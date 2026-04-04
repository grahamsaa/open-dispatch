import OpenAI from 'openai';

const LMSTUDIO_BASE_URL = process.env.LMSTUDIO_URL || 'http://localhost:1234/v1';

export const llm = new OpenAI({
  baseURL: LMSTUDIO_BASE_URL,
  apiKey: 'not-needed',
});

export async function listAvailableModels(): Promise<string[]> {
  const response = await llm.models.list();
  const models: string[] = [];
  for await (const model of response) {
    models.push(model.id);
  }
  return models;
}
