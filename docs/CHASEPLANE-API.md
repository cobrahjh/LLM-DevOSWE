# ChasePlane API Reference

**Status:** Unofficial / Reverse-Engineered
**Last Updated:** 2026-01-23

> ChasePlane by Parallel 42 does not have official API documentation. This document is based on community reverse-engineering and local testing.

---

## Overview

ChasePlane is a standalone Windows application for MSFS camera control. It runs outside the simulator and communicates via:
- WebSocket server (port 8652)
- HTTP endpoint (port 8652)
- Possibly REST API (port 42042 - unconfirmed)

---

## Endpoints

### HTTP Health Check

```
GET http://localhost:8652/getdata
```

**Purpose:** Check if ChasePlane is running
**Response:** Returns data if running, connection refused if not
**Timeout:** Use 500ms timeout for detection

**Usage in SimWidget:**
```javascript
const response = await fetch('http://localhost:8652/getdata', {
    signal: AbortSignal.timeout(500)
});
const isRunning = response.ok;
```

---

### WebSocket Server

```
ws://localhost:8652/
```

**Purpose:** Camera control and event communication
**Protocol:** Text-based messages

#### Authentication

Send GUID on connection:
```
a02e89fb-87e0-45a7-a333-324cfc016930
```

#### Message Formats (Tested)

| Format | Example | Notes |
|--------|---------|-------|
| Control Event | `CTRL_EVENT::CAM_SET_CINEMATIC::1` | With parameter |
| Input | `INPUT::CAM_SET_CINEMATIC::1` | Alternative format |
| Button | `BUTTON::1\|1\|164\|1` | device\|button\|code\|state |
| Device Input | `DEVICE_INPUT::GUID\|0\|1` | GUID-based |
| Command | `CMD::CAM_SET_CINEMATIC` | Simple command |
| Trigger | `TRIGGER_EVENT::CAM_SET_CINEMATIC` | Event trigger |

#### Known Events

| Event | Description |
|-------|-------------|
| `CAM_SET_CINEMATIC` | Toggle cinematic camera mode |
| `CAM_SET_CINEMATIC::1` | Set cinematic mode (1=on, 0=off) |

---

## Alternative Port

```
http://localhost:42042/
```

**Status:** Unconfirmed
**Purpose:** Possibly REST API for status queries
**Notes:** May not be active in all ChasePlane versions

---

## Detection Methods

### Method 1: HTTP (Recommended)

**Speed:** ~50ms
**Reliability:** High when ChasePlane running

```javascript
async function detectChasePlane() {
    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 500);
        const response = await fetch('http://localhost:8652/getdata', {
            signal: controller.signal
        });
        return response.ok;
    } catch {
        return false;
    }
}
```

### Method 2: Tasklist (Fallback)

**Speed:** ~400ms
**Reliability:** Always works

Uses Windows tasklist command to check for ChasePlane.exe process.

---

## SimWidget Integration

### Camera Controller (camera-controller.js)

SimWidget uses a hybrid approach:
1. HTTP detection first (fast)
2. Tasklist fallback if HTTP fails
3. Reports detection method in status

### Input Methods

When ChasePlane is detected, SimWidget can use:
- **vJoy** - Virtual joystick button simulation
- **SimConnect** - Direct event injection
- **PowerShell** - Keyboard sending (fallback)

### Status API

```
GET /api/camera/status
```

Returns:
```json
{
    "chasePlane": true,
    "chasePlaneDetection": "http",
    "platform": { "preferred": "vjoy" },
    "mode": "vjoy"
}
```

---

## Known Limitations

1. **No Official Documentation** - Parallel 42 has not published API docs
2. **Protocol May Change** - WebSocket format could change between versions
3. **Authentication Required** - WebSocket requires GUID auth
4. **MSFS 2024 Camera API** - Microsoft recently unlocked camera API, may reduce need for ChasePlane

---

## Resources

- [ChasePlane Official](https://parallel42.com/products/chaseplane)
- [ChasePlane FAQ](https://parallel42.com/blogs/wiki/chaseplane-faq)
- [ChasePlane Known Limitations](https://parallel42.com/blogs/wiki/chaseplane-known-limitations)

---

## Local Test Files

```
simwidget-hybrid/backend/test_cp.js    - WebSocket connection test
simwidget-hybrid/backend/test_cp2.js   - Message format testing
```

---

## Changelog

- **2026-01-23** - Initial documentation based on research
- **2026-01-23** - Added HTTP detection to camera-controller.js v3.1
