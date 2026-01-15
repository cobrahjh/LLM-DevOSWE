# Claude Code Session Launcher

Quick-launch scripts for resuming Claude Code sessions in project directories.

## Desktop Shortcuts

| Shortcut | Project | Color |
|----------|---------|-------|
| Claude LLM-DevOSWE | SimWidget Engine framework | Blue (1F) |
| Claude kittbox-web | KittBox web application | Red (4F) |

## How to Use

**Resume a session:**
1. Double-click the desktop shortcut
2. Terminal opens and continues the most recent conversation in that directory

**Start fresh session:**
1. Open terminal manually
2. `cd C:\LLM-DevOSWE` or `cd C:\kittbox-web`
3. Run `claude`

## Files

Each project has two files:

### claude-here.bat
```batch
@echo off
title Claude Code - [PROJECT]
color [COLOR]
cd /d C:\[PROJECT]
echo.
echo   === [PROJECT] ===
echo.
claude --continue
pause
```

### create-shortcut.ps1
Creates the desktop shortcut. Run once after setup:
```powershell
powershell -ExecutionPolicy Bypass -File create-shortcut.ps1
```

## Locations

| Project | Path | Scripts |
|---------|------|---------|
| LLM-DevOSWE | `C:\LLM-DevOSWE` | `claude-here.bat`, `create-shortcut.ps1` |
| kittbox-web | `C:\kittbox-web` | `claude-here.bat`, `create-shortcut.ps1` |

## Adding New Projects

1. Create `claude-here.bat` in project root:
   - Change title, color, and paths
   - Colors: `1F` blue, `2F` green, `4F` red, `5F` purple, `6F` yellow

2. Create `create-shortcut.ps1` in project root:
   - Update shortcut name and paths

3. Run the PowerShell script to create desktop shortcut

## Claude CLI Flags

- `--continue` / `-c` - Resume most recent session in current directory
- `--resume` / `-r` - Open picker to choose any session
- `--resume [search]` - Filter sessions by search term
