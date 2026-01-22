# SimWidget Engine

Flow Pro replacement for MSFS 2024 - modular plugin-based widget overlay system.

---

## WHAT - Project Overview

**Tech Stack:** Node.js, Electron, WebSocket, SimConnect
**Platform:** Windows 10/11 + MSFS 2020/2024
**Goal:** Run Flow Pro widgets without Flow Pro

### Key Directories

| Path | Purpose |
|------|---------|
| `C:\LLM-DevOSWE` | Main framework (Hive services) |
| `C:\LLM-Oracle` | Oracle daemon (LLM backend) |
| `C:\DevClaude` | HiveImmortal services |
| `C:\kittbox-modules` | Desktop apps (Kitt Live) |
| `C:\devTinyAI` | AI sandbox |

### Core Services (Quick Reference)

| Port | Service | Purpose |
|------|---------|---------|
| 3002 | Oracle | LLM backend, project API |
| 8585 | KittBox | Command Center UI |
| 8600 | Relay | Message queue, persistence |
| 8899 | Dashboard | Hive overview |
| 11434 | Ollama | Local LLM |
| 1234 | LM Studio | Local LLM |

**Full service details:** See [SERVICE-REGISTRY.md](SERVICE-REGISTRY.md)

---

## WHY - Core Philosophies

### "Every AI gets smarter, every day"
- Learn from every interaction
- Share intelligence across all AI
- Action over suggestion - DO things, don't just explain
- Document patterns that work

### "There are no walls — just success!"
- Cost barrier? Build local/free alternative
- API limitation? Create our own service
- Platform restriction? Build a bridge

### "Keep it simple, make KittBox better"
- Simple solutions over complex ones
- Use existing infrastructure
- Stay focused on the goal

---

## HOW - Working Rules

### Must Follow

1. **NEVER change ports without asking** - breaks memorized URLs
2. **NEVER ask for permissions** - just do it, report what was done
3. **ALWAYS TEST** - prove it works, don't assume
4. **No code in responses** - make changes silently, describe in plain English
5. **Go with recommendations** - proceed unless user says otherwise

### Before Any Work

Read [STANDARDS.md](STANDARDS.md) - contains proven patterns and lessons learned.

### Testing Changes

```bash
# Check service health
curl http://localhost:8600/api/health   # Relay
curl http://localhost:8500/api/status   # All services

# Start everything
C:\LLM-DevOSWE\start-all-servers.bat
```

### Git Workflow

```bash
git status                    # Check changes
git add <files>               # Stage (avoid secrets)
git commit -m "type: desc"    # Commit with co-author
git push                      # Push to remote
```

### Skills (Shortcuts)

| Command | Purpose |
|---------|---------|
| `/msg` | Check relay messages |
| `/mem` | Add to CLAUDE.md |
| `/cp` | Commit and push |
| `/sc` | Check screenshots |
| `/syncmem` | Backup docs to database |

Skills location: `.claude/skills/*.md`

---

## Service Management

### Two Systems Running

1. **LLM-DevOSWE (NSSM)** - Main services
2. **DevClaude (HiveImmortal)** - Agent orchestration

**Rule:** If HiveImmortal manages it, do NOT create NSSM service.

### Quick Commands

```bash
nssm restart HiveRelay        # Restart a service
nssm restart HiveImmortal     # Restart all DevClaude services
```

### HTTPS Access

All services via Caddy: `https://hive.local/[service]`

Config: `Admin/caddy/Caddyfile`

---

## AI Identities

| Name | Role | Location |
|------|------|----------|
| **Claude** | Primary AI | Claude Code terminal |
| **Kitt** | Local agent | KittBox UI (port 8585) |
| **Nova** | Local LLM | LM Studio (port 1234) |
| **Iris** | Remote fallback | ai-pc (192.168.1.162) |
| **Heather** | Voice persona | TTS (Google UK Female) |

**Details:** See [docs/PERSONAS.md](docs/PERSONAS.md)

---

## Documentation Index

| Document | Content |
|----------|---------|
| [SERVICE-REGISTRY.md](SERVICE-REGISTRY.md) | All services, ports, endpoints |
| [STANDARDS.md](STANDARDS.md) | Code patterns, timing, conventions |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture diagrams |
| [docs/PERSONAS.md](docs/PERSONAS.md) | AI personas and voice settings |
| [docs/INTEL-SOURCES.md](docs/INTEL-SOURCES.md) | Intel gathering configuration |
| [docs/CLAUDE-CODE-GUIDE.md](docs/CLAUDE-CODE-GUIDE.md) | CLI reference, hooks, MCP |
| [docs/COMPONENT-REGISTRY.md](docs/COMPONENT-REGISTRY.md) | UI components catalog |

---

## Quick Context

- **This PC:** Harold-PC (192.168.1.42)
- **Remote PC:** ai-pc (192.168.1.162)
- **LLMs:** Ollama + LM Studio locally, Iris remote
- **GitHub:** https://github.com/cobrahjh/LLM-DevOSWE
- **Screenshots:** `C:\Users\hjhar\OneDrive\Pictures\screenshoots`

---

## Key Rules Summary

| Rule | Why |
|------|-----|
| Don't change ports | Breaks bookmarks/memory |
| Don't ask permission | Slows down work |
| Always test | Prove it works |
| No code in chat | Keep responses clean |
| Use existing infra | Don't recreate |
| Security over convenience | Principle of least privilege |
| Cost warning required | No silent charges |
