# SimWidget Telemetry & Analytics Design
**Version:** 1.0.0  
**Last Updated:** 2025-01-07  
**Path:** `C:\LLM-DevOSWE\SimWidget_Engine\docs\TELEMETRY-DESIGN.md`

---

## 1. Supabase Hosting

### Where Does Supabase Reside?

**Supabase Cloud (Recommended)**
- URL: `https://YOUR_PROJECT.supabase.co`
- Hosted by Supabase on AWS
- Free tier: 500MB database, 1GB file storage
- No server management needed
- Auto-backups, SSL included

**Self-Hosted Option**
- Docker on your own server
- Full control but requires maintenance
- Good for privacy-sensitive deployments

**Recommendation:** Start with Supabase Cloud (free), migrate to self-hosted only if needed for privacy/compliance.

---

## 2. Platform Detection & Tracking

### Platforms We Track

| Platform | Detection Method | Limitations |
|----------|------------------|-------------|
| `desktop` | Default browser | Full functionality |
| `mobile` | User-agent regex | Touch-only, no keyboard shortcuts |
| `msfs-panel` | `window.name === 'ingamepanel'` or `Coherent` API | Limited DOM, no localStorage |
| `electron` | `navigator.userAgent.includes('Electron')` | Desktop app specific |
| `stream-deck` | Custom header from Stream Deck plugin | Button-only, no sliders |

### What We Record Per Platform

```javascript
{
    platform: "msfs-panel",
    capabilities: {
        localStorage: false,      // MSFS panels don't support
        touch: false,
        keyboard: true,
        websocket: true,
        notifications: false
    },
    limitations: [
        "no-localstorage",
        "no-file-download",
        "limited-dom"
    ],
    detected_addons: {
        chaseplane: true,
        fsuipc: true,
        vjoy: false
    }
}
```

---

## 3. Feature Tracking Matrix

### What's Implemented vs Missing

```sql
-- Supabase table: feature_matrix
CREATE TABLE feature_matrix (
    id SERIAL PRIMARY KEY,
    device_id TEXT NOT NULL,          -- Anonymous UUID
    widget TEXT NOT NULL,
    platform TEXT NOT NULL,
    feature TEXT NOT NULL,
    status TEXT NOT NULL,             -- 'working', 'partial', 'missing', 'not_applicable'
    error_count INTEGER DEFAULT 0,
    last_tested TIMESTAMPTZ,
    notes TEXT
);
```

**Status Values:**
- `working` - Feature works as expected
- `partial` - Works with limitations
- `missing` - Not implemented yet
- `not_applicable` - Feature doesn't apply to this platform
- `broken` - Was working, now broken

### Auto-Detection Flow

```javascript
// On widget load, test capabilities
async function detectCapabilities() {
    const capabilities = {
        localStorage: testLocalStorage(),
        websocket: testWebSocket(),
        simconnect: await testSimConnect(),
        chaseplane: await detectChasePlane(),
        fsuipc: await detectFSUIPC(),
        vjoy: await detectVJoy()
    };
    
    // Report to telemetry
    telemetry.reportCapabilities(capabilities);
    
    // Disable features that won't work
    if (!capabilities.localStorage) {
        disableFeature('preferences-save');
    }
    
    return capabilities;
}
```

---

## 4. Anonymous UUID System

### First Install UUID Generation

```javascript
// On first widget load
function getOrCreateDeviceId() {
    let deviceId = localStorage.getItem('simwidget_device_id');
    
    if (!deviceId) {
        // Generate anonymous UUID v4
        deviceId = 'sw_' + crypto.randomUUID();
        localStorage.setItem('simwidget_device_id', deviceId);
        
        // Report first install
        telemetry.reportInstall({
            deviceId,
            platform: detectPlatform(),
            timestamp: new Date().toISOString(),
            version: SIMWIDGET_VERSION
        });
    }
    
    return deviceId;
}
```

### UUID Considerations

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Format** | `sw_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | Prefix identifies source |
| **Storage** | localStorage | Persists across sessions |
| **MSFS Panel** | Generate per-session | No localStorage access |
| **Opt-out** | Yes, in settings | User can disable telemetry |
| **Linking** | Never | No cross-device tracking |
| **PII** | None | No email, name, IP stored |

### MSFS Panel Workaround

```javascript
// For MSFS panels without localStorage
function getMsfsPanelId() {
    // Use session-only ID
    if (!window._simwidget_session_id) {
        window._simwidget_session_id = 'msfs_' + Date.now().toString(36);
    }
    return window._simwidget_session_id;
}
```

---

## 5. Enhanced Telemetry Schema

### Supabase Tables

```sql
-- Devices table (anonymous)
CREATE TABLE devices (
    device_id TEXT PRIMARY KEY,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    platform TEXT NOT NULL,
    version TEXT NOT NULL,
    install_count INTEGER DEFAULT 1
);

