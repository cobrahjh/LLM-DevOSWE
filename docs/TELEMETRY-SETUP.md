# SimWidget Telemetry - Supabase Setup
**Version:** 1.0.0  
**Last Updated:** 2025-01-07  
**Path:** `C:\LLM-DevOSWE\SimWidget_Engine\docs\TELEMETRY-SETUP.md`

---

## Overview

SimWidget uses Supabase for telemetry (error tracking) and user feedback collection. This document explains how to set up and configure the telemetry system.

---

## Supabase Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Note your **Project URL** and **anon public key**

### 2. Create Tables

Run this SQL in Supabase SQL Editor:

```sql
-- Errors table
CREATE TABLE errors (
    id TEXT PRIMARY KEY,
    widget TEXT NOT NULL,
    version TEXT NOT NULL,
    platform TEXT NOT NULL,
    session_id TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    severity TEXT NOT NULL DEFAULT 'error',
    message TEXT NOT NULL,
    stack TEXT,
    context JSONB,
    count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feedback table
CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    widget TEXT NOT NULL,
    version TEXT NOT NULL,
    platform TEXT NOT NULL,
    session_id TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    feedback TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    context JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_errors_widget ON errors(widget);
CREATE INDEX idx_errors_timestamp ON errors(timestamp DESC);
CREATE INDEX idx_feedback_widget ON feedback(widget);
CREATE INDEX idx_feedback_timestamp ON feedback(timestamp DESC);

-- Enable Row Level Security
ALTER TABLE errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for telemetry)
CREATE POLICY "Allow anonymous error inserts" ON errors
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous feedback inserts" ON feedback
    FOR INSERT TO anon WITH CHECK (true);

-- Allow authenticated reads (for admin dashboard)
CREATE POLICY "Allow authenticated reads on errors" ON errors
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated reads on feedback" ON feedback
    FOR SELECT TO authenticated USING (true);
```

### 3. Configure SimWidget

Create a config file or set global variables:

**Option A: Config file** (`/ui/shared/telemetry-config.js`)
```javascript
window.SIMWIDGET_SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
window.SIMWIDGET_SUPABASE_KEY = 'YOUR_ANON_KEY';
```

**Option B: Server-injected** (via server.js)
```javascript
// In your widget HTML template
<script>
    window.SIMWIDGET_SUPABASE_URL = '${process.env.SUPABASE_URL}';
    window.SIMWIDGET_SUPABASE_KEY = '${process.env.SUPABASE_KEY}';
</script>
```

---

## Architecture

```
Widget Error/Feedback
        │
        ▼
TelemetryService (client)
        │
        ├─► Error: Deduplicate by hash
        │          Queue (max 50)
        │          Batch send every 60s
        │
        └─► Feedback: Immediate send
                │
                ▼
        Supabase REST API
                │
                ▼
        PostgreSQL Tables
```

### Error Deduplication

Errors are deduplicated per session using a hash of:
- Widget name
- Error message
- Source location

Same error occurring multiple times increments `count` but only sends once.

---

## Data Schema

### Error Object

```json
{
    "id": "err_abc123",
    "widget": "aircraft-control",
    "version": "1.2.0",
    "platform": "desktop",
    "session_id": "sess_xyz789",
    "timestamp": "2025-01-07T02:15:00Z",
    "severity": "error",
    "message": "WebSocket connection failed",
    "stack": "at connect (app.js:72:15)",
    "context": {
        "url": "http://localhost:8080/ui/aircraft-control/",
        "userAgent": "Mozilla/5.0...",
        "msfsConnected": false
    },
    "count": 3
}
```

### Feedback Object

```json
{
    "widget": "fuel-widget",
    "version": "2.4.0",
    "platform": "desktop",
    "session_id": "sess_xyz789",
    "timestamp": "2025-01-07T02:15:00Z",
    "feedback": "The gauge animation is smooth!",
    "rating": 5,
    "context": {
        "url": "http://localhost:8080/ui/fuel-widget/"
    }
}
```

---

## Integration in Widgets

### Minimal Setup

```html
<!-- In widget HTML -->
<link rel="stylesheet" href="/ui/shared/settings-panel.css">
<script src="/ui/shared/telemetry.js"></script>
<script src="/ui/shared/settings-panel.js"></script>
<script src="/ui/shared/feedback-section.js"></script>
```

```javascript
// In widget JS
const telemetry = new TelemetryService({
    widget: 'my-widget',
    version: '1.0.0'
});

// Manual error capture
try {
    riskyOperation();
} catch (e) {
    telemetry.captureError(e, { action: 'riskyOperation' });
}

// Settings with feedback
const settings = new SettingsPanel();
const feedback = new FeedbackSection(telemetry);
settings.registerSection('feedback', feedback.getConfig());
```

### Using Widget Base Class

```javascript
// Extends SimWidgetBase for automatic setup
class MyWidget extends SimWidgetBase {
    constructor() {
        super({
            widgetName: 'my-widget',
            widgetVersion: '1.0.0'
        });
    }
}
```

---

## Dashboard Queries

### Most Common Errors (Last 7 Days)

```sql
SELECT 
    widget,
    message,
    COUNT(*) as occurrences,
    SUM(count) as total_hits
FROM errors
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY widget, message
ORDER BY occurrences DESC
LIMIT 20;
```

### Feedback Summary

```sql
SELECT 
    widget,
    AVG(rating) as avg_rating,
    COUNT(*) as feedback_count
FROM feedback
WHERE rating IS NOT NULL
GROUP BY widget
ORDER BY feedback_count DESC;
```

### Error Trend

```sql
SELECT 
    DATE_TRUNC('day', timestamp) as day,
    COUNT(*) as error_count
FROM errors
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY day
ORDER BY day;
```

---

## Privacy Notes

- **No PII collected** - Only technical data
- **Session IDs** - Random, not linked to users
- **User Agent** - Truncated to 200 chars
- **Feedback** - Anonymous, no email required
- **Data retention** - Consider auto-delete after 90 days

---

## Files Reference

| File | Purpose |
|------|---------|
| `/ui/shared/telemetry.js` | Error capture & Supabase API |
| `/ui/shared/settings-panel.js` | Settings modal component |
| `/ui/shared/settings-panel.css` | Settings styles |
| `/ui/shared/feedback-section.js` | Feedback form section |
| `/ui/shared/widget-base.js` | Base class with auto-setup |
