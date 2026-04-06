# clawdra (अलूचात) Architecture Document

**Version:** 1.0  
**Status:** Draft  
**Created:** 2026-04-05

---

## 1. NAME AND VISION

### 1.1 Project Name

```
clawdra (अलूचात)
```

The name "clawdra" draws from Nepali/Hindi, meaning "potato chat" — a humble tuber that adapts, grows in complexity, and feeds intelligence. It represents an AI agent that starts simple but becomes exponentially capable through learning and iteration.

### 1.2 Mission

Build the smartest AI coding agent, smarter than Claude.

### 1.3 Inspiration

- **OpenClaw** — Autonomous coding agent architecture
- **MetaGPT** — Multi-agent collaboration framework
- **everything-claude-code** — Full-stack coding capabilities
- **oh-my-claudecode** — Claude Code enhancements and extensions

### 1.4 Core Philosophy

1. **Adaptive Learning** — Learn from every interaction and mistake
2. **Multi-Model Intelligence** — Ensemble reasoning across providers
3. **Persistent Context** — Never lose sight of the goal across sessions
4. **Tool Mastery** — Extend capabilities through tools, not just prompting
5. **Continuous Improvement** — Self-evolve through pattern recognition

---

## 2. CORE ARCHITECTURE COMPONENTS

### 2.1 Provider Abstraction Layer

#### Overview

The Provider Abstraction Layer (PAL) provides a unified interface for all supported AI providers. It abstracts API differences, handles authentication, manages rate limits, and provides intelligent model routing with automatic failover.

#### Supported Providers

| Provider | API Style | Authentication | Status |
|----------|-----------|----------------|--------|
| Anthropic | OpenAI-compatible | API Key | Required |
| OpenAI | OpenAI-compatible | API Key | Required |
| OpenRouter | OpenAI-compatible | API Key | Required |
| Ollama | OpenAI-compatible | Local/None | Optional |
| Gemini | Google-specific | API Key | Required |
| Bedrock | AWS-specific | AWS Credentials | Required |
| vLLM | OpenAI-compatible | Local/None | Optional |

#### Key Interfaces

```typescript
interface Provider {
  id: string;
  name: string;
  baseURL: string;
  
  // Model listing
  listModels(): Promise<Model[]>;
  
  // Completions
  createChatCompletion(
    params: ChatCompletionParams
  ): Promise<ChatCompletionResponse>;
  
  createStreamingCompletion(
    params: ChatCompletionParams,
    onChunk: (chunk: ChatCompletionChunk) => void
  ): Promise<void>;
  
  // Embeddings
  createEmbedding(
    params: EmbeddingParams
  ): Promise<EmbeddingResponse>;
  
  // Health check
  ping(): Promise<boolean>;
}

interface ChatCompletionParams {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  tools?: Tool[];
  toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
  stream?: boolean;
}

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ToolCall[];
  name?: string;
  toolCallId?: string;
}

interface Model {
  id: string;
  provider: string;
  contextWindow: number;
  maxTokens: number;
  pricing?: {
    input: number;
    output: number;
  };
  capabilities: ("chat" | "embedding" | "function-calling" | "vision")[];
}
```

#### Model Routing Strategy

```typescript
interface RouterConfig {
  // Task complexity assessment
  complexityThreshold: {
    simple: number;    // 0-30: Basic edits, read operations
    medium: number;    // 31-70: Feature implementation, debugging
    complex: number;   // 71-100: Architecture, full-stack, multi-file
  };
  
  // Routing rules
  routes: {
    simple: string[];     // Fast, cheap models (e.g., gpt-4o-mini)
    medium: string[];     // Balanced models (e.g., gpt-4o, claude-3.5-sonnet)
    complex: string[];    // Capable models (e.g., claude-3-opus, gpt-4-turbo)
    reasoning: string[];  // Reasoning models for complex logic
  };
  
  // Failover configuration
  failover: {
    enabled: boolean;
    maxRetries: number;
    retryDelay: number;
  };
}

class ProviderRouter {
  constructor(config: RouterConfig, providers: Provider[]);
  
  // Select optimal model based on task
  selectModel(task: TaskAnalysis): string;
  
  // Execute with automatic failover
  async executeWithFailover<T>(
    operation: (provider: Provider) => Promise<T>,
    preferredProviders: string[]
  ): Promise<T>;
  
  // Health-aware routing
  async getHealthyProvider(): Promise<Provider>;
}
```