-- Sessions table
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    device_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    widget_loads JSONB,           -- { "aircraft-control": 5, "fuel-widget": 2 }
    capabilities JSONB,           -- { localStorage: true, websocket: true }
    detected_addons JSONB         -- { chaseplane: true, fsuipc: false }
);

-- Errors table (existing, enhanced)
CREATE TABLE errors (
    id TEXT PRIMARY KEY,
    device_id TEXT,
    session_id TEXT,
    widget TEXT NOT NULL,
    version TEXT NOT NULL,
    platform TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    severity TEXT NOT NULL DEFAULT 'error',
    message TEXT NOT NULL,
    stack TEXT,
    context JSONB,
    count INTEGER DEFAULT 1
);

-- Feature usage table
CREATE TABLE feature_usage (
    id SERIAL PRIMARY KEY,
    device_id TEXT,
    widget TEXT NOT NULL,
    feature TEXT NOT NULL,
    platform TEXT NOT NULL,
    used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success BOOLEAN DEFAULT true,
    duration_ms INTEGER
);

-- Feedback table (existing)
CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    device_id TEXT,
    widget TEXT NOT NULL,
    version TEXT NOT NULL,
    platform TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    feedback TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    context JSONB
);
```

---

## 6. What We Track

### ✅ DO Track

| Data | Purpose |
|------|---------|
| Anonymous device ID | Aggregate unique users |
| Platform type | Feature compatibility |
| Widget versions | Upgrade patterns |
| Error messages | Bug fixing |
| Feature usage counts | Prioritize development |
| Session duration | Engagement metrics |
| Detected addons | Integration support |

### ❌ DON'T Track

| Data | Reason |
|------|--------|
| IP addresses | Privacy |
| Geographic location | Privacy |
| Email/name | Privacy |
| Flight data | Not relevant |
| File paths | Security |
| System specs | Not needed |

---

## 7. Opt-Out System

```javascript
// In settings panel
{
    title: 'Privacy',
    icon: '🔒',
    render: () => `
        <div class="privacy-settings">
            <label>
                <input type="checkbox" id="telemetry-enabled" 
                       ${telemetry.enabled ? 'checked' : ''}>
                Send anonymous usage data to help improve SimWidget
            </label>
            <p class="privacy-note">
                We collect: error reports, feature usage counts, platform info.
                We never collect: personal info, flight data, file paths.
            </p>
            <button id="delete-device-id">Reset Anonymous ID</button>
        </div>
    `
}
```

---

## 8. Dashboard Queries

### Most Common Errors by Platform

```sql
SELECT 
    platform,
    message,
    COUNT(DISTINCT device_id) as affected_devices,
    SUM(count) as total_occurrences
FROM errors
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY platform, message
ORDER BY affected_devices DESC
LIMIT 20;
```

### Feature Support Matrix

```sql
SELECT 
    widget,
    platform,
    feature,
    status,
    COUNT(DISTINCT device_id) as devices_tested
FROM feature_matrix
GROUP BY widget, platform, feature, status
ORDER BY widget, platform, feature;
```

### Platform Distribution

```sql
SELECT 
    platform,
    COUNT(DISTINCT device_id) as unique_devices,
    COUNT(*) as total_sessions
FROM sessions
WHERE started_at > NOW() - INTERVAL '30 days'
GROUP BY platform;
```

---

## 9. Implementation Priority

1. **Phase 1 (Now)**
   - Anonymous UUID generation
   - Error capture with dedup
   - Feedback form
   - Basic platform detection

2. **Phase 2 (Soon)**
   - Session tracking
   - Feature usage metrics
   - Addon detection
   - Capability testing

3. **Phase 3 (Later)**
   - Dashboard UI
   - Alert system for new errors
   - A/B testing framework
   - User cohort analysis

---

## 10. Files Reference

| File | Purpose |
|------|---------|
| `/ui/shared/telemetry.js` | Core telemetry service |
| `/ui/shared/device-id.js` | UUID generation & storage |
| `/ui/shared/capability-detect.js` | Platform & addon detection |
| `/docs/TELEMETRY-SETUP.md` | Supabase setup guide |
| `/docs/TELEMETRY-DESIGN.md` | This document |
