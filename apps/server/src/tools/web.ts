import type { ToolResult } from '@opendispatch/shared';

const MAX_RESPONSE = 50_000;

interface WebFetchArgs {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export async function webFetch(args: WebFetchArgs): Promise<ToolResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const response = await fetch(args.url, {
      method: (args.method || 'GET') as string,
      headers: args.headers,
      body: args.body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') || '';
    let body: string;

    if (contentType.includes('application/json')) {
      body = JSON.stringify(await response.json(), null, 2);
    } else {
      body = await response.text();
    }

    if (body.length > MAX_RESPONSE) {
      body = body.slice(0, MAX_RESPONSE) + '\n... (truncated)';
    }

    return {
      success: response.ok,
      output: `HTTP ${response.status} ${response.statusText}\nContent-Type: ${contentType}\n\n${body}`,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (err) {
    return { success: false, output: '', error: `Fetch failed: ${(err as Error).message}` };
  }
}
