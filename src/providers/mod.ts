export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
}

export interface Response {
  content: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  toolCalls?: ToolCall[];
  stopReason?: "end_turn" | "max_tokens" | "tool_use" | "stop_sequence" | "length" | null;
}

export interface Chunk {
  type: "content" | "tool_use" | "message_start" | "message_delta" | "message_stop" | "error";
  content?: string;
  delta?: string;
  toolCall?: ToolCall;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  isDone?: boolean;
  error?: string;
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface Provider {
  readonly name: string;
  readonly model: string;
  chat(messages: Message[]): Promise<Response>;
  streamChat(messages: Message[]): AsyncGenerator<Chunk, void, unknown>;
}

export type ProviderName = "anthropic" | "openai" | "openrouter" | "ollama" | "gemini" | "bedrock";

export function detectProvider(config?: ProviderConfig): ProviderName {
  const apiKey = config?.apiKey || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || "";

  if (process.env.OLLAMA_HOST) {
    return "ollama";
  }

  if (process.env.GEMINI_API_KEY) {
    return "gemini";
  }

  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return "bedrock";
  }

  if (apiKey.startsWith("sk-ant-")) {
    return "anthropic";
  }

  if (apiKey.startsWith("sk-")) {
    return "openai";
  }

  if (process.env.OPENROUTER_API_KEY) {
    return "openrouter";
  }

  return "anthropic";
}

export function getDefaultConfig(): ProviderConfig {
  return {
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || "",
    baseUrl: process.env.OPENAI_BASE_URL,
    model: process.env.ANTHROPIC_MODEL || process.env.OPENAI_MODEL || "claude-sonnet-4-20250514",
    maxTokens: parseInt(process.env.MAX_TOKENS || "8192"),
    temperature: parseFloat(process.env.TEMPERATURE || "0.7"),
    timeout: parseInt(process.env.TIMEOUT || "120000"),
  };
}

export function createProvider(config?: ProviderConfig): Provider {
  const cfg = { ...getDefaultConfig(), ...config };
  const providerName = detectProvider(cfg);

  switch (providerName) {
    case "anthropic":
      return new AnthropicProvider(cfg);
    case "openai":
      return new OpenAIProvider(cfg);
    case "openrouter":
      return new OpenRouterProvider(cfg);
    case "ollama":
      return new OllamaProvider(cfg);
    case "gemini":
      return new GeminiProvider(cfg);
    case "bedrock":
      return new BedrockProvider(cfg);
    default:
      return new AnthropicProvider(cfg);
  }
}

export class AnthropicProvider implements Provider {
  readonly name: ProviderName = "anthropic";
  readonly model: string;
  private apiKey: string;
  private baseUrl: string;
  private maxTokens: number;
  private timeout: number;

  constructor(config: ProviderConfig = {}) {
    this.model = config.model || "claude-sonnet-4-20250514";
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || "";
    this.baseUrl = config.baseUrl || "https://api.anthropic.com/v1";
    this.maxTokens = config.maxTokens || 8192;
    this.timeout = config.timeout || 120000;
  }

