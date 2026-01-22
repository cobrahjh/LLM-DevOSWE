# Intelligence Sources

Oracle autonomously gathers intelligence to keep the Hive ahead of the curve.

---

## Active Intel Sources

| Source | Frequency | Purpose |
|--------|-----------|---------|
| Hacker News API | 6 hours | AI/tech news, emerging trends |
| Ollama Model Registry | Daily | New model discoveries |
| GitHub Releases | 12 hours | Track updates to key repos |
| Hive Health Metrics | 60 seconds | Anomaly detection, patterns |

---

## Watched GitHub Repos

### Core AI/LLM
- ollama/ollama
- lmstudio-ai/lmstudio
- anthropics/claude-code
- anthropics/anthropic-sdk-python
- anthropics/anthropic-sdk-typescript
- openai/openai-node
- openai/openai-python

### MCP (Model Context Protocol)
- anthropics/model-context-protocol
- modelcontextprotocol/servers
- modelcontextprotocol/typescript-sdk

### Local LLM Tools
- ggml-org/llama.cpp
- Mozilla-Ocho/llamafile
- huggingface/transformers
- vllm-project/vllm
- oobabooga/text-generation-webui
- open-webui/open-webui

### AI Agents & Frameworks
- langchain-ai/langchain
- langchain-ai/langgraph
- microsoft/autogen
- crewAIInc/crewAI
- significant-gravitas/AutoGPT

### Dev Tools
- nodejs/node
- electron/electron
- microsoft/vscode
- github/copilot.vim

### Flight Sim
- EvenAR/node-simconnect
- flybywiresim/aircraft

### Utilities
- xtermjs/xterm.js
- websockets/ws
- expressjs/express
- jestjs/jest

---

## Future Intel Sources (TODO)

- **Hugging Face** - New model releases, trending models
- **Reddit r/LocalLLaMA** - Community discoveries, optimization tips
- **ArXiv RSS** - AI research papers (cs.AI, cs.LG)
- **Product Hunt** - New AI tools and services
- **Tech RSS Feeds** - Ars Technica, The Verge, TechCrunch AI sections
- **Model Benchmarks** - Track LMSYS leaderboard changes
- **Security Feeds** - CVE alerts for dependencies

---

## Intel API Endpoints

```bash
# Current intel summary
curl http://localhost:3002/api/intel

# Latest daily briefing
curl http://localhost:3002/api/intel/briefing

# Hacker News data
curl http://localhost:3002/api/intel/news

# Model discoveries
curl http://localhost:3002/api/intel/models

# GitHub releases
curl http://localhost:3002/api/intel/github

# Health trends
curl http://localhost:3002/api/intel/health

# Force refresh all
curl -X POST http://localhost:3002/api/intel/refresh

# Fetch specific source
curl -X POST http://localhost:3002/api/intel/fetch/github
```

---

## Database Persistence

Intel is stored in two locations:

1. **Local JSON:** `C:\LLM-Oracle\oracle-workspace\memory\intelligence.json`
2. **Relay SQLite:** `C:\LLM-DevOSWE\Admin\relay\knowledge.db`

### Relay Intel API

```bash
# Database summary
curl http://localhost:8600/api/intel/db

# Query news items
curl "http://localhost:8600/api/intel/db/news?limit=10"

# Query GitHub releases
curl "http://localhost:8600/api/intel/db/github?limit=10"

# Query health records
curl "http://localhost:8600/api/intel/db/health?limit=10"
```

---

## Philosophy

**"Research resources make the Hive stronger, smarter, and unstoppable."**

The Hive learns. The Hive adapts. The Hive never stops improving.
