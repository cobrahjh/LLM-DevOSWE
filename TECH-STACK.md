# LLM-DevOSWE Hive - Technical Overview

**Version:** 1.14.0
**Last Updated:** 2026-01-19

A comprehensive overview of the technologies, architecture, processes, and standards used in the Hive ecosystem.

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Architecture](#architecture)
3. [Shared Modules](#shared-modules)
4. [Services](#services)
5. [Development Process](#development-process)
6. [Testing Framework](#testing-framework)
7. [Code Quality](#code-quality)
8. [Deployment](#deployment)
9. [AI Integration](#ai-integration)

---

## Technology Stack

### Core Runtime

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 18+ (24.12.0 current) | Runtime environment |
| **JavaScript** | ES2021+ | Primary language |
| **SQLite** | via better-sqlite3 | Local persistence |

### Backend Frameworks

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.18.2 / ^5.2.1 | HTTP server framework |
| `ws` | ^8.19.0 | WebSocket support |
| `cors` | ^2.8.5 | Cross-origin requests |
| `dotenv` | ^16.3.1 / ^17.2.3 | Environment configuration |

### Database & Storage

| Package | Version | Purpose |
|---------|---------|---------|
| `better-sqlite3` | ^12.5.0 | SQLite bindings (sync API) |
| `@supabase/supabase-js` | ^2.90.0 | Cloud database (optional) |

### AI/LLM Integration

| Service | Port | Purpose |
|---------|------|---------|
| **Ollama** | 11434 | Local LLM inference (qwen3-coder) |
| **LM Studio** | 1234 | Local LLM (qwen2.5-coder-14b) |
| **Claude Code** | CLI | AI-assisted development |

### Development Tools

| Tool | Purpose |
|------|---------|
| **ESLint** | Code linting (^8.57.0) |
| **Jest** | Testing framework (^29.7.0) |
| **NSSM** | Windows service management |
| **Git** | Version control |

---

## Architecture

### Service-Oriented Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACES                           │
│   KittBox (:8585)  │  Kitt Live (:8686)  │  Mobile App      │
└──────────────┬────────────────────┬─────────────────────────┘
               │                    │
               ▼                    ▼
          ┌────────────────────────────────────────────────┐
          │                RELAY (:8600)                   │
          │   Message queue, WebSocket events, SQLite      │
          └────────────────────────┬───────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          ▼                        ▼                        ▼
   ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
   │   Oracle    │          │ Hive Brain  │          │  Hive-Mind  │
   │   :3002     │          │   :8800     │          │   :8701     │
   │ LLM Backend │          │ Device Mgmt │          │  Monitoring │
   └─────────────┘          └─────────────┘          └─────────────┘
```

### Port Allocation

| Range | Purpose |
|-------|---------|
| 3000-3999 | Oracle & API services |
| 8000-8099 | SimWidget (MSFS) |
| 8500-8599 | Core services (Agent, Orchestrator) |
| 8600-8699 | Communication (Relay, Router, Bridge) |
| 8700-8899 | Hive services (Mind, Brain, Oracle) |
| 11434 | Ollama |
| 1234 | LM Studio |

### Data Flow

1. **User Input** → UI (KittBox/Kitt Live)
2. **Request** → Relay (message queue)
3. **Processing** → Oracle (LLM) or Service
4. **Response** → WebSocket broadcast
5. **Display** → UI update

---

## Shared Modules

Located in `/shared/` - reusable utilities for all services.

### Constants (`shared/constants.js`)

Single source of truth for all configuration:

```javascript
const { SERVICES, PORTS, getServiceUrl, getHealthUrl } = require('../shared');

// Get service URL
const relayUrl = getServiceUrl('relay'); // http://localhost:8600

// Get health endpoint
const healthUrl = getHealthUrl('oracle'); // http://localhost:3002/api/health
```

**Exports:**
- `PORTS` - All port numbers
- `SERVICES` - Service definitions (name, port, healthPath, description)
- `MACHINES` - Network machine definitions
- `TIMEOUTS` - Standard timeout values
- `RETRY` - Retry configuration
- `getServiceUrl(key, host)` - Build service URL
- `getHealthUrl(key, host)` - Build health check URL
- `getCoreServices()` - List core service keys
- `getOptionalServices()` - List optional service keys

### Logger (`shared/logger.js`)

Standardized logging with colors, levels, and file rotation:

```javascript
const createLogger = require('../shared/logger');

const logger = createLogger('relay', {
    logFile: './logs/relay.log',
    maxFileSize: 5 * 1024 * 1024,  // 5MB
    maxBackups: 3
});

logger.info('Server started', { port: 8600 });
logger.error('Connection failed', { error: err.message });
logger.exception('Unhandled error', error);
```

**Log Levels:** `debug` < `info` < `warn` < `error`

**Environment:** Set `LOG_LEVEL=debug` for verbose output.

### Errors (`shared/errors.js`)

Typed error classes with HTTP status codes:

```javascript
const { NotFoundError, ValidationError, asyncHandler } = require('../shared');

// Throw typed errors
throw new NotFoundError('Task not found', { taskId: 123 });

// Async route wrapper
app.get('/api/tasks/:id', asyncHandler(async (req, res) => {
    const task = await getTask(req.params.id);
    if (!task) throw new NotFoundError('Task not found');
    res.json(task);
}));
```

**Error Classes:**
| Class | Status | Code |
|-------|--------|------|
| `HiveError` | 500 | INTERNAL_ERROR |
| `NotFoundError` | 404 | NOT_FOUND |
| `ValidationError` | 400 | VALIDATION_ERROR |
| `AuthenticationError` | 401 | AUTHENTICATION_ERROR |
| `AuthorizationError` | 403 | AUTHORIZATION_ERROR |
| `ConflictError` | 409 | CONFLICT_ERROR |
| `RateLimitError` | 429 | RATE_LIMIT_ERROR |
| `ServiceUnavailableError` | 503 | SERVICE_UNAVAILABLE |
| `TimeoutError` | 504 | TIMEOUT_ERROR |

### Validation (`shared/validation.js`)

Request validation middleware:

```javascript
const { validate, schemas } = require('../shared');

// Define schema
const taskSchema = {
    task: schemas.string({ minLength: 1 }),
    priority: schemas.optionalNumber({ min: 1, max: 10, default: 5 }),
    status: schemas.enum(['pending', 'active', 'done'])
};

// Use as middleware
app.post('/api/tasks', validate(taskSchema), (req, res) => {
    // req.body is validated and has defaults applied
});
```

**Schema Helpers:**
- `schemas.string(options)` - Required string
- `schemas.optionalString(options)` - Optional string
- `schemas.number(options)` - Required number
- `schemas.id()` - Positive integer
- `schemas.email()` - Email format
- `schemas.enum(values)` - Enumerated values
- `schemas.uuid()` - UUID format
- `schemas.array(itemSchema, options)` - Array with item validation

### Health (`shared/health.js`)

Standardized health responses:

```javascript
const { createHealthResponse, checkHealth } = require('../shared');

// Create health response
app.get('/api/health', (req, res) => {
    res.json(createHealthResponse('relay', '3.0.0', {
        queue: { pending: 5, completed: 100 }
    }));
});

// Check another service
const result = await checkHealth('http://localhost:3002/api/health');
if (result.healthy) {
    console.log('Oracle is online');
}
```

---

## Services

### Core Services (Required)

| Service | Port | Description |
|---------|------|-------------|
| **Relay** | 8600 | Message broker, task queue, SQLite persistence |
| **Oracle** | 3002 | LLM backend, project APIs, tool execution |
| **KittBox** | 8585 | Command center UI, task execution |
| **Hive-Mind** | 8701 | Real-time activity monitor |

### Extended Services (Optional)

| Service | Port | Description |
|---------|------|-------------|
| **Hive Brain** | 8800 | Device discovery, colony management |
| **Hive Oracle** | 8850 | Distributed LLM orchestrator |
| **Smart Router** | 8610 | LLM routing (Claude/Ollama/LM Studio) |
| **Browser Bridge** | 8620 | Browser automation API |
| **Claude Bridge** | 8700 | WebSocket to Claude Code CLI |
| **Kitt Live** | 8686 | Standalone chat UI |
| **Whisper** | 8660 | Speech-to-text transcription |

### Service Management

Each service has consistent npm scripts:

```bash
npm start      # Start the service
npm run dev    # Start with watch mode (auto-reload)
npm run lint   # Run ESLint
```

---

## Development Process

### Workflow

1. **Plan** - Define requirements, update CLAUDE.md if needed
2. **Implement** - Write code following STANDARDS.md
3. **Test** - Run `npm test` (unit + integration)
4. **Lint** - Run `npm run lint`
5. **Commit** - Use conventional commits
6. **Push** - Deploy to origin

### Commit Convention

```
type: Short description

- Detail 1
- Detail 2

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `refactor` - Code refactoring
- `test` - Adding tests
- `chore` - Maintenance

### Branch Strategy

- `master` - Main development branch
- Feature branches as needed

---

## Testing Framework

### Structure

```
tests/
├── setup.js              # Global test configuration
├── unit/                 # Unit tests
│   ├── constants.test.js
│   ├── health.test.js
│   ├── logger.test.js
│   ├── errors.test.js
│   └── validation.test.js
└── integration/          # Integration tests
    └── services.test.js
```

### Running Tests

```bash
npm test                           # Run all tests
npm run test:watch                 # Watch mode
npm test -- --testPathPattern=unit # Unit tests only
npm test -- --coverage             # With coverage report
```

### Test Coverage

| Module | Tests | Coverage |
|--------|-------|----------|
| constants | 18 | Core service definitions |
| health | 10 | Health response utilities |
| logger | 9 | Logging functionality |
| errors | 20 | Error classes and handlers |
| validation | 26 | Schema validation |
| integration | 10 | Live service health |
| **Total** | **93** | |

### Writing Tests

```javascript
describe('featureName', () => {
    beforeEach(() => {
        // Setup
    });

    test('should do something', () => {
        expect(result).toBe(expected);
    });

    test('should handle errors', () => {
        expect(() => badCall()).toThrow(ErrorType);
    });
});
```

---

## Code Quality

### ESLint Configuration

Located in `.eslintrc.json`:

```json
{
    "env": { "node": true, "es2021": true },
    "extends": "eslint:recommended",
    "rules": {
        "semi": ["error", "always"],
        "quotes": ["warn", "single"],
        "indent": ["warn", 4],
        "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
        "prefer-const": "warn",
        "no-var": "warn"
    }
}
```

### Running Linter

```bash
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix issues
```

### Code Standards

From `STANDARDS.md`:

- 4-space indentation
- Single quotes for strings
- Semicolons required
- Prefer `const` over `let`
- No `var`
- Arrow functions for callbacks
- Async/await over promises

---

## Deployment

### Development Mode

```bash
# Start all services
start-all-servers.bat

# Or individual service
cd Admin/relay && npm run dev
```

### Production Mode (Windows Services)

Services managed via NSSM:

```bash
# Install as Windows service
nssm install HiveRelay "node" "C:\LLM-DevOSWE\Admin\relay\relay-service.js"
nssm set HiveRelay Start SERVICE_AUTO_START

# Control services
nssm start HiveRelay
nssm stop HiveRelay
nssm restart HiveRelay
```

### Health Monitoring

```bash
# Quick health check
npm run health

# Core services only
npm run health -- --core

# JSON output
npm run health -- --json
```

---

## AI Integration

### Local LLMs

**Ollama (port 11434):**
- Primary: `qwen3-coder:latest` (34 tok/s)
- Fast: `qwen2.5-coder:7b` (172 tok/s)

**LM Studio (port 1234):**
- Primary: `qwen2.5-coder-14b-instruct`
- Backup models available

### AI Personas

| Persona | Backend | Role |
|---------|---------|------|
| **Kitt** | Ollama/Relay | Local assistant |
| **Nova** | LM Studio | Coding specialist |
| **Iris** | Remote LM Studio | Fallback AI |
| **Heather** | TTS Voice | Voice persona |

### Claude Code Integration

- Direct terminal interaction (free with subscription)
- Relay polling for remote access
- Task handoff via `/api/queue`

---

## File Structure

```
LLM-DevOSWE/
├── Admin/                    # Services
│   ├── relay/               # Message broker
│   ├── agent/               # KittBox
│   ├── orchestrator/        # Master O
│   ├── hive-mind/           # Activity monitor
│   ├── hive-brain/          # Device management
│   ├── hive-oracle/         # Distributed LLM
│   └── ...
├── shared/                   # Shared modules
│   ├── index.js             # Central export
│   ├── constants.js         # Configuration
│   ├── health.js            # Health utilities
│   ├── logger.js            # Logging
│   ├── errors.js            # Error classes
│   └── validation.js        # Validation
├── scripts/                  # CLI tools
│   └── health-check.js      # Health checker
├── tests/                    # Test suites
│   ├── setup.js
│   ├── unit/
│   └── integration/
├── .eslintrc.json           # Linter config
├── jest.config.js           # Test config
├── package.json             # Dependencies
├── CLAUDE.md                # AI context
├── STANDARDS.md             # Coding standards
├── DEPLOYMENT.md            # Deployment guide
└── TECH-STACK.md            # This document
```

---

## Quick Reference

### NPM Scripts (Root)

| Script | Command | Purpose |
|--------|---------|---------|
| `start` | `npm start` | Start relay service |
| `test` | `npm test` | Run all tests |
| `test:watch` | `npm run test:watch` | Watch mode |
| `lint` | `npm run lint` | Check code style |
| `lint:fix` | `npm run lint:fix` | Auto-fix issues |
| `health` | `npm run health` | Check services |

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `LOG_LEVEL` | `info` | Logging verbosity |
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | varies | Service port override |

### Useful Commands

```bash
# Check service status
curl http://localhost:8600/api/health

# List relay consumers
curl http://localhost:8600/api/consumers

# Queue a task
curl -X POST http://localhost:8600/api/queue \
  -H "Content-Type: application/json" \
  -d '{"task": "Do something", "source": "cli"}'
```

---

*Document generated as part of Phase 2: Code Quality improvements.*
