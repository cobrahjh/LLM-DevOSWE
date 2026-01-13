# Admin Service Standards
**Version:** v1.2.0  
**Last Updated:** 2026-01-09

All Admin services (Agent, Remote Support, etc.) MUST implement these standard patterns.

## Master (O) - Service Controller

The **Master (O)** (port 8500) is the master controller that manages all other services:

- **Dashboard:** http://localhost:8500
- **Features:** 
  - Start/stop/restart any service
  - Health watchdog with auto-restart
  - Web dashboard for visual control
  - Survives when child services crash

**Always start Master (O) first** - it will manage all other services.

```
┌─────────────────────────────────────────────────────────┐
│              Master (O) (port 8500)                     │
│  - Lightweight, minimal dependencies                    │
│  - Watchdog health monitoring (30s intervals)           │
│  - Auto-restart on failure (max 3 attempts)             │
│  - REST API for control                                 │
└──────────────────────┬──────────────────────────────────┘
                       │ monitors/controls
        ┌──────────────┼──────────────┬───────────────┐
        ▼              ▼              ▼               ▼
   Main Server     Agent (Kitt)   Remote Support   [Future]
   (8080)          (8585)         (8590)           
```

## Required Components

### 1. Service Logging (Console Intercept)
Every service must capture console output to a buffer for API access:

```javascript
const SERVICE_LOG = path.join(LOGS_DIR, 'service.log');
const serviceLogBuffer = [];
const MAX_LOG_LINES = 500;

function logToFile(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}`;
    serviceLogBuffer.push(line);
    if (serviceLogBuffer.length > MAX_LOG_LINES) {
        serviceLogBuffer.shift();
    }
    fs.appendFileSync(SERVICE_LOG, line + '\n');
}

// Intercept console
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
    originalLog.apply(console, args);
    logToFile(args.join(' '));
};

console.error = (...args) => {
    originalError.apply(console, args);
    logToFile('[ERROR] ' + args.join(' '));
};
```

### 2. Log Endpoint (/api/log)
Required for monitoring UIs to fetch service logs:

```javascript
app.get('/api/log', (req, res) => {
    const lines = parseInt(req.query.lines) || 100;
    const recentLines = serviceLogBuffer.slice(-lines);
    res.json({ 
        log: recentLines.join('\n'),
        lines: recentLines.length,
        total: serviceLogBuffer.length
    });
});
```

### 3. Health Endpoint (/api/health)
Basic health check (no auth required):

```javascript
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: 'X.X.X', service: 'service-name' });
});
```

### 4. Shutdown Endpoint (/api/shutdown)
Graceful shutdown via API (no auth - for server manager):

```javascript
app.post('/api/shutdown', (req, res) => {
    console.log('[ServiceName] Shutdown requested via API');
    res.json({ status: 'shutting_down' });
    
    // Close WebSocket connections
    wss.clients.forEach(client => client.close());
    
    // Close server gracefully
    setTimeout(() => {
        server.close(() => {
            console.log('[ServiceName] Graceful shutdown complete');
            process.exit(0);
        });
    }, 500);
});
```

### 5. Crash Protection
Prevent service crashes from killing the process:

```javascript
process.on('uncaughtException', (err) => {
    console.error('[ServiceName] Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[ServiceName] Unhandled Rejection:', reason);
});
```

### 6. Graceful Shutdown
Clean shutdown on signals:

```javascript
process.on('SIGINT', () => {
    console.log('[ServiceName] Shutting down gracefully...');
    // Close WebSocket connections
    wss.clients.forEach(client => client.close());
    server.close(() => {
        console.log('[ServiceName] Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('[ServiceName] SIGTERM received...');
    server.close(() => process.exit(0));
});
```

## Service Checklist

Before deploying any Admin service, verify:

- [ ] Console intercept logging implemented
- [ ] `/api/log` endpoint available (no auth)
- [ ] `/api/health` endpoint available (no auth)  
- [ ] `/api/status` endpoint available (no auth)
- [ ] `/api/shutdown` endpoint available (no auth)
- [ ] `uncaughtException` handler added
- [ ] `unhandledRejection` handler added
- [ ] SIGINT/SIGTERM handlers for graceful shutdown
- [ ] Version header in file with changelog
- [ ] TroubleshootEngine integration

## Services Using This Standard

| Service | Port | Path | Status |
|---------|------|------|--------|
| **Master (O)** | 8500 | `Admin/orchestrator/orchestrator.js` | ✅ Master Controller |
| Main Server | 8080 | `simwidget-hybrid/backend/server.js` | ✅ Compliant |
| Agent (Kitt) | 8585 | `Admin/agent/agent-server.js` | ✅ Compliant |
| Remote Support | 8590 | `Admin/remote-support/service.js` | ✅ Compliant |

## Master (O) API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Master health check |
| `/api/status` | GET | All services status |
| `/api/services` | GET | Service registry |
| `/api/services/:id` | GET | Single service status |
| `/api/services/:id/start` | POST | Start service |
| `/api/services/:id/stop` | POST | Stop service |
| `/api/services/:id/restart` | POST | Restart service |
| `/api/start-all` | POST | Start all services |
| `/api/stop-all` | POST | Stop all services |
| `/api/watchdog` | GET | Watchdog status |
| `/api/watchdog/enable` | POST | Enable auto-restart |
| `/api/watchdog/disable` | POST | Disable auto-restart |
| `/api/log` | GET | Master logs |
| `/api/shutdown` | POST | Shutdown Master |

---
*Created after Remote Support was missing error handling that Agent had.*
