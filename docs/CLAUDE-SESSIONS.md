# Claude Code Session Launcher

Quick-launch scripts for resuming Claude Code sessions in project directories.

## Visual Identification

**Persistent colored tabs** - Each project opens in Windows Terminal with a distinct tab color that stays visible even when scrolling:

| Shortcut | Project | Tab Color | Emoji |
|----------|---------|-----------|-------|
| Claude LLM-DevOSWE | SimWidget Engine | Blue (#0066CC) | 🔵 |
| Claude kittbox-web | KittBox web app | Red (#CC3300) | 🔴 |

## How to Use

**Resume a session:**
1. Double-click the desktop shortcut
2. Windows Terminal opens with colored tab
3. Continues the most recent conversation in that directory

**From Windows Terminal dropdown:**
- Click the dropdown arrow in Windows Terminal
- Select "🔵 LLM-DevOSWE" or "🔴 kittbox-web"

**Start fresh session:**
1. Open terminal manually
2. `cd C:\LLM-DevOSWE` or `cd C:\kittbox-web`
3. Run `claude`

## Windows Terminal Profiles

Profiles are stored in:
```
%LOCALAPPDATA%\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json
```

Each project has a profile with:
- Unique GUID for reliable launching
- `tabColor` - Persistent colored tab indicator
- `commandline` - Runs the claude-here.bat script
- `startingDirectory` - Project root

## Project Files

Each project has two files in its root:

### claude-here.bat
Displays ASCII banner and runs Claude:
- Large text logo (LLM or KITT)
- Project name and color indicator
- `claude --continue` to resume session

### create-shortcut.ps1
Creates desktop shortcut using profile GUID:
```powershell
powershell -ExecutionPolicy Bypass -File create-shortcut.ps1
```

## Locations

| Project | Path | GUID |
|---------|------|------|
| LLM-DevOSWE | `C:\LLM-DevOSWE` | `{11111111-1111-1111-1111-111111111111}` |
| kittbox-web | `C:\kittbox-web` | `{22222222-2222-2222-2222-222222222222}` |

## Adding New Projects

Use the setup script to generate all files:

```powershell
cd C:\LLM-DevOSWE\Admin\tools
.\setup-claude-project.ps1 -Name "MyProject" -Path "C:\MyProject" -Color "2F" -TabColor "#00CC66"
```

**Parameters:**
| Param | Description | Example |
|-------|-------------|---------|
| Name | Project display name | "MyProject" |
| Path | Project root directory | "C:\MyProject" |
| Color | CMD color code | 1F=blue, 2F=green, 4F=red |
| TabColor | Windows Terminal tab hex | "#0066CC" |
| Guid | Optional, auto-generated | "{guid-here}" |

**The script creates:**
1. `claude-here.bat` - Launch script with color
2. `create-shortcut.ps1` - Desktop shortcut creator
3. Outputs Windows Terminal profile JSON to add manually

## Claude CLI Flags

- `--continue` / `-c` - Resume most recent session in current directory
- `--resume` / `-r` - Open picker to choose any session
- `--resume [search]` - Filter sessions by search term
