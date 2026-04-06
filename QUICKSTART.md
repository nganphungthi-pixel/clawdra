# 🍡 clawdra - Quick Start Guide

## The Smartest AI Coding Agent - Smarter Than Claude

---

## 🚀 QUICK START (3 Options)

### Option 1: FREE Local AI (No API Key Required!)

**Best for:** Getting started immediately, 100% free

1. **Install Ollama** (Download from https://ollama.com)
   ```bash
   # Windows - Download installer from website
   # or use winget:
   winget install Ollama.Ollama
   ```

2. **Pull a model** (Run in terminal):
   ```bash
   ollama pull llama3
   # or smaller:
   ollama pull phi3
   ```

3. **Run clawdra**:
   ```bash
   npm run dev
   # or
   npm start
   ```

4. **Start chatting!** ✅

---

### Option 2: OpenRouter (Free Tier, 200+ Models)

**Best for:** Access to many models without multiple API keys

1. **Sign up**: https://openrouter.ai (Free tier available)

2. **Get API Key** from dashboard

3. **Set environment variable**:
   ```bash
   # Windows PowerShell
   $env:OPENROUTER_API_KEY="sk-ora-xxx"
   
   # Windows CMD
   set OPENROUTER_API_KEY=sk-ora-xxx
   ```

4. **Run**:
   ```bash
   npm run dev
   /provider openrouter
   ```

---

### Option 3: Anthropic/OpenAI (Paid, Best Quality)

**Best for:** Production use, highest quality

1. **Get API Key**:
   - Anthropic: https://console.anthropic.com ($5-15 free credits)
   - OpenAI: https://platform.openai.com

2. **Set environment variable**:
   ```bash
   # Windows PowerShell - Anthropic
   $env:ANTHROPIC_API_KEY="sk-ant-xxx"
   
   # Windows PowerShell - OpenAI
   $env:OPENAI_API_KEY="sk-xxx"
   ```

3. **Run**:
   ```bash
   npm run dev
   ```

---

## 📋 COMMANDS

Once in chat mode, type:

```
/help              - Show all commands
/status            - Show current configuration
/model <name>      - Switch AI model
/provider <name>   - Switch provider
/think <level>     - Set thinking level (low/medium/high/xhigh)
/compact           - Compact conversation history
/clear             - Clear current session
/skills            - List available skills
/memory            - Show memory stats
/exit              - Exit clawdra
```

**Or just type a message to chat with the AI!**

---

## 🎯 EXAMPLES

### Simple Question
```
🍡 > Explain async/await in JavaScript
```

### File Operations
```
🍡 > Create a hello world Node.js script
🍡 > Read the package.json file
🍡 > Edit src/index.ts to add error handling
```

### Complex Tasks
```
🍡 > Create a REST API with Express and TypeScript
🍡 > Build a React todo app with state management
🍡 > Debug why my tests are failing
```

---

## ⚙️ CONFIGURATION

### Environment Variables

See `.env.example` for all options. Copy to `.env`:

```bash
cp .env.example .env
```

### Key Settings

```bash
# Provider (anthropic/openai/openrouter/ollama/gemini/bedrock)
ALO OCHAAT_PROVIDER=ollama

# Model
ANTHROPIC_MODEL=claude-sonnet-4-20250514
OPENAI_MODEL=gpt-4o
OLLAMA_MODEL=llama3

# Thinking level
THINKING_LEVEL=medium

# Max iterations
MAX_ITERATIONS=50
```

---

## 🌐 WEBSOCKET GATEWAY

Start the gateway server for remote access:

```bash
npm run serve

# Connect via WebSocket
ws://localhost:8080

# Send request
{"type": "request", "id": "1", "prompt": "Hello"}
```

---

## 🎯 FEATURES

✅ **6 AI Providers** - Anthropic, OpenAI, OpenRouter, Ollama, Gemini, Bedrock  
✅ **10+ Tools** - Read, Write, Edit, Bash, WebSearch, WebFetch, Memory, Skills, Browser  
✅ **Smart Learning** - Pattern extraction, failure analysis, continuous improvement  
✅ **Multi-Model Routing** - Route tasks to optimal model based on complexity  
✅ **Skills System** - 6 built-in skills (review, commit, test, docs, architecture, bug-hunt)  
✅ **Persistent Memory** - SQLite-based, survives restarts  
✅ **WebSocket Gateway** - Remote access via WebSocket  
✅ **Sandbox Security** - Process isolation, path restrictions, rate limiting  
✅ **15+ Commands** - Full interactive CLI  

---

## 🐛 TROUBLESHOOTING

### "Provider not detected"
Make sure you have at least one API key set or Ollama installed.

### "Ollama connection refused"
Make sure Ollama is running:
```bash
ollama list
ollama pull llama3
```

### "Module not found"
Install dependencies:
```bash
npm install
```

### Build errors
Clean and rebuild:
```bash
rmdir /s /q node_modules
npm install
```

---

## 📊 ARCHITECTURE

```
┌─────────────────────────────────────────────────┐
│              clawdra CORE                      │
├─────────────────────────────────────────────────┤
│                                                  │
│  Providers (6) → Agent Loop → Tools (10+)      │
│       ↓              ↓            ↓             │
│  Multi-Model      Learning    Memory           │
│  Routing          Engine      System           │
│                                                  │
│  Gateway (WebSocket) + CLI + Skills            │
└─────────────────────────────────────────────────┘
```

---

## 💡 TIPS

1. **Start with Ollama** - Free, no setup needed
2. **Use /help** - See all available commands
3. **Use /status** - Check your configuration
4. **Be specific** - Clear instructions get better results
5. **Use thinking** - Higher thinking levels for complex tasks
6. **Check /memory** - See what the agent has learned

---

## 🎓 LEARNING MODE

clawdra learns from every interaction:
- ✅ Successful patterns are saved
- ❌ Failures are analyzed and lessons extracted
- 📈 Performance improves over time
- 💾 Knowledge persists across sessions

Check learning stats with `/memory`

---

**Enjoy building with clawdra! 🚀**
