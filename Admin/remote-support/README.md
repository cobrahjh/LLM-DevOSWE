# SimWidget Remote Support Service v1.0.0

> Windows service for remote command execution and system management

**Path:** `C:\LLM-DevOSWE\SimWidget_Engine\Admin\remote-support\`  
**Last Updated:** 2025-01-08

## Quick Start

```batch
# On Harold-PC
cd C:\LLM-DevOSWE\SimWidget_Engine\Admin\remote-support
setup.bat          # Install dependencies
start.bat          # Run manually (for testing)
```

## Installation as Windows Service

```batch
npm run install-service    # Install & start service
npm run uninstall-service  # Remove service
```

## Configuration

Edit `.env`:
```
REMOTE_PORT=8590
REMOTE_API_KEY=your-secure-key
```

## API Reference

All endpoints (except `/api/health`) require header: `X-Api-Key: <your-key>`

### Execute Command
```http
POST /api/exec
Content-Type: application/json
X-Api-Key: <key>

{
  "command": "Get-Process",
  "cwd": "C:\\path"  // optional
}
```

### File Operations
```http
# List directory
GET /api/files?path=C:\LLM-DevOSWE

# Read file
GET /api/files/C:/LLM-DevOSWE/file.txt

# Write file
POST /api/files
{
  "path": "C:\\DevClaude\\file.txt",
  "content": "file content"
}
```

### Service Management
```http
# List services
GET /api/services

# Control service
POST /api/services
{
  "service": "simwidget",  // or "agent"
  "action": "start"        // start|stop|restart
}
```

### System Status
```http
GET /api/status
```
Returns: hostname, CPU, memory, disk usage

### View Logs
```http
GET /api/logs?file=audit&lines=100
```

## WebSocket API

Connect: `ws://192.168.1.192:8590/ws?apiKey=<key>`

### Execute with streaming output
```json
{"type": "exec", "command": "Get-Process", "cwd": "C:\\path"}
```

Responses:
```json
{"type": "stdout", "data": "..."}
{"type": "stderr", "data": "..."}
{"type": "exit", "code": 0}
```

### Ping
```json
{"type": "ping"}
// Response: {"type": "pong", "timestamp": 1234567890}
```

## Security

### Allowed Commands
- `Get-*`, `Set-Location`, `dir`, `ls`, `cd`, `type`, `cat`
- `npm`, `npx`, `node`, `git`
- `Start-Process`, `Stop-Process`
- `Start-Service`, `Stop-Service`, `Restart-Service`
- `systeminfo`, `tasklist`, `netstat`, `ping`, `ipconfig`

### Blocked Patterns
- `Remove-Item -Recurse -Force`
- `rm -rf`
- `format [drive]:`
- `del /s /q`
- `reg delete`
- `shutdown`, `restart-computer`

### Rate Limiting
60 requests per minute per IP

### Audit Log
All commands logged to `logs/audit.log`

## Managed Services

| ID | Name | Port |
|----|------|------|
| simwidget | SimWidget Server | 8080 |
| agent | Agent Server | 8585 |

## Files

```
remote-support/
├── service.js           # Main service
├── install-service.js   # Windows service installer
├── uninstall-service.js # Windows service uninstaller
├── package.json
├── .env                 # Configuration
├── setup.bat            # Dependency installer
├── start.bat            # Manual start
├── logs/
│   └── audit.log        # Command audit log
└── README.md
```