  async chat(messages: Message[]): Promise<Response> {
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: nonSystemMessages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.name && { name: m.name }),
        ...(m.toolCallId && { tool_call_id: m.toolCallId }),
      })),
    };

    if (systemMessages[0]) {
      body.system = systemMessages[0].content;
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${error}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
      usage: { input_tokens: number; output_tokens: number };
      model: string;
      stop_reason: string | null;
    };

    const textContent = data.content.find((c) => c.type === "text");
    const toolCallsContent = data.content.filter((c) => c.type === "tool_use");

    return {
      content: textContent?.text || "",
      model: data.model,
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      toolCalls: toolCallsContent.length > 0
        ? toolCallsContent.map((tc) => ({
            id: tc.id!,
            name: tc.name!,
            input: tc.input as Record<string, unknown>,
          }))
        : undefined,
      stopReason: data.stop_reason as Response["stopReason"],
    };
  }

  async *streamChat(messages: Message[]): AsyncGenerator<Chunk, void, unknown> {
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: nonSystemMessages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.name && { name: m.name }),
      })),
      stream: true,
    };

    if (systemMessages[0]) {
      body.system = systemMessages[0].content;
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(line.slice(5)) as {
              type: string;
              delta?: { text?: string };
              tool_use?: { id?: string; name?: string; input?: string };
              usage?: { output_tokens?: number };
            };

            switch (data.type) {
              case "content_block_delta":
                if (data.delta?.text) {
                  yield { type: "content", delta: data.delta.text };
                }
                break;
              case "tool_use":
                yield {
                  type: "tool_use",
                  toolCall: {
                    id: data.tool_use?.id || "",
                    name: data.tool_use?.name || "",
                    input: data.tool_use?.input ? JSON.parse(data.tool_use.input) : {},
                  },
                };
                break;
              case "message_start":
                yield { type: "message_start" };
                break;
              case "message_delta":
                if (data.delta?.text) {
                  yield { type: "message_delta", delta: data.delta.text };
                }
                if (data.usage) {
                  yield {
                    type: "message_delta",
                    usage: { inputTokens: 0, outputTokens: data.usage.output_tokens || 0 },
                  };
                }
                break;
              case "message_stop":
                yield { type: "message_stop", isDone: true };
                return;
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export class OpenAIProvider implements Provider {
  readonly name: ProviderName = "openai";
  readonly model: string;
  private apiKey: string;
  private baseUrl: string;
  private maxTokens: number;
  private timeout: number;

  constructor(config: ProviderConfig = {}) {
    this.model = config.model || "gpt-4o";
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || "";
    this.baseUrl = config.baseUrl || "https://api.openai.com/v1";
    this.maxTokens = config.maxTokens || 8192;
    this.timeout = config.timeout || 120000;
  }

  async chat(messages: Message[]): Promise<Response> {
    const apiMessages = messages.map((m) => {
      const msg: Record<string, unknown> = {
        role: m.role,
        content: m.content,
      };
      if (m.name) msg.name = m.name;
      if (m.toolCalls) {
        msg.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.input),
          },
        }));
      }
      return msg;
    });

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: apiMessages,
        max_tokens: this.maxTokens,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{
        message: {
          content: string;
          tool_calls?: Array<ToolCallFunction>;
        };
        finish_reason: string | null;
      }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model: string;
    };
    
    interface ToolCallFunction {
      id: string;
      type: string;
      "function": { name: string; arguments: string };
    }

    const choice = data.choices[0];
    const message = choice?.message;

    return {
      content: message?.content || "",
      model: data.model,
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      toolCalls: message?.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc["function"].name,
        input: JSON.parse(tc["function"].arguments),
      })),
      stopReason: choice?.finish_reason as Response["stopReason"],
    };
  }

  async *streamChat(messages: Message[]): AsyncGenerator<Chunk, void, unknown> {
    const apiMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.name && { name: m.name }),
    }));

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: apiMessages,
        max_tokens: this.maxTokens,
        stream: true,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          if (trimmed === "data: [DONE]") {
            yield { type: "message_stop", isDone: true };
            return;
          }

          try {
            const data = JSON.parse(trimmed.slice(6)) as {
              choices: Array<{
                delta: {
                  content?: string;
                  tool_calls?: Array<DeltaToolCall>;
                };
                finish_reason: string | null;
              }>;
            };

            interface DeltaToolCall {
              id: string;
              index: number;
              type: string;
              "function": { name: string; arguments: string };
            }

            const choice = data.choices[0];
            if (!choice) continue;

            if (choice.delta?.content) {
              yield { type: "content", delta: choice.delta.content };
            }

            if (choice.delta?.tool_calls) {
              for (const tc of choice.delta.tool_calls) {
                yield {
                  type: "tool_use",
                  toolCall: {
                    id: tc.id,
                    name: tc["function"].name,
                    input: JSON.parse(tc["function"].arguments),
                  },
                };
              }
            }

            if (choice.finish_reason) {
              yield { type: "message_stop", isDone: true };
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export class OpenRouterProvider implements Provider {
  readonly name: ProviderName = "openrouter";
  readonly model: string;
  private apiKey: string;
  private baseUrl: string;
  private maxTokens: number;
  private timeout: number;

  constructor(config: ProviderConfig = {}) {
    this.model = config.model || "anthropic/claude-sonnet-4-20250514";
    this.apiKey = config.apiKey || process.env.OPENROUTER_API_KEY || "";
    this.baseUrl = config.baseUrl || "https://openrouter.ai/api/v1";
    this.maxTokens = config.maxTokens || 8192;
    this.timeout = config.timeout || 120000;
  }

  async chat(messages: Message[]): Promise<Response> {
    const systemMsg = messages.find((m) => m.role === "system");
    const filteredMessages = messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model: this.model,
      messages: filteredMessages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.name && { name: m.name }),
      })),
    };

    if (systemMsg) {
      body.system = systemMsg.content;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "HTTP-Referer": "https://clawdra.dev",
        "X-Title": "clawdra",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{
        message: {
          content: string;
          tool_calls?: Array<ORFunctionCall>;
        };
      }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model: string;
    };

    interface ORFunctionCall {
      id: string;
      "function": { name: string; arguments: string };
    }

    const choice = data.choices[0];
    const message = choice?.message;

    return {
      content: message?.content || "",
      model: data.model || this.model,
      usage: data.usage
        ? {
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      toolCalls: message?.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc["function"].name,
        input: JSON.parse(tc["function"].arguments),
      })),
    };
  }

  async *streamChat(messages: Message[]): AsyncGenerator<Chunk, void, unknown> {
    const systemMsg = messages.find((m) => m.role === "system");
    const filteredMessages = messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model: this.model,
      messages: filteredMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    };

    if (systemMsg) {
      body.system = systemMsg.content;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "HTTP-Referer": "https://clawdra.dev",
        "X-Title": "clawdra",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          if (trimmed === "data: [DONE]") {
            yield { type: "message_stop", isDone: true };
            return;
          }

          try {
            const data = JSON.parse(trimmed.slice(6)) as {
              choices: Array<{ delta: { content?: string } }>;
            };

            const content = data.choices[0]?.delta?.content;
            if (content) {
              yield { type: "content", delta: content };
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export class OllamaProvider implements Provider {
  readonly name: ProviderName = "ollama";
  readonly model: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: ProviderConfig = {}) {
    this.model = config.model || "llama3";
    this.baseUrl = config.baseUrl || process.env.OLLAMA_HOST || "http://localhost:11434";
    this.timeout = config.timeout || 120000;
  }

  async chat(messages: Message[]): Promise<Response> {
    const apiMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: apiMessages,
        stream: false,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${error}`);
    }

    const data = await response.json() as {
      message: { content: string; role: string };
      done: boolean;
      total_duration?: number;
    };

    return {
      content: data.message.content,
      model: this.model,
      usage: data.total_duration
        ? {
            inputTokens: 0,
            outputTokens: Math.floor(data.total_duration / 1_000_000),
            totalTokens: Math.floor(data.total_duration / 1_000_000),
          }
        : undefined,
    };
  }

  async *streamChat(messages: Message[]): AsyncGenerator<Chunk, void, unknown> {
    const apiMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: apiMessages,
        stream: true,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          try {
            const data = JSON.parse(line) as {
              message?: { content?: string };
              done: boolean;
            };

            if (data.message?.content) {
              yield { type: "content", delta: data.message.content };
            }

            if (data.done) {
              yield { type: "message_stop", isDone: true };
              return;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export function createFallbackProvider(primaryConfig?: ProviderConfig, fallbackConfig?: ProviderConfig): Provider {
  const primaryProvider = createProvider(primaryConfig);
  
  const originalChat = primaryProvider.chat.bind(primaryProvider);
  const originalStreamChat = primaryProvider.streamChat.bind(primaryProvider);

  primaryProvider.chat = async (messages: Message[]): Promise<Response> => {
    try {
      return await originalChat(messages);
    } catch (error) {
      if (!fallbackConfig) throw error;
      
      const fallbackProvider = createProvider(fallbackConfig);
      return fallbackProvider.chat(messages);
    }
  };

  primaryProvider.streamChat = async function* (messages: Message[]): AsyncGenerator<Chunk, void, unknown> {
    try {
      yield* originalStreamChat(messages);
    } catch (error) {
      if (!fallbackConfig) throw error;
      
      const fallbackProvider = createProvider(fallbackConfig);
      yield* fallbackProvider.streamChat(messages);
    }
  };

  return primaryProvider;
}

// ============================================
// GEMINI PROVIDER
// ============================================

export class GeminiProvider implements Provider {
  readonly name: ProviderName = "gemini";
  readonly model: string;
  private apiKey: string;
  private maxTokens: number;
  private timeout: number;

  constructor(config: ProviderConfig = {}) {
    this.model = config.model || process.env.GEMINI_MODEL || "gemini-2.0-flash";
    this.apiKey = config.apiKey || process.env.GEMINI_API_KEY || "";
    this.maxTokens = config.maxTokens || 8192;
    this.timeout = config.timeout || 120000;
  }

  async chat(messages: Message[]): Promise<Response> {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({ model: this.model });

    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const prompt = nonSystemMessages.map((m) => m.content).join("\n");

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: this.maxTokens,
      },
    });

    const response = await result.response;
    const text = response.text();

    return {
      content: text,
      model: this.model,
      usage: {
        inputTokens: 0, // Gemini doesn't provide token counts in this API
        outputTokens: 0,
        totalTokens: 0,
      },
    };
  }

  async *streamChat(messages: Message[]): AsyncGenerator<Chunk, void, unknown> {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({ model: this.model });

    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const prompt = nonSystemMessages.map((m) => m.content).join("\n");

    const result = await model.generateContentStream(prompt);

    yield { type: "message_start" };

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield { type: "content", delta: text };
      }
    }

    yield { type: "message_stop", isDone: true };
  }
}

// ============================================
// BEDROCK PROVIDER
// ============================================

export class BedrockProvider implements Provider {
  readonly name: ProviderName = "bedrock";
  readonly model: string;
  private maxTokens: number;
  private timeout: number;
  private region: string;

  constructor(config: ProviderConfig = {}) {
    this.model = config.model || process.env.BEDROCK_MODEL || "anthropic.claude-3-5-sonnet-20241022-v2:0";
    this.maxTokens = config.maxTokens || 8192;
    this.timeout = config.timeout || 120000;
    this.region = process.env.AWS_REGION || "us-east-1";
  }

  async chat(messages: Message[]): Promise<Response> {
    const { BedrockRuntimeClient, InvokeModelCommand } = await import("@aws-sdk/client-bedrock-runtime");

    const client = new BedrockRuntimeClient({ region: this.region });

    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const body = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: this.maxTokens,
      messages: nonSystemMessages.map((m) => ({
        role: m.role,
        content: [{ type: "text", text: m.content }],
      })),
      system: systemMessages[0]?.content,
    };

    const command = new InvokeModelCommand({
      modelId: this.model,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(body),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    const content = responseBody.content?.[0]?.text || "";

    return {
      content,
      model: this.model,
      usage: {
        inputTokens: responseBody.usage?.input_tokens || 0,
        outputTokens: responseBody.usage?.output_tokens || 0,
        totalTokens: (responseBody.usage?.input_tokens || 0) + (responseBody.usage?.output_tokens || 0),
      },
    };
  }

  async *streamChat(messages: Message[]): AsyncGenerator<Chunk, void, unknown> {
    const { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } = await import("@aws-sdk/client-bedrock-runtime");

    const client = new BedrockRuntimeClient({ region: this.region });

    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const body = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: this.maxTokens,
      messages: nonSystemMessages.map((m) => ({
        role: m.role,
        content: [{ type: "text", text: m.content }],
      })),
      system: systemMessages[0]?.content,
    };

    const command = new InvokeModelWithResponseStreamCommand({
      modelId: this.model,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(body),
    });

    const response = await client.send(command);

    yield { type: "message_start" };

    for await (const chunk of (response as any).body || []) {
      if (chunk.chunk?.bytes) {
        try {
          const data = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes));
          const text = data.content?.[0]?.text;
          if (text) {
            yield { type: "content", delta: text };
          }
        } catch {
          // Skip malformed
        }
      }
    }

    yield { type: "message_stop", isDone: true };
  }
}