import type { ModelProfile } from '@opendispatch/shared';
import { buildRegistry, type LMStudioModelInfo } from '@opendispatch/shared';

const LMSTUDIO_API = process.env.LMSTUDIO_URL?.replace('/v1', '') || 'http://localhost:1234';
const REFRESH_INTERVAL = 30_000; // 30 seconds

let cachedRegistry: Record<string, ModelProfile> = {};
let lastRefresh = 0;

/** Fetch model list from LMStudio and build registry */
async function fetchRegistry(): Promise<Record<string, ModelProfile>> {
  const response = await fetch(`${LMSTUDIO_API}/api/v0/models`);
  if (!response.ok) throw new Error(`LMStudio API error: ${response.status}`);
  const data = await response.json() as { data: LMStudioModelInfo[] };
  return buildRegistry(data.data);
}

/** Get the current model registry, refreshing if stale */
export async function getRegistry(): Promise<Record<string, ModelProfile>> {
  const now = Date.now();
  if (now - lastRefresh > REFRESH_INTERVAL || Object.keys(cachedRegistry).length === 0) {
    try {
      cachedRegistry = await fetchRegistry();
      lastRefresh = now;
    } catch (err) {
      // If refresh fails and we have a cache, use it
      if (Object.keys(cachedRegistry).length > 0) {
        console.error('Failed to refresh model registry, using cache:', (err as Error).message);
      } else {
        console.error('Failed to fetch model registry:', (err as Error).message);
      }
    }
  }
  return cachedRegistry;
}

/** Get a single model profile, or undefined if not found */
export async function getModelProfile(modelId: string): Promise<ModelProfile | undefined> {
  const registry = await getRegistry();
  return registry[modelId];
}

/** List all model profiles */
export async function listModelProfiles(): Promise<ModelProfile[]> {
  const registry = await getRegistry();
  return Object.values(registry);
}

/** Force a registry refresh (e.g. after loading/unloading a model) */
export function invalidateRegistry(): void {
  lastRefresh = 0;
}
