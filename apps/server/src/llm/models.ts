import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const LMSTUDIO_API = process.env.LMSTUDIO_URL?.replace('/v1', '') || 'http://localhost:1234';
const LMS_CLI = process.env.LMS_PATH || `${process.env.HOME}/.lmstudio/bin/lms`;

export interface ModelInfo {
  id: string;
  state: 'loaded' | 'not-loaded';
  arch?: string;
  quantization?: string;
  loadedContextLength?: number;
  maxContextLength?: number;
  capabilities?: string[];
}

export async function getModelsDetailed(): Promise<ModelInfo[]> {
  try {
    const response = await fetch(`${LMSTUDIO_API}/api/v0/models`);
    if (!response.ok) throw new Error(`LMStudio API error: ${response.status}`);
    const data = await response.json() as { data: Array<Record<string, unknown>> };

    return data.data.map(m => ({
      id: m.id as string,
      state: (m.state as string) === 'loaded' ? 'loaded' as const : 'not-loaded' as const,
      arch: m.arch as string | undefined,
      quantization: m.quantization as string | undefined,
      loadedContextLength: m.loaded_context_length as number | undefined,
      maxContextLength: m.max_context_length as number | undefined,
      capabilities: m.capabilities as string[] | undefined,
    }));
  } catch (err) {
    console.error('Failed to get detailed model info:', err);
    return [];
  }
}

export async function loadModel(modelId: string, contextLength?: number): Promise<{ ok: boolean; message: string }> {
  try {
    // Unload any currently loaded model first
    const models = await getModelsDetailed();
    const loaded = models.filter(m => m.state === 'loaded');
    for (const m of loaded) {
      if (m.id !== modelId) {
        await execAsync(`${LMS_CLI} unload "${m.id}"`, { timeout: 30000 });
      }
    }

    // Check if this model is already loaded with the right context
    const target = models.find(m => m.id === modelId);
    if (target?.state === 'loaded' && (!contextLength || target.loadedContextLength === contextLength)) {
      return { ok: true, message: `${modelId} already loaded with ${target.loadedContextLength} context.` };
    }

    // If model is loaded but with wrong context, unload first
    if (target?.state === 'loaded') {
      await execAsync(`${LMS_CLI} unload "${modelId}"`, { timeout: 30000 });
    }

    // Load with specified context length
    const ctxArg = contextLength ? `-c ${contextLength}` : '';
    const { stdout, stderr } = await execAsync(
      `${LMS_CLI} load "${modelId}" ${ctxArg} -y`,
      { timeout: 120000 }
    );

    return { ok: true, message: `${modelId} loaded${contextLength ? ` with ${contextLength} context` : ''}.` };
  } catch (err) {
    return { ok: false, message: `Failed to load model: ${(err as Error).message}` };
  }
}

export async function unloadModel(modelId: string): Promise<{ ok: boolean; message: string }> {
  try {
    await execAsync(`${LMS_CLI} unload "${modelId}"`, { timeout: 30000 });
    return { ok: true, message: `${modelId} unloaded.` };
  } catch (err) {
    return { ok: false, message: `Failed to unload model: ${(err as Error).message}` };
  }
}
