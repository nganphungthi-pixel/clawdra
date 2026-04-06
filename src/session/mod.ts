/**
 * Session Store
 * JSON file-based session management with history, session keys
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";

export interface SessionEntry {
  sessionId: string;
  sessionKey: string;
  channel: string;
  chatId: string;
  userId: string;
  modelOverride?: string;
  providerOverride?: string;
  createdAt: number;
  updatedAt: number;
  lastActivityAt: number;
  messageCount: number;
  toolCallCount: number;
  compactionCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostCents: number;
  status: "active" | "idle" | "archived";
  metadata?: Record<string, unknown>;
}

export interface SessionStore {
  [sessionKey: string]: SessionEntry;
}

export class SessionManager {
  private storePath: string;
  private store: SessionStore = {};
  private sessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  constructor(storePath: string) {
    this.storePath = storePath;
    this.loadStore();
  }

  /**
   * Create a new session
   */
  createSession(sessionKey: string, channel: string, chatId: string, userId: string): SessionEntry {
    const sessionId = randomUUID();
    const now = Date.now();

    const entry: SessionEntry = {
      sessionId,
      sessionKey,
      channel,
      chatId,
      userId,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      messageCount: 0,
      toolCallCount: 0,
      compactionCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostCents: 0,
      status: "active",
    };

    this.store[sessionKey] = entry;
    this.saveStore();
    return entry;
  }

  /**
   * Get session by key
   */
  getSession(sessionKey: string): SessionEntry | undefined {
    return this.store[sessionKey];
  }

  /**
   * Get session by ID
   */
  getSessionById(sessionId: string): SessionEntry | undefined {
    for (const entry of Object.values(this.store)) {
      if (entry.sessionId === sessionId) {
        return entry;
      }
    }
    return undefined;
  }

  /**
   * Update session activity
   */
  updateActivity(sessionKey: string, updates: Partial<SessionEntry>): SessionEntry | undefined {
    const entry = this.store[sessionKey];
    if (!entry) return undefined;

    Object.assign(entry, updates, {
      updatedAt: Date.now(),
      lastActivityAt: Date.now(),
    });

    this.saveStore();
    return entry;
  }

  /**
   * Increment message count
   */
  recordMessage(sessionKey: string, inputTokens: number = 0, outputTokens: number = 0, costCents: number = 0): void {
    const entry = this.store[sessionKey];
    if (!entry) return;

    entry.messageCount++;
    entry.totalInputTokens += inputTokens;
    entry.totalOutputTokens += outputTokens;
    entry.totalCostCents += costCents;
    entry.lastActivityAt = Date.now();
    entry.updatedAt = Date.now();

    this.saveStore();
  }

  /**
   * Record tool call
   */
  recordToolCall(sessionKey: string): void {
    const entry = this.store[sessionKey];
    if (!entry) return;

    entry.toolCallCount++;
    entry.updatedAt = Date.now();

    this.saveStore();
  }

  /**
   * Record compaction
   */
  recordCompaction(sessionKey: string): void {
    const entry = this.store[sessionKey];
    if (!entry) return;

    entry.compactionCount++;
    entry.updatedAt = Date.now();

    this.saveStore();
  }

  /**
   * Reset session (creates new session, preserves history)
   */
  resetSession(oldSessionKey: string, newChannel?: string): SessionEntry {
    const oldEntry = this.store[oldSessionKey];
    if (!oldEntry) {
      throw new Error(`Session not found: ${oldSessionKey}`);
    }

    // Archive old session
    oldEntry.status = "archived";

    // Create new session with same channel/chat
    const newSessionKey = `${oldEntry.channel}:${oldEntry.chatId}:${Date.now()}`;
    return this.createSession(
      newSessionKey,
      newChannel || oldEntry.channel,
      oldEntry.chatId,
      oldEntry.userId
    );
  }

  /**
   * List active sessions
   */
  listActiveSessions(): SessionEntry[] {
    return Object.values(this.store)
      .filter(e => e.status === "active")
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionKey: string): SessionEntry | undefined {
    return this.store[sessionKey];
  }

  /**
   * Archive idle sessions
   */
  archiveIdleSessions(idleThresholdMs: number = 3600000): number {
    const now = Date.now();
    let archived = 0;

    for (const entry of Object.values(this.store)) {
      if (entry.status === "active" && (now - entry.lastActivityAt) > idleThresholdMs) {
        entry.status = "idle";
        archived++;
      }
    }

    if (archived > 0) {
      this.saveStore();
    }

    return archived;
  }

  /**
   * Clean old archived sessions
   */
  cleanArchivedSessions(maxAgeMs: number = 86400000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of Object.entries(this.store)) {
      if (entry.status === "archived" && (now - entry.updatedAt) > maxAgeMs) {
        delete this.store[key];
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.saveStore();
    }

    return cleaned;
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  private loadStore(): void {
    try {
      if (existsSync(this.storePath)) {
        const data = readFileSync(this.storePath, "utf-8");
        this.store = JSON.parse(data) as SessionStore;
      }
    } catch (error) {
      console.error("[Session] Failed to load store:", error);
      this.store = {};
    }
  }

  private saveStore(): void {
    try {
      const dir = dirname(this.storePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.storePath, JSON.stringify(this.store, null, 2));
    } catch (error) {
      console.error("[Session] Failed to save store:", error);
    }
  }
}

/**
 * Generate session key from channel, chat ID, and optional agent ID
 */
export function generateSessionKey(channel: string, chatId: string, agentId: string = "default"): string {
  return `${channel}:${chatId}:${agentId}`;
}

/**
 * Parse session key into components
 */
export function parseSessionKey(sessionKey: string): { channel: string; chatId: string; agentId: string } {
  const parts = sessionKey.split(":");
  return {
    channel: parts[0] || "unknown",
    chatId: parts.slice(1, -1).join(":") || "unknown",
    agentId: parts[parts.length - 1] || "default",
  };
}
