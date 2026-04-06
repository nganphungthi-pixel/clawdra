/**
 * Multi-Channel Support System
 * Supports Telegram, Discord, Slack, and more
 */

import { EventEmitter } from "node:events";
import { AgentLoop, AgentResult, StreamCallback } from "../agent/mod.js";
import { createProvider, Message } from "../providers/mod.js";

// ============================================
// CHANNEL TYPES
// ============================================

export type ChannelType = "telegram" | "discord" | "slack" | "whatsapp" | "cli" | "websocket" | "web" | "signal" | "irc" | "teams" | "matrix" | "line" | "wechat";

export interface ChannelMessage {
  id: string;
  channel: ChannelType;
  chatId: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: number;
  isGroup: boolean;
  replyTo?: string;
  attachments?: ChannelAttachment[];
  raw?: unknown;
}

export interface ChannelAttachment {
  type: "image" | "video" | "audio" | "document" | "voice";
  url?: string;
  data?: Buffer;
  mimeType?: string;
  fileName?: string;
}

export interface ChannelConfig {
  enabled: boolean;
  token?: string;
  webhook?: string;
  allowedChats?: string[];
  blockedUsers?: string[];
  isGroupEnabled: boolean;
  mentionRequired: boolean;
}

export interface ChannelSendOptions {
  chatId: string;
  content: string;
  replyTo?: string;
  parseMode?: "markdown" | "html" | "text";
  attachments?: ChannelAttachment[];
}

// ============================================
// CHANNEL INTERFACE
// ============================================

export interface ChannelAdapter extends EventEmitter {
  readonly type: ChannelType;
  readonly name: string;

  start(): Promise<void>;
  stop(): Promise<void>;
  sendMessage(options: ChannelSendOptions): Promise<void>;
  isConnected(): boolean;
}

// ============================================
// CHANNEL MANAGER
// ============================================

export class ChannelManager {
  private channels: Map<ChannelType, ChannelAdapter> = new Map();
  private agentLoops: Map<string, AgentLoop> = new Map();
  private sessionChatMap: Map<string, string> = new Map();

  async registerChannel(channel: ChannelAdapter): Promise<void> {
    this.channels.set(channel.type, channel);

    channel.on("message", (message: ChannelMessage) => {
      this.handleMessage(message);
    });

    channel.on("error", (error: Error) => {
      console.error(`[${channel.name}] Error:`, error.message);
    });
  }

  getChannel(type: ChannelType): ChannelAdapter | undefined {
    return this.channels.get(type);
  }

  getActiveChannels(): ChannelType[] {
    const active: ChannelType[] = [];
    for (const [type, channel] of this.channels) {
      if (channel.isConnected()) {
        active.push(type);
      }
    }
    return active;
  }

  private async handleMessage(message: ChannelMessage): Promise<void> {
    const sessionKey = `${message.channel}:${message.chatId}`;
    let agentLoop = this.agentLoops.get(sessionKey);

    if (!agentLoop) {
      agentLoop = new AgentLoop({
        stream: false,
        maxIterations: 30,
      });
      this.agentLoops.set(sessionKey, agentLoop);
    }

    this.sessionChatMap.set(sessionKey, message.chatId);

    const callback: StreamCallback = {
      onContent: async (content: string) => {
        const channel = this.channels.get(message.channel);
        if (channel) {
          await channel.sendMessage({
            chatId: message.chatId,
            content,
            replyTo: message.id,
          });
        }
      },
      onDone: async (result: AgentResult) => {
        if (!result.content) return;
        const channel = this.channels.get(message.channel);
        if (channel) {
          await channel.sendMessage({
            chatId: message.chatId,
            content: result.content,
            replyTo: message.id,
          });
        }
      },
      onError: async (error: Error) => {
        const channel = this.channels.get(message.channel);
        if (channel) {
          await channel.sendMessage({
            chatId: message.chatId,
            content: `❌ Error: ${error.message}`,
            replyTo: message.id,
          });
        }
      },
    };

    await agentLoop.runAgentStream(message.content, callback);
  }

