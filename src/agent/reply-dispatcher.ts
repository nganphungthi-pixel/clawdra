/**
 * Reply Dispatcher
 * Manages typing indicators, block reply delivery, tool callbacks, approval events
 */

import { EventEmitter } from "node:events";

export interface ReplyDispatcherOptions {
  sendTimeoutMs?: number;
  blockSendTimeoutMs?: number;
  typingIntervalMs?: number;
  onTypingStart?: () => Promise<void>;
  onTypingStop?: () => Promise<void>;
  onBlockSend?: (block: ReplyBlock) => Promise<void>;
  onToolResult?: (result: unknown) => void;
  onApprovalEvent?: (event: ApprovalEvent) => void;
  onReasoningStream?: (content: string) => void;
  onCompactionStart?: () => void;
  onCompactionEnd?: () => void;
  onModelSelected?: (model: string) => void;
}

export interface ReplyBlock {
  id: string;
  content: string;
  type: "text" | "code" | "image" | "audio" | "tool_use" | "reasoning";
  timestamp: number;
  isPartial: boolean;
}

export interface ApprovalEvent {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  prompt: string;
  timestamp: number;
}

export const BLOCK_REPLY_SEND_TIMEOUT_MS = 15000;
const DEFAULT_TYPING_INTERVAL_MS = 6000;

export class ReplyDispatcher {
  private emitter: EventEmitter;
  private options: ReplyDispatcherOptions;
  private activeBlocks: Map<string, ReplyBlock> = new Map();
  private typingInterval: NodeJS.Timeout | null = null;
  private isTypingActive = false;
  private runStartedAt: number;
  private blockCounter = 0;

  constructor(options: ReplyDispatcherOptions = {}) {
    this.emitter = new EventEmitter();
    this.options = {
      sendTimeoutMs: 30000,
      blockSendTimeoutMs: BLOCK_REPLY_SEND_TIMEOUT_MS,
      typingIntervalMs: DEFAULT_TYPING_INTERVAL_MS,
      ...options,
    };
    this.runStartedAt = Date.now();
  }

  // ============================================
  // TYPING INDICATORS
  // ============================================

  async startTyping(): Promise<void> {
    if (this.isTypingActive) return;
    this.isTypingActive = true;

    if (this.options.onTypingStart) {
      await this.options.onTypingStart();
    }

    this.typingInterval = setInterval(async () => {
      if (this.options.onTypingStart) {
        try {
          await this.options.onTypingStart();
        } catch (error) {
          // Typing indicator failure is non-fatal
        }
      }
    }, this.options.typingIntervalMs);
  }

  async stopTyping(): Promise<void> {
    if (!this.isTypingActive) return;
    this.isTypingActive = false;

    if (this.typingInterval) {
      clearInterval(this.typingInterval);
      this.typingInterval = null;
    }

    if (this.options.onTypingStop) {
      try {
        await this.options.onTypingStop();
      } catch (error) {
        // Non-fatal
      }
    }
  }

  // ============================================
  // BLOCK REPLY DELIVERY
  // ============================================

