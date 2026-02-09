# Hive Brain v2.0.0 (Unified)

**Entry:** `hive-brain.js` | **Port:** 8810 | **NSSM Service:** HiveBrain

## What This Is
Unified device discovery and colony management service. Scans network for Hive nodes, manages enrollment, monitors device health.

**Version 2.0.0:** Merged from two separate services (8800 + 8810)

## Key Rules
- NEVER change port 8810
- JSON persistence in `data/devices.json` and `data/enrollment-queue.json`
- Background scanning runs every 5 minutes
- WebSocket broadcasts real-time updates to connected clients

## Features

### Device Discovery
- Network ping sweep (192.168.1.0/24)
- Port scanning for Hive services
- Device fingerprinting (OS, services, hostname)
- Automatic enrollment queue for Hive nodes

### Colony Management
- Approval workflow (discovered → known devices)
- Device health monitoring across services
- Real-time WebSocket updates
- JSON file persistence

### Monitoring
- Health checks for Oracle, Relay, KittBox, Hive-Mind
- Last seen tracking
- Service availability status

## Merge History

**Original Services:**
1. **server.js (port 8800)** - Hive Brain Admin
   - WebSocket support
   - Device health checking
   - In-memory storage

2. **hive-brain.js (port 8810)** - Hive Brain Discovery
   - JSON persistence
   - Enrollment queue
   - Background scanning

**Why Merged:**
- Overlapping functionality (both did device discovery)
- Same callers (Hive Oracle)
- No clear separation of concerns
- Resource waste (two services, two ports)

**What Was Preserved:**
- ✅ WebSocket real-time updates (from 8800)
- ✅ JSON file persistence (from 8810)
- ✅ Enrollment queue workflow (from 8810)
- ✅ Device health checking (from 8800)
- ✅ Background scanning (from 8810)

**Old Files Archived:**
- `deprecated-server.js` (was 8800)
- `deprecated-hive-brain.js` (was 8810)

## Key Endpoints
```
GET  /api/health              - Service health with device counts
POST /api/discover            - Trigger manual discovery scan
GET  /api/devices             - List all devices (known + discovered)
GET  /api/devices/:ip         - Get specific device details
POST /api/devices/:ip/approve - Approve device (discovered → known)
DELETE /api/devices/:ip       - Remove device
GET  /api/enrollment          - Get enrollment queue
POST /api/scan/:ip            - Scan specific IP
GET  /api/colony              - Get all Hive nodes
GET  /api/devices/:ip/health  - Check device health
GET  /api/health/all          - Check all known devices health
POST /api/devices             - Add device manually
GET  /api/usage/stats         - Get usage metrics
```

## WebSocket Events
```
scan_start         - Discovery scan started
scan_progress      - Scan progress update
device_found       - New device discovered
discovery_complete - Scan finished
device_approved    - Device moved to known
device_updated     - Device notes/data changed
device_removed     - Device deleted
```

## Testing
```bash
# Health check
curl http://localhost:8810/api/health

# Trigger discovery
curl -X POST http://localhost:8810/api/discover

# List devices
curl http://localhost:8810/api/devices

# WebSocket connection
wscat -c ws://localhost:8810
```

## Background Scanning
- **Interval:** 5 minutes
- **Networks:** 192.168.1.0/24
- **Batch size:** 20 IPs per batch
- **Initial delay:** 30 seconds after startup

## Dependencies
- Calls: Network devices (ping, port scan)
- Called by: Hive Oracle (8850), Dashboard (8899)
- Database: `data/devices.json`, `data/enrollment-queue.json`
