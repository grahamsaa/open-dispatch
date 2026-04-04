export type ModelCapability = 'general' | 'code' | 'reasoning' | 'vision' | 'embedding' | 'fast';
export type ModelSpeed = 'fast' | 'medium' | 'slow';
export type ModelQuality = 'low' | 'medium' | 'high';

export interface ModelProfile {
  id: string;
  name: string;
  capabilities: ModelCapability[];
  contextWindow: number;
  speed: ModelSpeed;
  quality: ModelQuality;
  supportsToolCalls: boolean;
  cost: number;
}

export interface RoutingDecision {
  modelId: string;
  reason: string;
}
