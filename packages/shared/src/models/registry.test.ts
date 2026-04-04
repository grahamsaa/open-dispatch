import { describe, it, expect } from 'vitest';
import { MODEL_REGISTRY, DEFAULT_MODEL } from './registry.js';

describe('MODEL_REGISTRY', () => {
  it('has a default model that exists in the registry', () => {
    expect(MODEL_REGISTRY[DEFAULT_MODEL]).toBeDefined();
  });

  it('all models have required fields', () => {
    for (const [id, model] of Object.entries(MODEL_REGISTRY)) {
      expect(model.id).toBe(id);
      expect(model.name).toBeTruthy();
      expect(model.capabilities.length).toBeGreaterThan(0);
      expect(model.contextWindow).toBeGreaterThan(0);
      expect(['fast', 'medium', 'slow']).toContain(model.speed);
      expect(['low', 'medium', 'high']).toContain(model.quality);
      expect(typeof model.supportsToolCalls).toBe('boolean');
      expect(model.cost).toBeGreaterThan(0);
    }
  });

  it('has at least one vision model', () => {
    const visionModels = Object.values(MODEL_REGISTRY).filter(m => m.capabilities.includes('vision'));
    expect(visionModels.length).toBeGreaterThan(0);
  });

  it('has at least one embedding model', () => {
    const embeddingModels = Object.values(MODEL_REGISTRY).filter(m => m.capabilities.includes('embedding'));
    expect(embeddingModels.length).toBeGreaterThan(0);
  });

  it('has at least one fast model', () => {
    const fastModels = Object.values(MODEL_REGISTRY).filter(m => m.speed === 'fast');
    expect(fastModels.length).toBeGreaterThan(0);
  });

  it('has models that do not support tool calls', () => {
    const noTools = Object.values(MODEL_REGISTRY).filter(m => !m.supportsToolCalls);
    expect(noTools.length).toBeGreaterThan(0);
  });

  it('contains the expected number of models', () => {
    expect(Object.keys(MODEL_REGISTRY).length).toBe(11);
  });
});
