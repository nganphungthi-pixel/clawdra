import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { resolve, join, dirname, extname, relative, isAbsolute } from "node:path";
import { homedir } from "node:os";

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  execute(input: unknown, context?: ToolContext): Promise<ToolResult>;
}

export enum ToolPermission {
  READ = "read",
  WRITE = "write",
  EDIT = "edit",
  BASH = "bash",
  WEB = "web",
  MCP = "mcp",
  MEMORY = "memory",
  SKILLS = "skills",
  BROWSER = "browser",
}

export interface ToolPermissionConfig {
  allowedPaths?: string[];
  blockedPaths?: string[];
  allowedCommands?: string[];
  blockedCommands?: string[];
  timeout?: number;
  sandbox?: boolean;
}

export interface ToolContext {
  toolCallId: string;
  workingDirectory: string;
  permissions: Set<ToolPermission>;
  config: ToolPermissionConfig;
}

const DEFAULT_PERMISSION_CONFIG: ToolPermissionConfig = {
  allowedPaths: [process.cwd()],
  blockedPaths: [],
  allowedCommands: [],
  blockedCommands: [],
  timeout: 120000,
  sandbox: true,
};

function resolvePath(path: string, workingDir: string): string {
  if (isAbsolute(path)) {
    return path;
  }
  return resolve(workingDir, path);
}

function isPathAllowed(path: string, config: ToolPermissionConfig): boolean {
  const resolved = resolvePath(path, config.allowedPaths?.[0] || process.cwd());
  
  for (const blocked of config.blockedPaths || []) {
    if (resolved.startsWith(blocked)) {
      return false;
    }
  }
  
  if (config.allowedPaths && config.allowedPaths.length > 0) {
    for (const allowed of config.allowedPaths) {
      if (resolved.startsWith(allowed)) {
        return true;
      }
    }
    return false;
  }
  
  return true;
}

const ReadInputSchema = z.object({
  filePath: z.string(),
  offset: z.number().optional(),
  limit: z.number().optional(),
});

type ReadInput = z.infer<typeof ReadInputSchema>;

export class ReadTool implements Tool {
  name = "Read";
  description = "Read file contents with optional offset and limit for pagination. Supports glob patterns (*, **, ?) and regex when searching.";
  inputSchema = ReadInputSchema;

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = ReadInputSchema.parse(input) as ReadInput;
    const filePath = resolvePath(parsed.filePath, context.workingDirectory);

    if (!isPathAllowed(filePath, context.config)) {
      return {
        toolCallId: context.toolCallId,
        content: `Error: Access denied to path ${filePath}`,
        isError: true,
      };
    }

