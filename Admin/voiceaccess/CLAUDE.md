# VoiceAccess

**Entry:** `server.js` | **Port:** 8875

## What This Is
Centralized voice access management — admin/control layer for the Hive voice ecosystem. Provides a web dashboard for persona management, voice command routing, macro system, and command history/analytics.

## Key Rules
- NEVER change port 8875
- Data persisted to `voiceaccess-data.json` (auto-created)
- History auto-trims to 500 entries
- Intent matching uses regex patterns with complexity tiers (T0-T4)
- Unmatched commands route to default target via Relay

## Architecture
- Express.js + WebSocket on port 8875
- JSON file persistence (`voiceaccess-data.json`)
- 3 default personas: Heather, ShiZhenXiang, Kitt
- 14 regex intent patterns for command routing
- Routes commands to Orchestrator, Oracle, Relay, TTS

## Key Endpoints
```
GET  /api/health              - Service health + client count
POST /api/command             - Process voice command text
GET  /api/personas            - List persona configs
PUT  /api/personas/:id        - Update persona settings
GET  /api/macros              - List voice macros
POST /api/macros              - Create macro
GET  /api/history             - Command history (filterable)
GET  /api/history/stats       - 24h analytics
GET  /api/settings            - Global voice settings
PUT  /api/settings            - Update settings
POST /api/speak               - Broadcast TTS to WebSocket clients
GET  /api/services            - Voice service status
```

## Dependencies
- Orchestrator (:8500) for service status/restart
- Oracle (:8850) for LLM queries
- Relay (:8600) for message routing and conversation logs
- Hive Voice (:8870) for voice control state
- KittBox (:8585) for persona modules

## Testing
```bash
curl http://localhost:8875/api/health
curl http://localhost:8875/api/personas
curl -X POST http://localhost:8875/api/command -H "Content-Type: application/json" -d "{\"text\":\"status\"}"
```
