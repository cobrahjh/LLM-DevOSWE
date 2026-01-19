# Relay Service API Documentation

**Service:** Relay
**Port:** 8600
**Version:** 3.0.0
**Base URL:** `http://localhost:8600`

The Relay service is the central message broker for the Hive ecosystem. It handles task queuing, consumer management, and inter-service communication.

---

## Table of Contents

1. [Health & Status](#health--status)
2. [Task Queue](#task-queue)
3. [Consumer Management](#consumer-management)
4. [Messages (Claude Code Polling)](#messages-claude-code-polling)
5. [Team Tasks](#team-tasks)
6. [Conversation Logs](#conversation-logs)
7. [Prompt Management](#prompt-management)
8. [Benchmarks](#benchmarks)
9. [Training Examples](#training-examples)
10. [WebSocket Events](#websocket-events)

---

## Health & Status

### GET /api/health

Check service health and queue statistics.

**Response:**
```json
{
  "status": "ok",
  "service": "SimWidget Relay",
  "version": "3.0.0",
  "queue": {
    "pending": 5,
    "processing": 2,
    "completed": 150,
    "failed": 3,
    "needs_review": 1,
    "rejected": 0,
    "total": 161
  },
  "consumers": 2,
  "deadLetters": 0
}
```

### GET /

Web dashboard for task management.

---

## Task Queue

### POST /api/queue

Add a new task to the queue.

**Request Body:**
```json
{
  "task": "Process this file",
  "source": "kittbox",
  "priority": 5,
  "metadata": {}
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `task` | string | Yes* | Task description |
| `message` | string | Yes* | Alternative to `task` |
| `source` | string | No | Origin of the task |
| `priority` | number | No | 1-10, default 5 |
| `metadata` | object | No | Additional data |

*Either `task` or `message` is required.

**Response:**
```json
{
  "success": true,
  "id": 123,
  "status": "pending"
}
```

### GET /api/queue

List all tasks with optional filtering.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `limit` | number | Max results (default: 100) |
| `offset` | number | Pagination offset |

**Response:**
```json
{
  "tasks": [
    {
      "id": 123,
      "task": "Process this file",
      "status": "pending",
      "source": "kittbox",
      "created_at": "2026-01-19T10:00:00Z"
    }
  ],
  "total": 50
}
```

### GET /api/queue/pending

Get pending tasks count and list.

**Response:**
```json
{
  "count": 5,
  "tasks": [...]
}
```

### GET /api/queue/:id

Get a specific task by ID.

**Response:**
```json
{
  "id": 123,
  "task": "Process this file",
  "status": "pending",
  "source": "kittbox",
  "response": null,
  "created_at": "2026-01-19T10:00:00Z",
  "updated_at": "2026-01-19T10:00:00Z"
}
```

### DELETE /api/queue/:id

Delete a task. Protected tasks (pending/processing) require `?force=true`.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `force` | boolean | Force delete protected tasks |

**Response:**
```json
{
  "success": true,
  "message": "Task deleted"
}
```

### POST /api/queue/:id/cross

Mark a task as crossed off (manual completion).

**Response:**
```json
{
  "success": true,
  "task": {...}
}
```

### POST /api/queue/:id/process

Mark a task as processing.

**Response:**
```json
{
  "success": true,
  "task": {...}
}
```

### POST /api/queue/:id/note

Add a note to a task.

**Request Body:**
```json
{
  "note": "Working on this now"
}
```

### POST /api/queue/respond

Respond to a task (legacy endpoint).

**Request Body:**
```json
{
  "id": 123,
  "response": "Task completed successfully"
}
```

### POST /api/queue/cleanup

Remove completed and crossed tasks.

**Response:**
```json
{
  "success": true,
  "removed": 25
}
```

### POST /api/queue/reset-processing

Reset stuck processing tasks back to pending.

**Response:**
```json
{
  "success": true,
  "reset": 3
}
```

---

## Task Lifecycle

### GET /api/tasks/next

Get the next available task for processing (consumer use).

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `consumer_id` | string | Consumer identifier |

**Response:**
```json
{
  "task": {
    "id": 123,
    "task": "Process this file",
    "status": "processing",
    "claimed_by": "consumer-abc"
  }
}
```

Returns `{ "task": null }` if no tasks available.

### GET /api/tasks/:id

Get task details by ID.

### POST /api/tasks/:id/complete

Mark a task as completed.

**Request Body:**
```json
{
  "response": "Task completed successfully",
  "result": {}
}
```

### POST /api/tasks/:id/release

Release a task back to pending (unclaim).

### POST /api/tasks/:id/reject

Reject a task with reason.

**Request Body:**
```json
{
  "reason": "Invalid input format"
}
```

### POST /api/tasks/:id/review

Mark a task for manual review.

**Request Body:**
```json
{
  "reason": "Needs human verification"
}
```

### GET /api/queue/review

Get tasks marked for review.

### POST /api/tasks/:id/resubmit

Resubmit a failed or rejected task.

### GET /api/tasks/history

Get completed task history.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max results (default: 50) |
| `source` | string | Filter by source |

### GET /api/tasks/dead-letters

Get failed tasks (dead letter queue).

### GET /api/dead-letters

Alias for `/api/tasks/dead-letters`.

### POST /api/dead-letters/:id/retry

Retry a failed task.

---

## Consumer Management

### POST /api/consumer/register

Register a new consumer.

**Request Body:**
```json
{
  "consumer_id": "claude-bridge-1",
  "name": "Claude Bridge Worker",
  "capabilities": ["code", "analysis"]
}
```

**Response:**
```json
{
  "success": true,
  "consumer_id": "claude-bridge-1"
}
```

### POST /api/consumer/unregister

Unregister a consumer.

**Request Body:**
```json
{
  "consumer_id": "claude-bridge-1"
}
```

### POST /api/consumer/heartbeat

Send consumer heartbeat (keep-alive).

**Request Body:**
```json
{
  "consumer_id": "claude-bridge-1",
  "status": "idle"
}
```

### GET /api/consumers

List all registered consumers.

**Response:**
```json
{
  "consumers": [
    {
      "id": "claude-bridge-1",
      "name": "Claude Bridge Worker",
      "status": "idle",
      "last_heartbeat": "2026-01-19T10:00:00Z"
    }
  ]
}
```

---

## Messages (Claude Code Polling)

These endpoints support Claude Code's direct polling mode.

### GET /api/messages/pending

Get pending messages for Claude Code.

**Response:**
```json
{
  "messages": [
    {
      "id": 123,
      "message": "Help with this code",
      "source": "phone",
      "created_at": "2026-01-19T10:00:00Z"
    }
  ]
}
```

### POST /api/messages/:id/claim

Claim a message for processing.

**Response:**
```json
{
  "success": true,
  "message": {...}
}
```

### POST /api/messages/:id/respond

Respond to a claimed message.

**Request Body:**
```json
{
  "response": "Here's the solution..."
}
```

---

## Team Tasks

Multi-agent task assignment system.

### POST /api/team-tasks

Create a team task.

**Request Body:**
```json
{
  "description": "Implement new feature",
  "assigned_to": "programmer",
  "priority": "high",
  "metadata": {}
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | Yes | Task description |
| `assigned_to` | string | No | Team member (pm, programmer) |
| `priority` | string | No | low, medium, high |

### GET /api/team-tasks

List team tasks.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `assigned_to` | string | Filter by assignee |

### GET /api/team-tasks/:id

Get team task by ID.

### PATCH /api/team-tasks/:id

Update a team task.

**Request Body:**
```json
{
  "status": "in_progress",
  "notes": "Started working on this"
}
```

### POST /api/team-tasks/:id/complete

Complete a team task.

**Request Body:**
```json
{
  "summary": "Feature implemented successfully"
}
```

### DELETE /api/team-tasks/:id

Delete a team task.

### GET /api/team-tasks/stats/summary

Get team task statistics.

**Response:**
```json
{
  "total": 50,
  "by_status": {
    "pending": 10,
    "in_progress": 5,
    "completed": 35
  },
  "by_assignee": {
    "pm": 20,
    "programmer": 30
  }
}
```

---

## Conversation Logs

Voice persona conversation tracking.

### POST /api/conversation-logs

Log a conversation entry.

**Request Body:**
```json
{
  "persona": "heather",
  "text": "Hello, how can I help?",
  "type": "spoken"
}
```

### GET /api/conversation-logs/:persona

Get conversation logs for a persona.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max results |

### GET /api/conversation-logs/:persona/check

Check if text was recently spoken (avoid repeats).

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | string | Text to check |

### DELETE /api/conversation-logs/:persona

Clear conversation logs for a persona.

---

## Prompt Management

Store and manage AI prompts.

### GET /api/prompts

List all prompts.

### GET /api/prompts/:id

Get prompt by ID.

### POST /api/prompts

Create a new prompt.

**Request Body:**
```json
{
  "name": "Code Review",
  "content": "Review this code for...",
  "category": "development",
  "tags": ["code", "review"]
}
```

### PUT /api/prompts/:id

Update a prompt.

### DELETE /api/prompts/:id

Delete a prompt.

### POST /api/prompts/:id/test

Test a prompt with sample input.

**Request Body:**
```json
{
  "input": "function test() { return 1; }",
  "model": "qwen3-coder"
}
```

---

## Benchmarks

LLM performance benchmarking.

### GET /api/benchmarks

List all benchmarks.

### GET /api/benchmarks/:id

Get benchmark by ID.

### POST /api/benchmarks

Create a new benchmark.

**Request Body:**
```json
{
  "name": "Code Generation Speed",
  "prompt_id": 1,
  "models": ["qwen3-coder", "qwen2.5-coder:14b"],
  "iterations": 5
}
```

### POST /api/benchmarks/:id/run

Run a benchmark.

### GET /api/benchmarks/:id/compare

Compare benchmark results across models.

---

## Training Examples

Store training data for fine-tuning.

### GET /api/training/examples

List training examples.

### POST /api/training/examples

Add a training example.

**Request Body:**
```json
{
  "input": "User question",
  "output": "Expected response",
  "category": "general"
}
```

### PUT /api/training/examples/:id

Update a training example.

### DELETE /api/training/examples/:id

Delete a training example.

---

## WebSocket Events

Connect to `ws://localhost:8600` for real-time updates.

### Events Emitted

| Event | Payload | Description |
|-------|---------|-------------|
| `task:created` | `{ task }` | New task added |
| `task:updated` | `{ task }` | Task status changed |
| `task:completed` | `{ task }` | Task completed |
| `task:failed` | `{ task, error }` | Task failed |
| `consumer:connected` | `{ consumer }` | Consumer registered |
| `consumer:disconnected` | `{ consumer_id }` | Consumer unregistered |
| `message:pending` | `{ message }` | New message for Claude |

### Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `subscribe` | `{ channels: [] }` | Subscribe to channels |
| `unsubscribe` | `{ channels: [] }` | Unsubscribe from channels |

### Example Connection

```javascript
const ws = new WebSocket('ws://localhost:8600');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['tasks', 'messages']
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.type, data.payload);
};
```

---

## File Lock (Legacy)

### GET /api/filelock

Check file lock status.

### DELETE /api/filelock

Release file lock.

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Task not found",
    "statusCode": 404
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid input |
| `CONFLICT_ERROR` | 409 | Resource conflict |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limits

No rate limits are currently enforced. For production deployments, consider adding rate limiting middleware.

---

*Generated as part of Phase 3: Documentation*
