import { describe, it, expect } from 'vitest';
import { webFetch } from './web.js';

describe('webFetch', () => {
  it('fetches a URL successfully', async () => {
    // Use the LMStudio health endpoint as a reliable local target
    const result = await webFetch({ url: 'http://localhost:1234/v1/models' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('HTTP 200');
  });

  it('handles connection errors gracefully', async () => {
    const result = await webFetch({ url: 'http://localhost:99999/nope' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Fetch failed');
  });
});
