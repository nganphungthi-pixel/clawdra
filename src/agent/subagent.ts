/**
 * Sub-Agent Manager - Multi-agent orchestration
 * Spawns and manages sub-agents for parallel task execution
 */

import { Provider, Message, Response, createProvider } from "../providers/mod.js";
import { MemorySystem, MemoryType } from "../memory/mod.js";
import { ToolExecutor, ToolResult } from "../tools/mod.js";
import { TaskAnalysis, TaskCategory } from "./router.js";

export interface SubAgentConfig {
  maxConcurrent?: number;
  defaultProvider?: Provider;
  memory?: MemorySystem;
  tools?: ToolExecutor;
}

export interface SubAgentResult {
  name: string;
  output: string;
  success: boolean;
  error?: string;
  duration: number;
  tokensUsed?: number;
}

export interface SubAgent {
  id: string;
  name: string;
  task: string;
  provider: Provider;
  memory: MemorySystem;
  tools: ToolExecutor;
  status: "pending" | "running" | "completed" | "failed";
  startTime: number;
  endTime?: number;
  result?: SubAgentResult;
}

const SUB_AGENT_SYSTEM_PROMPT = `You are a specialized sub-agent working on a specific task.
Focus on completing your assigned task efficiently and return a clear, concise result.
You have access to the same tools as the main agent.`;

export class SubAgentManager {
  private maxConcurrent: number;
  private defaultProvider: Provider;
  private memory: MemorySystem;
  private tools: ToolExecutor;
  private activeAgents: Map<string, SubAgent> = new Map();
  private completedResults: SubAgentResult[] = [];

  constructor(config: SubAgentConfig = {}) {
    this.maxConcurrent = config.maxConcurrent || 3;
    this.defaultProvider = config.defaultProvider || createProvider();
    this.memory = config.memory || new MemorySystem();
    this.tools = config.tools || new ToolExecutor();
  }

  /**
   * Analyze task and determine how many sub-agents are needed
   */
  async spawnSubAgents(prompt: string, analysis: TaskAnalysis): Promise<SubAgentResult[]> {
    if (analysis.complexity < 60) {
      return [];
    }

    const numAgents = this.calculateNumAgents(analysis);
    const tasks = this.decomposeTask(prompt, analysis, numAgents);

    const results: SubAgentResult[] = [];
    const runningAgents: string[] = [];

    for (const task of tasks) {
      if (runningAgents.length >= this.maxConcurrent) {
        const completed = await this.waitForAnyAgent();
        results.push(completed);
      }

      const agentId = await this.spawnAgent(task);
      runningAgents.push(agentId);
    }

    for (const agentId of runningAgents) {
      const result = await this.waitForAgent(agentId);
      results.push(result);
    }

    this.completedResults.push(...results);
    return results;
  }

  /**
   * Calculate number of sub-agents needed based on complexity
   */
  private calculateNumAgents(analysis: TaskAnalysis): number {
    if (analysis.complexity < 70) return 2;
    if (analysis.complexity < 85) return 3;
    return Math.min(5, Math.ceil(analysis.complexity / 20));
  }

  /**
   * Decompose a complex task into sub-tasks
   */
  private decomposeTask(prompt: string, analysis: TaskAnalysis, numAgents: number): string[] {
    const tasks: string[] = [];

    switch (analysis.category) {
      case "complex":
        tasks.push(...this.decomposeComplexTask(prompt, numAgents));
        break;
      case "reasoning":
        tasks.push(...this.decomposeReasoningTask(prompt, numAgents));
        break;
      case "medium":
        tasks.push(...this.decomposeMediumTask(prompt, numAgents));
        break;
      default:
        tasks.push(prompt);
    }

    return tasks;
  }

  private decomposeComplexTask(prompt: string, numAgents: number): string[] {
    const lowerPrompt = prompt.toLowerCase();
    const tasks: string[] = [];

    if (lowerPrompt.includes("file") || lowerPrompt.includes("create")) {
      tasks.push("Analyze the task requirements and plan the file structure");
      tasks.push("Implement the core functionality in the main files");
      if (numAgents >= 3) {
        tasks.push("Add tests, documentation, and error handling");
      }
      if (numAgents >= 4) {
        tasks.push("Review code quality, security, and performance");
      }
    } else {
      for (let i = 0; i < numAgents; i++) {
        tasks.push(`Part ${i + 1} of the task: ${prompt}`);
      }
    }

    return tasks.slice(0, numAgents);
  }

