/**
 * MCP Service Connectors
 * Connect to Supabase, Firebase, Vercel, GitHub, Resend, shadcn, Hostinger, WordPress
 * Inspired by OpenClaw's MCP architecture
 */

import { MCPManager, MCPServerConfig } from "../mcp/mod.js";

// ============================================
// MCP CONNECTOR DEFINITIONS
// ============================================

export function createServiceConnectors(): MCPServerConfig[] {
  const connectors: MCPServerConfig[] = [];

  // GitHub MCP (official)
  if (process.env.GITHUB_TOKEN) {
    connectors.push({
      name: "github",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN },
      timeout: 30000,
    });
  }

  // Supabase MCP
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    connectors.push({
      name: "supabase",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-postgres", process.env.SUPABASE_URL!.replace("https://", "postgresql://").replace("http://", "postgresql://")],
      env: {
        DATABASE_URL: `postgresql://postgres:${process.env.SUPABASE_KEY}@db.${process.env.SUPABASE_URL!.split("//")[1]}:5432/postgres`,
      },
      timeout: 30000,
    });
  }

  // Firebase MCP (via REST API wrapper)
  if (process.env.FIREBASE_PROJECT_ID) {
    connectors.push({
      name: "firebase",
      command: "node",
      args: [require.resolve("./firebase-mcp.js")],
      env: {
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
        FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || "",
        FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || "",
      },
      timeout: 30000,
    });
  }

  // Vercel MCP
  if (process.env.VERCEL_TOKEN) {
    connectors.push({
      name: "vercel",
      command: "npx",
      args: ["-y", "@vercel/mcp"],
      env: { VERCEL_TOKEN: process.env.VERCEL_TOKEN },
      timeout: 30000,
    });
  }

  // Resend MCP (email)
  if (process.env.RESEND_API_KEY) {
    connectors.push({
      name: "resend",
      command: "npx",
      args: ["-y", "resend-mcp-server"],
      env: { RESEND_API_KEY: process.env.RESEND_API_KEY },
      timeout: 30000,
    });
  }

  // shadcn/ui MCP (component generator)
  connectors.push({
    name: "shadcn",
    command: "node",
    args: [require.resolve("./shadcn-mcp.js")],
    env: {
      PROJECT_DIR: process.cwd(),
    },
    timeout: 30000,
  });

  // WordPress MCP
  if (process.env.WORDPRESS_URL && process.env.WORDPRESS_USERNAME && process.env.WORDPRESS_PASSWORD) {
    connectors.push({
      name: "wordpress",
      command: "node",
      args: [require.resolve("./wordpress-mcp.js")],
      env: {
        WORDPRESS_URL: process.env.WORDPRESS_URL,
        WORDPRESS_USERNAME: process.env.WORDPRESS_USERNAME,
        WORDPRESS_PASSWORD: process.env.WORDPRESS_PASSWORD,
        WORDPRESS_APP_PASSWORD: process.env.WORDPRESS_APP_PASSWORD || "",
      },
      timeout: 30000,
    });
  }

  // Hostinger MCP (via SSH/API)
  if (process.env.HOSTINGER_API_KEY) {
    connectors.push({
      name: "hostinger",
      command: "node",
      args: [require.resolve("./hostinger-mcp.js")],
      env: {
        HOSTINGER_API_KEY: process.env.HOSTINGER_API_KEY,
        HOSTINGER_API_SECRET: process.env.HOSTINGER_API_SECRET || "",
      },
      timeout: 60000,
    });
  }

  // PostgreSQL MCP (generic)
  if (process.env.POSTGRES_URL) {
    connectors.push({
      name: "postgres",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-postgres", process.env.POSTGRES_URL],
      timeout: 30000,
    });
  }

  // SQLite MCP
  if (process.env.SQLITE_PATH) {
    connectors.push({
      name: "sqlite",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-sqlite", process.env.SQLITE_PATH],
      timeout: 30000,
    });
  }

  // Filesystem MCP
  connectors.push({
    name: "filesystem",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
    timeout: 30000,
  });

  // Git MCP
  connectors.push({
    name: "git",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-git"],
    timeout: 30000,
  });

  // Puppeteer MCP (browser automation)
  connectors.push({
    name: "puppeteer",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    timeout: 60000,
  });

  // Brave Search MCP
  if (process.env.BRAVE_API_KEY) {
    connectors.push({
      name: "brave-search",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-brave-search"],
      env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY },
      timeout: 30000,
    });
  }

  // Fetch MCP (web content)
  connectors.push({
    name: "fetch",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-fetch"],
    timeout: 30000,
  });

  return connectors;
}

