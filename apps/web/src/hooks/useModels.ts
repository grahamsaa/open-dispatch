'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

interface ModelInfo {
  id: string;
  state: 'loaded' | 'not-loaded';
  arch?: string;
  quantization?: string;
  loadedContextLength?: number;
  maxContextLength?: number;
  capabilities?: string[];
}

export function useModels() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchModels = useCallback(async () => {
    try {
      const data = await api<{ models: ModelInfo[] }>('/models');
      setModels(data.models);
    } catch (err) {
      console.error('Failed to fetch models:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  // Poll every 5 seconds to catch model state changes
  useEffect(() => {
    const interval = setInterval(fetchModels, 5000);
    return () => clearInterval(interval);
  }, [fetchModels]);

  const loadModel = useCallback(async (modelId: string, contextLength?: number) => {
    const result = await api<{ ok: boolean; message: string }>('/models/load', {
      method: 'POST',
      body: JSON.stringify({ model: modelId, contextLength }),
    });
    await fetchModels();
    return result;
  }, [fetchModels]);

  const unloadModel = useCallback(async (modelId: string) => {
    const result = await api<{ ok: boolean; message: string }>('/models/unload', {
      method: 'POST',
      body: JSON.stringify({ model: modelId }),
    });
    await fetchModels();
    return result;
  }, [fetchModels]);

  const loadedModel = models.find(m => m.state === 'loaded');

  return { models, loading, loadedModel, loadModel, unloadModel, refetch: fetchModels };
}
