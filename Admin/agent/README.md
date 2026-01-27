# SimWidget Agent v1.0.6

Self-hosted Claude assistant with full dev environment access.

**Path:** C:\LLM-DevOSWE\SimWidget_Engine\Admin\agent\  
**Last Updated:** 2026-01-09

> ⚠️ **Having issues?** See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for quick fixes!

## Features

- 💬 Web chat UI accessible from phone
- 🎤 Voice input (speech-to-text)
- 📁 Read/write project files
- ⚡ Execute PowerShell commands
- 🚀 Control SimWidget server
- 📦 Git commit/push
- ☰ Admin menu with quick commands
- ⚙️ Services panel with status monitoring
- 🔴 Live status dots for all services

## Changelog

### v1.0.6 (2026-01-09)
- Fixed: UI buttons not working (escaped template literals)
- Added: TROUBLESHOOTING.md guide

### v1.0.5
- Added express.static for HTML serving
- Added ☰ hamburger menu with admin commands
- Added ⚙️ services panel with Start/Stop controls
- Added compact status dots in header
- Status auto-refresh every 10 seconds

### v1.0.4
- Fixed tool_use/tool_result sequencing bug
- Safe history trimming

### v1.0.3
- Added slide-out menu for service control
- Integrated with Remote Support API

## Setup

### 1. Get Anthropic API Key

1. Go to: https://console.anthropic.com/
2. Create account or sign in
3. Go to API Keys → Create Key
4. Copy the key (starts with `sk-ant-`)

### 2. Configure

```powershell
cd C:\LLM-DevOSWE\SimWidget_Engine\Admin\agent

# Copy example config
copy .env.example .env

# Edit .env and add your API key
notepad .env
```

### 3. Install & Run

```powershell
# Install dependencies (first time only)
npm install

# Start agent
npm start
```

Or just double-click `start-agent.bat`

### 4. Access

- **Local:** http://localhost:8585
- **Phone:** http://192.168.1.192:8585

## Usage

### From Phone

1. Open browser
2. Go to http://192.168.1.192:8585
3. Chat with Kit!

### Quick Actions

- **Server Status** - Check if SimWidget server running
- **Restart Server** - Restart SimWidget on port 8080
- **Run Tests** - Execute test suite
- **Git Sync** - Commit and push to GitHub

### Example Commands

```
"Show me the fuel widget code"
"Add a new button to flight recorder"
"What's the server status?"
"Create a new widget called nav-display"
"List all files in ui folder"
"Run the tests"
"Sync changes to GitHub with message 'Fixed bug'"
```

## Firewall

If can't connect from phone, allow port 8585:

```powershell
New-NetFirewallRule -DisplayName "SimWidget Agent" -Direction Inbound -Port 8585 -Protocol TCP -Action Allow
```

## Architecture

```
Phone Browser ──▶ Agent Server (8585) ──▶ Claude API
                        │
                        ├── File System
                        ├── PowerShell
                        └── SimWidget (8080)
```

## Costs

Claude API usage is pay-per-token:
- Typical chat: ~$0.01-0.05
- Complex tasks: ~$0.10-0.30
- Monthly estimate: $5-20 for regular use

Monitor usage at: https://console.anthropic.com/

## Security Notes

- Agent only listens on local network
- API key stored in .env (not committed)
- For external access, use Tailscale VPN
