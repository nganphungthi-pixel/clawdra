/**
 * Block Streaming with Coalescing - OpenClaw pattern
 * Chunks streaming LLM output into deliverable blocks
 * Configurable chunk sizes, boundary preferences, idle flush
 */

export interface BlockStreamingConfig {
  minChars: number;          // Minimum chars before flushing (default 800)
  maxChars: number;          // Maximum chars per block (default 1200)
  breakPreference: "paragraph" | "newline" | "sentence";
  idleFlushMs: number;       // Idle timeout before flushing (default 1000ms)
  channelTextLimit: number;  // Channel text message limit (default 4096)
}

export const DEFAULT_BLOCK_STREAMING_CONFIG: BlockStreamingConfig = {
  minChars: 800,
  maxChars: 1200,
  breakPreference: "paragraph",
  idleFlushMs: 1000,
  channelTextLimit: 4096,
};

export interface StreamChunk {
  type: "text" | "reasoning" | "tool_use";
  content: string;
  isComplete: boolean;
}

export type BlockStreamCallback = (block: string, isPartial: boolean) => Promise<void>;

export class BlockCoalescer {
  private config: BlockStreamingConfig;
  private buffer = "";
  private idleTimer: NodeJS.Timeout | null = null;
  private callback: BlockStreamCallback;
  private isComplete = false;
  private totalCharsSent = 0;

  constructor(callback: BlockStreamCallback, config: Partial<BlockStreamingConfig> = {}) {
    this.callback = callback;
    this.config = { ...DEFAULT_BLOCK_STREAMING_CONFIG, ...config };
  }

  /**
   * Add a chunk to the coalescer
   */
  async addChunk(chunk: StreamChunk): Promise<void> {
    if (this.isComplete) return;

    this.buffer += chunk.content;

    // Reset idle timer
    this.resetIdleTimer();

    // Check if we should flush
    if (this.buffer.length >= this.config.minChars) {
      await this.tryFlush();
    }
  }

  /**
   * Flush remaining content
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const content = this.extractBlock(this.buffer);
    if (content.length > 0) {
      await this.callback(content, false);
      this.totalCharsSent += content.length;
    }

    this.buffer = "";
    this.isComplete = true;
    this.clearIdleTimer();
  }

  /**
   * Mark stream as complete and flush
   */
  async complete(): Promise<void> {
    await this.flush();
  }

  /**
   * Try to flush accumulated content
   */
  private async tryFlush(): Promise<void> {
    if (this.buffer.length < this.config.minChars) return;

    const content = this.extractBlock(this.buffer);
    if (content.length === 0) return;

    // Check channel limit
    const clampedContent = content.slice(0, this.config.channelTextLimit);
    if (clampedContent.length === 0) return;

    await this.callback(clampedContent, false);
    this.totalCharsSent += clampedContent.length;

    // Remove flushed content from buffer
    this.buffer = this.buffer.slice(content.length);

    // Reset idle timer with remaining content
    if (this.buffer.length > 0) {
      this.resetIdleTimer();
    }
  }

  /**
   * Extract a clean block from buffer based on break preference
   */
  private extractBlock(text: string): string {
    const maxLen = Math.min(this.config.maxChars, this.config.channelTextLimit);

    if (text.length <= maxLen) {
      return text;
    }

    const searchArea = text.slice(0, maxLen);

    switch (this.config.breakPreference) {
      case "paragraph":
        return this.breakAtParagraph(searchArea, text);
      case "newline":
        return this.breakAtNewline(searchArea, text);
      case "sentence":
        return this.breakAtSentence(searchArea, text);
      default:
        return searchArea;
    }
  }

  private breakAtParagraph(searchArea: string, fullText: string): string {
    // Find last paragraph boundary
    const paragraphs = searchArea.split("\n\n");
    if (paragraphs.length <= 1) {
      return this.breakAtNewline(searchArea, fullText);
    }

    // Keep all complete paragraphs
    const result = paragraphs.slice(0, -1).join("\n\n");
    return result.length > 0 ? result : searchArea;
  }

  private breakAtNewline(searchArea: string, fullText: string): string {
    const lines = searchArea.split("\n");
    if (lines.length <= 1) {
      return this.breakAtSentence(searchArea, fullText);
    }

    const result = lines.slice(0, -1).join("\n");
    return result.length > 0 ? result : searchArea;
  }

  private breakAtSentence(searchArea: string, fullText: string): string {
    // Find last sentence boundary
    const sentenceEndings = /[.!?]+\s/g;
    let lastMatch = 0;
    let match;

    while ((match = sentenceEndings.exec(searchArea)) !== null) {
      lastMatch = match.index + match[0].length;
    }

    if (lastMatch > 0) {
      return searchArea.slice(0, lastMatch);
    }

    return searchArea;
  }

  /**
   * Idle timer management
   */
  private resetIdleTimer(): void {
    this.clearIdleTimer();

    this.idleTimer = setTimeout(async () => {
      if (this.buffer.length > 0 && !this.isComplete) {
        await this.tryFlush();
      }
    }, this.config.idleFlushMs);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.clearIdleTimer();
    this.buffer = "";
    this.isComplete = true;
  }

  /**
   * Stats
   */
  getStats(): { buffered: number; sent: number; isComplete: boolean } {
    return {
      buffered: this.buffer.length,
      sent: this.totalCharsSent,
      isComplete: this.isComplete,
    };
  }
}

/**
 * Channel-specific block streaming coalesce defaults
 * Different channels have different message limits
 */
export const CHANNEL_BLOCK_STREAMING_DEFAULTS: Record<string, Partial<BlockStreamingConfig>> = {
  telegram: {
    maxChars: 4096,
    channelTextLimit: 4096,
  },
  discord: {
    maxChars: 2000,
    channelTextLimit: 2000,
  },
  slack: {
    maxChars: 40000,
    channelTextLimit: 40000,
  },
  whatsapp: {
    maxChars: 4096,
    channelTextLimit: 4096,
  },
  webchat: {
    maxChars: 8192,
    channelTextLimit: 8192,
  },
  cli: {
    maxChars: 2000,
    channelTextLimit: 2000,
  },
};

/**
 * Get block streaming config for a specific channel
 */
export function getBlockStreamingConfigForChannel(channelId: string): BlockStreamingConfig {
  const channelDefaults = CHANNEL_BLOCK_STREAMING_DEFAULTS[channelId] || {};
  return { ...DEFAULT_BLOCK_STREAMING_CONFIG, ...channelDefaults };
}
