import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import type { ToolResult } from '@opendispatch/shared';
import { chatCompletion } from '../llm/completion.js';
import type { ChatMessage } from '@opendispatch/shared';

const MAX_BROWSER_STEPS = 20;
const CDP_ENDPOINT = process.env.CDP_URL || 'http://localhost:9222';

// ── Browser Connection ──
// Priority:
// 1. CDP connection to user's Chrome (has auth sessions, cookies, etc.)
// 2. Standalone Chromium (fresh, no sessions)

let browserInstance: Browser | null = null;
let browserContext: BrowserContext | null = null;
let connectionMode: 'cdp' | 'standalone' | null = null;

async function getBrowser(): Promise<{ context: BrowserContext; mode: 'cdp' | 'standalone' }> {
  if (browserContext && browserInstance?.isConnected()) {
    return { context: browserContext, mode: connectionMode! };
  }

  // Try CDP first — connects to user's running Chrome
  try {
    browserInstance = await chromium.connectOverCDP(CDP_ENDPOINT, { timeout: 3000 });
    const contexts = browserInstance.contexts();
    browserContext = contexts[0] || await browserInstance.newContext();
    connectionMode = 'cdp';
    return { context: browserContext, mode: 'cdp' };
  } catch {
    // CDP not available — fall back to standalone
  }

  // Standalone Chromium
  browserInstance = await chromium.launch({
    headless: false,
    args: ['--window-size=1280,900'],
  });
  browserContext = await browserInstance.newContext({
    viewport: { width: 1280, height: 900 },
  });
  connectionMode = 'standalone';
  return { context: browserContext, mode: 'standalone' };
}

interface BrowserNavigateArgs {
  task: string;
  startUrl?: string;
  model?: string;
}

const BROWSER_SYSTEM_PROMPT = `You are a browser automation agent. You are given a simplified view of a web page and a task to accomplish.

You must respond with EXACTLY ONE JSON action block. No explanation, no markdown — just the JSON.

Available actions:
- {"action": "click", "selector": "CSS selector"} — click an element
- {"action": "fill", "selector": "CSS selector", "value": "text"} — type into an input
- {"action": "select", "selector": "CSS selector", "value": "option value"} — select dropdown option
- {"action": "navigate", "url": "https://..."} — go to a URL
- {"action": "scroll", "direction": "down"|"up"} — scroll the page
- {"action": "wait", "ms": 1000} — wait for content to load
- {"action": "press", "key": "Enter"|"Tab"|"Escape"} — press a key
- {"action": "done", "result": "summary of what was accomplished"} — task is complete
- {"action": "fail", "reason": "why the task cannot be completed"} — give up

Rules:
- Use specific CSS selectors. Prefer [data-*], [aria-label], #id, then tag+text content.
- If a page hasn't loaded yet, use {"action": "wait", "ms": 2000}.
- If you need to click a link or button, find its selector from the page snapshot.
- After filling a form field, you may need to click a submit button or press Enter.
- If the page content doesn't seem right for the task, re-navigate.
- You are operating inside the user's real Chrome browser with their authenticated sessions. If a site shows you a logged-in state, you can use it directly.`;

