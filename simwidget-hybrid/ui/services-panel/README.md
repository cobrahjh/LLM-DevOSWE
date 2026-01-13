# Services Panel Widget v1.0.0

Monitor and control SimWidget services.

**Path:** C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\ui\services-panel\  
**Last Updated:** 2025-01-08

## Features

- Real-time status monitoring for all services
- Start/Stop controls for each service
- Compact mode (status dots only)
- Auto-refresh every 5 seconds

## Services Monitored

| Service | Port | Description |
|---------|------|-------------|
| SimWidget | 8080 | Main server with SimConnect |
| Agent | 8585 | Claude chat assistant |
| Remote | 8590 | Remote command API |

## API Endpoint

The widget uses `/api/services` endpoint added in server v1.9.0:

```javascript
// GET /api/services - List services
// POST /api/services - Control service
{
  "service": "simwidget|agent|remote",
  "action": "start|stop|restart"
}
```

## Files

- `index.html` - Widget HTML structure
- `widget.css` - Styling with compact mode
- `widget.js` - Service monitoring logic

## Usage

Access at: http://localhost:8080/ui/services-panel/

Or embedded in Agent UI at: http://192.168.1.42:8585
