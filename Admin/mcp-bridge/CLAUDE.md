# MCP-Hive Bridge

**Entry:** `server.js` | **Port:** 8860

## What This Is
Central hub managing 7 MCP (Model Context Protocol) servers via JSON-RPC stdio protocol.

## Key Rules
- NEVER change port 8860
- MCP servers defined in `MCP_SERVERS` object — each has command, args, env, tools
- Servers requiring API keys (slack, brave-search) won't start without them
- Auto-start enabled servers on bridge startup

## Current Servers
| Server | Status | Needs |
|--------|--------|-------|
| filesystem | Auto-start | Nothing |
| memory | Auto-start | Nothing |
| github | Auto-start | GITHUB_PERSONAL_ACCESS_TOKEN |
| sequential-thinking | Auto-start | Nothing |
| puppeteer | Auto-start | Nothing |
| slack | Manual | SLACK_BOT_TOKEN, SLACK_TEAM_ID |
| brave-search | Manual | BRAVE_API_KEY |

## Key Endpoints
```
GET  /api/health           - Bridge health
GET  /api/servers          - All server statuses
POST /api/servers/:name/start  - Start a server
POST /api/servers/:name/stop   - Stop a server
POST /api/tools/:server/:tool  - Call a tool
GET  /api/quick/search     - Brave search shortcut
```

## Testing
```bash
curl http://localhost:8860/api/health
curl http://localhost:8860/api/servers
```