#### Implementation Requirements

1. **Unified Response Format** — All providers return in OpenAI-compatible format
2. **Streaming passthrough** — Binary-mode streaming from upstream providers
3. **Token tracking** — Accurate token counting per model for cost estimation
4. **Caching layer** — Cache repeated identical requests
5. **Connection pooling** — Reuse HTTP connections per provider

---

### 2.2 Tool System

#### Core Tools (4)

The tool system provides four foundational operations that enable the agent to interact with the external world.

##### 2.2.1 Read Tool

**Purpose:** Read files and search for content using glob patterns and grep.

```typescript
interface ReadTool {
  name: "read";
  description: "Read file contents or search files by pattern";
  
  parameters: z.object({
    filePath: z.string().describe("File path or glob pattern"),
    limit: z.number().optional().default(2000),
    offset: z.number().optional().default(1),
    pattern: z.string().optional().describe("Regex pattern to search"),
    include: z.string().optional().describe("File extension filter"),
  });
  
  execute(params: ReadParams): Promise<ReadResult>;
}

interface ReadParams {
  filePath: string;
  limit?: number;
  offset?: number;
  pattern?: string;
  include?: string;
}

interface ReadResult {
  success: boolean;
  content: string;
  matches?: Match[];
  error?: string;
}

interface Match {
  file: string;
  line: number;
  content: string;
}
```

##### 2.2.2 Write Tool

**Purpose:** Create new files or overwrite existing files.

```typescript
interface WriteTool {
  name: "write";
  description: "Create or overwrite a file";
  
  parameters: z.object({
    filePath: z.string().describe("Absolute path to the file"),
    content: z.string().describe("File content to write"),
  });
  
  execute(params: WriteParams): Promise<WriteResult>;
}

interface WriteParams {
  filePath: string;
  content: string;
}

interface WriteResult {
  success: boolean;
  bytesWritten: number;
  error?: string;
}
```

##### 2.2.3 Edit Tool

**Purpose:** Modify specific portions of existing files using string replacement.

```typescript
interface EditTool {
  name: "edit";
  description: "Edit a file using exact string replacement";
  
  parameters: z.object({
    filePath: z.string().describe("Absolute path to the file"),
    oldString: z.string().describe("Text to replace"),
    newString: z.string().describe("Replacement text"),
    replaceAll: z.boolean().optional().default(false),
  });
  
  execute(params: EditParams): Promise<EditResult>;
}

interface EditParams {
  filePath: string;
  oldString: string;
  newString: string;
  replaceAll?: boolean;
}

interface EditResult {
  success: boolean;
  replacements: number;
  error?: string;
}
```

##### 2.2.4 Bash Tool

**Purpose:** Execute shell commands for system operations.

```typescript
interface BashTool {
  name: "bash";
  description: "Execute shell commands";
  
  parameters: z.object({
    command: z.string().describe("Command to execute"),
    timeout: z.number().optional().default(120000),
    workdir: z.string().optional().describe("Working directory"),
  });
  
  execute(params: BashParams): Promise<BashResult>;
}

interface BashParams {
  command: string;
  timeout?: number;
  workdir?: string;
}

interface BashResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  runtime: number;
}
```

#### Tool Extensions

##### 2.2.5 Browser Tool

Headless browser control for web interactions.

```typescript
interface BrowserTool {
  name: "browser";
  
  actions: {
    navigate(url: string): Promise<void>;
    click(selector: string): Promise<void>;
    type(selector: string, text: string): Promise<void>;
    screenshot(): Promise<string>;
    evaluate<T>(fn: string): Promise<T>;
    // ... additional actions
  };
}
```

##### 2.2.6 MCP (Model Context Protocol) Tool

Integration with MCP servers for extended capabilities.

```typescript
interface MCPTool {
  name: "mcp";
  
  connect(server: string, config: MCPConfig): Promise<void>;
  call<T>(tool: string, params: Record<string, unknown>): Promise<T>;
  list(): Promise<MCPService[]>;
  disconnect(server: string): Promise<void>;
}
```

##### 2.2.7 Web Search Tool

Real-time web search capabilities.

