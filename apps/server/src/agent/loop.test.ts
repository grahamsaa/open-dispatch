import { describe, it, expect } from 'vitest';
import { PauseController } from './loop.js';

describe('PauseController', () => {
  it('starts unpaused', () => {
    const ctrl = new PauseController();
    expect(ctrl.paused).toBe(false);
  });

  it('can be paused', () => {
    const ctrl = new PauseController();
    ctrl.pause();
    expect(ctrl.paused).toBe(true);
  });

  it('can be resumed', () => {
    const ctrl = new PauseController();
    ctrl.pause();
    ctrl.resume();
    expect(ctrl.paused).toBe(false);
  });

  it('waitIfPaused resolves immediately when not paused', async () => {
    const ctrl = new PauseController();
    await ctrl.waitIfPaused(); // Should not hang
    expect(ctrl.paused).toBe(false);
  });

  it('waitIfPaused blocks until resumed', async () => {
    const ctrl = new PauseController();
    ctrl.pause();

    let resolved = false;
    const promise = ctrl.waitIfPaused().then(() => { resolved = true; });

    // Still paused
    await new Promise(r => setTimeout(r, 50));
    expect(resolved).toBe(false);

    // Resume
    ctrl.resume();
    await promise;
    expect(resolved).toBe(true);
  });
});