  async sendBlock(content: string, type: ReplyBlock["type"] = "text"): Promise<ReplyBlock> {
    const block: ReplyBlock = {
      id: `block-${++this.blockCounter}`,
      content,
      type,
      timestamp: Date.now(),
      isPartial: false,
    };

    this.activeBlocks.set(block.id, block);

    if (this.options.onBlockSend) {
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Block send timeout after ${this.options.blockSendTimeoutMs}ms`)),
          this.options.blockSendTimeoutMs);
      });

      await Promise.race([
        this.options.onBlockSend(block),
        timeout,
      ]);
    }

    this.emitter.emit("block:sent", block);
    return block;
  }

  async sendPartialBlock(content: string, type: ReplyBlock["type"] = "text"): Promise<ReplyBlock> {
    const block: ReplyBlock = {
      id: `block-partial-${++this.blockCounter}`,
      content,
      type,
      timestamp: Date.now(),
      isPartial: true,
    };

    if (this.options.onBlockSend) {
      try {
        await this.options.onBlockSend(block);
      } catch {
        // Partial block failures are silent
      }
    }

    return block;
  }

  // ============================================
  // EVENT CALLBACKS
  // ============================================

  onToolResult(result: unknown): void {
    if (this.options.onToolResult) {
      this.options.onToolResult(result);
    }
    this.emitter.emit("tool:result", result);
  }

  onToolStart(tool: string, input: unknown): void {
    this.emitter.emit("tool:start", { tool, input, timestamp: Date.now() });
  }

  onApprovalEvent(event: ApprovalEvent): void {
    if (this.options.onApprovalEvent) {
      this.options.onApprovalEvent(event);
    }
    this.emitter.emit("approval:event", event);
  }

  onReasoningStream(content: string): void {
    if (this.options.onReasoningStream) {
      this.options.onReasoningStream(content);
    }
    this.emitter.emit("reasoning:stream", content);
  }

  onReasoningEnd(): void {
    this.emitter.emit("reasoning:end");
  }

  onCompactionStart(): void {
    if (this.options.onCompactionStart) {
      this.options.onCompactionStart();
    }
    this.emitter.emit("compaction:start");
  }

  onCompactionEnd(): void {
    if (this.options.onCompactionEnd) {
      this.options.onCompactionEnd();
    }
    this.emitter.emit("compaction:end");
  }

  onModelSelected(model: string): void {
    if (this.options.onModelSelected) {
      this.options.onModelSelected(model);
    }
    this.emitter.emit("model:selected", model);
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================

  on(event: string, handler: (...args: any[]) => void): void {
    this.emitter.on(event, handler);
  }

  once(event: string, handler: (...args: any[]) => void): void {
    this.emitter.once(event, handler);
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  async start(): Promise<void> {
    await this.startTyping();
    this.emitter.emit("dispatcher:start", { timestamp: this.runStartedAt });
  }

  async cleanup(): Promise<void> {
    await this.stopTyping();
    this.activeBlocks.clear();
    this.emitter.emit("dispatcher:cleanup", { duration: Date.now() - this.runStartedAt });
    this.emitter.removeAllListeners();
  }

  getActiveBlocks(): ReplyBlock[] {
    return Array.from(this.activeBlocks.values());
  }

  getDuration(): number {
    return Date.now() - this.runStartedAt;
  }
}

// ============================================
// REPLY OPERATION REGISTRY (prevents double-dispatch)
// ============================================

interface ActiveReplyOperation {
  sessionKey: string;
  startedAt: number;
  dispatcher: ReplyDispatcher;
}

const activeReplyOperations: Map<string, ActiveReplyOperation> = new Map();

export class ReplyOperationAlreadyActiveError extends Error {
  constructor(sessionKey: string) {
    super(`Reply operation already active for session: ${sessionKey}`);
    this.name = "ReplyOperationAlreadyActiveError";
  }
}

export function acquireReplyOperation(sessionKey: string): ReplyDispatcher {
  const existing = activeReplyOperations.get(sessionKey);
  if (existing) {
    throw new ReplyOperationAlreadyActiveError(sessionKey);
  }

  const dispatcher = new ReplyDispatcher();
  activeReplyOperations.set(sessionKey, {
    sessionKey,
    startedAt: Date.now(),
    dispatcher,
  });

  return dispatcher;
}

export function releaseReplyOperation(sessionKey: string): void {
  const op = activeReplyOperations.get(sessionKey);
  if (op) {
    op.dispatcher.cleanup().catch(() => {});
    activeReplyOperations.delete(sessionKey);
  }
}

export function getActiveReplyOperation(sessionKey: string): ReplyDispatcher | undefined {
  return activeReplyOperations.get(sessionKey)?.dispatcher;
}

export function getActiveReplyCount(): number {
  return activeReplyOperations.size;
}
