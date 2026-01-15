# DocSync Agent

AI-powered document synchronization to Google Drive.

## Overview

```
Doc Created/Modified → File Watcher → tinyAI (summarize) → Google Drive
                                            ↓
                                    Relay notification
```

## Quick Start

**One-time sync:**
```batch
C:\LLM-DevOSWE\Admin\docsync\docsync.bat
```

**Continuous watch mode:**
```batch
C:\LLM-DevOSWE\Admin\docsync\docsync-watch.bat
```

## Commands

| Command | Action |
|---------|--------|
| `docsync.bat` | Scan and sync changed files once |
| `docsync.bat --watch` | Continuous watch mode |
| `docsync.bat --sync-all` | Force sync all files |
| `docsync.bat --status` | Show sync status |

## Configuration

Edit `docsync-agent.js` to customize:

```javascript
const CONFIG = {
    googleDrive: 'G:\\My Drive\\AI Development',
    projects: {
        'LLM-DevOSWE': {
            watchPaths: ['C:\\LLM-DevOSWE\\docs', 'C:\\LLM-DevOSWE\\Admin\\tools'],
            patterns: ['*.md', '*.json', '*.bat', '*.ps1']
        },
        'kittbox-web': {
            watchPaths: ['C:\\kittbox-web'],
            patterns: ['*.md', '*.json', '*.bat', '*.ps1']
        }
    },
    ollama: {
        model: 'qwen2.5-coder:7b'  // Fast model for summaries
    },
    pollInterval: 5000,  // 5 seconds
    enableAI: true
};
```

## Watched File Types

| Pattern | Description |
|---------|-------------|
| `*.md` | Markdown documentation |
| `*.json` | JSON config/data files |
| `*.bat` | Batch scripts |
| `*.ps1` | PowerShell scripts |

## Google Drive Structure

```
G:\My Drive\AI Development\
├── LLM-DevOSWE\
│   ├── CLAUDE-SESSIONS.md
│   ├── PROJECT-LAUNCHER.md
│   ├── PROJECT-TRACKER.md
│   └── ...
└── kittbox-web\
    ├── README.md
    └── ...
```

## AI Processing

When enabled, tinyAI (Ollama) generates summaries for `.md` files:

- Uses `qwen2.5-coder:7b` (fast, 172 tok/s)
- Creates 1-2 sentence summary
- Logs summary to console and relay

**Disable AI processing:**
```javascript
enableAI: false
```

## State Tracking

Sync state stored in `docsync-state.json`:

```json
{
    "syncedFiles": {
        "C:\\LLM-DevOSWE\\docs\\README.md": 1736956800000
    },
    "lastSave": "2026-01-15T12:00:00.000Z"
}
```

## Integration

### Add to startup

Add to `start-all-servers.bat` or run as Windows service.

### Relay notifications

DocSync posts to relay at `/api/docsync/log`:

```json
{
    "type": "docsync",
    "project": "LLM-DevOSWE",
    "file": "README.md",
    "summary": "Project documentation for SimWidget Engine.",
    "timestamp": "2026-01-15T12:00:00.000Z"
}
```

## Files

| File | Purpose |
|------|---------|
| `docsync-agent.js` | Main agent script |
| `docsync.bat` | One-time sync launcher |
| `docsync-watch.bat` | Watch mode launcher |
| `docsync-state.json` | Sync state tracking |

## Troubleshooting

**Files not syncing:**
- Check `docsync-state.json` for tracked files
- Run `--sync-all` to force resync

**AI summaries not working:**
- Ensure Ollama is running: `ollama list`
- Check model: `ollama run qwen2.5-coder:7b "test"`

**Google Drive path not found:**
- Verify `G:\My Drive` is mounted
- Update `CONFIG.googleDrive` path
