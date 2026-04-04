import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ToolResult } from '@opendispatch/shared';
import { llm } from '../llm/client.js';

const execAsync = promisify(exec);
const MAX_SCREEN_STEPS = 15;
const VISION_MODEL = 'qwen2.5-vl-72b';

interface ScreenControlArgs {
  task: string;
  maxSteps?: number;
}

const SCREEN_SYSTEM_PROMPT = `You are a desktop automation agent controlling a macOS computer. You can see a screenshot of the current screen and must decide what action to take.

Respond with EXACTLY ONE JSON action. No explanation — just the JSON.

Available actions:
- {"action": "click", "x": 500, "y": 300} — click at screen coordinates
- {"action": "double_click", "x": 500, "y": 300} — double-click
- {"action": "right_click", "x": 500, "y": 300} — right-click
- {"action": "type", "text": "hello world"} — type text (uses keyboard)
- {"action": "key", "key": "return"|"tab"|"escape"|"space"|"delete"|"cmd+c"|"cmd+v"|"cmd+t"|"cmd+w"|"cmd+a"} — press a key or combo
- {"action": "scroll", "x": 500, "y": 300, "direction": "up"|"down", "clicks": 3} — scroll at position
- {"action": "move", "x": 500, "y": 300} — move mouse without clicking
- {"action": "drag", "fromX": 100, "fromY": 200, "toX": 300, "toY": 400} — drag from one point to another
- {"action": "wait", "ms": 2000} — wait for something to happen
- {"action": "screenshot"} — take another screenshot without acting (to re-examine)
- {"action": "done", "result": "description of what was accomplished"} — task complete
- {"action": "fail", "reason": "why it can't be done"} — give up

Guidelines:
- Coordinates are in screen pixels. The screenshot shows the full desktop.
- Click on buttons, links, menu items by identifying their position in the screenshot.
- After clicking, wait briefly and take a new screenshot to verify the result.
- For text input: click the field first, then type.
- Use keyboard shortcuts when efficient (cmd+t for new tab, cmd+l for address bar, etc.)
- If something isn't working, try a different approach.`;

export async function screenControl(args: ScreenControlArgs): Promise<ToolResult> {
  const maxSteps = args.maxSteps || MAX_SCREEN_STEPS;
  const stepLog: string[] = [];

  try {
    for (let step = 0; step < maxSteps; step++) {
      // Take screenshot
      const screenshotPath = join(tmpdir(), `opendispatch-screen-${Date.now()}.png`);
      try {
        await execAsync(`screencapture -x ${screenshotPath}`, { timeout: 5000 });
      } catch (err) {
        stepLog.push(`Step ${step + 1}: Screenshot failed: ${(err as Error).message}`);
        return {
          success: false,
          output: stepLog.join('\n'),
          error: 'Failed to capture screenshot. Ensure screen recording permission is granted.',
        };
      }

      // Read screenshot as base64
      const screenshotBuffer = await readFile(screenshotPath);
      const screenshotBase64 = screenshotBuffer.toString('base64');

      // Clean up screenshot file
      await unlink(screenshotPath).catch(() => {});

      // Send to vision model
      const response = await llm.chat.completions.create({
        model: VISION_MODEL,
        messages: [
          { role: 'system', content: SCREEN_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Task: ${args.task}\n\nStep ${step + 1} of ${maxSteps}. What action should I take?${
                  stepLog.length ? `\n\nPrevious actions:\n${stepLog.slice(-5).join('\n')}` : ''
                }`,
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${screenshotBase64}` },
              },
            ],
          },
        ],
        max_tokens: 256,
      });

      const content = response.choices[0]?.message?.content || '';
      const action = parseScreenAction(content);

      if (!action) {
        stepLog.push(`Step ${step + 1}: Failed to parse action from: ${content.slice(0, 200)}`);
        continue;
      }

      stepLog.push(`Step ${step + 1}: ${JSON.stringify(action)}`);

      if (action.action === 'done') {
        return {
          success: true,
          output: `Screen task completed in ${step + 1} steps.\n\nResult: ${action.result}\n\nSteps:\n${stepLog.join('\n')}`,
        };
      }

      if (action.action === 'fail') {
        return {
          success: false,
          output: `Screen task failed at step ${step + 1}: ${action.reason}\n\nSteps:\n${stepLog.join('\n')}`,
          error: action.reason,
        };
      }

      // Execute the action
      try {
        await executeScreenAction(action);
        // Wait for the action to take effect
        await new Promise(r => setTimeout(r, action.action === 'wait' ? (action.ms || 1000) : 800));
      } catch (err) {
        stepLog.push(`  Error: ${(err as Error).message}`);
      }
    }

    return {
      success: false,
      output: `Reached max steps (${maxSteps}).\n\nSteps:\n${stepLog.join('\n')}`,
      error: 'Max screen control steps reached',
    };
  } catch (err) {
    return {
      success: false,
      output: stepLog.join('\n'),
      error: `Screen control error: ${(err as Error).message}`,
    };
  }
}

export interface ScreenAction {
  action: string;
  x?: number;
  y?: number;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  text?: string;
  key?: string;
  direction?: string;
  clicks?: number;
  ms?: number;
  result?: string;
  reason?: string;
}

