# Hive Port Management Guide

**Purpose:** Prevent port conflicts across the Hive ecosystem
**Tools:** `port-manager.js`, `port-registry.json`, `check-ports.ps1`
**Updated:** February 14, 2026

## Overview

The Hive ecosystem consists of 25+ services running on different ports. Port conflicts can cause service failures and difficult-to-debug issues. This guide establishes a systematic process for port management.

## Port Ranges

Hive services are organized into specific port ranges:

| Range | Type | Description |
|-------|------|-------------|
| 0-1023 | System | Reserved for OS and well-known services |
| 3000-3999 | Hive Core | Core services (Oracle, etc.) |
| 8000-8099 | SimWidget | SimWidget and related services |
| 8500-8899 | Hive Services | Infrastructure services |
| 9000-9999 | User Services | User projects and custom services |
| 11000-12000 | External | External services (Ollama, LM Studio) |

## Before Starting a New Service

### 1. Check Port Availability

**Option A: Using Port Manager (Node.js)**
```bash
cd C:\LLM-DevOSWE\Admin\tools
node port-manager.js check 8765
```

**Option B: Using PowerShell Script**
```powershell
# Check single port
Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue

# Run full port check
C:\LLM-DevOSWE\Admin\tools\check-ports.ps1
```

**Option C: Programmatically (in your service)**
```javascript
const { checkPort } = require('./Admin/tools/port-manager');

const PORT = 8765;
const available = await checkPort(PORT);
if (!available) {
    console.error(`Port ${PORT} is already in use!`);
    process.exit(1);
}
```

### 2. Get Port Suggestion

Let the port manager suggest an appropriate port based on service type:

```bash
# Suggest port for a hive service
node port-manager.js suggest hive "MyNewService"

# Suggest port for a user project
node port-manager.js suggest user "MyProject"

# Find available port in specific range
node port-manager.js find 8500 8899
```

### 3. Validate Port Choice

```bash
# Validate port is appropriate and available
node port-manager.js validate 8765 hive
```

### 4. Reserve the Port

Once you've chosen a port, reserve it in the registry:

```bash
node port-manager.js reserve 8765 "MyService" "C:\path\to\service.js"
```

Or programmatically:

```javascript
const { reservePort } = require('./Admin/tools/port-manager');

await reservePort(8765, 'MyService', __filename, {
    serviceType: 'hive',
    description: 'My awesome service',
    nssm: 'MyServiceName' // If using NSSM
});
```

## In Your Service Code

### Standard Port Initialization Pattern

```javascript
const { checkPort, getPortInfo } = require('../Admin/tools/port-manager');

const PORT = process.env.PORT || 8765;

async function startServer() {
    // Check port availability
    const available = await checkPort(PORT);
    if (!available) {
        const portInfo = await getPortInfo(PORT);
        console.error(`❌ Port ${PORT} is already in use`);
        if (portInfo.reserved) {
            console.error(`   Reserved by: ${portInfo.reservation.serviceName}`);
            console.error(`   Script: ${portInfo.reservation.scriptPath}`);
        }
        process.exit(1);
    }

    // Start your server
    const server = app.listen(PORT, () => {
        console.log(`✓ Service listening on port ${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        server.close(() => {
            console.log('Server stopped');
            process.exit(0);
        });
    });
}

startServer();
```

### Environment Variable Support

Always support PORT environment variable for flexibility:

```javascript
const PORT = process.env.PORT || 8765;

// Validate it's in appropriate range
if (PORT < 8500 || PORT > 8899) {
    console.warn(`⚠️  Port ${PORT} is outside recommended range for hive services (8500-8899)`);
}
```

## Port Registry

### Structure

The port registry (`Admin/tools/port-registry.json`) tracks all reserved ports:

```json
{
  "version": "1.0.0",
  "lastUpdated": "2026-02-14T14:20:00.000Z",
  "ports": {
    "8765": {
      "serviceName": "MyService",
      "scriptPath": "C:\\path\\to\\service.js",
      "reservedAt": "2026-02-14T14:20:00.000Z",
      "serviceType": "hive",
      "description": "My service description",
      "nssm": "MyServiceName"
    }
  }
}
```

### Viewing Reserved Ports

```bash
# List all reserved ports
node port-manager.js list