export async function browserNavigate(args: BrowserNavigateArgs, defaultCwd: string): Promise<ToolResult> {
  const model = args.model || 'qwen3.5-122b-a10b';

  try {
    const { context: ctx, mode } = await getBrowser();
    const page = await ctx.newPage();

    if (args.startUrl) {
      await page.goto(args.startUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: BROWSER_SYSTEM_PROMPT },
    ];

    const stepLog: string[] = [];
    stepLog.push(`Browser mode: ${mode}${mode === 'cdp' ? ' (using Chrome sessions)' : ' (standalone, no sessions)'}`);

    for (let step = 0; step < MAX_BROWSER_STEPS; step++) {
      const snapshot = await extractPageSnapshot(page);
      const currentUrl = page.url();

      messages.push({
        role: 'user',
        content: `Task: ${args.task}\n\nCurrent URL: ${currentUrl}\n\nPage snapshot:\n${snapshot}`,
      });

      const response = await chatCompletion({ model, messages, maxTokens: 512 });
      const content = response.content || '';

      messages.push({ role: 'assistant', content });

      const action = parseAction(content);
      if (!action) {
        stepLog.push(`Step ${step + 1}: Failed to parse action from: ${content.slice(0, 200)}`);
        continue;
      }

      stepLog.push(`Step ${step + 1}: ${JSON.stringify(action)}`);

      if (action.action === 'done') {
        await page.close();
        return {
          success: true,
          output: `Browser task completed in ${step + 1} steps.\n\nResult: ${action.result}\n\nSteps:\n${stepLog.join('\n')}`,
        };
      }

      if (action.action === 'fail') {
        await page.close();
        return {
          success: false,
          output: `Browser task failed at step ${step + 1}: ${action.reason}\n\nSteps:\n${stepLog.join('\n')}`,
          error: action.reason,
        };
      }

      try {
        await executeAction(page, action);
        await page.waitForTimeout(500);
      } catch (err) {
        const errMsg = (err as Error).message;
        stepLog.push(`  Error: ${errMsg}`);
        messages.push({
          role: 'user',
          content: `Action failed with error: ${errMsg}. Try a different approach.`,
        });
      }
    }

    await page.close();
    return {
      success: false,
      output: `Reached max steps (${MAX_BROWSER_STEPS}).\n\nSteps:\n${stepLog.join('\n')}`,
      error: 'Max browser steps reached',
    };
  } catch (err) {
    return {
      success: false,
      output: '',
      error: `Browser error: ${(err as Error).message}`,
    };
  }
}

async function extractPageSnapshot(page: Page): Promise<string> {
  const snapshot = await page.evaluate(() => {
    const MAX_ELEMENTS = 150;
    const elements: string[] = [];
    let count = 0;

    const selectors = [
      'a[href]', 'button', 'input', 'textarea', 'select',
      'h1', 'h2', 'h3', 'h4', '[role="button"]', '[role="link"]',
      '[role="tab"]', '[role="menuitem"]', '[role="checkbox"]',
      '[role="radio"]', '[role="switch"]', '[role="search"]',
      'label', 'nav', 'main', 'form',
    ];

    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (count >= MAX_ELEMENTS) break;

        const htmlEl = el as HTMLElement;
        if (!htmlEl.offsetParent && htmlEl.tagName !== 'BODY') continue;

        const tag = htmlEl.tagName.toLowerCase();
        const text = (htmlEl.textContent || '').trim().slice(0, 80);
        const attrs: string[] = [];

        if (htmlEl.id) attrs.push(`id="${htmlEl.id}"`);
        if (htmlEl.getAttribute('name')) attrs.push(`name="${htmlEl.getAttribute('name')}"`);
        if (htmlEl.getAttribute('aria-label')) attrs.push(`aria-label="${htmlEl.getAttribute('aria-label')}"`);
        if (htmlEl.getAttribute('placeholder')) attrs.push(`placeholder="${htmlEl.getAttribute('placeholder')}"`);
        if (htmlEl.getAttribute('href')) attrs.push(`href="${htmlEl.getAttribute('href')!.slice(0, 100)}"`);
        if (htmlEl.getAttribute('type')) attrs.push(`type="${htmlEl.getAttribute('type')}"`);
        if (htmlEl.getAttribute('value')) attrs.push(`value="${htmlEl.getAttribute('value')!.slice(0, 50)}"`);
        if (htmlEl.getAttribute('role')) attrs.push(`role="${htmlEl.getAttribute('role')}"`);
        if ((htmlEl as HTMLInputElement).checked !== undefined && (htmlEl as HTMLInputElement).checked) attrs.push('checked');
        if (htmlEl.getAttribute('disabled') !== null) attrs.push('disabled');
        if (htmlEl.getAttribute('data-testid')) attrs.push(`data-testid="${htmlEl.getAttribute('data-testid')}"`);

        const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';
        elements.push(`<${tag}${attrStr}>${text}</${tag}>`);
        count++;
      }
      if (count >= MAX_ELEMENTS) break;
    }

    const title = document.title;
    const mainText = (document.querySelector('main, article, [role="main"]') as HTMLElement)?.textContent?.trim().slice(0, 500) || '';

    return `Title: ${title}\n\nMain content:\n${mainText}\n\nInteractive elements:\n${elements.join('\n')}`;
  });

  return snapshot.slice(0, 8000);
}