```typescript
interface WebSearchTool {
  name: "websearch";
  
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  fetch(url: string, format?: "text" | "markdown" | "html"): Promise<string>;
}
```

##### 2.2.8 Memory Tool

Persistent memory access for context.

```typescript
interface MemoryTool {
  name: "memory";
  
  store(key: string, value: unknown): Promise<void>;
  retrieve(key: string): Promise<unknown>;
  search(query: string): Promise<MemoryEntry[]>;
  delete(key: string): Promise<void>;
}
```

##### 2.2.9 Skills Tool

Dynamic skill loading and execution.

```typescript
interface SkillsTool {
  name: "skills";
  
  load(name: string): Promise<Skill>;
  list(): Promise<Skill[]>;
  execute<T>(name: string, params: Record<string, unknown>): Promise<T>;
}
```

#### Tool Registry

```typescript
interface ToolRegistry {
  // Register a tool
  register(tool: Tool): void;
  
  // Get tool by name
  get(name: string): Tool | undefined;
  
  // List all tools
  list(): Tool[];
  
  // Validate tool parameters
  validate(name: string, params: unknown): ValidationResult;
  
  // Execute tool with permission check
  execute(
    name: string,
    params: unknown,
    context: ExecutionContext
  ): Promise<ToolResult>;
}
```

---

### 2.3 Agent Loop

#### Overview

The agent loop is the core execution engine that processes user queries through a continuous cycle of thinking, tool execution, and response generation.

#### Loop Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        QUERY INPUT                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────���─���
│                    ┌───────────────────┐                        │
│                    │    THINK PHASE    │                        │
│                    │  - Parse intent  │                        │
│                    │  - Analyze task │                        │
│                    │  - Plan actions │                        │
│                    └───────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ┌───────────────────┐                         │
│                   │  TOOL CALL PHASE  │                         │
│                   │ - Select tools  │                         │
│                   │ - Build params  │                         │
│                   │ - Validate     │                         │
│                   └───────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                ┌───────────────────────┐                         │
│                │  EXECUTION PHASE      │                         │
│                │ - Permission check   │                         │
│                │ - Execute tool       │                         │
│                │ - Handle errors      │                         │
│                └───────────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                ┌───────────────────────┐                         │
│                │  RESPONSE PHASE       │                         │
│                │ - Format output      │                         │
│                │ - Stream if needed   │                         │
│                │ - Check for continue │                         │
│                └───────────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌─────────────┴─────────────┐
              │   Continue?             │
              │   (yes) → Think Phase    │
              │   (no) → END            │
              └─────────────────────────┘
```

#### Implementation

```typescript
interface AgentLoop {
  constructor(config: AgentConfig);
  
  // Run agent on a single query
  run(query: string, context?: RunContext): Promise<RunResult>;
  
  // Run with streaming
  runStream(
    query: string,
    context: RunContext,
    onChunk: (chunk: Chunk) => void
  ): Promise<void>;
}

interface AgentConfig {
  provider: Provider;
  router: ProviderRouter;
  tools: ToolRegistry;
  maxIterations: number;
  maxTokensPerIteration: number;
  loopDetectionThreshold: number;
  streamingEnabled: boolean;
}

interface RunContext {
  sessionId?: string;
  systemPrompt?: string;
  files?: string[];
  resume?: boolean;
}

interface Chunk {
  type: "text" | "tool-call" | "tool-result" | "error" | "done";
  content: string;
}
```

#### Task Analysis

```typescript
interface TaskAnalyzer {
  // Analyze query complexity (0-100)
  analyzeComplexity(query: string, context?: FileContext): number;
  
  // Determine required tools
  identifyTools(query: string, context?: FileContext): ToolRequirement[];
  
  // Extract key entities
  extractEntities(query: string): Entity[];
  
  // Build execution plan
  buildPlan(query: string, context?: FileContext): ExecutionPlan;
}

interface ExecutionPlan {
  steps: PlanStep[];
  estimatedIterations: number;
  requiredModels: string[];
}

interface PlanStep {
  id: string;
  action: "read" | "write" | "edit" | "bash" | "custom";
  target?: string;
  params?: Record<string, unknown>;
  dependsOn: string[];
}
```

#### Loop Detection

```typescript
interface LoopDetector {
  constructor(threshold: number);
  
