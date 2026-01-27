# Hive Oracle (Distributed LLM)

**Entry:** `server.js` | **Port:** 8850

## What This Is
Distributed LLM colony — discovers and coordinates multiple LLM nodes across the network for load-balanced inference.

## Key Rules
- NEVER change port 8850
- Auto-discovers LLM nodes (Ollama, LM Studio) on the network
- Distributed memory sync between nodes
- Load balances queries across available backends

## Architecture
- Express.js + WebSocket
- Node discovery via broadcast/polling
- Memory synchronization protocol between colony nodes
- Supports Ollama (:11434) and LM Studio (:1234) backends

## Key Endpoints
```
GET  /api/health        - Colony health (node count, model count)
GET  /api/models        - Available models across colony
POST /api/query         - Query LLM with load balancing
GET  /api/nodes         - List colony nodes
```

## Testing
```bash
curl http://localhost:8850/api/health
curl http://localhost:8850/api/models
```
