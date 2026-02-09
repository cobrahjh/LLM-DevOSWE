# Usage Metrics Integration Guide
**Version:** 1.0.0
**Created:** 2026-02-09
**Purpose:** Track service usage to identify active vs abandoned services

---

## Why Usage Metrics?

During the Hive duplicate audit, we discovered many services that might be duplicates OR might serve different purposes. **We can't decide which to merge until we know which are actually being used.**

Usage metrics answer:
- ✅ Is this service actually being used?
- ✅ When was it last active?
- ✅ Which endpoints get the most traffic?
- ✅ How long has it been running?

---

## Quick Start

### 1. Add the Module

```javascript
const usageMetrics = require('../shared/usage-metrics');

// Initialize at startup
usageMetrics.init('ServiceName');
```

### 2. Add Middleware

```javascript
// After cors(), before routes
app.use(usageMetrics.middleware());
```

### 3. Update Health Endpoint

```javascript
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'ServiceName',
        // ... existing fields ...
        usage: usageMetrics.getSummary()  // Add this
    });
});
```

### 4. (Optional) Add Detailed Stats Endpoint

```javascript
app.get('/api/usage', (req, res) => {
    res.json(usageMetrics.getStats());
});
```

---

## Complete Example

```javascript
const express = require('express');
const usageMetrics = require('../shared/usage-metrics');

const app = express();

// Initialize metrics
usageMetrics.init('ExampleService');

// Add middleware BEFORE routes
app.use(express.json());
app.use(usageMetrics.middleware());

// Your routes
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'ExampleService',
        usage: usageMetrics.getSummary()
    });
});

app.get('/api/usage/stats', (req, res) => {
    res.json(usageMetrics.getStats());
});

app.listen(8080);
```

---

## API Reference

### Methods

#### `init(serviceName)`
Initialize metrics tracking for a service.

```javascript
usageMetrics.init('MyService');
```

#### `middleware()`
Express middleware to automatically track all requests.

```javascript
app.use(usageMetrics.middleware());
```

#### `trackRequest(method, path)`
Manually track a request (if not using middleware).

```javascript
usageMetrics.trackRequest('GET', '/api/data');
```

#### `trackError()`
Increment error counter.

```javascript
try {
    // ... code ...
} catch (err) {
    usageMetrics.trackError();
    throw err;
}
```

#### `trackConnection(delta)`
Track WebSocket or other persistent connections.

```javascript
wss.on('connection', (ws) => {
    usageMetrics.trackConnection(+1);

    ws.on('close', () => {
        usageMetrics.trackConnection(-1);
    });
});
```

#### `getSummary()`
Get compact stats for health endpoint.

```javascript
{
    uptime: 3600,        // Seconds since start
    requests: 1523,      // Total request count
    lastActivity: 1234567890, // Unix timestamp
    isActive: true       // Has received requests
}
```

#### `getStats()`
Get detailed statistics.

```javascript
{
    service: 'ServiceName',
    uptime: 3600,
    uptimeFormatted: '1h 0m 0s',
    startTime: 1234567890,
    requestCount: 1523,
    errorCount: 5,
    activeConnections: 3,
    lastActivity: 1234567890,
    idleTime: 120,
    idleTimeFormatted: '2m 0s',
    totalEndpoints: 15,
    topEndpoints: [
        { endpoint: 'GET /api/health', count: 500, lastHit: 1234567890 },
        { endpoint: 'POST /api/data', count: 200, lastHit: 1234567880 },
        // ... top 10 endpoints
    ],
    isActive: true,
    isIdle: false  // True if no activity for 5+ minutes
}
```

---

## Integration Checklist

For each service to integrate:

- [ ] Import `usage-metrics` module
- [ ] Call `init('ServiceName')` at startup
- [ ] Add `middleware()` after cors, before routes
- [ ] Update `/api/health` to include `usage.getSummary()`
- [ ] (Optional) Add `/api/usage/stats` endpoint
- [ ] (Optional) Track WebSocket connections
- [ ] (Optional) Track errors in catch blocks
- [ ] Test: Verify health endpoint returns usage stats
- [ ] Restart service to activate metrics

---

## Services Integrated

| Service | Port | Status | Integrated |
|---------|------|--------|------------|
| Relay | 8600 | Core | ✅ v3.1.0 |
| Oracle | 3002 | Core | ⏳ Pending |
| SimWidget Main | 8080 | Core | ⏳ Pending |
| Agent/KittBox | 8585 | Core | ⏳ Pending |
| Orchestrator | 8500 | Core | ⏳ Pending |
| Claude Bridge (8601) | 8601 | Core | ⏳ Pending |
| Claude Bridge (8700) | 8700 | Inactive | ❌ Not needed |
| Hive-Mind | 8701 | Core | ⏳ Pending |
| Terminal Hub | 8771 | Core | ⏳ Pending |
| Hive Brain (8800) | 8800 | Core | ⏳ Pending |
| Hive Brain (8810) | 8810 | Core | ⏳ Pending |
| Master Mind | 8820 | Core | ⏳ Pending |
| Hive Oracle | 8850 | Core | ⏳ Pending |
| MCP-Bridge | 8860 | Core | ⏳ Pending |
| Dashboard | 8899 | Core | ⏳ Pending |

**Target:** Integrate into all 15 core services by end of Week 1

---

## Collection & Analysis

### 1. Wait Period
After integration, let services run for **1 week** to collect meaningful data.

### 2. Collection Script
```bash
# Collect usage stats from all services
curl -s http://localhost:8600/api/usage/stats > relay-usage.json
curl -s http://localhost:3002/api/usage/stats > oracle-usage.json
# ... etc
```

### 3. Analysis
```javascript
// Example: Identify abandoned services
const stats = require('./relay-usage.json');
if (stats.requestCount === 0) {
    console.log(`${stats.service} has NEVER been used!`);
} else if (stats.idleTime > 604800) { // 7 days
    console.log(`${stats.service} hasn't been used in 7+ days`);
}
```

### 4. Decisions
Based on 1-week data:
- **requestCount = 0**: Service is abandoned, safe to deprecate
- **requestCount < 100/week**: Low usage, candidate for merge
- **requestCount > 1000/week**: Active service, keep separate
- **Compare duplicates**: Which of two services gets more traffic?

---

## Benefits

1. **Data-driven decisions** - No guessing about which services to merge
2. **Low risk** - Non-intrusive addition to existing code
3. **Minimal overhead** - Lightweight tracking (~1ms per request)
4. **Actionable insights** - Clear metrics for Phase 2 decisions
5. **Historical tracking** - Can monitor usage trends over time

---

## Next Steps

**Week 1 (Current):**
- ✅ Create usage-metrics.js utility
- ✅ Integrate into Relay service (example)
- ✅ Create integration guide
- ⏳ Integrate into remaining 14 core services
- ⏳ Deploy updates to production

**Week 2:**
- Collect 7 days of usage data
- Analyze service usage patterns
- Identify truly abandoned services
- Create usage report for Phase 2 decisions

---

## Troubleshooting

### Metrics not showing up
- Verify service has been restarted after integration
- Check `init()` was called before `middleware()`
- Verify middleware is placed before routes

### Incorrect request counts
- Ensure middleware is placed AFTER cors/json parsing
- Ensure middleware is placed BEFORE routes
- Check if service has multiple entry points

### Memory concerns
- Endpoint stats limited to Map storage (small overhead)
- Top endpoints limited to 10 entries in stats output
- No request body/response storage (just counters)

---

**For questions or issues:** See `docs/reports/HIVE-DUPLICATE-AUDIT-2026-02-09.md`