  // Record an iteration
  record(plan: ExecutionPlan, result: StepResult): void;
  
  // Detect loops
  detect(): LoopDetection | null;
  
  // Clear history
  clear(): void;
}

interface LoopDetection {
  type: "repetition" | "oscillation" | "dead-end";
  lastN: number;
  description: string;
}
```

---

### 2.4 Gateway (Control Plane)

#### Overview

The Gateway is the control plane that manages client connections, routing, session state, and tool execution dispatch via WebSocket.

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           GATEWAY                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  WebSocket   │  │    REST      │  │   GraphQL    │          │
│  │  Server     │  │    API       │  │    API       │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                    │
│         └────────────────┼────────────────┘                    │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 Channel Router                           │   │
│  │  - Route to appropriate channel handler                 │   │
│  │  - Apply middleware (auth, rate limit)                  │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Session Manager                             │   │
│  │  - Create/destroy sessions                               │   │
│  │  - State persistence                                      │   │
│  │  - Context management                                     │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            Tool Execution Dispatcher                      │   │
│  │  - Queue tool requests                                     │   │
│  │  - Execute with permission check                          │   │
│  │  - Stream results                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### WebSocket Protocol

```typescript
interface GatewayConfig {
  port: number;
  host: string;
  protocols: ("ws" | "wss")[];
  
  // Middleware
  auth: AuthMiddleware;
  rateLimiter: RateLimiter;
  
  // Persistence
  sessionStore: SessionStore;
}

interface WebSocketMessage {
  type: "request" | "response" | "ping" | "pong" | "error";
  id: string;
  sessionId?: string;
  payload: unknown;
}

interface GatewayAPI {
  // Connect
  connect(): Promise<Connection>;
  
  // Send request
  send(request: Request): Promise<Response>;
  
  // Stream
  stream(request: Request, onChunk: (chunk: Chunk) => void): Promise<void>;
  
  // Ping/pong
  ping(): Promise<number>;
  
  // Disconnect
  disconnect(): void;
}
```

#### Session Management

```typescript
interface SessionManager {
  // Create session
  create(options?: SessionOptions): Session;
  
  // Get session
  get(sessionId: string): Session | undefined;
  
  // Update session
  update(sessionId: string, state: SessionState): void;
  
  // Delete session
  delete(sessionId: string): void;
  
  // List sessions
  list(): Session[];
  
  // Cleanup expired
  cleanup(): void;
}

interface Session {
  id: string;
  createdAt: number;
  updatedAt: number;
  state: SessionState;
  context: Context;
  channel: string;
}

interface SessionState {
  messages: Message[];
  tools: string[];
  files: string[];
  variables: Record<string, unknown>;
}
```

---

### 2.5 Memory System

#### Overview

The memory system provides persistent context across sessions, pattern extraction for learning, and cross-session intelligence.

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MEMORY SYSTEM                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Session    │  │   Pattern    │  │   Vector     │          │
│  │   Memory     │  │   Store      │  │   Store      │          │
│  │              │  │              │  │              │          │
│  │ - Messages   │  │ - Templates  │  │ - Semantic   │          │
│  │ - Context   │  │ - Heuristics │  │   Search    │          │
│  │ - Variables │  │ - Strategies │  │ - Similarity │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                    │
│         └────────────────┼────────────────┘                    │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               Memory Index / Query Engine                │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               Pattern Learning Engine                   │   │
│  │  - Extract patterns from interactions                    │   │
│  │  - Build expertise from success/failure                    │   │
│  │  - Suggest improvements                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Implementation

```typescript
interface MemorySystem {
  constructor(config: MemoryConfig);
  
  // Store in memory
  store(key: string, value: unknown, options?: StoreOptions): Promise<void>;
  
  // Retrieve from memory
  retrieve(key: string): Promise<unknown>;
  
  // Search semantic memory
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  
  // Extract patterns
  extractPatterns(interaction: Interaction): Promise<Pattern[]>;
  
  // Learn from interaction
  learn(interaction: Interaction): Promise<void>;
}

interface MemoryConfig {
  storage: "sqlite" | "postgres" | "redis" | "memory";
  vectorDimension: number;
  maxHistorySize: number;
  patternExtractionEnabled: boolean;
  crossSessionLearning: boolean;
}