// ============================================
// MCP CONNECTOR REGISTRY
// ============================================

export interface ServiceConnectorInfo {
  name: string;
  description: string;
  envVars: string[];
  docs: string;
  category: "database" | "deploy" | "email" | "cms" | "hosting" | "auth" | "search" | "ui" | "devops";
}

export const SERVICE_REGISTRY: ServiceConnectorInfo[] = [
  {
    name: "supabase",
    description: "Supabase - Open source Firebase alternative. Manage databases, auth, storage, edge functions.",
    envVars: ["SUPABASE_URL", "SUPABASE_KEY"],
    docs: "https://supabase.com/docs",
    category: "database",
  },
  {
    name: "firebase",
    description: "Firebase - Google's app development platform. Manage Firestore, Auth, Functions, Storage.",
    envVars: ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"],
    docs: "https://firebase.google.com/docs",
    category: "database",
  },
  {
    name: "vercel",
    description: "Vercel - Deploy, preview, and ship web apps. Manage deployments, domains, environment variables.",
    envVars: ["VERCEL_TOKEN"],
    docs: "https://vercel.com/docs",
    category: "deploy",
  },
  {
    name: "github",
    description: "GitHub - Repositories, issues, PRs, actions, packages. Full GitOps workflow.",
    envVars: ["GITHUB_TOKEN"],
    docs: "https://docs.github.com",
    category: "devops",
  },
  {
    name: "resend",
    description: "Resend - Email API for developers. Send, track, and manage emails.",
    envVars: ["RESEND_API_KEY"],
    docs: "https://resend.com/docs",
    category: "email",
  },
  {
    name: "shadcn",
    description: "shadcn/ui - Beautiful UI components. Add, customize, and generate components.",
    envVars: [],
    docs: "https://ui.shadcn.com/docs",
    category: "ui",
  },
  {
    name: "wordpress",
    description: "WordPress - Manage posts, pages, media, users, themes, plugins via REST API.",
    envVars: ["WORDPRESS_URL", "WORDPRESS_USERNAME", "WORDPRESS_PASSWORD"],
    docs: "https://developer.wordpress.org/rest-api/",
    category: "cms",
  },
  {
    name: "hostinger",
    description: "Hostinger - Manage hosting, domains, DNS, email accounts, databases.",
    envVars: ["HOSTINGER_API_KEY", "HOSTINGER_API_SECRET"],
    docs: "https://www.hostinger.in/tutorials",
    category: "hosting",
  },
  {
    name: "brave-search",
    description: "Brave Search - Private, independent search engine for web and local queries.",
    envVars: ["BRAVE_API_KEY"],
    docs: "https://brave.com/search/api/",
    category: "search",
  },
  {
    name: "postgres",
    description: "PostgreSQL - Query and manage PostgreSQL databases.",
    envVars: ["POSTGRES_URL"],
    docs: "https://www.postgresql.org/docs/",
    category: "database",
  },
  {
    name: "filesystem",
    description: "Filesystem - Read, write, edit, search files on your local system.",
    envVars: [],
    docs: "",
    category: "devops",
  },
  {
    name: "git",
    description: "Git - Clone, commit, branch, merge, push, pull via Git.",
    envVars: [],
    docs: "",
    category: "devops",
  },
  {
    name: "puppeteer",
    description: "Puppeteer - Browser automation, screenshots, web scraping, testing.",
    envVars: [],
    docs: "https://pptr.dev/",
    category: "devops",
  },
  {
    name: "fetch",
    description: "Fetch - Retrieve web content from any URL.",
    envVars: [],
    docs: "",
    category: "search",
  },
];
