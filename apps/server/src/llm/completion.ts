import type { ChatMessage, ToolCall, ToolDefinition } from '@opendispatch/shared';
import { MODEL_REGISTRY } from '@opendispatch/shared';
import { llm } from './client.js';
import type OpenAI from 'openai';

interface CompletionOptions {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  maxTokens?: number;
}

interface CompletionResult {
  content: string | null;
  toolCalls: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export async function chatCompletion(opts: CompletionOptions): Promise<CompletionResult> {
  const modelProfile = MODEL_REGISTRY[opts.model];
  const supportsTools = modelProfile?.supportsToolCalls ?? true;

  const params: OpenAI.Chat.ChatCompletionCreateParams = {
    model: opts.model,
    messages: opts.messages as OpenAI.Chat.ChatCompletionMessageParam[],
    max_tokens: opts.maxTokens ?? 4096,
  };

  if (opts.tools?.length && supportsTools) {
    params.tools = opts.tools as OpenAI.Chat.ChatCompletionTool[];
    params.tool_choice = 'auto';
  } else if (opts.tools?.length && !supportsTools) {
    // For models that don't support native tool calls, inject tool descriptions
    // into the system prompt and parse JSON from the response
    const toolsDesc = opts.tools.map(t =>
      `- ${t.function.name}: ${t.function.description}\n  Parameters: ${JSON.stringify(t.function.parameters)}`
    ).join('\n');

    const fallbackInstruction = `\n\nYou have access to these tools. To use a tool, respond with a JSON block:\n\`\`\`json\n{"tool_calls": [{"name": "tool_name", "arguments": {...}}]}\n\`\`\`\n\nAvailable tools:\n${toolsDesc}\n\nIf you don't need a tool, respond normally without any JSON block.`;

    const messages = [...opts.messages];
    if (messages[0]?.role === 'system') {
      messages[0] = { ...messages[0], content: (messages[0].content || '') + fallbackInstruction };
    } else {
      messages.unshift({ role: 'system', content: fallbackInstruction });
    }
    params.messages = messages as OpenAI.Chat.ChatCompletionMessageParam[];
  }

  const response = await llm.chat.completions.create(params);
  const choice = response.choices[0];

  if (!choice) {
    return { content: null, toolCalls: [] };
  }

  // Native tool calls
  if (choice.message.tool_calls?.length) {
    return {
      content: choice.message.content,
      toolCalls: choice.message.tool_calls.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
      } : undefined,
    };
  }

  // Fallback: parse JSON tool calls from content
  const content = choice.message.content || '';
  const toolCalls = parseFallbackToolCalls(content);

  return {
    content: toolCalls.length ? stripToolCallJson(content) : content,
    toolCalls,
    usage: response.usage ? {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
    } : undefined,
  };
}

function parseFallbackToolCalls(content: string): ToolCall[] {
  const jsonMatch = content.match(/```json\s*\n?([\s\S]*?)\n?```/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (!parsed.tool_calls || !Array.isArray(parsed.tool_calls)) return [];

    return parsed.tool_calls.map((tc: { name: string; arguments: Record<string, unknown> }, i: number) => ({
      id: `fallback_${Date.now()}_${i}`,
      type: 'function' as const,
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.arguments),
      },
    }));
  } catch {
    return [];
  }
}

function stripToolCallJson(content: string): string {
  return content.replace(/```json\s*\n?[\s\S]*?\n?```/, '').trim();
}
