# Project Index
**Last Updated:** 2026-01-15
**Single source of truth for all projects and directories**

---

## Directory Map

| Directory | Purpose | Status |
|-----------|---------|--------|
| `C:\LLM-DevOSWE` | Main framework, services, documentation | Active |
| `C:\LLM-Oracle` | Oracle daemon, LLM backend | Active |
| `C:\kittbox-modules` | Desktop apps (Kitt Live, etc.) | Active |
| `C:\kittbox-web` | KittBox web interface | Active |
| `C:\twitch-disability-app` | Accessibility browser extension | Active |
| `C:\devTinyAI` | AI sandbox, experiments | Active |

---

## Projects

### LLM-DevOSWE (Main Framework)
- **Path:** `C:\LLM-DevOSWE`
- **Type:** Framework + Services
- **Purpose:** SimWidget Engine, service infrastructure, AI tools
- **Key Files:**
  - `CLAUDE.md` - AI context
  - `STANDARDS.md` - Coding patterns
  - `SERVICE-REGISTRY.md` - All services/ports
  - `PROJECT-INDEX.md` - This file
- **Services:** Relay, Agent, Orchestrator, Remote Support, Bridges

### LLM-Oracle
- **Path:** `C:\LLM-Oracle`
- **Type:** Daemon service
- **Purpose:** Autonomous LLM backend, project API, sandbox
- **Port:** 3002
- **Key Files:**
  - `oracle.js` - Main daemon
  - `oracle-data/memory.json` - Knowledge base

### Kitt Live
- **Path:** `C:\kittbox-modules\kitt-live`
- **Type:** Electron desktop app
- **Purpose:** Voice/text AI assistant
- **Hotkey:** Alt+K
- **Key Files:**
  - `main.js` - Electron main process
  - `renderer/app.js` - Chat UI

### KittBox Web
- **Path:** `C:\kittbox-web`
- **Type:** Web application
- **Purpose:** Browser-based KittBox interface
- **Status:** Development

### Twitch Accessibility Extension
- **Path:** `C:\twitch-disability-app`
- **Type:** Chrome extension
- **Purpose:** Make Twitch accessible for blind/visually impaired
- **Repo:** https://github.com/cobrahjh/twitch-disability-app
- **Features:** Screen reader, keyboard nav, high contrast, TTS

### devTinyAI (Sandbox)
- **Path:** `C:\devTinyAI`
- **Type:** AI workspace
- **Purpose:** tinyAI experiments, code generation, sandbox
- **Key Files:**
  - `tinyai.js` - AI agent CLI
  - `sandbox/` - Throwaway code
  - `context/` - Project knowledge files

---

## Quick Commands

```powershell
# Open project in terminal
cd C:\LLM-DevOSWE      # Main framework
cd C:\LLM-Oracle       # Oracle daemon
cd C:\kittbox-modules\kitt-live  # Kitt Live

# Launch Claude Code in project
claude-here.bat        # If set up in project root
```

---

## Documentation Quick Links

| Doc | Location | Purpose |
|-----|----------|---------|
| AI Context | `C:\LLM-DevOSWE\CLAUDE.md` | Claude instructions, shortcuts, rules |
| Standards | `C:\LLM-DevOSWE\STANDARDS.md` | Coding patterns, timing defaults |
| Services | `C:\LLM-DevOSWE\SERVICE-REGISTRY.md` | All ports, endpoints, commands |
| Architecture | `C:\LLM-DevOSWE\ARCHITECTURE.md` | System design, diagrams |
| Windows Services | `C:\LLM-DevOSWE\docs\WINDOWS-SERVICES.md` | Service management |
| Widget Guide | `C:\LLM-DevOSWE\docs\WIDGET-CREATION-GUIDE.md` | Building widgets |

---

## Git Repositories

| Project | Repo |
|---------|------|
| Twitch Accessibility | https://github.com/cobrahjh/twitch-disability-app |
| (others as created) | |

---

## Project Registration (Oracle)

To register a new project with Oracle for tinyAI access:

1. Add to `C:\LLM-Oracle\oracle.js`:
```javascript
const PROJECTS = {
    'project-name': {
        root: 'C:/project-path',
        allowed: ['src', 'lib'],  // Dirs AI can write to
        description: 'What it does'
    }
};
```

2. Create context file in `C:\devTinyAI\context\project-name.md`

3. Restart Oracle: `net stop simwidgetoracle && net start simwidgetoracle`
