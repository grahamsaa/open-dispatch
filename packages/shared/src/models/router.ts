import type { ModelProfile, RoutingDecision, ModelCapability } from '../types/model.js';
import { MODEL_REGISTRY, DEFAULT_MODEL } from './registry.js';

interface RoutingHints {
  hasImages?: boolean;
  needsEmbedding?: boolean;
  complexity?: 'low' | 'medium' | 'high';
  requiresReasoning?: boolean;
  preferFast?: boolean;
  preferredModel?: string;
}

export function routeTask(hints: RoutingHints): RoutingDecision {
  if (hints.preferredModel && MODEL_REGISTRY[hints.preferredModel]) {
    return { modelId: hints.preferredModel, reason: 'user-specified model' };
  }

  if (hints.hasImages) {
    return { modelId: 'qwen2.5-vl-72b', reason: 'vision capability required' };
  }

  if (hints.needsEmbedding) {
    return { modelId: 'text-embedding-nomic-embed-text-v1.5', reason: 'embedding task' };
  }

  if (hints.complexity === 'high' || hints.requiresReasoning) {
    return { modelId: 'qwen3.5-122b', reason: 'complex reasoning task' };
  }

  if (hints.complexity === 'low' || hints.preferFast) {
    return { modelId: 'qwen3.5-122b-a10b', reason: 'simple task, using fast MoE model' };
  }

  return { modelId: DEFAULT_MODEL, reason: 'default workhorse model' };
}

export function getModel(modelId: string): ModelProfile | undefined {
  return MODEL_REGISTRY[modelId];
}

export function listModels(): ModelProfile[] {
  return Object.values(MODEL_REGISTRY);
}

export function modelsWithCapability(cap: ModelCapability): ModelProfile[] {
  return Object.values(MODEL_REGISTRY).filter(m => m.capabilities.includes(cap));
}
