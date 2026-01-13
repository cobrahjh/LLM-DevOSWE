# SimWidget Test Framework
**Version:** 1.1.0  
**Last Updated:** 2025-01-08  
**Path:** `C:\LLM-DevOSWE\SimWidget_Engine\tests\README.md`

---

## Overview

Automated testing with **stored expected results** (fixtures) and **SQLite history database**.

## Quick Start

```bash
# Run all tests
node tests/test-runner.js

# Run with database recording
node tests/test-runner.js --db

# Update fixtures (save current results as expected)
node tests/test-runner.js --update

# Run specific category
node tests/test-runner.js plugins
node tests/test-runner.js templates
node tests/test-runner.js files
node tests/test-runner.js services
node tests/test-runner.js widgets
node tests/test-runner.js api
node tests/test-runner.js security
```

---

## Admin CLI

```bash
# Schedule Management
node tests/test-admin.js schedule list
node tests/test-admin.js schedule add <name> <cron|preset> [suites]
node tests/test-admin.js schedule enable <name>
node tests/test-admin.js schedule disable <name>
node tests/test-admin.js schedule delete <name>

# History & Reports
node tests/test-admin.js history [limit]
node tests/test-admin.js report <runId>
node tests/test-admin.js trends [days]
node tests/test-admin.js flaky [days]

# Maintenance
node tests/test-admin.js stats
node tests/test-admin.js archive
node tests/test-admin.js vacuum

# Windows Task Scheduler
node tests/test-admin.js install-task
node tests/test-admin.js uninstall-task
```

### Cron Presets

| Preset | Cron | Description |
|--------|------|-------------|
| `hourly` | `0 * * * *` | Every hour |
| `daily` | `0 8 * * *` | 8am daily |
| `twice-daily` | `0 8,20 * * *` | 8am and 8pm |
| `weekly` | `0 8 * * 1` | Monday 8am |

---

## Test Categories

| Category | Tests | Requires |
|----------|-------|----------|
| **plugins** | Manifest validation, discovery | Nothing |
| **templates** | Widget template files, structure, CSS/JS validation | Nothing |
| **files** | File inspection, type detection, binary scanning | Nothing |
| **services** | Lorby AAO, server connection | External services |
| **widgets** | UI endpoints load | Server running |
| **api** | REST endpoints respond correctly | Server running |
| **security** | File scanning, pattern detection | Nothing |

---

## Fixtures (Expected Results)

Fixtures are stored in `tests/fixtures/` as JSON files.

```
tests/fixtures/
├── plugins-discovery.json           # Expected plugin list
├── plugins-core-manifest.json       # Core plugin structure
├── plugins-manifests-valid.json     # Validation result
├── templates-directories-exist.json # Template folders
├── templates-shared-files.json      # Shared CSS/JS files
├── templates-required-files.json    # Required template files
├── templates-manifests-valid.json   # Template manifest validation
├── templates-html-structure.json    # HTML component structure
├── templates-css-variables.json     # CSS theme variables
├── templates-base-class-methods.json# JS base class methods
├── services-server-status.json      # Server response shape
├── services-lorby-connection.json
├── security-*.json                  # Security test fixtures
└── api-flight-data-structure.json
```

### Creating New Fixtures

1. Run with `--update` to save current results
2. Review the generated fixture
3. Commit to version control

```bash
node tests/test-runner.js --update
```

---

## Adding Tests

Edit `tests/test-runner.js`:

```javascript
await runTest('category', 'test-name', async () => {
    // Test logic here
    return {
        // Return object to compare against fixture
        someKey: someValue,
        anotherKey: anotherValue
    };
});
```

The return object is compared against `fixtures/category-test-name.json`.

---

## Results

Results are saved to `tests/results/` with timestamps:

```json
{
    "timestamp": "2025-01-08T12:00:00Z",
    "duration": 1234,
    "summary": {
        "passed": 10,
        "failed": 2,
        "skipped": 1
    },
    "tests": [...]
}
```

---

## CI Integration

```bash
# Exit code 0 = all passed, 1 = failures
node tests/test-runner.js && echo "Tests passed"
```

---

## Test Types

### Unit Tests (Offline)
- Plugin manifest validation
- Config parsing
- Utility functions

### Integration Tests (Requires Services)
- Lorby AAO connection
- SimConnect bridge
- API endpoints

### Smoke Tests (Server Running)
- Widget pages load
- WebSocket connects
- Commands execute

---

## Maintenance

When code changes break fixtures:

1. Review if change is intentional
2. Run `--update` to regenerate
3. Verify new fixture is correct
4. Commit updated fixture

---

## Cloud Sync (Supabase)

Cloud sync stores test results in Supabase for cross-device history and trends.

### Setup

1. Create a Supabase project at https://supabase.com
2. Create `.env.supabase`:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```
3. Run setup: `node tests/setup-supabase.js`
4. Copy SQL from output and run in Supabase SQL Editor

### Cloud Commands

```bash
# Run tests with automatic cloud sync
node tests/test-runner.js --cloud

# Manual sync of local results
node tests/test-admin.js cloud sync

# Check connection status
node tests/test-admin.js cloud status

# View cloud statistics
node tests/test-admin.js cloud stats

# List cloud runs
node tests/test-admin.js cloud runs

# Show all devices
node tests/test-admin.js cloud devices

# Show failure trends
node tests/test-admin.js cloud trends 7

# Cleanup old data (90 days)
node tests/test-admin.js cloud cleanup
```

### Files

| File | Purpose |
|------|---------|
| `.env.supabase` | Credentials (gitignored) |
| `tests/supabase-schema.sql` | Database schema |
| `tests/setup-supabase.js` | Setup/test script |
| `tests/lib/supabase-client.js` | Client library |