  private decomposeReasoningTask(prompt: string, numAgents: number): string[] {
    const tasks: string[] = [
      "Analyze the problem and identify key constraints",
      "Develop a solution approach with detailed reasoning",
    ];

    if (numAgents >= 3) {
      tasks.push("Validate the solution and check for edge cases");
    }

    return tasks.slice(0, numAgents);
  }

  private decomposeMediumTask(prompt: string, numAgents: number): string[] {
    const tasks: string[] = [
      "Gather information and understand the context",
      "Implement the solution",
    ];

    if (numAgents >= 3) {
      tasks.push("Test and verify the implementation");
    }

    return tasks.slice(0, numAgents);
  }

  /**
   * Spawn a single sub-agent
   */
  private async spawnAgent(task: string): Promise<string> {
    const id = crypto.randomUUID();
    const agent: SubAgent = {
      id,
      name: `sub-agent-${id.slice(0, 8)}`,
      task,
      provider: this.defaultProvider,
      memory: this.memory,
      tools: this.tools,
      status: "running",
      startTime: Date.now(),
    };

    this.activeAgents.set(id, agent);

    agent.provider
      .chat([
        { role: "system", content: SUB_AGENT_SYSTEM_PROMPT },
        { role: "user", content: task },
      ])
      .then((response) => {
        agent.status = "completed";
        agent.endTime = Date.now();
        agent.result = {
          name: agent.name,
          output: response.content,
          success: true,
          duration: agent.endTime - agent.startTime,
          tokensUsed: response.usage?.totalTokens,
        };
      })
      .catch((error) => {
        agent.status = "failed";
        agent.endTime = Date.now();
        agent.result = {
          name: agent.name,
          output: "",
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: agent.endTime - agent.startTime,
        };
      });

    return id;
  }

  /**
   * Wait for any agent to complete
   */
  private async waitForAnyAgent(): Promise<SubAgentResult> {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        for (const [id, agent] of this.activeAgents) {
          if (agent.status === "completed" || agent.status === "failed") {
            clearInterval(interval);
            this.activeAgents.delete(id);
            resolve(agent.result!);
            return;
          }
        }
      }, 100);
    });
  }

  /**
   * Wait for a specific agent to complete
   */
  private async waitForAgent(id: string): Promise<SubAgentResult> {
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        const agent = this.activeAgents.get(id);
        if (!agent) {
          clearInterval(interval);
          reject(new Error("Agent not found"));
          return;
        }
        if (agent.status === "completed" || agent.status === "failed") {
          clearInterval(interval);
          this.activeAgents.delete(id);
          resolve(agent.result!);
        }
      }, 100);
    });
  }

  /**
   * Execute a sub-agent directly
   */
  async executeSubAgent(task: string, name?: string): Promise<SubAgentResult> {
    const startTime = Date.now();
    const agentName = name || `sub-agent-${crypto.randomUUID().slice(0, 8)}`;

    try {
      const response = await this.defaultProvider.chat([
        { role: "system", content: SUB_AGENT_SYSTEM_PROMPT },
        { role: "user", content: task },
      ]);

      const result: SubAgentResult = {
        name: agentName,
        output: response.content,
        success: true,
        duration: Date.now() - startTime,
        tokensUsed: response.usage?.totalTokens,
      };

      this.completedResults.push(result);
      return result;
    } catch (error) {
      const result: SubAgentResult = {
        name: agentName,
        output: "",
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };

      this.completedResults.push(result);
      return result;
    }
  }

  /**
   * Get active agent count
   */
  getActiveAgentCount(): number {
    return this.activeAgents.size;
  }

  /**
   * Get completed results
   */
  getCompletedResults(): SubAgentResult[] {
    return this.completedResults;
  }

  /**
   * Shutdown all active agents
   */
  async shutdown(): Promise<void> {
    this.activeAgents.clear();
  }
}
