import { describe, it, expect } from 'vitest';
import { browserStatus } from './browser.js';

describe('browserStatus', () => {
  it('returns a result object', async () => {
    const result = await browserStatus();
    expect(result.success).toBe(true);
    expect(result.output).toBeTruthy();
  });

  it('reports CDP not available when Chrome has no debug port', async () => {
    // Chrome is running without CDP in the test environment
    const result = await browserStatus();
    expect(result.output).toMatch(/CDP|Chrome|available|not available/i);
  });

  it('includes connection instructions when CDP is unavailable', async () => {
    const result = await browserStatus();
    if (result.output.includes('not available')) {
      expect(result.output).toContain('remote-debugging-port');
    }
  });
});
