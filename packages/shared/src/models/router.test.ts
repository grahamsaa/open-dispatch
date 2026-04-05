import { describe, it, expect } from 'vitest';
import { routeTask, getModel, listModels, modelsWithCapability } from './router.js';
import { buildRegistry, type LMStudioModelInfo } from './registry.js';

// Build a test registry from sample LMStudio data
const SAMPLE_MODELS: LMStudioModelInfo[] = [
  { id: 'qwen3.5-122b-a10b', arch: 'qwen3_5_moe', quantization: '8bit', max_context_length: 262144, capabilities: ['tool_use'] },
  { id: 'qwen3.5-9b-mlx', arch: 'qwen3_5', quantization: '4bit', max_context_length: 262144, capabilities: ['tool_use'] },
  { id: 'qwen3.5-122b', arch: 'qwen3_5_moe', quantization: '4bit', max_context_length: 262144, capabilities: ['tool_use'] },
  { id: 'llama-3.3-70b', arch: 'llama', quantization: '8bit', max_context_length: 131072, capabilities: ['tool_use'] },
  { id: 'qwen2.5-vl-72b', arch: 'qwen2_5_vl', quantization: '8bit', max_context_length: 128000, capabilities: [], type: 'vlm' },
  { id: 'text-embedding-nomic-embed-text-v1.5', arch: 'nomic-bert', quantization: 'Q4_K_M', max_context_length: 2048, capabilities: [] },
  { id: 'qwen3-235b-thinking', arch: 'qwen3_moe', quantization: '8bit', max_context_length: 262144, capabilities: ['tool_use'] },
];

const registry = buildRegistry(SAMPLE_MODELS);

describe('routeTask', () => {
  it('returns user-specified model when provided', () => {
    const result = routeTask({ preferredModel: 'llama-3.3-70b' }, registry);
    expect(result.modelId).toBe('llama-3.3-70b');
    expect(result.reason).toBe('user-specified model');
  });

  it('ignores unknown preferred model', () => {
    const result = routeTask({ preferredModel: 'nonexistent-model' }, registry);
    expect(result.modelId).not.toBe('nonexistent-model');
  });

  it('routes vision tasks to a vision model', () => {
    const result = routeTask({ hasImages: true }, registry);
    expect(result.modelId).toBe('qwen2.5-vl-72b');
  });

  it('routes embedding tasks to embedding model', () => {
    const result = routeTask({ needsEmbedding: true }, registry);
    expect(result.modelId).toBe('text-embedding-nomic-embed-text-v1.5');
  });

  it('routes high complexity to highest-cost reasoning model', () => {
    const result = routeTask({ complexity: 'high' }, registry);
    expect(registry[result.modelId].capabilities).toContain('reasoning');
  });

  it('routes reasoning tasks to a reasoning model', () => {
    const result = routeTask({ requiresReasoning: true }, registry);
    expect(registry[result.modelId].capabilities).toContain('reasoning');
  });

  it('routes low complexity to a fast model', () => {
    const result = routeTask({ complexity: 'low' }, registry);
    expect(registry[result.modelId].speed).toBe('fast');
  });

  it('routes fast preference to a fast model', () => {
    const result = routeTask({ preferFast: true }, registry);
    expect(registry[result.modelId].speed).toBe('fast');
  });

  it('returns default model when no hints provided', () => {
    const result = routeTask({}, registry);
    expect(result.modelId).toBe('qwen3.5-122b-a10b');
    expect(result.reason).toBeDefined();
  });

  it('vision takes priority over complexity', () => {
    const result = routeTask({ hasImages: true, complexity: 'low' }, registry);
    expect(registry[result.modelId].capabilities).toContain('vision');
  });
});

describe('getModel', () => {
  it('returns model profile for known model', () => {
    const model = getModel('qwen3.5-9b-mlx', registry);
    expect(model).toBeDefined();
    expect(model!.speed).toBe('fast');
  });

  it('returns undefined for unknown model', () => {
    expect(getModel('nonexistent', registry)).toBeUndefined();
  });
});

describe('listModels', () => {
  it('returns all registered models', () => {
    const models = listModels(registry);
    expect(models.length).toBe(SAMPLE_MODELS.length);
    expect(models.length).toBeGreaterThan(0);
  });
});

describe('modelsWithCapability', () => {
  it('returns vision models', () => {
    const models = modelsWithCapability('vision', registry);
    expect(models.length).toBeGreaterThan(0);
    expect(models.every(m => m.capabilities.includes('vision'))).toBe(true);
  });

  it('returns embedding models', () => {
    const models = modelsWithCapability('embedding', registry);
    expect(models.length).toBe(1);
    expect(models[0].id).toBe('text-embedding-nomic-embed-text-v1.5');
  });

  it('returns code-capable models', () => {
    const models = modelsWithCapability('code', registry);
    expect(models.length).toBeGreaterThan(3);
  });
});