  async startAll(): Promise<void> {
    for (const channel of this.channels.values()) {
      try {
        await channel.start();
        console.log(`✅ Channel started: ${channel.name}`);
      } catch (error) {
        console.error(`❌ Failed to start channel ${channel.name}:`, error);
      }
    }
  }

  async stopAll(): Promise<void> {
    for (const channel of this.channels.values()) {
      try {
        await channel.stop();
      } catch (error) {
        console.error(`Failed to stop channel ${channel.name}:`, error);
      }
    }
  }
}

// ============================================
// TELEGRAM CHANNEL
// ============================================

export class TelegramChannel extends EventEmitter implements ChannelAdapter {
  readonly type: ChannelType = "telegram";
  readonly name = "Telegram";

  private token: string;
  private bot: any = null;
  private connected = false;

  constructor(config: ChannelConfig) {
    super();
    this.token = config.token || process.env.TELEGRAM_BOT_TOKEN || "";
  }

  async start(): Promise<void> {
    if (!this.token) {
      console.log("⚠️ Telegram not configured - skipping");
      return;
    }

    try {
      // Lazy import node-telegram-bot-api
      const TelegramBot = (await import("node-telegram-bot-api")).default;

      this.bot = new TelegramBot(this.token, { polling: true });

      this.bot.on("message", (msg: any) => {
        const message: ChannelMessage = {
          id: String(msg.message_id),
          channel: "telegram",
          chatId: String(msg.chat.id),
          userId: String(msg.from?.id || ""),
          userName: msg.from?.username || msg.from?.first_name || "Unknown",
          content: msg.text || "",
          timestamp: msg.date * 1000,
          isGroup: msg.chat.type !== "private",
          replyTo: msg.reply_to_message ? String(msg.reply_to_message.message_id) : undefined,
          raw: msg,
        };

        this.emit("message", message);
      });

      this.bot.on("error", (error: Error) => {
        this.emit("error", error);
      });

      this.connected = true;
      const botInfo = await this.bot.getMe();
      console.log(`🤖 Telegram bot started: @${botInfo.username}`);
    } catch (error) {
      console.error("Failed to start Telegram channel:", error);
      this.connected = false;
    }
  }

  async stop(): Promise<void> {
    if (this.bot) {
      this.bot.stopPolling();
      this.connected = false;
    }
  }

  async sendMessage(options: ChannelSendOptions): Promise<void> {
    if (!this.bot) return;

    try {
      await this.bot.sendMessage(options.chatId, options.content, {
        reply_to_message_id: options.replyTo ? parseInt(options.replyTo) : undefined,
        parse_mode: options.parseMode === "markdown" ? "Markdown" : undefined,
      });
    } catch (error) {
      console.error("Telegram send message error:", error);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// ============================================
// DISCORD CHANNEL
// ============================================

export class DiscordChannel extends EventEmitter implements ChannelAdapter {
  readonly type: ChannelType = "discord";
  readonly name = "Discord";

  private token: string;
  private client: any = null;
  private connected = false;

  constructor(config: ChannelConfig) {
    super();
    this.token = config.token || process.env.DISCORD_BOT_TOKEN || "";
  }

  async start(): Promise<void> {
    if (!this.token) {
      console.log("⚠️ Discord not configured - skipping");
      return;
    }

    try {
      const { Client, GatewayIntentBits } = await import("discord.js");

      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
        ],
      });

      this.client.on("messageCreate", (msg: any) => {
        if (msg.author.bot) return;

        const message: ChannelMessage = {
          id: msg.id,
          channel: "discord",
          chatId: msg.channel.id,
          userId: msg.author.id,
          userName: msg.author.username,
          content: msg.content,
          timestamp: msg.createdTimestamp,
          isGroup: msg.guild !== null,
          raw: msg,
        };

        this.emit("message", message);
      });

      await this.client.login(this.token);
      this.connected = true;
      console.log(`🤖 Discord bot started: ${this.client.user?.tag}`);
    } catch (error) {
      console.error("Failed to start Discord channel:", error);
      this.connected = false;
    }
  }

