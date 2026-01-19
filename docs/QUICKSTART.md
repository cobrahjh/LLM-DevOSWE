# Hive Quick Start Guide

Get the Hive ecosystem running in minutes.

---

## Prerequisites

- **Node.js** 18+ installed
- **Git** for version control
- **Ollama** or **LM Studio** for local LLM (optional)

---

## 1. Clone & Install

```bash
git clone https://github.com/cobrahjh/LLM-DevOSWE.git
cd LLM-DevOSWE
npm install
```

---

## 2. Start All Services

### Option A: Quick Start (Development)

```bash
# Windows
start-all-servers.bat

# Or manually
npm start  # Starts Relay only
```

### Option B: Individual Services

```bash
# Terminal 1 - Relay (required)
cd Admin/relay && npm start

# Terminal 2 - Oracle (LLM backend)
cd C:/LLM-Oracle && npm start

# Terminal 3 - KittBox (UI)
cd Admin/agent && npm start

# Terminal 4 - Hive-Mind (monitoring)
cd Admin/hive-mind && npm start
```

---

## 3. Verify Services

### Health Check

```bash
npm run health
```

**Expected Output:**
```
========================================
  Hive Health Check
========================================

  [OK] Relay           :8600  ONLINE
  [OK] Oracle          :3002  ONLINE
  [OK] KittBox         :8585  ONLINE
  [OK] Hive-Mind       :8701  ONLINE

----------------------------------------
  Online: 4  |  Offline: 0  |  Total: 4
========================================
```

### Manual Check

```bash
curl http://localhost:8600/api/health
curl http://localhost:3002/api/health
```

---

## 4. Access UIs

| UI | URL | Purpose |
|----|-----|---------|
| **KittBox** | http://localhost:8585 | Command Center |
| **Relay Dashboard** | http://localhost:8600 | Task Queue |
| **Hive-Mind** | http://localhost:8701 | Activity Monitor |
| **Kitt Live** | http://localhost:8686 | Chat Interface |

---

## 5. Local LLM Setup (Optional)

### Ollama

```bash
# Install Ollama from https://ollama.ai
ollama pull qwen2.5-coder:14b
ollama serve  # Runs on port 11434
```

### LM Studio

1. Download from https://lmstudio.ai
2. Load `qwen2.5-coder-14b-instruct`
3. Start server on port 1234

---

## 6. Run Tests

```bash
# All tests
npm test

# With coverage
npm test -- --coverage

# Watch mode
npm run test:watch
```

---

## 7. Development Mode

Start services with auto-reload:

```bash
cd Admin/relay && npm run dev
cd Admin/agent && npm run dev
```

---

## Service Ports Reference

| Port | Service | Required |
|------|---------|----------|
| 8600 | Relay | ✅ Yes |
| 3002 | Oracle | ✅ Yes |
| 8585 | KittBox | ✅ Yes |
| 8701 | Hive-Mind | ✅ Yes |
| 8686 | Kitt Live | Optional |
| 8800 | Hive Brain | Optional |
| 8850 | Hive Oracle | Optional |
| 11434 | Ollama | Optional |
| 1234 | LM Studio | Optional |

---

## Common Commands

```bash
# Check service health
npm run health

# Run linter
npm run lint

# Fix lint issues
npm run lint:fix

# View task queue
curl http://localhost:8600/api/queue

# Add a task
curl -X POST http://localhost:8600/api/queue \
  -H "Content-Type: application/json" \
  -d '{"task": "Test task", "source": "cli"}'

# Ask Oracle
curl -X POST http://localhost:3002/api/ask \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello!"}'
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
netstat -ano | findstr :8600

# Kill process
taskkill /PID <pid> /F
```

### Service Won't Start

1. Check if dependencies installed: `npm install`
2. Check port availability
3. Check logs in service directory
4. Verify Node.js version: `node --version`

### LLM Not Responding

1. Check Ollama/LM Studio is running
2. Verify model is loaded
3. Check Oracle config for correct backend
4. Test directly: `curl http://localhost:11434/api/tags`

### Reset Everything

```bash
# Stop all services
taskkill /IM node.exe /F

# Clear relay database (optional)
del Admin\relay\relay.db

# Restart
start-all-servers.bat
```

---

## Next Steps

1. Read [TECH-STACK.md](../TECH-STACK.md) for architecture overview
2. Read [API-RELAY.md](API-RELAY.md) for Relay API reference
3. Read [API-ORACLE.md](API-ORACLE.md) for Oracle API reference
4. Read [STANDARDS.md](../STANDARDS.md) for coding conventions
5. Read [CLAUDE.md](../CLAUDE.md) for AI context

---

## Getting Help

- **Issues:** https://github.com/cobrahjh/LLM-DevOSWE/issues
- **Docs:** `docs/` folder
- **AI Help:** Ask through KittBox or Kitt Live

---

*Quick Start Guide - Part of Phase 3: Documentation*
