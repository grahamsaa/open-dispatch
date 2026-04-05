import type { ModelProfile, RoutingDecision, ModelCapability } from '../types/model.js';
import { DEFAULT_MODEL } from './registry.js';

interface RoutingHints {
  hasImages?: boolean;
  needsEmbedding?: boolean;
  complexity?: 'low' | 'medium' | 'high';
  requiresReasoning?: boolean;
  preferFast?: boolean;
  preferredModel?: string;
}

export function routeTask(hints: RoutingHints, registry: Record<string, ModelProfile> = {}): RoutingDecision {
  if (hints.preferredModel && registry[hints.preferredModel]) {
    return { modelId: hints.preferredModel, reason: 'user-specified model' };
  }

  // Find models by capability from whatever is available
  const withCap = (cap: string) => Object.values(registry).filter(m => m.capabilities.includes(cap as ModelCapability));
  const withSpeed = (speed: string) => Object.values(registry).filter(m => m.speed === speed);

  if (hints.hasImages) {
    const visionModels = withCap('vision');
    if (visionModels.length > 0) return { modelId: visionModels[0].id, reason: 'vision capability required' };
  }

  if (hints.needsEmbedding) {
    const embeddingModels = withCap('embedding');
    if (embeddingModels.length > 0) return { modelId: embeddingModels[0].id, reason: 'embedding task' };
  }

  if (hints.complexity === 'high' || hints.requiresReasoning) {
    // Pick highest-quality reasoning model
    const reasoningModels = withCap('reasoning').sort((a, b) => b.cost - a.cost);
    if (reasoningModels.length > 0) return { modelId: reasoningModels[0].id, reason: 'complex reasoning task' };
  }

  if (hints.complexity === 'low' || hints.preferFast) {
    const fastModels = withSpeed('fast').sort((a, b) => a.cost - b.cost);
    if (fastModels.length > 0) return { modelId: fastModels[0].id, reason: 'simple task, using fast model' };
  }

  // Default: prefer DEFAULT_MODEL if available, otherwise cheapest general model
  if (registry[DEFAULT_MODEL]) {
    return { modelId: DEFAULT_MODEL, reason: 'default workhorse model' };
  }
  const general = Object.values(registry).filter(m => m.capabilities.includes('general')).sort((a, b) => a.cost - b.cost);
  if (general.length > 0) return { modelId: general[0].id, reason: 'best available general model' };

  return { modelId: DEFAULT_MODEL, reason: 'default model (not found in registry)' };
}

export function getModel(modelId: string, registry: Record<string, ModelProfile> = {}): ModelProfile | undefined {
  return registry[modelId];
}

export function listModels(registry: Record<string, ModelProfile> = {}): ModelProfile[] {
  return Object.values(registry);
}

export function modelsWithCapability(cap: ModelCapability, registry: Record<string, ModelProfile> = {}): ModelProfile[] {
  return Object.values(registry).filter(m => m.capabilities.includes(cap));
}