    if (!existsSync(filePath)) {
      return {
        toolCallId: context.toolCallId,
        content: `Error: File not found: ${filePath}`,
        isError: true,
      };
    }

    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      const entries = readdirSync(filePath);
      return {
        toolCallId: context.toolCallId,
        content: entries.map(e => {
          const fullPath = join(filePath, e);
          const isDir = statSync(fullPath).isDirectory();
          return isDir ? `${e}/` : e;
        }).join("\n"),
      };
    }

    try {
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      const offset = parsed.offset ?? 1;
      const limit = parsed.limit ?? lines.length;

      const start = Math.max(0, offset - 1);
      const end = Math.min(lines.length, start + limit);

      const selectedLines = lines.slice(start, end);
      const lineNumbers = selectedLines.map((_, i) => start + i + 1);

      let output = "";
      for (let i = 0; i < selectedLines.length; i++) {
        output += `${lineNumbers[i]}: ${selectedLines[i]}\n`;
      }

      return {
        toolCallId: context.toolCallId,
        content: output,
      };
    } catch (error) {
      return {
        toolCallId: context.toolCallId,
        content: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}

const WriteInputSchema = z.object({
  filePath: z.string(),
  content: z.string(),
  append: z.boolean().optional(),
});

type WriteInput = z.infer<typeof WriteInputSchema>;

export class WriteTool implements Tool {
  name = "Write";
  description = "Create a new file or overwrite existing file with content. Use append option to add to existing files.";
  inputSchema = WriteInputSchema;

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = WriteInputSchema.parse(input) as WriteInput;
    const filePath = resolvePath(parsed.filePath, context.workingDirectory);

    if (!isPathAllowed(filePath, context.config)) {
      return {
        toolCallId: context.toolCallId,
        content: `Error: Access denied to path ${filePath}`,
        isError: true,
      };
    }

    try {
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      if (parsed.append && existsSync(filePath)) {
        const existing = readFileSync(filePath, "utf-8");
        writeFileSync(filePath, existing + parsed.content);
      } else {
        writeFileSync(filePath, parsed.content);
      }

      return {
        toolCallId: context.toolCallId,
        content: parsed.append ? `Appended to ${filePath}` : `Written to ${filePath}`,
      };
    } catch (error) {
      return {
        toolCallId: context.toolCallId,
        content: `Error writing file: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}

const EditInputSchema = z.object({
  filePath: z.string(),
  oldString: z.string(),
  newString: z.string(),
  replaceAll: z.boolean().optional(),
});

type EditInput = z.infer<typeof EditInputSchema>;

export class EditTool implements Tool {
  name = "Edit";
  description = "Edit a file by replacing specific text. Use replaceAll to replace all occurrences of oldString.";
  inputSchema = EditInputSchema;

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = EditInputSchema.parse(input) as EditInput;
    const filePath = resolvePath(parsed.filePath, context.workingDirectory);

    if (!isPathAllowed(filePath, context.config)) {
      return {
        toolCallId: context.toolCallId,
        content: `Error: Access denied to path ${filePath}`,
        isError: true,
      };
    }

    if (!existsSync(filePath)) {
      return {
        toolCallId: context.toolCallId,
        content: `Error: File not found: ${filePath}`,
        isError: true,
      };
    }

    try {
      let content = readFileSync(filePath, "utf-8");

      if (parsed.replaceAll) {
        const occurrences = (content.match(new RegExp(parsed.oldString.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
        if (occurrences === 0) {
          return {
            toolCallId: context.toolCallId,
            content: `Error: String not found in file: ${parsed.oldString}`,
            isError: true,
          };
        }
        content = content.split(parsed.oldString).join(parsed.newString);
        writeFileSync(filePath, content);
        return {
          toolCallId: context.toolCallId,
          content: `Replaced ${occurrences} occurrence(s) in ${filePath}`,
        };
      }

      const index = content.indexOf(parsed.oldString);
      if (index === -1) {
        return {
          toolCallId: context.toolCallId,
          content: `Error: String not found in file: ${parsed.oldString}`,
          isError: true,
        };
      }

      content = content.slice(0, index) + parsed.newString + content.slice(index + parsed.oldString.length);
      writeFileSync(filePath, content);

      return {
        toolCallId: context.toolCallId,
        content: `Edited ${filePath}`,
      };
    } catch (error) {
      return {
        toolCallId: context.toolCallId,
        content: `Error editing file: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}

const BashInputSchema = z.object({
  command: z.string(),
  timeout: z.number().optional(),
  workdir: z.string().optional(),
});

type BashInput = z.infer<typeof BashInputSchema>;

export class BashTool implements Tool {
  name = "Bash";
  description = "Execute shell commands. Supports Node.js built-in modules and common CLI tools.";
  inputSchema = BashInputSchema;

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = BashInputSchema.parse(input) as BashInput;
    const command = parsed.command;
    const workdir = parsed.workdir ? resolvePath(parsed.workdir, context.workingDirectory) : context.workingDirectory;

    for (const blocked of context.config.blockedCommands || []) {
      if (command.includes(blocked)) {
        return {
          toolCallId: context.toolCallId,
          content: `Error: Command blocked: ${blocked}`,
          isError: true,
        };
      }
    }

    const timeout = parsed.timeout ?? context.config.timeout ?? 120000;

    try {
      const { spawn } = await import("node:child_process");
      
      return new Promise((resolve) => {
        const proc = spawn("sh", ["-c", command], {
          cwd: workdir,
          env: { ...process.env },
          shell: true,
        });

        let stdout = "";
        let stderr = "";

        proc.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        proc.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        const timer = setTimeout(() => {
          proc.kill("SIGTERM");
          resolve({
            toolCallId: context.toolCallId,
            content: `Command timed out after ${timeout}ms`,
            isError: true,
          });
        }, timeout);

        proc.on("close", (code) => {
          clearTimeout(timer);
          const output = stdout + (stderr ? `\n${stderr}` : "");
          resolve({
            toolCallId: context.toolCallId,
            content: output || `Exited with code ${code}`,
          });
        });

        proc.on("error", (error) => {
          clearTimeout(timer);
          resolve({
            toolCallId: context.toolCallId,
            content: `Error: ${error.message}`,
            isError: true,
          });
        });
      });
    } catch (error) {
      return {
        toolCallId: context.toolCallId,
        content: `Error executing command: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}

const WebSearchInputSchema = z.object({
  query: z.string(),
  numResults: z.number().optional(),
});

type WebSearchInput = z.infer<typeof WebSearchInputSchema>;

export class WebSearchTool implements Tool {
  name = "WebSearch";
  description = "Search the web using AI-powered search. Returns relevant results with snippets.";
  inputSchema = WebSearchInputSchema;

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = WebSearchInputSchema.parse(input) as WebSearchInput;

    try {
      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.EXA_API_KEY || "",
        },
        body: JSON.stringify({
          query: parsed.query,
          numResults: parsed.numResults || 8,
        }),
      });

      if (!response.ok) {
        throw new Error(`WebSearch API error: ${response.status}`);
      }

      const data = await response.json() as {
        results: Array<{ title: string; url: string; snippet: string }>;
      };

      const results = data.results.map((r) => `- [${r.title}](${r.url})\n  ${r.snippet}`).join("\n\n");

      return {
        toolCallId: context.toolCallId,
        content: results,
      };
    } catch (error) {
      return {
        toolCallId: context.toolCallId,
        content: `WebSearch error: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}

const WebFetchInputSchema = z.object({
  url: z.string().url(),
  format: z.enum(["markdown", "text", "html"]).optional(),
});

type WebFetchInput = z.infer<typeof WebFetchInputSchema>;

export class WebFetchTool implements Tool {
  name = "WebFetch";
  description = "Fetch content from a URL. Returns content in specified format (markdown by default).";
  inputSchema = WebFetchInputSchema;

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = WebFetchInputSchema.parse(input) as WebFetchInput;

    try {
      const response = await fetch(parsed.url, {
        method: "GET",
        headers: {
          "User-Agent": "clawdra/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(`WebFetch error: ${response.status}`);
      }

      let content: string;
      if (parsed.format === "html") {
        content = await response.text();
      } else {
        content = await response.text();
      }

      return {
        toolCallId: context.toolCallId,
        content,
      };
    } catch (error) {
      return {
        toolCallId: context.toolCallId,
        content: `WebFetch error: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}

const MCPInputSchema = z.object({
  server: z.string(),
  tool: z.string(),
  input: z.record(z.unknown()),
});

type MCPInput = z.infer<typeof MCPInputSchema>;

export class MCPTool implements Tool {
  name = "MCP";
  description = "Execute tools from Model Context Protocol servers. Enables integration with external MCP-powered tools.";
  inputSchema = MCPInputSchema;

  private servers: Map<string, any> = new Map();

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = MCPInputSchema.parse(input) as MCPInput;

    try {
      const server = this.servers.get(parsed.server);
      if (!server) {
        return {
          toolCallId: context.toolCallId,
          content: `Error: MCP server not found: ${parsed.server}`,
          isError: true,
        };
      }

      const tool = server[parsed.tool];
      if (!tool) {
        return {
          toolCallId: context.toolCallId,
          content: `Error: MCP tool not found: ${parsed.tool}`,
          isError: true,
        };
      }

      const result = await tool(parsed.input);

      return {
        toolCallId: context.toolCallId,
        content: JSON.stringify(result),
      };
    } catch (error) {
      return {
        toolCallId: context.toolCallId,
        content: `MCP error: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }

  registerServer(name: string, server: any): void {
    this.servers.set(name, server);
  }
}

const MemoryInputSchema = z.object({
  action: z.enum(["read", "write", "delete", "search"]),
  key: z.string().optional(),
  value: z.string().optional(),
  query: z.string().optional(),
});

type MemoryInput = z.infer<typeof MemoryInputSchema>;

export class MemoryTool implements Tool {
  name = "Memory";
  description = "Persistent key-value storage for agent context. Supports read, write, delete, and search operations.";
  inputSchema = MemoryInputSchema;

  private storage: Map<string, string> = new Map();

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = MemoryInputSchema.parse(input) as MemoryInput;

    switch (parsed.action) {
      case "read": {
        const value = this.storage.get(parsed.key!);
        return {
          toolCallId: context.toolCallId,
          content: value || "",
        };
      }
      case "write": {
        this.storage.set(parsed.key!, parsed.value!);
        return {
          toolCallId: context.toolCallId,
          content: `Stored: ${parsed.key}`,
        };
      }
      case "delete": {
        const deleted = this.storage.delete(parsed.key!);
        return {
          toolCallId: context.toolCallId,
          content: deleted ? `Deleted: ${parsed.key}` : `Key not found: ${parsed.key}`,
        };
      }
      case "search": {
        const results: string[] = [];
        const query = parsed.query?.toLowerCase() || "";
        for (const [key, value] of this.storage) {
          if (key.toLowerCase().includes(query) || value.toLowerCase().includes(query)) {
            results.push(`${key}: ${value}`);
          }
        }
        return {
          toolCallId: context.toolCallId,
          content: results.join("\n") || "No results found",
        };
      }
    }
  }

  loadStorage(storage: Map<string, string>): void {
    this.storage = storage;
  }

  getStorage(): Map<string, string> {
    return this.storage;
  }
}

const SkillsInputSchema = z.object({
  action: z.enum(["load", "list", "execute"]),
  name: z.string().optional(),
  input: z.record(z.unknown()).optional(),
});

type SkillsInput = z.infer<typeof SkillsInputSchema>;

export class SkillsTool implements Tool {
  name = "Skills";
  description = "Load and execute specialized skills that provide domain-specific instructions and workflows.";
  inputSchema = SkillsInputSchema;

  private skills: Map<string, any> = new Map();

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = SkillsInputSchema.parse(input) as SkillsInput;

    switch (parsed.action) {
      case "load": {
        const skill = this.skills.get(parsed.name!);
        return {
          toolCallId: context.toolCallId,
          content: skill ? JSON.stringify(skill) : `Skill not found: ${parsed.name}`,
        };
      }
      case "list": {
        const names = Array.from(this.skills.keys()).join(", ");
        return {
          toolCallId: context.toolCallId,
          content: names || "No skills loaded",
        };
      }
      case "execute": {
        const skill = this.skills.get(parsed.name!);
        if (!skill) {
          return {
            toolCallId: context.toolCallId,
            content: `Skill not found: ${parsed.name}`,
            isError: true,
          };
        }
        const result = await skill.execute(parsed.input);
        return {
          toolCallId: context.toolCallId,
          content: JSON.stringify(result),
        };
      }
    }
  }

  loadSkill(name: string, skill: any): void {
    this.skills.set(name, skill);
  }

  getSkill(name: string): any {
    return this.skills.get(name);
  }
}

const BrowserInputSchema = z.object({
  action: z.enum(["navigate", "click", "type", "screenshot", "evaluate", "wait"]),
  url: z.string().url().optional(),
  selector: z.string().optional(),
  text: z.string().optional(),
  script: z.string().optional(),
  timeout: z.number().optional(),
});

type BrowserInput = z.infer<typeof BrowserInputSchema>;

export class BrowserTool implements Tool {
  name = "Browser";
  description = "Control a headless browser for web automation. Supports navigation, clicking, typing, and JavaScript execution.";
  inputSchema = BrowserInputSchema;

  private browser: any = null;
  private page: any = null;

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = BrowserInputSchema.parse(input) as BrowserInput;

    try {
      if (!this.browser) {
        const { chromium } = await import("playwright");
        this.browser = await chromium.launch({ headless: true });
        this.page = await this.browser.newPage();
      }

      switch (parsed.action) {
        case "navigate": {
          await this.page.goto(parsed.url!);
          return {
            toolCallId: context.toolCallId,
            content: `Navigated to ${parsed.url}`,
          };
        }
        case "click": {
          await this.page.click(parsed.selector!);
          return {
            toolCallId: context.toolCallId,
            content: `Clicked ${parsed.selector}`,
          };
        }
        case "type": {
          await this.page.fill(parsed.selector!, parsed.text!);
          return {
            toolCallId: context.toolCallId,
            content: `Typed in ${parsed.selector}`,
          };
        }
        case "screenshot": {
          const screenshot = await this.page.screenshot();
          return {
            toolCallId: context.toolCallId,
            content: `[Screenshot: ${screenshot.length} bytes]`,
          };
        }
        case "evaluate": {
          const result = await this.page.evaluate(parsed.script!);
          return {
            toolCallId: context.toolCallId,
            content: JSON.stringify(result),
          };
        }
        case "wait": {
          await this.page.waitForTimeout(parsed.timeout || 1000);
          return {
            toolCallId: context.toolCallId,
            content: "Waited",
          };
        }
      }
    } catch (error) {
      return {
        toolCallId: context.toolCallId,
        content: `Browser error: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

export class ToolExecutor {
  private tools: Map<string, Tool> = new Map();
  private context: ToolContext;

  constructor(config: ToolPermissionConfig = DEFAULT_PERMISSION_CONFIG) {
    this.context = {
      toolCallId: "",
      workingDirectory: process.cwd(),
      permissions: new Set([
        ToolPermission.READ,
        ToolPermission.WRITE,
        ToolPermission.EDIT,
        ToolPermission.BASH,
        ToolPermission.WEB,
        ToolPermission.MCP,
        ToolPermission.MEMORY,
        ToolPermission.SKILLS,
        ToolPermission.BROWSER,
      ]),
      config,
    };

    this.registerCoreTools();
    this.registerExtensionTools();
  }

  private registerCoreTools(): void {
    this.tools.set("Read", new ReadTool());
    this.tools.set("Write", new WriteTool());
    this.tools.set("Edit", new EditTool());
    this.tools.set("Bash", new BashTool());
  }

  private registerExtensionTools(): void {
    this.tools.set("WebSearch", new WebSearchTool());
    this.tools.set("WebFetch", new WebFetchTool());
    this.tools.set("MCP", new MCPTool());
    this.tools.set("Memory", new MemoryTool());
    this.tools.set("Skills", new SkillsTool());
    this.tools.set("Browser", new BrowserTool());
  }

  toolPermissionCheck(toolName: string): boolean {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return false;
    }

    const toolPermissionMap: Record<string, ToolPermission> = {
      Read: ToolPermission.READ,
      Write: ToolPermission.WRITE,
      Edit: ToolPermission.EDIT,
      Bash: ToolPermission.BASH,
      WebSearch: ToolPermission.WEB,
      WebFetch: ToolPermission.WEB,
      MCP: ToolPermission.MCP,
      Memory: ToolPermission.MEMORY,
      Skills: ToolPermission.SKILLS,
      Browser: ToolPermission.BROWSER,
    };

    const permission = toolPermissionMap[toolName];
    return permission ? this.context.permissions.has(permission) : false;
  }

  async executeTool(toolName: string, input: unknown, toolCallId?: string): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        toolCallId: toolCallId || "",
        content: `Error: Tool not found: ${toolName}`,
        isError: true,
      };
    }

    if (!this.toolPermissionCheck(toolName)) {
      return {
        toolCallId: toolCallId || "",
        content: `Error: Permission denied for tool: ${toolName}`,
        isError: true,
      };
    }

    const context: ToolContext = {
      ...this.context,
      toolCallId: toolCallId || crypto.randomUUID(),
    };

    const validatedInput = tool.inputSchema.parse(input);
    return tool.execute(validatedInput, context);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  setWorkingDirectory(dir: string): void {
    this.context.workingDirectory = dir;
  }

  setPermissions(permissions: Set<ToolPermission>): void {
    this.context.permissions = permissions;
  }

  addPermission(permission: ToolPermission): void {
    this.context.permissions.add(permission);
  }

  removePermission(permission: ToolPermission): void {
    this.context.permissions.delete(permission);
  }
}

export function createToolExecutor(config?: ToolPermissionConfig): ToolExecutor {
  return new ToolExecutor(config);
}