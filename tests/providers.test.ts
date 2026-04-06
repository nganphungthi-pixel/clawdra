/**
 * Provider Tests
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { detectProvider, getDefaultConfig, AnthropicProvider, OpenAIProvider, OpenRouterProvider, OllamaProvider } from '../src/providers/mod.js';

describe('Provider Detection', () => {
  let originalAnthropicKey: string | undefined;
  let originalOpenaiKey: string | undefined;
  let originalOpenrouterKey: string | undefined;
  let originalOllamaHost: string | undefined;

  beforeAll(() => {
    originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
    originalOpenaiKey = process.env.OPENAI_API_KEY;
    originalOpenrouterKey = process.env.OPENROUTER_API_KEY;
    originalOllamaHost = process.env.OLLAMA_HOST;
  });

  afterAll(() => {
    process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
    process.env.OPENAI_API_KEY = originalOpenaiKey;
    process.env.OPENROUTER_API_KEY = originalOpenrouterKey;
    process.env.OLLAMA_HOST = originalOllamaHost;
  });

  it('should detect Anthropic provider from API key prefix', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.OPENAI_API_KEY = '';
    process.env.OPENROUTER_API_KEY = '';
    process.env.OLLAMA_HOST = '';
    expect(detectProvider()).toBe('anthropic');
  });

  it('should detect OpenAI provider from API key prefix', () => {
    process.env.ANTHROPIC_API_KEY = '';
    process.env.OPENAI_API_KEY = 'sk-test-key';
    process.env.OPENROUTER_API_KEY = '';
    process.env.OLLAMA_HOST = '';
    expect(detectProvider()).toBe('openai');
  });

  it('should detect Ollama from host env var', () => {
    process.env.OLLAMA_HOST = 'http://localhost:11434';
    expect(detectProvider()).toBe('ollama');
  });

  it('should detect OpenRouter from env var', () => {
    process.env.ANTHROPIC_API_KEY = '';
    process.env.OPENAI_API_KEY = '';
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.OLLAMA_HOST = '';
    expect(detectProvider()).toBe('openrouter');
  });
});

describe('Default Config', () => {
  it('should return config with model and API key', () => {
    const config = getDefaultConfig();
    expect(config).toBeDefined();
    expect(config.model).toBeDefined();
    expect(config.maxTokens).toBeGreaterThan(0);
  });
});

describe('Provider Classes', () => {
  it('should create Anthropic provider with defaults', () => {
    const provider = new AnthropicProvider();
    expect(provider.name).toBe('anthropic');
    expect(provider.model).toBeDefined();
  });

  it('should create OpenAI provider with defaults', () => {
    const provider = new OpenAIProvider();
    expect(provider.name).toBe('openai');
    expect(provider.model).toBeDefined();
  });

  it('should create OpenRouter provider with defaults', () => {
    const provider = new OpenRouterProvider();
    expect(provider.name).toBe('openrouter');
    expect(provider.model).toBeDefined();
  });

  it('should create Ollama provider with defaults', () => {
    const provider = new OllamaProvider();
    expect(provider.name).toBe('ollama');
    expect(provider.model).toBeDefined();
  });
});
