import { describe, it, expect } from 'vitest';
import { routeTask, getModel, listModels, modelsWithCapability } from './router.js';
import { MODEL_REGISTRY } from './registry.js';

describe('routeTask', () => {
  it('returns user-specified model when provided', () => {
    const result = routeTask({ preferredModel: 'llama-3.3-70b' });
    expect(result.modelId).toBe('llama-3.3-70b');
    expect(result.reason).toBe('user-specified model');
  });

  it('ignores unknown preferred model', () => {
    const result = routeTask({ preferredModel: 'nonexistent-model' });
    expect(result.modelId).not.toBe('nonexistent-model');
  });

  it('routes vision tasks to qwen2.5-vl-72b', () => {
    const result = routeTask({ hasImages: true });
    expect(result.modelId).toBe('qwen2.5-vl-72b');
  });

  it('routes embedding tasks to nomic', () => {
    const result = routeTask({ needsEmbedding: true });
    expect(result.modelId).toBe('text-embedding-nomic-embed-text-v1.5');
  });

  it('routes high complexity to qwen3.5-122b', () => {
    const result = routeTask({ complexity: 'high' });
    expect(result.modelId).toBe('qwen3.5-122b');
  });

  it('routes reasoning tasks to qwen3.5-122b', () => {
    const result = routeTask({ requiresReasoning: true });
    expect(result.modelId).toBe('qwen3.5-122b');
  });

  it('routes low complexity to fast MoE model', () => {
    const result = routeTask({ complexity: 'low' });
    expect(result.modelId).toBe('qwen3.5-122b-a10b');
  });

  it('routes fast preference to MoE model', () => {
    const result = routeTask({ preferFast: true });
    expect(result.modelId).toBe('qwen3.5-122b-a10b');
  });

  it('returns default model when no hints provided', () => {
    const result = routeTask({});
    expect(result.modelId).toBeDefined();
    expect(result.reason).toBeDefined();
  });

  it('vision takes priority over complexity', () => {
    const result = routeTask({ hasImages: true, complexity: 'low' });
    expect(result.modelId).toBe('qwen2.5-vl-72b');
  });
});

describe('getModel', () => {
  it('returns model profile for known model', () => {
    const model = getModel('qwen3.5-9b-mlx');
    expect(model).toBeDefined();
    expect(model!.name).toBe('Qwen 3.5 9B');
    expect(model!.speed).toBe('fast');
  });

  it('returns undefined for unknown model', () => {
    expect(getModel('nonexistent')).toBeUndefined();
  });
});

describe('listModels', () => {
  it('returns all registered models', () => {
    const models = listModels();
    expect(models.length).toBe(Object.keys(MODEL_REGISTRY).length);
    expect(models.length).toBeGreaterThan(0);
  });
});

describe('modelsWithCapability', () => {
  it('returns vision models', () => {
    const models = modelsWithCapability('vision');
    expect(models.length).toBeGreaterThan(0);
    expect(models.every(m => m.capabilities.includes('vision'))).toBe(true);
  });

  it('returns embedding models', () => {
    const models = modelsWithCapability('embedding');
    expect(models.length).toBe(1);
    expect(models[0].id).toBe('text-embedding-nomic-embed-text-v1.5');
  });

  it('returns code-capable models', () => {
    const models = modelsWithCapability('code');
    expect(models.length).toBeGreaterThan(3);
  });
});