interface Interaction {
  id: string;
  sessionId: string;
  query: string;
  response: string;
  toolsUsed: string[];
  success: boolean;
  timestamp: number;
  duration: number;
}

interface Pattern {
  id: string;
  type: string;
  description: string;
  examples: string[];
  frequency: number;
  successRate: number;
}
```

---

### 2.6 Security & Sandbox

#### Overview

Security is paramount. The sandbox system provides isolated execution environments with tool permission controls and rate limiting.

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       SECURITY LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              Docker Sandbox Manager                     │    │
│  │  - Container lifecycle                                   │    │
│  │  - Resource limits (CPU, memory, network)               │    │
│  │  - File system isolation                                  │    │
│  │  - Process sandboxing                                     │    │
│  └─────────────────────��─��──────────────────────────────────┘    │
│                              │                                    │
│                              ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              Tool Permission System                        │    │
│  │  - Role-based access                                       │    │
│  │  - Tool whitelisting                                        │    │
│  │  - Parameter validation                                     │    │
│  │  - Execution audit                                          │    │
│  └──────────────────────────────────────────────────────────┘    │
│                              │                                    │
│                              ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              Rate Limiter                                 │    │
│  │  - Per-user limits                                         │    │
│  │  - Per-tool limits                                         │    │
│  │  - Global limits                                           │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Sandbox Implementation

```typescript
interface SandboxConfig {
  // Container configuration
  image: string;
  cpuLimit: string;
  memoryLimit: string;
  networkEnabled: boolean;
  
  // Execution limits
  maxConcurrent: number;
  executionTimeout: number;
  
  // File system
  allowedPaths: string[];
  readOnlyPaths: string[];
}

interface SandboxManager {
  // Create sandboxed environment
  create(sessionId: string): Promise<Sandbox>;
  
  // Execute in sandbox
  execute(
    command: string,
    sandbox: Sandbox,
    options?: ExecuteOptions
  ): Promise<ExecuteResult>;
  
  // Destroy sandbox
  destroy(sessionId: string): Promise<void>;
  
  // Get sandbox status
  status(sessionId: string): Promise<SandboxStatus>;
}
```

#### Permission System

```typescript
interface PermissionConfig {
  defaultRole: Role;
  roles: Record<Role, RolePermissions>;
  toolPolicies: Record<string, ToolPolicy>;
}

type Role = "admin" | "developer" | "user" | "guest";

interface RolePermissions {
  allowedTools: string[];
  maxRequestsPerMinute: number;
  maxTokensPerDay: number;
  allowedPaths: string[];
  canExecuteCommands: boolean;
}

interface ToolPolicy {
  requiresConfirmation: boolean;
  allowedParameters?: Record<string, ParameterConstraint>;
  rateLimit?: number;
  timeout?: number;
}
```

---

### 2.7 Multi-Channel Support

#### Overview

clawdra supports multiple communication channels, allowing users to interact through their preferred interfaces.

#### Channel Architecture

```
┌───────────────────────────────────────────────────────────���─���───┐
│                      CHANNEL LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Channel Router                         │   │
│  │  - Route messages to appropriate handler                 │   │
│  │  - Normalize message format                              │   │
│  │  - Handle channel-specific features                      │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                               │                                    │
│          ┌────────────────────┼────────────────────┐              │
│          │                    │                    │              │
│          ▼                    ▼                    ▼              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     │
│  │     CLI      │     │   Web UI     │     │   Telegram   │     │
│  │             │     │             │     │              │     │
│  │ - Ink/TUI  │     │ - WebSocket │     │ - Bot API   │     │
│  │ - ANSI     │     │ - React     │     │ - Commands  │     │
│  └──────────────┘     └──────────────┘     └──────────────┘     │
│          │                    │                    │              │
│          │                    │                    │              │
│          └────────────────────┼────────────────────┘              │
│                               │                                    │
│          ┌────────────────────┼────────────────────┐              │
│          │                    │                    │              │
│          ▼                    ▼                    ▼              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     │
│  │  Discord     │     │   Slack      │     │  WhatsApp    │     │
│  │              │     │              │     │              │     │
│  │ - Bot API   │     │ - Webhooks  │     │ - Cloud API │     │
│  │ - Commands  │     │ - Events    │     │ - Templates │     │
│  └──────────────┘     └──────────────┘     └──────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Channel Interface