interface BrowserAction {
  action: string;
  selector?: string;
  value?: string;
  url?: string;
  direction?: string;
  ms?: number;
  key?: string;
  result?: string;
  reason?: string;
}

function parseAction(content: string): BrowserAction | null {
  try {
    const parsed = JSON.parse(content.trim());
    if (parsed.action) return parsed;
  } catch {}

  const codeBlock = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlock) {
    try {
      const parsed = JSON.parse(codeBlock[1].trim());
      if (parsed.action) return parsed;
    } catch {}
  }

  const jsonMatch = content.match(/\{[^{}]*"action"\s*:\s*"[^"]+?"[^{}]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.action) return parsed;
    } catch {}
  }

  return null;
}

async function executeAction(page: Page, action: BrowserAction): Promise<void> {
  switch (action.action) {
    case 'click':
      if (!action.selector) throw new Error('click requires a selector');
      await page.locator(action.selector).first().click({ timeout: 5000 });
      break;

    case 'fill':
      if (!action.selector || action.value === undefined) throw new Error('fill requires selector and value');
      await page.locator(action.selector).first().fill(action.value, { timeout: 5000 });
      break;

    case 'select':
      if (!action.selector || !action.value) throw new Error('select requires selector and value');
      await page.locator(action.selector).first().selectOption(action.value, { timeout: 5000 });
      break;

    case 'navigate':
      if (!action.url) throw new Error('navigate requires a url');
      await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      break;

    case 'scroll':
      if (action.direction === 'up') {
        await page.evaluate(() => window.scrollBy(0, -500));
      } else {
        await page.evaluate(() => window.scrollBy(0, 500));
      }
      break;

    case 'wait':
      await page.waitForTimeout(action.ms || 1000);
      break;

    case 'press':
      if (!action.key) throw new Error('press requires a key');
      await page.keyboard.press(action.key);
      break;

    default:
      throw new Error(`Unknown action: ${action.action}`);
  }
}

export async function browserGetPage(): Promise<ToolResult> {
  try {
    const { context: ctx, mode } = await getBrowser();
    const pages = ctx.pages();
    if (pages.length === 0) {
      return { success: true, output: `Browser connected (${mode}). No pages open.` };
    }
    const page = pages[pages.length - 1];
    const snapshot = await extractPageSnapshot(page);
    return {
      success: true,
      output: `Browser mode: ${mode}\nCurrent URL: ${page.url()}\n\n${snapshot}`,
    };
  } catch (err) {
    return { success: false, output: '', error: `Browser error: ${(err as Error).message}` };
  }
}

export async function browserStatus(): Promise<ToolResult> {
  try {
    // Quick check: is CDP available?
    const response = await fetch(`${CDP_ENDPOINT}/json/version`, { signal: AbortSignal.timeout(2000) });
    if (response.ok) {
      const info = await response.json() as { Browser?: string; webSocketDebuggerUrl?: string };
      return {
        success: true,
        output: `Chrome CDP available at ${CDP_ENDPOINT}\nBrowser: ${info.Browser || 'unknown'}\nWebSocket: ${info.webSocketDebuggerUrl || 'unknown'}\n\nBrowser will connect via CDP with your authenticated sessions.`,
      };
    }
    return {
      success: true,
      output: `Chrome CDP not available at ${CDP_ENDPOINT}.\n\nTo enable authenticated browsing, restart Chrome with:\n  open -a "Google Chrome" --args --remote-debugging-port=9222\n\nOr run: npm run chrome (from the open-dispatch directory)\n\nFalling back to standalone Chromium (no saved sessions).`,
    };
  } catch {
    return {
      success: true,
      output: `Chrome CDP not available at ${CDP_ENDPOINT}.\n\nTo enable authenticated browsing, restart Chrome with:\n  open -a "Google Chrome" --args --remote-debugging-port=9222\n\nFalling back to standalone Chromium (no saved sessions).`,
    };
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance && connectionMode === 'standalone') {
    await browserInstance.close();
  }
  // For CDP, we disconnect but don't close the user's Chrome
  if (browserInstance && connectionMode === 'cdp') {
    browserInstance.close().catch(() => {});
  }
  browserInstance = null;
  browserContext = null;
  connectionMode = null;
}

// Export for testing
export { extractPageSnapshot as _extractPageSnapshot, parseAction as _parseAction };
