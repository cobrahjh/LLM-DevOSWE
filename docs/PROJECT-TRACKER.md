# Project Task & Feature Tracker

Track tasks and features across all projects by day, time, and phase.

## Quick Start

```batch
C:\LLM-DevOSWE\Admin\tools\tracker.bat
```

Or add shortcut `trk` to run before coding.

## Usage

### Interactive Mode (Default)
```batch
tracker.bat
```
Shows status report then interactive menu:
1. Add new task
2. Update task phase
3. Complete a task
4. Add project
5. View full history

### Status Only
```batch
tracker.bat --status
```

### Quick Add
```batch
tracker.bat --add "LLM-DevOSWE" "Task title" "development"
```

### Quick Complete
```batch
tracker.bat --complete "partial task name"
```

### Export JSON
```batch
tracker.bat --json
```

## Phases

| Phase | Description |
|-------|-------------|
| planning | Requirements, design |
| development | Active coding |
| testing | Testing, debugging |
| review | Code review, polish |
| completed | Done |

## Projects

| Project | Color | Description |
|---------|-------|-------------|
| LLM-DevOSWE | Blue | SimWidget Engine framework |
| kittbox-web | Red | KittBox web application |

## Data File

`C:\LLM-DevOSWE\Admin\tools\tracker-data.json`

```json
{
  "projects": { ... },
  "phases": ["planning", "development", "testing", "review", "completed"],
  "tasks": [
    {
      "id": 1736956800000,
      "project": "LLM-DevOSWE",
      "title": "Task description",
      "phase": "development",
      "notes": "Optional notes",
      "created": "2026-01-15T09:00:00.000Z",
      "completedAt": null
    }
  ]
}
```

## Workflow

**Before starting work:**
1. Run `tracker.bat`
2. Review status report
3. Add new tasks or update phases
4. Start coding

**After completing work:**
1. Run `tracker.bat`
2. Mark tasks complete
3. Add notes if needed

## Status Report Shows

- Active tasks by project and phase
- Recently completed tasks
- Today's activity summary

## Integration Ideas

- Run tracker before `claude --resume`
- Add to `start-all-projects.bat`
- Create daily summary exports

## Files

| File | Purpose |
|------|---------|
| `project-tracker.js` | Main script |
| `tracker.bat` | Batch wrapper |
| `tracker-data.json` | Task database |
