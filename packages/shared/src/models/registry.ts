import type { ModelProfile, ModelCapability, ModelSpeed, ModelQuality } from '../types/model.js';

export const DEFAULT_MODEL = 'qwen3.5-122b-a10b';

/** Raw model info from LMStudio /api/v0/models */
export interface LMStudioModelInfo {
  id: string;
  arch?: string;
  quantization?: string;
  max_context_length?: number;
  capabilities?: string[];
  type?: string; // 'llm' | 'vlm' | 'embedding'
}

/** Parse parameter count from model ID (e.g. "qwen3.5-122b-a10b" → 122) */
function parseParamBillions(id: string): number | null {
  // Match patterns like "122b", "9b", "235b", "70b", "32b", "8x22b" (MoE total)
  const moeMatch = id.match(/(\d+)x(\d+)b/i);
  if (moeMatch) return parseInt(moeMatch[1]) * parseInt(moeMatch[2]);

  const match = id.match(/(\d+)b/i);
  if (match) return parseInt(match[1]);
  return null;
}

/** Parse active parameter count for MoE models (e.g. "122b-a10b" → 10) */
function parseActiveParams(id: string): number | null {
  const match = id.match(/a(\d+)b/i);
  return match ? parseInt(match[1]) : null;
}

/** Check if model is a Mixture of Experts architecture */
function isMoE(id: string, arch?: string): boolean {
  if (arch?.includes('moe') || arch?.includes('mixtral')) return true;
  if (id.includes('-a') && parseActiveParams(id) !== null) return true;
  if (/\d+x\d+b/i.test(id)) return true;
  return false;
}

/** Generate a human-readable name from model ID */
function inferName(id: string, arch?: string): string {
  // Clean up the ID into a readable name
  let name = id
    .replace(/@/g, ' ')
    .replace(/-mlx$/, '')
    .split('-')
    .map(part => {
      // Capitalize first letter of non-numeric parts
      if (/^\d/.test(part)) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');

  // Add MoE indicator if applicable
  const activeParams = parseActiveParams(id);
  if (activeParams && isMoE(id, arch)) {
    name += ` (${activeParams}B active)`;
  }

  return name;
}

/** Infer model capabilities from metadata */
function inferCapabilities(id: string, arch?: string, type?: string): ModelCapability[] {
  const caps: ModelCapability[] = ['general', 'code'];

  // Vision models
  if (type === 'vlm' || arch?.includes('vl') || id.includes('-vl-')) {
    caps.push('vision');
  }

  // Embedding models
  if (arch?.includes('bert') || id.includes('embed')) {
    return ['embedding'];
  }

  // Reasoning — larger models or explicit thinking models
  const params = parseParamBillions(id);
  if (params && params >= 30) caps.push('reasoning');
  if (id.includes('thinking') || id.includes('reason')) caps.push('reasoning');

  // Fast — small models or MoE with small active params
  const activeParams = parseActiveParams(id);
  if (params && params <= 14) caps.push('fast');
  if (activeParams && activeParams <= 14) caps.push('fast');

  return caps;
}

/** Infer speed based on model size and architecture */
function inferSpeed(id: string, arch?: string): ModelSpeed {
  const params = parseParamBillions(id);
  const activeParams = parseActiveParams(id);
  const effectiveParams = activeParams || params;

  if (!effectiveParams) return 'medium';
  if (effectiveParams <= 14) return 'fast';
  if (effectiveParams <= 80) return 'medium';
  return 'slow';
}

/** Infer quality based on model size */
function inferQuality(id: string): ModelQuality {
  const params = parseParamBillions(id);
  if (!params) return 'medium';
  if (params <= 14) return 'low';
  if (params <= 40) return 'medium';
  return 'high';
}

/** Infer cost (1-10) based on effective size */
function inferCost(id: string, arch?: string): number {
  // Embedding models are cheap
  if (id.includes('embed') || arch?.includes('bert')) return 1;

  const params = parseParamBillions(id);
  const activeParams = parseActiveParams(id);

  if (!params) return 5;

  // MoE with small active params are cheap despite large total
  if (activeParams) {
    if (activeParams <= 14) return 2;
    return 4;
  }

  // Dense models scale with size
  if (params <= 14) return 1;
  if (params <= 40) return 3;
  if (params <= 80) return 5;
  if (params <= 140) return 7;
  return 10;
}

/**
 * Infer minimum context length based on model size.
 * M3 Ultra 512GB RAM — no need to be conservative.
 */
function inferMinContext(id: string): number {
  const params = parseParamBillions(id);

  // Embedding models
  if (id.includes('embed')) return 2048;

  if (!params) return 32768;
  if (params <= 14) return 32768;
  if (params <= 40) return 32768;
  return 65536; // 70B+
}

/**
 * Build a ModelProfile from LMStudio model metadata.
 * Pure inference — no network calls.
 */
export function buildModelProfile(info: LMStudioModelInfo): ModelProfile {
  const caps = inferCapabilities(info.id, info.arch, info.type);
  const isEmbedding = caps.includes('embedding');

  return {
    id: info.id,
    name: inferName(info.id, info.arch),
    capabilities: caps,
    contextWindow: info.max_context_length || (isEmbedding ? 8192 : 32768),
    minContextLength: inferMinContext(info.id),
    speed: inferSpeed(info.id, info.arch),
    quality: inferQuality(info.id),
    supportsToolCalls: info.capabilities?.includes('tool_use') ?? !isEmbedding,
    cost: inferCost(info.id, info.arch),
  };
}

/**
 * Build a full registry from a list of LMStudio models.
 */
export function buildRegistry(models: LMStudioModelInfo[]): Record<string, ModelProfile> {
  const registry: Record<string, ModelProfile> = {};
  for (const m of models) {
    registry[m.id] = buildModelProfile(m);
  }
  return registry;
}
