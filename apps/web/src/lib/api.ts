const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3456';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json();
}

export function wsUrl(): string {
  const base = API_BASE.replace(/^http/, 'ws');
  return `${base}/ws`;
}
