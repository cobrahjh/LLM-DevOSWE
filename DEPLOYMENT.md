# Deployment Guide
**Last Updated:** 2026-01-19
**Version:** 1.0.0

Complete guide for deploying the LLM-DevOSWE Hive on single or multiple machines.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Single Machine Deployment](#single-machine-deployment)
3. [Multi-Machine Deployment](#multi-machine-deployment)
4. [Windows Services Setup](#windows-services-setup)
5. [Docker Deployment](#docker-deployment)
6. [Troubleshooting](#troubleshooting)
7. [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

### Required Software
- **Node.js** v18+ (LTS recommended)
- **Git** for version control
- **Ollama** for local LLM inference
- **curl** for health checks (included in Windows 10+)

### Optional Software
- **LM Studio** for additional local LLM
- **Python 3.10+** for Whisper (speech-to-text)
- **NSSM** for Windows service management
- **Docker** for containerized deployment

### Hardware Requirements
| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 4 cores | 8+ cores |
| RAM | 16GB | 32GB+ |
| Storage | 50GB SSD | 100GB+ NVMe |
| GPU | None | NVIDIA 8GB+ VRAM |

---

## Single Machine Deployment

### Quick Start

1. **Clone the repository**
```bash
git clone https://github.com/cobrahjh/LLM-DevOSWE.git C:\LLM-DevOSWE
git clone https://github.com/cobrahjh/LLM-Oracle.git C:\LLM-Oracle
```

2. **Install dependencies**
```bash
cd C:\LLM-DevOSWE && npm install
cd C:\LLM-DevOSWE\Admin\relay && npm install
cd C:\LLM-DevOSWE\Admin\agent && npm install
cd C:\LLM-Oracle && npm install
```

3. **Configure environment**
```bash
copy C:\LLM-DevOSWE\.env.example C:\LLM-DevOSWE\.env
# Edit .env with your API keys
```

4. **Start Ollama**
```bash
ollama serve
ollama pull qwen2.5-coder:14b
```

5. **Start all services**
```bash
C:\LLM-DevOSWE\start-all-servers.bat
```

6. **Verify deployment**
- Open http://localhost:8585 (KittBox)
- Open http://localhost:8701 (Hive-Mind)
- Check all services show green

### Service Startup Order

**Critical:** Services must start in this order:

1. **Ollama/LM Studio** - LLM backends (external)
2. **Relay** (8600) - Message broker (all services depend on this)
3. **Oracle** (3002) - LLM API
4. **Master O** (8500) - Orchestrator
5. **KittBox** (8585) - Web UI
6. **Other services** - Any order

### Manual Service Start

```bash
# Start individually (in separate terminals)
cd C:\LLM-DevOSWE\Admin\relay && node relay-service.js
cd C:\LLM-Oracle && node oracle.js
cd C:\LLM-DevOSWE\Admin\agent && node agent-server.js
```

---

## Multi-Machine Deployment

### Network Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Harold-PC     │     │    morpu-pc     │     │     ai-pc       │
│   (Primary)     │────►│   (Secondary)   │────►│   (Fallback)    │
│   192.168.1.192  │     │  192.168.1.xxx  │     │  192.168.1.162  │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ Relay     :8600 │     │ Relay     :8600 │     │ LM Studio :1234 │
│ Oracle    :3002 │     │ Oracle    :3002 │     │ (Iris)          │
│ KittBox   :8585 │     │ KittBox   :8585 │     │                 │
│ Ollama   :11434 │     │ Ollama   :11434 │     │                 │
│ LM Studio :1234 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Secondary Node Setup (morpu-pc)

1. **Copy install package**
```bash
# From primary machine
xcopy /E /I C:\LLM-DevOSWE\Admin\morpu-install-package \\morpu-pc\C$\hive-install
```

2. **On secondary machine**
```bash
cd C:\hive-install
install.bat
```

3. **Configure for network**
Edit `.env` on secondary:
```
PRIMARY_RELAY=http://192.168.1.192:8600
NODE_NAME=morpu-pc
```

4. **Start services**
```bash
start-hive.bat
```

### Firewall Configuration

Open these ports on all machines:

| Port | Service | Direction |
|------|---------|-----------|
| 8600 | Relay | Inbound/Outbound |
| 3002 | Oracle | Inbound |
| 8585 | KittBox | Inbound |
| 8701 | Hive-Mind | Inbound |
| 11434 | Ollama | Inbound |
| 1234 | LM Studio | Inbound |

PowerShell (run as Admin):
```powershell
# Allow Relay
New-NetFirewallRule -DisplayName "Hive Relay" -Direction Inbound -Port 8600 -Protocol TCP -Action Allow

# Allow all hive ports
$ports = @(3002, 8585, 8600, 8701, 11434, 1234)
foreach ($port in $ports) {
    New-NetFirewallRule -DisplayName "Hive $port" -Direction Inbound -Port $port -Protocol TCP -Action Allow
}
```

---

## Windows Services Setup

### Using NSSM

NSSM (Non-Sucking Service Manager) manages Node.js services.

1. **Download NSSM**
```bash
# Download from https://nssm.cc/download
# Extract to C:\nssm\nssm.exe
```

2. **Install services**
```bash
# Relay
nssm install HiveRelay "C:\Program Files\nodejs\node.exe"
nssm set HiveRelay AppDirectory "C:\LLM-DevOSWE\Admin\relay"
nssm set HiveRelay AppParameters "relay-service.js"
nssm set HiveRelay Start SERVICE_AUTO_START

# Oracle
nssm install HiveOracle "C:\Program Files\nodejs\node.exe"
nssm set HiveOracle AppDirectory "C:\LLM-Oracle"
nssm set HiveOracle AppParameters "oracle.js"
nssm set HiveOracle Start SERVICE_AUTO_START

# KittBox
nssm install HiveKittBox "C:\Program Files\nodejs\node.exe"
nssm set HiveKittBox AppDirectory "C:\LLM-DevOSWE\Admin\agent"
nssm set HiveKittBox AppParameters "agent-server.js"
nssm set HiveKittBox Start SERVICE_AUTO_START
```

3. **Start services**
```bash
nssm start HiveRelay
nssm start HiveOracle
nssm start HiveKittBox
```

### Service Management

```bash
# Check status
nssm status HiveRelay

# Stop/Start/Restart
nssm stop HiveRelay
nssm start HiveRelay
nssm restart HiveRelay

# View logs (opens GUI)
nssm edit HiveRelay

# Remove service
nssm remove HiveRelay confirm
```

### Auto-Recovery Configuration

```bash
# Configure service to restart on failure
nssm set HiveRelay AppExit Default Restart
nssm set HiveRelay AppRestartDelay 5000
```

---

## Docker Deployment

### Prerequisites
- Docker Desktop or Docker Engine
- WSL2 (Windows) or Linux host

### Quick Start

```bash
cd C:\LLM-DevOSWE\Admin\docker
docker-compose up -d
```

### Docker Compose Configuration

File: `Admin/docker/docker-compose.yml`

```yaml
version: '3.8'
services:
  relay:
    build: ../relay
    ports:
      - "8600:8600"
    volumes:
      - relay-data:/app/data
    restart: unless-stopped

  oracle:
    build: ../../LLM-Oracle
    ports:
      - "3002:3002"
    environment:
      - OLLAMA_URL=http://host.docker.internal:11434
    restart: unless-stopped

  kittbox:
    build: ../agent
    ports:
      - "8585:8585"
    depends_on:
      - relay
      - oracle
    restart: unless-stopped

volumes:
  relay-data:
```

### WSL2 Deployment

```bash
# Start WSL hive
C:\LLM-DevOSWE\Admin\docker\start-hive-wsl.bat

# Stop WSL hive
C:\LLM-DevOSWE\Admin\docker\stop-hive-wsl.bat
```

---

## Troubleshooting

### Service Won't Start

**Check port availability:**
```bash
netstat -ano | findstr :8600
# If port in use, kill the process:
taskkill /PID <PID> /F
```

**Check Node.js:**
```bash
node --version  # Should be v18+
npm --version
```

**Check logs:**
```bash
# Agent logs
type C:\LLM-DevOSWE\Admin\agent\logs\agent-server.log

# Relay logs (if using NSSM)
nssm edit HiveRelay  # Check I/O tab for log paths
```

### Connection Refused

1. Verify service is running: `curl http://localhost:PORT/api/health`
2. Check firewall: `netsh advfirewall firewall show rule name=all | findstr PORT`
3. Check binding: `netstat -ano | findstr LISTENING | findstr PORT`

### Ollama Not Responding

```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# Restart Ollama
taskkill /IM ollama.exe /F
ollama serve
```

### Database Locked

```bash
# Stop all services
C:\LLM-DevOSWE\stop-hive.bat

# Delete lock files
del C:\LLM-DevOSWE\Admin\relay\tasks.db-shm
del C:\LLM-DevOSWE\Admin\relay\tasks.db-wal

# Restart
C:\LLM-DevOSWE\start-all-servers.bat
```

### High Memory Usage

1. Check which service: Task Manager → Details → Sort by Memory
2. Restart the service: `nssm restart HiveServiceName`
3. If persistent, check for memory leaks in logs

---

## Rollback Procedures

### Quick Rollback (Git)

```bash
# View recent commits
git log --oneline -10

# Rollback to previous commit
git checkout <commit-hash> -- <file>

# Or reset entire repo (DESTRUCTIVE)
git reset --hard <commit-hash>
```

### Service Rollback

```bash
# 1. Stop affected service
nssm stop HiveRelay

# 2. Backup current version
xcopy /E /I C:\LLM-DevOSWE\Admin\relay C:\backup\relay-broken

# 3. Restore previous version
git checkout HEAD~1 -- Admin/relay/

# 4. Reinstall dependencies
cd C:\LLM-DevOSWE\Admin\relay && npm install

# 5. Restart service
nssm start HiveRelay
```

### Full System Restore

```bash
# 1. Stop all services
C:\LLM-DevOSWE\stop-hive.bat

# 2. Backup databases
copy C:\LLM-DevOSWE\Admin\relay\tasks.db C:\backup\

# 3. Reset to known good state
git fetch origin
git reset --hard origin/master

# 4. Reinstall all dependencies
npm install
cd Admin\relay && npm install
cd ..\agent && npm install

# 5. Restore database if needed
copy C:\backup\tasks.db C:\LLM-DevOSWE\Admin\relay\

# 6. Start services
C:\LLM-DevOSWE\start-all-servers.bat
```

---

## Environment Variables

### Required
| Variable | Description | Example |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Claude API key | `sk-ant-...` |

### Optional
| Variable | Description | Default |
|----------|-------------|---------|
| `HIVE_API_KEY` | Relay auth key | (none - localhost bypass) |
| `LLM_BACKEND` | 'ollama', 'lmstudio', 'auto' | `lmstudio` |
| `OLLAMA_URL` | Ollama endpoint | `http://localhost:11434` |
| `LMSTUDIO_URL` | LM Studio endpoint | `http://localhost:1234` |
| `SSL_ENABLED` | Enable HTTPS | `false` |
| `NODE_ENV` | Environment | `development` |

---

## Health Monitoring

### Manual Health Check

```bash
# Quick check all services
C:\LLM-DevOSWE\hive-status.bat

# Or use curl
curl http://localhost:8600/api/health  # Relay
curl http://localhost:3002/api/health  # Oracle
curl http://localhost:8585/api/health  # KittBox
```

### Automated Monitoring

Use Hive-Mind dashboard: http://localhost:8701

Or configure Master Orchestrator for auto-restart on failure.

---

## Support

- **Documentation:** See `CLAUDE.md`, `STANDARDS.md`, `SERVICE-REGISTRY.md`
- **Issues:** https://github.com/cobrahjh/LLM-DevOSWE/issues
- **Logs:** Check `Admin/*/logs/` directories
