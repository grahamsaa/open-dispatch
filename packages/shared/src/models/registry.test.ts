import { describe, it, expect } from 'vitest';
import { buildModelProfile, buildRegistry, DEFAULT_MODEL, type LMStudioModelInfo } from './registry.js';

const SAMPLE_MODELS: LMStudioModelInfo[] = [
  { id: 'qwen3.5-122b-a10b', arch: 'qwen3_5_moe', quantization: '8bit', max_context_length: 262144, capabilities: ['tool_use'], type: 'vlm' },
  { id: 'qwen3.5-9b-mlx', arch: 'qwen3_5', quantization: '4bit', max_context_length: 262144, capabilities: ['tool_use'], type: 'llm' },
  { id: 'llama-3.3-70b', arch: 'llama', quantization: '8bit', max_context_length: 131072, capabilities: ['tool_use'], type: 'llm' },
  { id: 'qwen2.5-vl-72b', arch: 'qwen2_5_vl', quantization: '8bit', max_context_length: 128000, capabilities: [], type: 'vlm' },
  { id: 'text-embedding-nomic-embed-text-v1.5', arch: 'nomic-bert', quantization: 'Q4_K_M', max_context_length: 2048, capabilities: [], type: 'llm' },
  { id: 'qwen3-235b-thinking', arch: 'qwen3_moe', quantization: '8bit', max_context_length: 262144, capabilities: ['tool_use'], type: 'llm' },
  { id: 'wizardlm-2-8x22b', arch: 'mixtral', quantization: '4bit', max_context_length: 65536, capabilities: [], type: 'llm' },
];

describe('buildModelProfile', () => {
  it('infers MoE properties from model ID with active params', () => {
    const profile = buildModelProfile(SAMPLE_MODELS[0]);
    expect(profile.id).toBe('qwen3.5-122b-a10b');
    expect(profile.speed).toBe('fast'); // 10B active
    expect(profile.capabilities).toContain('fast');
    expect(profile.cost).toBeLessThan(5); // MoE is cheap
    expect(profile.supportsToolCalls).toBe(true);
  });

  it('infers small model properties', () => {
    const profile = buildModelProfile(SAMPLE_MODELS[1]);
    expect(profile.id).toBe('qwen3.5-9b-mlx');
    expect(profile.speed).toBe('fast');
    expect(profile.quality).toBe('low');
    expect(profile.capabilities).toContain('fast');
  });

  it('infers large dense model properties', () => {
    const profile = buildModelProfile(SAMPLE_MODELS[2]);
    expect(profile.id).toBe('llama-3.3-70b');
    expect(profile.quality).toBe('high');
    expect(profile.minContextLength).toBe(65536);
    expect(profile.capabilities).toContain('reasoning');
  });

  it('detects vision models', () => {
    const profile = buildModelProfile(SAMPLE_MODELS[3]);
    expect(profile.capabilities).toContain('vision');
  });

  it('detects embedding models', () => {
    const profile = buildModelProfile(SAMPLE_MODELS[4]);
    expect(profile.capabilities).toEqual(['embedding']);
    expect(profile.supportsToolCalls).toBe(false);
    expect(profile.minContextLength).toBe(2048);
    expect(profile.cost).toBeLessThanOrEqual(5);
  });

  it('handles MoE models with 8x22b pattern', () => {
    const profile = buildModelProfile(SAMPLE_MODELS[6]);
    expect(profile.id).toBe('wizardlm-2-8x22b');
    expect(profile.quality).toBe('high'); // 176B total
  });

  it('uses LMStudio tool_use capability', () => {
    const withTools = buildModelProfile({ id: 'test-7b', capabilities: ['tool_use'] });
    expect(withTools.supportsToolCalls).toBe(true);

    const noTools = buildModelProfile({ id: 'test-7b', capabilities: [] });
    expect(noTools.supportsToolCalls).toBe(false);
  });

  it('uses max_context_length from LMStudio', () => {
    const profile = buildModelProfile({ id: 'test-7b', max_context_length: 131072 });
    expect(profile.contextWindow).toBe(131072);
  });

  it('generates a readable name', () => {
    const profile = buildModelProfile(SAMPLE_MODELS[0]);
    expect(profile.name.toLowerCase()).toContain('122b');
    expect(profile.name).toContain('10B active');
  });
});

describe('buildRegistry', () => {
  it('builds a complete registry from model list', () => {
    const registry = buildRegistry(SAMPLE_MODELS);
    expect(Object.keys(registry)).toHaveLength(SAMPLE_MODELS.length);
    for (const m of SAMPLE_MODELS) {
      expect(registry[m.id]).toBeDefined();
      expect(registry[m.id].id).toBe(m.id);
    }
  });

  it('all models have required fields', () => {
    const registry = buildRegistry(SAMPLE_MODELS);
    for (const [id, model] of Object.entries(registry)) {
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
});

describe('DEFAULT_MODEL', () => {
  it('is a valid string', () => {
    expect(DEFAULT_MODEL).toBe('qwen3.5-122b-a10b');
  });
});
