# Oracle Service API Documentation

**Service:** Oracle
**Port:** 3002
**Version:** 2.0.0
**Base URL:** `http://localhost:3002`

The Oracle service is the LLM backend for the Hive ecosystem. It handles AI queries, project management, sandbox operations, and memory persistence.

---

## Table of Contents

1. [Health & Status](#health--status)
2. [AI Queries](#ai-queries)
3. [Task Management](#task-management)
4. [Conversation Sessions](#conversation-sessions)
5. [Memory System](#memory-system)
6. [Model Management](#model-management)
7. [Sandbox Operations](#sandbox-operations)
8. [Project Operations](#project-operations)

---

## Health & Status

### GET /api/health

Check service health and LLM backend status.

**Response:**
```json
{
  "healthy": true,
  "backend": "lmstudio",
  "ollama": "online",
  "models": [
    {
      "name": "qwen2.5-coder-14b-instruct",
      "params": "14B",
      "size": "8.4GB"
    }
  ],
  "lastCheck": "2026-01-19T10:00:00Z"
}
```

### GET /api/briefing

Get current system briefing/status summary.

**Response:**
```json
{
  "status": "operational",
  "activeModel": "qwen2.5-coder-14b-instruct",
  "pendingTasks": 3,
  "lastActivity": "2026-01-19T10:00:00Z"
}
```

---

## AI Queries

### POST /api/ask

Send a query to the LLM.

**Request Body:**
```json
{
  "prompt": "Explain how async/await works in JavaScript",
  "model": "qwen2.5-coder-14b-instruct",
  "systemPrompt": "You are a helpful coding assistant",
  "temperature": 0.7,
  "maxTokens": 2000,
  "sessionId": "session-123"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | User query |
| `model` | string | No | Model to use (default: configured) |
| `systemPrompt` | string | No | System context |
| `temperature` | number | No | 0-1, creativity level |
| `maxTokens` | number | No | Max response length |
| `sessionId` | string | No | Conversation session ID |

**Response:**
```json
{
  "response": "Async/await is a syntax for handling...",
  "model": "qwen2.5-coder-14b-instruct",
  "tokens": {
    "prompt": 45,
    "completion": 350,
    "total": 395
  },
  "timing": {
    "total_ms": 2500,
    "tokens_per_second": 140
  }
}
```

### POST /api/consult

Consult with context injection (includes hive state).

**Request Body:**
```json
{
  "query": "What services are running?",
  "includeContext": true
}
```

**Response:** Same as `/api/ask` but with hive context automatically injected.

---

## Task Management

### GET /api/tasks

List Oracle's internal tasks.

**Response:**
```json
{
  "tasks": [
    {
      "id": 1,
      "description": "Process code review",
      "status": "pending",
      "created_at": "2026-01-19T10:00:00Z"
    }
  ]
}
```

### POST /api/tasks

Create a new internal task.

**Request Body:**
```json
{
  "description": "Analyze codebase structure",
  "priority": "high"
}
```

### GET /api/tasks/escalated

Get tasks escalated from other services.

### POST /api/direct-task

Create a direct task for immediate processing.

**Request Body:**
```json
{
  "task": "Generate unit tests for utils.js",
  "context": "// file contents here",
  "priority": "high"
}
```

### GET /api/direct-tasks

List direct tasks.

### POST /api/direct-tasks/:id/done

Mark a direct task as done.

---

## Conversation Sessions

### GET /api/sessions

List all conversation sessions.

**Response:**
```json
{
  "sessions": [
    {
      "id": "session-123",
      "created_at": "2026-01-19T10:00:00Z",
      "message_count": 15,
      "last_activity": "2026-01-19T11:30:00Z"
    }
  ]
}
```

### GET /api/conversation/:sessionId

Get conversation history for a session.

**Response:**
```json
{
  "sessionId": "session-123",
  "messages": [
    {
      "role": "user",
      "content": "Hello",
      "timestamp": "2026-01-19T10:00:00Z"
    },
    {
      "role": "assistant",
      "content": "Hi! How can I help?",
      "timestamp": "2026-01-19T10:00:01Z"
    }
  ]
}
```

### DELETE /api/conversation/:sessionId

Delete a conversation session.

---

## Memory System

Oracle maintains persistent memory across sessions.

### GET /api/memory/facts

List all stored facts.

**Response:**
```json
{
  "facts": {
    "user_name": "Harold",
    "preferred_language": "JavaScript",
    "project_root": "C:/LLM-DevOSWE"
  }
}
```

### GET /api/memory/facts/:key

Get a specific fact.

### POST /api/memory/facts

Store a new fact.

**Request Body:**
```json
{
  "key": "favorite_framework",
  "value": "Express"
}
```

### DELETE /api/memory/facts/:key

Delete a fact.

### GET /api/memory/sessions

List memory sessions.

### POST /api/memory/sessions

Create a new memory session.

### POST /api/memory/sessions/:id/end

End a memory session.

### GET /api/memory/handoffs

List task handoffs between sessions.

### POST /api/memory/handoffs

Create a handoff.

**Request Body:**
```json
{
  "from_session": "session-123",
  "to_session": "session-456",
  "context": "Continue working on the API docs",
  "files": ["docs/API-RELAY.md"]
}
```

### POST /api/memory/handoffs/:id/claim

Claim a handoff.

### POST /api/memory/handoffs/:id/complete

Complete a handoff.

### GET /api/memory/context

Get current context for AI injection.

**Response:**
```json
{
  "facts": {...},
  "recentSessions": [...],
  "activeHandoffs": [...],
  "hiveState": {
    "services": {...},
    "tasks": {...}
  }
}
```

---

## Model Management

### GET /api/model

Get current model configuration.

**Response:**
```json
{
  "current": "qwen2.5-coder-14b-instruct",
  "backend": "lmstudio",
  "available": [
    "qwen2.5-coder-14b-instruct",
    "qwen3-coder-30b",
    "llama-3.3-70b"
  ]
}
```

### POST /api/model

Switch active model.

**Request Body:**
```json
{
  "model": "qwen3-coder-30b"
}
```

### GET /api/workspace

Get workspace/environment information.

**Response:**
```json
{
  "cwd": "C:/LLM-DevOSWE",
  "platform": "win32",
  "node": "v24.12.0",
  "memory": {
    "used": 512,
    "total": 1024,
    "unit": "MB"
  }
}
```

---

## Sandbox Operations

The sandbox (`C:/devTinyAI`) is an isolated environment for AI experimentation.

### GET /api/sandbox

List files in the sandbox.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | string | Subdirectory to list |

**Response:**
```json
{
  "path": "sandbox",
  "files": [
    {
      "name": "test.js",
      "type": "file",
      "size": 1024,
      "modified": "2026-01-19T10:00:00Z"
    },
    {
      "name": "experiments",
      "type": "directory"
    }
  ]
}
```

### GET /api/sandbox/read

Read a file from the sandbox.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `file` | string | File path relative to sandbox |

**Response:**
```json
{
  "file": "test.js",
  "content": "console.log('Hello');",
  "size": 24
}
```

### POST /api/sandbox/write

Write a file to the sandbox.

**Request Body:**
```json
{
  "file": "test.js",
  "content": "console.log('Updated');"
}
```

### DELETE /api/sandbox/delete

Delete a file from the sandbox.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `file` | string | File path to delete |

### POST /api/sandbox/run

Execute code in the sandbox.

**Request Body:**
```json
{
  "code": "console.log(2 + 2);",
  "language": "javascript"
}
```

**Response:**
```json
{
  "success": true,
  "output": "4\n",
  "exitCode": 0,
  "duration_ms": 150
}
```

---

## Project Operations

Registered projects can be accessed for reading/writing.

### GET /api/projects

List all registered projects.

**Response:**
```json
{
  "projects": [
    {
      "name": "twitch-accessibility",
      "root": "C:/twitch-disability-app",
      "description": "Accessibility browser extension"
    },
    {
      "name": "llm-devoswe",
      "root": "C:/LLM-DevOSWE",
      "description": "Main hive framework"
    }
  ]
}
```

### GET /api/projects/:name

Get project structure.

**Response:**
```json
{
  "name": "twitch-accessibility",
  "root": "C:/twitch-disability-app",
  "allowed": ["src", "lib", "components"],
  "structure": {
    "src": ["index.js", "utils.js"],
    "lib": ["helpers.js"]
  }
}
```

### GET /api/projects/:name/read

Read a file from a project.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `file` | string | File path relative to project root |

**Response:**
```json
{
  "file": "src/index.js",
  "content": "// Main entry point...",
  "project": "twitch-accessibility"
}
```

### POST /api/projects/:name/write

Write a file to a project (restricted to allowed directories).

**Request Body:**
```json
{
  "file": "src/newfile.js",
  "content": "// New file content"
}
```

**Response:**
```json
{
  "success": true,
  "file": "src/newfile.js",
  "project": "twitch-accessibility"
}
```

**Error (unauthorized directory):**
```json
{
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Cannot write to directory: docs"
  }
}
```

---

## Insights & Analytics

### GET /api/insights

Get AI-generated insights about recent activity.

**Response:**
```json
{
  "insights": [
    {
      "type": "pattern",
      "message": "You frequently ask about async code",
      "confidence": 0.85
    },
    {
      "type": "suggestion",
      "message": "Consider creating a utility library for common patterns",
      "confidence": 0.72
    }
  ],
  "generated_at": "2026-01-19T10:00:00Z"
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Project not found",
    "statusCode": 404
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid input |
| `AUTHORIZATION_ERROR` | 403 | Access denied |
| `SERVICE_UNAVAILABLE` | 503 | LLM backend offline |
| `TIMEOUT_ERROR` | 504 | LLM response timeout |

---

## LLM Backend Configuration

Oracle supports multiple backends:

| Backend | Port | Configuration |
|---------|------|---------------|
| **LM Studio** | 1234 | `LLM_BACKEND=lmstudio` |
| **Ollama** | 11434 | `LLM_BACKEND=ollama` |
| **Smart Router** | 8610 | `LLM_BACKEND=router` |

Set via environment variable or Oracle config.

---

*Generated as part of Phase 3: Documentation*
