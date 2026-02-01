# [PROJECT_NAME]

**Port:** [PORT]
**Type:** Hive Service
**Status:** Development

---

## Overview

[Brief description of what this service does]

---

## Parent Context

See [main CLAUDE.md](C:/LLM-DevOSWE/CLAUDE.md) for full Hive ecosystem context.

Key references:
- [SERVICE-REGISTRY.md](C:/LLM-DevOSWE/SERVICE-REGISTRY.md) - All ports and services
- [STANDARDS.md](C:/LLM-DevOSWE/STANDARDS.md) - Coding patterns and conventions

---

## Quick Start

```bash
npm install
npm start
```

Health check: `http://localhost:[PORT]/api/health`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (required) |
| GET | `/api/status` | Service status |

---

## Integration Points

### Relay (Port 8600)
```javascript
// Send alert
fetch('http://localhost:8600/api/alerts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'info', message: 'Hello from [PROJECT_NAME]' })
});

// Store data
fetch('http://localhost:8600/api/knowledge', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'mydata', value: { foo: 'bar' } })
});
```

### Orchestrator (Port 8500)
Service will be auto-monitored if registered in orchestrator config.

---

## Configuration

Edit `config.json`:
```json
{
  "port": [PORT],
  "name": "[PROJECT_NAME]"
}
```

---

## Development Notes

[Add notes as you develop]