export function parseScreenAction(content: string): ScreenAction | null {
  // Try the whole content as JSON
  try {
    const parsed = JSON.parse(content.trim());
    if (parsed.action) return parsed;
  } catch {}

  // Try code block
  const codeBlock = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlock) {
    try {
      const parsed = JSON.parse(codeBlock[1].trim());
      if (parsed.action) return parsed;
    } catch {}
  }

  // Try finding JSON object in text
  const jsonMatch = content.match(/\{[^{}]*"action"\s*:\s*"[^"]+?"[^{}]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.action) return parsed;
    } catch {}
  }

  return null;
}

async function executeScreenAction(action: ScreenAction): Promise<void> {
  switch (action.action) {
    case 'click':
      validateCoords(action.x, action.y);
      await execAsync(`cliclick c:${action.x},${action.y}`);
      break;

    case 'double_click':
      validateCoords(action.x, action.y);
      await execAsync(`cliclick dc:${action.x},${action.y}`);
      break;

    case 'right_click':
      validateCoords(action.x, action.y);
      await execAsync(`cliclick rc:${action.x},${action.y}`);
      break;

    case 'type':
      if (!action.text) throw new Error('type requires text');
      // cliclick t: types text. Escape special chars.
      const escaped = action.text.replace(/"/g, '\\"');
      await execAsync(`cliclick t:"${escaped}"`);
      break;

    case 'key':
      if (!action.key) throw new Error('key requires key name');
      await pressKey(action.key);
      break;

    case 'scroll':
      validateCoords(action.x, action.y);
      const clicks = action.clicks || 3;
      const dir = action.direction === 'up' ? '+' : '-';
      // Move to position first, then scroll
      await execAsync(`cliclick m:${action.x},${action.y}`);
      // Use AppleScript for scrolling since cliclick doesn't support it well
      const scrollAmount = action.direction === 'up' ? clicks : -clicks;
      await execAsync(`osascript -e 'tell application "System Events" to scroll area 1 of front window of first application process whose frontmost is true'`).catch(() => {
        // Fallback: use key-based scrolling
        return execAsync(`cliclick ${Array(clicks).fill(`kp:${action.direction === 'up' ? 'arrow-up' : 'arrow-down'}`).join(' ')}`);
      });
      break;

    case 'move':
      validateCoords(action.x, action.y);
      await execAsync(`cliclick m:${action.x},${action.y}`);
      break;

    case 'drag':
      validateCoords(action.fromX, action.fromY);
      validateCoords(action.toX, action.toY);
      await execAsync(`cliclick dd:${action.fromX},${action.fromY} du:${action.toX},${action.toY}`);
      break;

    case 'wait':
      // Handled by caller
      break;

    case 'screenshot':
      // No-op — next iteration will take a screenshot
      break;

    default:
      throw new Error(`Unknown screen action: ${action.action}`);
  }
}

function validateCoords(x?: number, y?: number): void {
  if (x === undefined || y === undefined) throw new Error('Action requires x and y coordinates');
  if (x < 0 || y < 0) throw new Error('Coordinates must be non-negative');
  if (x > 10000 || y > 10000) throw new Error('Coordinates seem too large');
}

async function pressKey(key: string): Promise<void> {
  // Map common key names to cliclick key press syntax
  // cliclick uses kp: for key press
  // For modifier combos, use AppleScript
  if (key.includes('+')) {
    // Modifier combo like cmd+c, cmd+v, cmd+t
    const parts = key.toLowerCase().split('+');
    const modifiers: string[] = [];
    let mainKey = parts[parts.length - 1];

    for (const part of parts.slice(0, -1)) {
      switch (part) {
        case 'cmd': case 'command': modifiers.push('command down'); break;
        case 'ctrl': case 'control': modifiers.push('control down'); break;
        case 'alt': case 'option': modifiers.push('option down'); break;
        case 'shift': modifiers.push('shift down'); break;
      }
    }

    // Map key names to AppleScript key codes
    const keyMap: Record<string, string> = {
      'a': 'keystroke "a"', 'c': 'keystroke "c"', 'v': 'keystroke "v"',
      'x': 'keystroke "x"', 'z': 'keystroke "z"', 't': 'keystroke "t"',
      'w': 'keystroke "w"', 'l': 'keystroke "l"', 'n': 'keystroke "n"',
      'f': 'keystroke "f"', 's': 'keystroke "s"', 'q': 'keystroke "q"',
      'tab': 'key code 48', 'return': 'key code 36', 'space': 'key code 49',
      'delete': 'key code 51', 'escape': 'key code 53',
    };

    const keystroke = keyMap[mainKey] || `keystroke "${mainKey}"`;
    const modStr = modifiers.length ? ` using {${modifiers.join(', ')}}` : '';
    await execAsync(`osascript -e 'tell application "System Events" to ${keystroke}${modStr}'`);
  } else {
    // Single key
    const keyMap: Record<string, string> = {
      'return': 'return', 'enter': 'return',
      'tab': 'tab', 'escape': 'escape', 'space': 'space',
      'delete': 'delete', 'backspace': 'delete',
      'up': 'arrow-up', 'down': 'arrow-down',
      'left': 'arrow-left', 'right': 'arrow-right',
    };
    const mapped = keyMap[key.toLowerCase()] || key;
    await execAsync(`cliclick kp:${mapped}`);
  }
}