```typescript
interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  
  // Connect to channel
  connect(): Promise<void>;
  
  // Disconnect from channel
  disconnect(): Promise<void>;
  
  // Send message
  send(message:ChannelMessage): Promise<void>;
  
  // Handle incoming message
  onMessage(handler: MessageHandler): void;
  
  // Handle file attachment
  onFile(handler: FileHandler): void;
}

type ChannelType = "cli" | "websocket" | "telegram" | "discord" | "slack" | "whatsapp";

interface ChannelMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  attachments?: Attachment[];
  timestamp: number;
}
```

#### Channel Implementation Notes

1. **CLI** — Terminal-based using Ink (React for CLI) with ANSI color support
2. **Web UI** — Browser-based using React with WebSocket connection
3. **Telegram** — Bot API with command support and inline queries
4. **Discord** — Slash commands and bot interactions
5. **Slack** — Webhook-based with interactive messages
6. **WhatsApp** — WhatsApp Cloud API with message templates

---

## 3. TECHNICAL STACK

### 3.1 Runtime

| Option | Version | Notes |
|--------|---------|-------|
| **Bun** | 1.0+ | Preferred — faster startup, built-in bundler |
| **Node.js** | 22+ | Alternative — mature ecosystem |

### 3.2 Language

```
TypeScript 5.x — Static typing with strict mode
```

### 3.3 Key Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `zod` | Schema validation | ^4.0.0 |
| `ws` | WebSocket server | ^8.0.0 |
| `ink` | React CLI | ^5.0.0 |
| `react` | UI framework | ^18.0.0 |
| `@modelcontextprotocol/sdk` | MCP integration | ^1.0.0 |
| `dockerode` | Docker API | ^4.0.0 |
| `ws` | WebSocket | ^8.0.0 |
| `better-sqlite3` | SQLite | ^9.0.0 |

### 3.4 Schema Validation

```typescript
import { z } from "zod/v4";

// Use Zod v4 for all schema validation
const ChatCompletionParamsSchema = z.object({
  model: z.string(),
  messages: z.array(MessageSchema),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  stop: z.array(z.string()).optional(),
  tools: z.array(ToolSchema).optional(),
  toolChoice: z.union([
    z.literal("auto"),
    z.literal("none"),
    ToolChoiceSchema,
  ]).optional(),
  stream: z.boolean().optional(),
});
```

---

## 4. KEY FEATURES TO MAKE IT SMARTER THAN CLAUDE

### 4.1 Learning from Mistakes

```typescript
interface LearningEngine {
  constructor(memory: MemorySystem);
  
  // Analyze failure
  analyzeFailure(interaction: Interaction, error: Error): FailureAnalysis;
  
  // Extract lessons
  extractLessons(analysis: FailureAnalysis): Lesson[];
  
  // Apply learned corrections
  applyCorrections(context: ExecutionContext): Promise<Correction>;
}

interface FailureAnalysis {
  rootCause: string;
  category: "tool-error" | "logic-error" | "context-error" | "api-error";
  severity: "critical" | "major" | "minor";
  suggestions: string[];
  relatedPatterns: Pattern[];
}

// System captures failures and extracts:
// - What went wrong
// - Root cause analysis
// - Corrective actions
// - Pattern updates for future prevention
```

### 4.2 Better Context Management

```typescript
interface ContextManager {
  // Build context window
  buildContext(
    query: string,
    session: Session,
    options?: ContextOptions
  ): Promise<ContextWindow>;
  
  // Prioritize context
  prioritizeContext(context: ContextWindow): PriorityContext;
  
  // Compress context
  compressContext(context: ContextWindow, maxTokens: number): CompressedContext;
}

interface ContextOptions {
  maxTokens: number;
  includeFileContents: string[];
  includeHistory: boolean;
  compressionLevel: "none" | "moderate" | "aggressive";
}
```

### 4.3 Multi-Model Ensemble

```typescript
interface EnsembleRouter {
  constructor(config: EnsembleConfig);
  
  // Execute with multiple models
  async execute(
    query: string,
    context: Context
  ): Promise<EnsembleResult>;
  
  // Vote on results
  vote(results: ModelResult[]): VoteResult;
}

interface EnsembleConfig {
  models: Model[];
  votingStrategy: "majority" | "weighted" | "best-of-n";
  parallelExecution: boolean;
  
  // Specialized routing
  specializedTasks: {
    coding: string[];
    reasoning: string[];
    creative: string[];
  };
}
```

