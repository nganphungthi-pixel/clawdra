<p align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="https://img.shields.io/badge/🦞-Clawdra-000000?style=flat">
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/🦞-Clawdra-FFFFFF?style=flat">
    <img alt="clawdra" height="48" src="https://img.shields.io/badge/🦞%20Clawdra-black?style=flat">
  </picture>
</p>

<p align="center">
  <strong>The world-class AI coding agent</strong><br>
  <sub>Smarter. Faster. Connected to everything.</sub>
</p>

<p align="center">
  <a href="https://github.com/nganphungthi-pixel/clawdra/actions"><img src="https://img.shields.io/github/actions/workflow/status/nganphungthi-pixel/clawdra/test.yml?style=for-the-badge" alt="CI"></a>
  <a href="https://github.com/nganphungthi-pixel/clawdra/releases"><img src="https://img.shields.io/github/v/release/nganphungthi-pixel/clawdra?include_prereleases&style=for-the-badge" alt="Release"></a>
  <a href="https://discord.gg"><img src="https://img.shields.io/discord/clawdra?label=Discord&logo=discord&logoColor=white&color=5865F2&style=for-the-badge" alt="Discord"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="License"></a>
</p>

---

**Clawdra** is a fully-featured AI coding agent that runs on your machine. It connects to any AI provider, understands your codebase, researches across the web, reasons through complex problems, and helps you build software — all from your terminal or browser. Built with TypeScript, designed for developers who want an agent that works *their* way.

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#models">Models</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#features">Features</a> ·
  <a href="#integrations">Integrations</a> ·
  <a href="#security">Security</a> ·
  <a href="#contributing">Contributing</a>
</p>

---

## Models (selection + auth)

Clawdra connects to **any** AI provider. You pick the provider, you pay them directly, Clawdra charges nothing.

