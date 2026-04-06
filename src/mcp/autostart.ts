/**
 * MCP Auto-Start System
 * Automatically detects available services from .env and starts relevant MCP servers
 */

import { getMCPManager } from '../mcp/mod.js';
import { SERVICE_REGISTRY } from '../mcp/connectors.js';

export interface MCPAutoStartResult {
  started: string[];
  skipped: string[];
  errors: string[];
  totalAvailable: number;
}

/**
 * Auto-detect and start MCP servers based on environment configuration
 */
export async function autoStartMCPServers(): Promise<MCPAutoStartResult> {
  const manager = getMCPManager();
  const result: MCPAutoStartResult = {
    started: [],
    skipped: [],
    errors: [],
    totalAvailable: 0,
  };

  // Core MCP servers (always available)
  const coreServers = [
    { name: 'filesystem', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()], timeout: 30000 },
    { name: 'git', command: 'npx', args: ['-y', '@modelcontextprotocol/server-git'], timeout: 30000 },
    { name: 'fetch', command: 'npx', args: ['-y', '@modelcontextprotocol/server-fetch'], timeout: 30000 },
  ];

  // Conditional servers (need env vars)
  const conditionalServers = [
    { name: 'github', needs: ['GITHUB_TOKEN'], command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], timeout: 30000 },
    { name: 'brave-search', needs: ['BRAVE_API_KEY'], command: 'npx', args: ['-y', '@modelcontextprotocol/server-brave-search'], timeout: 30000 },
    { name: 'postgres', needs: ['POSTGRES_URL'], command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres', process.env.POSTGRES_URL || ''], timeout: 30000 },
  ];

  const allServers = [...coreServers, ...conditionalServers];
  result.totalAvailable = allServers.length;

  for (const server of allServers) {
    const needs = (server as any).needs as string[] | undefined;
    const hasAllEnvVars = !needs || needs.every((v: string) => process.env[v] && process.env[v]!.length > 0);

    if (!hasAllEnvVars) {
      result.skipped.push(server.name);
      continue;
    }

    try {
      await manager.registerServer(server);
      result.started.push(server.name);
    } catch (error) {
      result.errors.push(`${server.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return result;
}

/**
 * Get summary of configured vs available MCP servers
 */
export function getMCPStatusSummary(): string {
  const connectors = SERVICE_REGISTRY;
  const configured: string[] = [];
  const available: string[] = [];

  for (const c of connectors) {
    const hasAllEnvVars = c.envVars.every((v: string) => process.env[v] && process.env[v]!.length > 0);
    if (hasAllEnvVars || c.envVars.length === 0) {
      configured.push(c.name);
    } else {
      available.push(c.name);
    }
  }

  let summary = `## MCP Server Status\n\n`;
  summary += `**Configured:** ${configured.length} | **Available:** ${available.length} | **Total:** ${connectors.length}\n\n`;

  if (configured.length > 0) {
    summary += `### ✅ Ready to Start\n\n`;
    configured.forEach(name => { summary += `- ${name}\n`; });
    summary += '\n';
  }

  if (available.length > 0) {
    summary += `### ⚙️ Available (Set env vars to enable)\n\n`;
    available.forEach(name => {
      const connector = connectors.find(s => s.name === name);
      if (connector) {
        summary += `- ${name} (needs: ${connector.envVars.join(', ')})\n`;
      }
    });
  }

  return summary;
}

/**
 * Get recommended MCP servers based on user's stack
 */
export function getRecommendedMCPServers(): string[] {
  const recommendations: string[] = ['filesystem', 'git', 'fetch'];

  if (process.env.GITHUB_TOKEN) recommendations.push('github');
  if (process.env.SUPABASE_URL || process.env.POSTGRES_URL) recommendations.push('postgres');
  if (process.env.VERCEL_TOKEN) recommendations.push('vercel');
  if (process.env.RESEND_API_KEY) recommendations.push('resend');

  return recommendations;
}
