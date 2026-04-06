/**
 * Config System
 * Includes, env var substitution, validation, atomic writes, audit log
 * File watcher for hot-reload
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { EventEmitter } from "node:events";
import { z } from "zod";

export interface ConfigIO {
  loadConfig(): Promise<Record<string, unknown>>;
  writeConfigFile(config: Record<string, unknown>): Promise<void>;
  getRuntimeConfig(): Record<string, unknown>;
  setRuntimeConfig(config: Record<string, unknown>): void;
  onReload(handler: (config: Record<string, unknown>) => void): void;
}

export interface ConfigAuditEntry {
  timestamp: number;
  action: "write" | "restore";
  beforeHash: string;
  afterHash: string;
  source: string;
}

const ConfigSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  thinkingLevel: z.string().optional(),
  maxIterations: z.number().optional(),
  enableLearning: z.boolean().optional(),
  enableSandbox: z.boolean().optional(),
  sandboxType: z.enum(["docker", "process", "none"]).optional(),
  channels: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
}).passthrough();

export class ConfigManager extends EventEmitter implements ConfigIO {
  private configPath: string;
  private stateDir: string;
  private auditLogPath: string;
  private backupPath: string;
  private runtimeConfig: Record<string, unknown> | null = null;
  private cachedConfig: Record<string, unknown> | null = null;
  private fileWatcher: ReturnType<typeof setInterval> | null = null;
  private lastMtimeMs = 0;
  private maxBackups = 10;

  constructor(configPath: string, stateDir: string) {
    super();
    this.configPath = resolve(configPath);
    this.stateDir = resolve(stateDir);
    this.auditLogPath = join(this.stateDir, "config-audit.jsonl");
    this.backupPath = join(this.stateDir, "config-backups");
  }

  /**
   * Start file watcher for hot-reload
   */
  startWatching(): void {
    if (this.fileWatcher) return;

    this.fileWatcher = setInterval(() => {
      try {
        if (existsSync(this.configPath)) {
          const { mtimeMs } = require("node:fs").statSync(this.configPath);
          if (mtimeMs > this.lastMtimeMs && this.lastMtimeMs > 0) {
            this.loadConfig().then(config => {
              this.emit("reload", config);
            }).catch(() => {});
          }
          this.lastMtimeMs = mtimeMs;
        }
      } catch {
        // File watch errors are non-fatal
      }
    }, 2000);
  }

  stopWatching(): void {
    if (this.fileWatcher) {
      clearInterval(this.fileWatcher);
      this.fileWatcher = null;
    }
  }

  /**
   * Load config with include resolution and env var substitution
   */
  async loadConfig(): Promise<Record<string, unknown>> {
    if (this.runtimeConfig) {
      return { ...this.runtimeConfig };
    }

    if (this.cachedConfig) {
      return { ...this.cachedConfig };
    }

    if (!existsSync(this.configPath)) {
      const defaultConfig = this.createDefaultConfig();
      this.saveConfig(defaultConfig);
      return defaultConfig;
    }

    try {
      let content = readFileSync(this.configPath, "utf-8");
      this.lastMtimeMs = require("node:fs").statSync(this.configPath).mtimeMs;

      // Resolve $include directives
      content = this.resolveIncludes(content);

      // Resolve ${ENV_VAR} references
      content = this.resolveEnvVars(content);

      const config = JSON.parse(content) as Record<string, unknown>;

      // Validate
      const result = ConfigSchema.safeParse(config);
      if (!result.success) {
        console.warn(`[Config] Validation warnings:`, result.error.errors);
      }

      this.cachedConfig = config;
      return { ...config };
    } catch (error) {
      console.error(`[Config] Failed to load config from ${this.configPath}:`, error);
      return this.createDefaultConfig();
    }
  }

  /**
   * Write config with atomic write, backup rotation, and audit log
   */
  async writeConfigFile(config: Record<string, unknown>): Promise<void> {
    const beforeHash = this.hashConfig(this.cachedConfig || {});
    const afterHash = this.hashConfig(config);

    // Create backup
    await this.createBackup();

    // Atomic write: write to temp, then rename
    const tempPath = this.configPath + ".tmp";
    writeFileSync(tempPath, JSON.stringify(config, null, 2));
    renameSync(tempPath, this.configPath);

    // Update cache
    this.cachedConfig = { ...config };
    this.runtimeConfig = null;

    // Audit log
    await this.writeAuditEntry({
      timestamp: Date.now(),
      action: "write",
      beforeHash,
      afterHash,
      source: "writeConfigFile",
    });

    this.emit("change", config);
  }

  /**
   * Get runtime config snapshot
   */
  getRuntimeConfig(): Record<string, unknown> {
    if (this.runtimeConfig) {
      return { ...this.runtimeConfig };
    }
    return this.cachedConfig ? { ...this.cachedConfig } : this.createDefaultConfig();
  }

  /**
   * Set runtime config (replaces file config temporarily)
   */
  setRuntimeConfig(config: Record<string, unknown>): void {
    this.runtimeConfig = { ...config };
  }

  /**
   * Apply patch to current config
   */
  async applyPatch(patch: Record<string, unknown>): Promise<void> {
    const current = await this.loadConfig();
    const merged = this.deepMerge(current, patch);
    await this.writeConfigFile(merged);
  }

  /**
   * Subscribe to config reloads
   */
  onReload(handler: (config: Record<string, unknown>) => void): void {
    this.on("reload", handler);
  }

  // ============================================
  // INCLUDE RESOLUTION
  // ============================================

  private resolveIncludes(content: string): string {
    // $include: "path/to/file.json"
    const includeRegex = /\$include:\s*["']([^"']+)["']/g;
    const visited = new Set<string>();

    return content.replace(includeRegex, (match, includePath) => {
      const resolved = resolve(dirname(this.configPath), includePath);

      // Circular dependency guard
      if (visited.has(resolved)) {
        console.warn(`[Config] Circular include detected: ${resolved}`);
        return "{}";
      }

      visited.add(resolved);

      try {
        if (existsSync(resolved)) {
          return readFileSync(resolved, "utf-8");
        }
      } catch {
        console.warn(`[Config] Failed to resolve include: ${resolved}`);
      }

      return "{}";
    });
  }

  // ============================================
  // ENV VAR SUBSTITUTION
  // ============================================

  private resolveEnvVars(content: string): string {
    // ${ENV_VAR} or ${ENV_VAR:-default}
    const envRegex = /\$\{([^}]+)\}/g;

    return content.replace(envRegex, (match, expr) => {
      const [varName, defaultValue] = expr.split(":-");
      return process.env[varName] || defaultValue || "";
    });
  }

  // ============================================
  // BACKUP MANAGEMENT
  // ============================================

  private async createBackup(): Promise<void> {
    if (!existsSync(this.configPath)) return;

    try {
      if (!existsSync(this.backupPath)) {
        mkdirSync(this.backupPath, { recursive: true });
      }

      const timestamp = Date.now();
      const backupFile = join(this.backupPath, `config-${timestamp}.json`);
      copyFileSync(this.configPath, backupFile);

      // Rotate old backups
      this.rotateBackups();
    } catch (error) {
      console.error("[Config] Failed to create backup:", error);
    }
  }

  private rotateBackups(): void {
    try {
      const { readdirSync, unlinkSync, statSync } = require("node:fs");
      if (!existsSync(this.backupPath)) return;

      const backups = readdirSync(this.backupPath)
        .map((f: string) => ({ name: f, time: statSync(join(this.backupPath, f)).mtimeMs }))
        .sort((a: { time: number }, b: { time: number }) => b.time - a.time);

      while (backups.length > this.maxBackups) {
        const old = backups.pop();
        if (old) {
          unlinkSync(join(this.backupPath, old.name));
        }
      }
    } catch {
      // Non-fatal
    }
  }

  // ============================================
  // AUDIT LOG
  // ============================================

  private async writeAuditEntry(entry: ConfigAuditEntry): Promise<void> {
    try {
      if (!existsSync(this.stateDir)) {
        mkdirSync(this.stateDir, { recursive: true });
      }

      const line = JSON.stringify(entry) + "\n";
      require("node:fs").appendFileSync(this.auditLogPath, line);
    } catch (error) {
      console.error("[Config] Failed to write audit entry:", error);
    }
  }

  // ============================================
  // UTILITIES
  // ============================================

  private hashConfig(config: Record<string, unknown>): string {
    const content = JSON.stringify(config);
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    const result = { ...target };

    for (const key of Object.keys(source)) {
      const sourceVal = source[key];
      const targetVal = target[key];

      if (sourceVal && typeof sourceVal === "object" && !Array.isArray(sourceVal) &&
          targetVal && typeof targetVal === "object" && !Array.isArray(targetVal)) {
        result[key] = this.deepMerge(targetVal as Record<string, unknown>, sourceVal as Record<string, unknown>);
      } else {
        result[key] = sourceVal;
      }
    }

    return result;
  }

  private saveConfig(config: Record<string, unknown>): void {
    try {
      const dir = dirname(this.configPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      this.cachedConfig = config;
    } catch (error) {
      console.error("[Config] Failed to save default config:", error);
    }
  }

  private createDefaultConfig(): Record<string, unknown> {
    return {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      maxTokens: 8192,
      temperature: 0.7,
      thinkingLevel: "medium",
      maxIterations: 50,
      enableLearning: true,
      enableSandbox: false,
      sandboxType: "process",
      channels: ["cli"],
      skills: [],
    };
  }
}