- **Ollama** — free, runs locally on your machine. No API key, no internet needed. Best for privacy.
- **Anthropic** — Claude models. Get API key at [console.anthropic.com](https://console.anthropic.com/settings/keys).
- **OpenAI** — GPT models. Get API key at [platform.openai.com](https://platform.openai.com/api-keys).
- **OpenRouter** — 200+ models from one key. Some models free. Get key at [openrouter.ai](https://openrouter.ai/keys).
- **Google** — Gemini models. Free tier available. Get key at [aistudio.google.com](https://aistudio.google.com/app/apikey).

Model note: while many providers/models are supported, for the best coding experience we recommend **Claude Sonnet 4** (Anthropic) or **GPT-4o** (OpenAI). For free local usage, **Qwen 2.5 72B** via Ollama is excellent.

---

## Install (recommended)

**Requires:** [Node.js](https://nodejs.org) 22+ and [Git](https://git-scm.com).

```bash
git clone https://github.com/nganphungthi-pixel/clawdra.git
cd clawdra
npm install
```

After install, the setup wizard shows you all available providers and models:

```bash
# Interactive setup (pick provider + model)
npm run setup

# Or see all options without selecting
node scripts/setup.js providers
node scripts/setup.js models
```

---

## Quick start (TL;DR)

```bash
# 1. Pick your provider & set API key
cp .env.example .env
# Edit .env → add ONE provider's API key

# 2. Start chatting
npx tsx src/cli.ts chat

# 3. Try the fancy terminal UI
npx tsx src/cli.ts chat --tui

# 4. Or open in your browser
npx tsx src/cli.ts serve
# → http://localhost:8080
```

Upgrade note: `git pull && npm install` to get the latest version.

---

## Highlights

- **[Any AI provider](#models)** — Anthropic, OpenAI, Google, OpenRouter, Ollama, Bedrock. Switch anytime.
- **[Built-in research](#research)** — 8 search engines, deep reasoning, multi-agent task decomposition.
- **[200+ connectors](#integrations)** — Supabase, Firebase, Vercel, GitHub, Slack, Discord, and more.
- **[Enterprise-ready](#governance)** — Company governance, budget tracking, audit logging, sandboxed execution.
- **[Runs anywhere](#platform)** — Windows, macOS, Linux. Local AI with zero API costs via Ollama.
- **[Voice support](#voice)** — Transcription (Whisper/Deepgram) + TTS (OpenAI/ElevenLabs/Edge TTS).
- **[MCP integration](#mcp)** — Full Model Context Protocol support with auto-discovery.
- **[Plugin system](#plugins)** — 30+ registration methods, hot-reload, community extensible.

---

## Star History

<p align="center">
  <a href="https://star-history.com/#nganphungthi-pixel/clawdra&Date">
    <img src="https://api.star-history.com/svg?repos=nganphungthi-pixel/clawdra&type=Date" alt="Star History" width="600">
  </a>
</p>

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     clawdra core                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Agent    │  │ Tool     │  │ Memory   │  │ Learning   │  │
│  │ Loop     │──│ Executor │──│ System   │──│ Engine     │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│       │              │             │              │          │
│  ┌────┴─────┐  ┌─────┴────┐  ┌────┴─────┐  ┌───┴──────┐   │
│  │ Provider │  │ Sandbox  │  │ Vector   │  │ Hook     │   │
│  │ Router   │  │ Manager  │  │ Store    │  │ System   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
│  Channels                                                   │
│  Telegram │ Discord │ Slack │ Webhook │ CLI │ WebSocket     │
│                                                             │
│  Voice System                                               │
│  Transcription (Whisper, Deepgram) │ TTS (OpenAI, ElevenLabs)│
│                                                             │
│  Governance                                                 │
│  Companies │ Agents │ Issues │ Budgets │ Org Chart           │
│                                                             │
│  MCP Integration                                            │
│  Filesystem │ Git │ GitHub │ Postgres │ Browser              │
└─────────────────────────────────────────────────────────────┘
```

---

## Everything we built so far

### Core platform
- **Agent loop** — streaming, retry logic, loop detection, context compaction
- **Provider abstraction** — 6 providers with automatic fallback chains
- **Tool system** — Read, Write, Edit, Bash, WebSearch, WebFetch, Memory, Skills, Browser, MCP
- **Learning engine** — records interactions, analyzes failures, extracts patterns

### Channels
- **CLI** — interactive readline with 27 slash commands
- **TUI** — React/Ink terminal UI with streaming output
- **WebSocket** — real-time gateway for web clients and external apps
- **Web UI** — browser-based chat interface at `http://localhost:8080`
- **Telegram** — bot integration with group support
- **Discord** — guild and channel support
- **Slack** — Bolt-based integration with socket mode
- **Voice** — speak to Clawdra, get spoken responses

### Research & reasoning
- **8 search engines** — Google, Brave, Bing, DuckDuckGo, Tavily, Exa, GitHub, Yahoo
- **Deep reasoning** — chain-of-thought analysis with 4 depth modes (quick/standard/deep/expert)
- **Multi-agent** — spawn sub-agents for parallel task decomposition
- **Expertise patterns** — auto-detects context (Next.js, React, Tailwind, WordPress, etc.)

### Tools + automation
- **Security scanner** — 20 vulnerability classes (SQLi, XSS, Command Injection, Secrets, etc.)
- **Governance** — secret detection, approval workflows, audit logging
- **Rate limiting** — per-identifier rate limiting with sliding windows
- **Cost tracking** — token-based cost estimation with budget enforcement

### Runtime + safety
- **Sandboxed execution** — Docker and process isolation for code execution
- **Path validation** — allow/block lists for file access
- **Input validation** — Zod schemas for all tool inputs
- **Session management** — JSON-based session store with history

### Ops + packaging
- **Plugin system** — 30+ registration methods, hot-reload support
- **Config system** — hot-reload config with audit trail and atomic writes
- **Docker** — multi-stage build + docker compose with profiles
- **Tests** — 43 passing tests across providers, tools, memory, agent, security

---

## Integrations

### Databases & Backend
Supabase · Firebase · PostgreSQL · SQLite · MongoDB · MySQL · Databricks · Snowflake · MotherDuck · Dremio · Starburst · PlanetScale · BigQuery · Hex · Metabase · Tableau · Airtable

### Deploy & Hosting
Vercel · Netlify · Cloudflare · Hostinger · Wix · Webflow · WordPress.com

### CRM & Sales
HubSpot · Salesforce · Attio · Close CRM · Apollo · ZoomInfo · Clay · Common Room · Zoho CRM

### Communication
Slack · Gmail · Google Calendar · Resend · MailerLite · Mailchimp · Klaviyo · ActiveCampaign · Intercom · IFTTT · Zapier · Make · n8n · Workato

### Design & Creativity
Figma · Canva · Miro · tldraw · Excalidraw · Mermaid Chart · Lucid · Sketch · Gamma

### Finance
Stripe · PayPal · Square · Razorpay · GoCardless · Brex · Mercury · Ramp · QuickBooks · TurboTax · Credit Karma

### Monitoring & Security
Sentry · Grafana · Honeycomb · Dynatrace · Socket · Postman · Kubernetes

---

## Security

- **Sandboxed execution** — Docker/process isolation for code execution
- **Path validation** — allow/block lists for file access
- **Secret detection** — automated scanning for hardcoded credentials
- **Input validation** — Zod schemas for all tool inputs
- **Rate limiting** — per-identifier rate limiting
- **Audit logging** — comprehensive activity tracking with config audit trail

---

## Configuration

Clawdra is configured via `.env` file. After `npm install`:

```bash
cp .env.example .env
```

```json5
{
  // Pick ONE provider
  "OLLAMA_HOST": "http://localhost:11434",          // Free, local
  // "ANTHROPIC_API_KEY": "sk-ant-...",             // Claude models
  // "OPENAI_API_KEY": "sk-...",                    // GPT models
  // "OPENROUTER_API_KEY": "sk-or-...",             // 200+ models
  // "GEMINI_API_KEY": "...",                       // Gemini models

  // Optional: Override default model
  // "ANTHROPIC_MODEL": "claude-sonnet-4-20250514",
  // "OPENAI_MODEL": "gpt-4o",

  // Optional: Web search
  // "TAVILY_API_KEY": "...",
  // "EXA_API_KEY": "...",

  // Optional: Channels
  // "TELEGRAM_BOT_TOKEN": "...",
  // "DISCORD_BOT_TOKEN": "...",
  // "SLACK_BOT_TOKEN": "...",
}
```

---

## Project structure

```
clawdra/
├── src/
│   ├── agent/          # Agent loop, learning, sub-agents, streaming
│   ├── channels/       # Telegram, Discord, Slack, Webhook
│   ├── commands/       # 27 slash commands
│   ├── config/         # Hot-reload config with audit trail
│   ├── connectors/     # 200+ service connectors
│   ├── expertise/      # Domain expertise patterns
│   ├── gateway/        # WebSocket server + Web UI
│   ├── governance/     # Company management, budgets, org charts
│   ├── hooks/          # Pre/post processing pipeline
│   ├── mcp/            # Model Context Protocol integration
│   ├── memory/         # JSON + SQLite + vector store
│   ├── platform/       # Cross-platform (Windows/macOS/Linux)
│   ├── plugins/        # Plugin API with 30+ registration methods
│   ├── providers/      # AI provider abstraction (6 providers)
│   ├── reasoning/      # Chain-of-thought reasoning engine
│   ├── research/       # Multi-engine search system
│   ├── sandbox/        # Docker/process isolation
│   ├── security/       # Vulnerability scanners + audit
│   ├── session/        # Session management
│   ├── skills/         # Skill system registry
│   ├── tools/          # Tool execution engine
│   ├── voice/          # Transcription + TTS
│   ├── tui/            # React terminal UI
│   └── cli.ts          # Main entry point
├── tests/              # 43 passing tests
├── scripts/            # Setup wizard and utilities
├── public/             # Web UI
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## Chat commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/model` | Switch AI model |
| `/provider` | Switch AI provider |
| `/status` | Show agent status and metrics |
| `/research <q>` | Multi-engine web research |
| `/reason <q>` | Deep chain-of-thought reasoning |
| `/security` | Run security audit |
| `/connectors` | Browse 200+ service connectors |
| `/plugins` | List available plugins |
| `/skills` | List available skills |
| `/session` | Session management |
| `/bughunt` | Scan for vulnerabilities |
| `/config` | Show configuration |
| `/memory` | View memory state |
| `/compact` | Compact conversation context |
| `/clear` | Clear conversation history |
| `/commit` | Create git commit |
| `/review` | Review code |
| `/think` | Set thinking level |
| `/exit` | Exit |

---

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/providers.test.ts
```

---

## Docker

```bash
# Build and run
docker compose up -d

# With local AI (Ollama)
docker compose --profile local-ai up -d

# Production with Redis
docker compose --profile production up -d
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License — see the [LICENSE](LICENSE) file.

---

## ☕ Support This Project

Clawdra is free and open source. If it helps you build something great, consider buying me a coffee:

<p align="left">
  <a href="https://paypal.me/YOUR_LINK_HERE" target="_blank">
    <img src="https://img.shields.io/badge/☕%20Buy%20Me%20a%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" height="36">
  </a>
</p>

Every cup of coffee fuels more features. Thank you! 🙏

---

<p align="center">
  <sub><strong>clawdra</strong> — Making AI coding agents smarter, one commit at a time. 🚀</sub>
</p>
