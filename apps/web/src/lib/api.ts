function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window === 'undefined') return 'http://localhost:3456';
  // Derive API server host from the browser's current hostname
  // so it works from iPads, phones, and other devices on the network
  return `http://${window.location.hostname}:3456`;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
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
  const base = getApiBase().replace(/^http/, 'ws');
  return `${base}/ws`;
}