### 4.4 Continuous Improvement

```typescript
interface ContinuousImprovement {
  constructor(memory: MemorySystem, provider: Provider);
  
  // Track performance metrics
  trackMetrics(interaction: Interaction): void;
  
  // Identify improvement opportunities
  identifyOpportunities(): Promise<Improvement[]>;
  
  // Implement improvements
  implementImprovement(plan: ImprovementPlan): Promise<void>;
  
  // A/B test improvements
  testImprovement(
    id: string,
    variant: string,
    test: TestDefinition
  ): Promise<TestResult>;
}
```

### 4.5 Pattern Recognition

```typescript
interface PatternRecognizer {
  constructor(memory: MemorySystem);
  
  // Recognize patterns in interaction
  recognize(interaction: Interaction): Promise<RecognizedPattern[]>;
  
  // Build pattern library
  buildLibrary(sessions: Session[]): Promise<PatternLibrary>;
  
  // Match new situations
  match(query: string): Promise<PatternMatch[]>;
}

interface PatternLibrary {
  id: string;
  patterns: Pattern[];
  createdAt: number;
  updatedAt: number;
  version: number;
}
```

---

## 5. FILE STRUCTURE

```
clawdra/
├── README.md
├── clawdra-ARCHITECTURE.md          # This document
├── package.json
├── tsconfig.json
├── .env.example
├── .dockerignore
├── Dockerfile
│
├── src/
│   ├── index.ts                      # Entry point
│   ├── config.ts                     # Configuration
│   │
│   ├── providers/
│   │   ├── index.ts                  # Provider exports
│   │   ├── base.ts                   # Base provider interface
│   │   ├── anthropic.ts             # Anthropic provider
│   │   ├── openai.ts                 # OpenAI provider
│   │   ├── openrouter.ts             # OpenRouter provider
│   │   ├── ollama.ts                 # Ollama provider
│   │   ├── gemini.ts                 # Gemini provider
│   │   ├── bedrock.ts                # Bedrock provider
│   │   ├── vllm.ts                   # vLLM provider
│   │   ├── router.ts                 # Model router
│   │   └── registry.ts               # Provider registry
│   │
│   ├── tools/
│   │   ├── index.ts                  # Tool exports
│   │   ├── base.ts                   # Base tool interface
│   │   ├── read.ts                   # Read tool
│   │   ├── write.ts                  # Write tool
│   │   ├── edit.ts                    # Edit tool
│   │   ├── bash.ts                   # Bash tool
│   │   ├── browser.ts                # Browser tool
│   │   ├── mcp.ts                    # MCP tool
│   │   ├── websearch.ts               # Web search tool
│   │   ├── memory.ts                 # Memory tool
│   │   ├── skills.ts                 # Skills tool
│   │   └── registry.ts               # Tool registry
│   │
│   ├── agent/
│   │   ├── index.ts                  # Agent exports
│   │   ├── loop.ts                   # Agent loop
│   │   ├── analyzer.ts               # Task analyzer
│   │   ├── planner.ts               # Execution planner
│   │   ├── loop-detector.ts         # Loop detection
│   │   └── context-builder.ts       # Context builder
│   │
│   ├── gateway/
│   │   ├── index.ts                  # Gateway exports
│   │   ├── server.ts                 # WebSocket server
│   │   ├── router.ts                 # Channel router
│   │   ├── session.ts               # Session manager
│   │   ├── dispatcher.ts            # Tool dispatcher
│   │   └── middleware.ts            # Middleware
│   │
│   ├── memory/
│   │   ├── index.ts                  # Memory exports
│   │   ├── system.ts                 # Memory system
│   │   ├── session.ts               # Session memory
│   │   ├── pattern.ts               # Pattern store
│   │   ├── vector.ts                # Vector store
│   │   ├── learner.ts               # Learning engine
│   │   └── storage.ts               # Storage backend
│   │
│   ├── skills/
│   │   ├── index.ts                  # Skills exports
│   │   ├── loader.ts                # Skill loader
│   │   ├── registry.ts             # Skill registry
│   │   └── skills/
│   │       ├── .gitkeep
│   │       └── builtin/             # Built-in skills
│   │
│   ├── channels/
│   │   ├── index.ts                  # Channel exports
│   │   ├── base.ts                   # Base channel
│   │   ├── cli.ts                    # CLI channel (Ink)
│   │   ├── websocket.ts              # WebSocket channel
│   │   ├── telegram.ts               # Telegram channel
│   │   ├── discord.ts               # Discord channel
│   │   ├── slack.ts                  # Slack channel
│   │   └── whatsapp.ts              # WhatsApp channel
│   │
│   ├── sandbox/
│   │   ├── index.ts                  # Sandbox exports
│   │   ├── docker.ts                 # Docker sandbox
│   │   ├── permissions.ts           # Permission system
│   │   ├── rate-limiter.ts         # Rate limiter
│   │   └── audit.ts                 # Audit logger
│   │
│   ├── cli/
│   │   ├── index.ts                  # CLI entry point
│   │   ├── app.ts                   # Ink app
│   │   ├── components/              # UI components
│   │   └── commands/               # CLI commands
│   │
│   ├── types/
│   │   └── index.ts                  # Shared types
│   │
│   └── utils/
│       ├── index.ts                  # Utility exports
│       ├── logger.ts                # Logger
│       ├── metrics.ts              # Metrics
│       └── validation.ts           # Validation helpers
│
├── test/
│   ├── providers/
│   ├── tools/
│   ├── agent/
│   ├── gateway/
│   ├── memory/
│   └── channels/
│
└── docs/
    ├── SPEC.md
    └── API.md
```