# Get info about specific port
node port-manager.js check 8765
```

### Releasing Ports

When decommissioning a service:

```bash
node port-manager.js release 8765
```

## Detecting Conflicts

### Find Port Conflicts

Check for discrepancies between registry and actual usage:

```bash
node port-manager.js conflicts
```

This will show:
- **Reserved but available** - Ports in registry but not currently in use (service down)
- **In use but not reserved** - Ports in use but not in registry (needs registration)

### Regular Audits

Run periodic audits to keep registry accurate:

```bash
# Weekly audit script
cd C:\LLM-DevOSWE\Admin\tools
node port-manager.js conflicts > port-audit-$(date +%Y%m%d).log
```

## Common Patterns

### Pattern 1: Dynamic Port Selection

If fixed port isn't critical:

```javascript
const { findAvailablePort } = require('../Admin/tools/port-manager');

const PORT = await findAvailablePort(9000, 9999);
if (!PORT) {
    console.error('No available ports in range 9000-9999');
    process.exit(1);
}
console.log(`Using port ${PORT}`);
```

### Pattern 2: Port with Fallback

```javascript
const { checkPort } = require('../Admin/tools/port-manager');

const PREFERRED_PORT = 8765;
const FALLBACK_PORT = 8766;

let PORT = PREFERRED_PORT;
if (!(await checkPort(PREFERRED_PORT))) {
    console.warn(`Port ${PREFERRED_PORT} in use, trying ${FALLBACK_PORT}`);
    PORT = FALLBACK_PORT;
    if (!(await checkPort(FALLBACK_PORT))) {
        console.error('Both primary and fallback ports unavailable');
        process.exit(1);
    }
}
```

### Pattern 3: Validate Before Server Start

```javascript
const { validatePort } = require('../Admin/tools/port-manager');

const PORT = 8765;
const validation = await validatePort(PORT, 'hive');

if (!validation.valid) {
    console.error('Port validation failed:');
    validation.errors.forEach(err => console.error(`  ❌ ${err}`));
    process.exit(1);
}

if (validation.warnings.length > 0) {
    validation.warnings.forEach(warn => console.warn(`  ⚠️  ${warn}`));
}
```

## Troubleshooting

### Port Already in Use

```bash
# Find what's using the port (Windows)
netstat -ano | findstr :8765

# Kill process by PID
taskkill /PID <pid> /F

# Or use PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 8765).OwningProcess | Stop-Process -Force
```

### Port Shows In Use But Nothing Listed

```bash
# Check for zombie processes
netstat -ano | findstr LISTENING

# Restart networking (requires admin)
netsh winsock reset
```

### Registry Out of Sync

```bash
# Audit conflicts
node port-manager.js conflicts

# Update registry for unreserved ports
node port-manager.js reserve <port> <service> <path>

# Remove stale reservations
node port-manager.js release <port>
```

## Integration with Orchestrator

The Master Orchestrator (port 8500) should check port availability before starting services:

```javascript
// In orchestrator.js
const { checkPort } = require('./tools/port-manager');

async function startService(service) {
    if (!(await checkPort(service.port))) {
        console.error(`Cannot start ${service.name} - port ${service.port} in use`);
        return false;
    }
    // ... proceed with start
}
```

## Best Practices

1. **Always check before use** - Never assume a port is available
2. **Reserve in registry** - Document all port assignments
3. **Use appropriate ranges** - Follow the range guidelines for service type
4. **Support PORT env var** - Allow runtime port configuration
5. **Graceful failure** - Exit cleanly if port unavailable
6. **Log clearly** - Show what port service is using
7. **Regular audits** - Check for conflicts monthly
8. **Update docs** - Keep SERVICE-REGISTRY.md in sync with port-registry.json

## Quick Reference

```bash
# Check port
node port-manager.js check 8765

# Find available port
node port-manager.js find 8500 8899

# Suggest port for service type
node port-manager.js suggest hive "MyService"

# Reserve port
node port-manager.js reserve 8765 "MyService" "C:\path\to\service.js"

# List all reserved
node port-manager.js list

# Check conflicts
node port-manager.js conflicts

# Release port
node port-manager.js release 8765
```

## See Also

- [SERVICE-REGISTRY.md](../SERVICE-REGISTRY.md) - Complete service directory
- [STANDARDS.md](STANDARDS.md) - Hive coding standards
- [Admin/tools/port-manager.js](../Admin/tools/port-manager.js) - Port manager source
- [Admin/tools/port-registry.json](../Admin/tools/port-registry.json) - Port registry

---

**Remember:** The port registry is the single source of truth for port assignments. When in doubt, check the registry!