  async stop(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.connected = false;
    }
  }

  async sendMessage(options: ChannelSendOptions): Promise<void> {
    if (!this.client) return;

    try {
      const channel = await this.client.channels.fetch(options.chatId);
      if (channel && "send" in channel) {
        await channel.send(options.content);
      }
    } catch (error) {
      console.error("Discord send message error:", error);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// ============================================
// SLACK CHANNEL
// ============================================

export class SlackChannel extends EventEmitter implements ChannelAdapter {
  readonly type: ChannelType = "slack";
  readonly name = "Slack";

  private token: string;
  private app: any = null;
  private server: any = null;
  private connected = false;

  constructor(config: ChannelConfig) {
    super();
    this.token = config.token || process.env.SLACK_BOT_TOKEN || "";
  }

  async start(): Promise<void> {
    if (!this.token) {
      console.log("⚠️ Slack not configured - skipping");
      return;
    }

    try {
      const { App } = await import("@slack/bolt");

      this.app = new App({
        token: this.token,
        signingSecret: process.env.SLACK_SIGNING_SECRET || "dummy",
        socketMode: true,
        appToken: process.env.SLACK_APP_TOKEN,
      });

      this.app.message(async ({ message, say }: any) => {
        if (typeof message.text !== "string") return;

        const msg: ChannelMessage = {
          id: message.ts,
          channel: "slack",
          chatId: message.channel,
          userId: message.user || "",
          userName: message.username || message.user || "Unknown",
          content: message.text,
          timestamp: parseInt(message.ts) * 1000,
          isGroup: false,
          raw: message,
        };

        this.emit("message", msg);
      });

      await this.app.start(parseInt(process.env.SLACK_PORT || "3000"));
      this.connected = true;
      console.log("🤖 Slack bot started");
    } catch (error) {
      console.error("Failed to start Slack channel:", error);
      this.connected = false;
    }
  }

  async stop(): Promise<void> {
    if (this.app) {
      await this.app.stop();
      this.connected = false;
    }
  }

  async sendMessage(options: ChannelSendOptions): Promise<void> {
    if (!this.app) return;

    try {
      await this.app.client.chat.postMessage({
        channel: options.chatId,
        text: options.content,
        thread_ts: options.replyTo,
      });
    } catch (error) {
      console.error("Slack send message error:", error);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// ============================================
// WEBHOOK CHANNEL (Generic HTTP)
// ============================================

export class WebhookChannel extends EventEmitter implements ChannelAdapter {
  readonly type: ChannelType = "web";
  readonly name = "Webhook";

  private server: any = null;
  private connected = false;
  private port: number;

  constructor(config: ChannelConfig) {
    super();
    this.port = parseInt(config.webhook || "4000");
  }

  async start(): Promise<void> {
    const { createServer } = await import("node:http");

    this.server = createServer(async (req: any, res: any) => {
      if (req.method === "POST" && req.url === "/webhook") {
        let body = "";
        req.on("data", (chunk: any) => (body += chunk));
        req.on("end", () => {
          try {
            const data = JSON.parse(body);
            const message: ChannelMessage = {
              id: data.id || crypto.randomUUID(),
              channel: "web",
              chatId: data.chatId || "default",
              userId: data.userId || "anonymous",
              userName: data.userName || "Web User",
              content: data.content || data.message || "",
              timestamp: Date.now(),
              isGroup: false,
              raw: data,
            };
            this.emit("message", message);
          } catch (error) {
            // Ignore parse errors
          }
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    this.server.listen(this.port, () => {
      this.connected = true;
      console.log(`🌐 Webhook server started on port ${this.port}`);
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
      this.connected = false;
    }
  }

  async sendMessage(options: ChannelSendOptions): Promise<void> {
    // For webhook, we just log - responses go back through the request
    console.log(`[Webhook] Response for ${options.chatId}: ${options.content}`);
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// ============================================
// FACTORY
// ============================================

export function createChannel(type: ChannelType, config: ChannelConfig): ChannelAdapter {
  switch (type) {
    case "telegram":
      return new TelegramChannel(config);
    case "discord":
      return new DiscordChannel(config);
    case "slack":
      return new SlackChannel(config);
    case "web":
      return new WebhookChannel(config);
    default:
      throw new Error(`Unsupported channel type: ${type}`);
  }
}

export function createChannelManager(): ChannelManager {
  return new ChannelManager();
}