---

## 6. IMPLEMENTATION ROADMAP

### Phase 1: Core Foundation
- [ ] Provider abstraction with Anthropic, OpenAI, OpenRouter
- [ ] 4 Core Tools (Read, Write, Edit, Bash)
- [ ] Basic agent loop with streaming
- [ ] CLI interface with Ink

### Phase 2: Gateway & Sessions
- [ ] WebSocket server
- [ ] Session management
- [ ] Tool execution dispatcher
- [ ] Memory system with SQLite

### Phase 3: Extensions & Channels
- [ ] Additional providers (Ollama, Gemini, Bedrock)
- [ ] Extended tools (Browser, Web Search)
- [ ] Multi-channel support (Telegram, Discord)
- [ ] Skills system

### Phase 4: Intelligence
- [ ] Pattern recognition
- [ ] Learning engine
- [ ] Multi-model ensemble
- [ ] Cross-session memory

### Phase 5: Security & Scale
- [ ] Docker sandbox
- [ ] Permission system
- [ ] Rate limiting
- [ ] Production optimization

---

## 7. APPENDIX

### A. Configuration Schema

```typescript
import { z } from "zod/v4";

const ConfigSchema = z.object({
  // Runtime
  runtime: z.enum(["bun", "node"]).default("bun"),
  
  // Providers
  providers: z.object({
    default: z.string(),
    anthropic: z.string().optional(),
    openai: z.string().optional(),
    openrouter: z.string().optional(),
    ollama: z.string().optional(),
    gemini: z.string().optional(),
    bedrock: z.string().optional(),
  }),
  
  // Agent
  agent: z.object({
    maxIterations: z.number().positive().default(100),
    maxTokensPerIteration: z.number().positive().default(16000),
    loopDetectionThreshold: z.number().positive().default(5),
    streamingEnabled: z.boolean().default(true),
  }),
  
  // Gateway
  gateway: z.object({
    port: z.number().positive().default(8080),
    host: z.string().default("localhost"),
  }),
  
  // Memory
  memory: z.object({
    storage: z.enum(["sqlite", "postgres", "redis", "memory"]).default("sqlite"),
    maxHistorySize: z.number().positive().default(10000),
  }),
  
  // Security
  security: z.object({
    sandboxEnabled: z.boolean().default(false),
    rateLimitEnabled: z.boolean().default(true),
  }),
});

type Config = z.infer<typeof ConfigSchema>;
```

### B. Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Optional (one required for at least one provider)
OPENROUTER_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434
GEMINI_API_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Gateway
GATEWAY_PORT=8080
GATEWAY_HOST=localhost

# Memory
DATABASE_URL=./data/clawdra.db

# Features
DEBUG=false
LOG_LEVEL=info
```

---

**END OF DOCUMENT**