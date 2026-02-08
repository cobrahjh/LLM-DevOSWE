# Testing Standards - Hive Ecosystem

Universal testing patterns and automation for all Hive projects, based on SimGlass implementation.

## Overview

Every Hive project should have **four layers of testing**:

1. **Unit Tests** - Core functionality validation
2. **Integration Tests** - Cross-component communication
3. **Functional Tests** - UI/UX interactions (Playwright)
4. **Performance Tests** - Bundle size & load time regression tracking

## Standard Test Infrastructure

### Required Files

```
project/
├── tests/
│   ├── test-runner.js          # Main test suite
│   ├── functional-tests.js     # Playwright UI tests
│   ├── performance-regression.js # Performance tracking
│   ├── performance-baseline.json # Baseline metrics
│   ├── README.md               # Test documentation
│   └── package.json            # Test dependencies
├── .git/hooks/
│   └── pre-commit              # Auto-run tests before commit
└── .github/workflows/
    └── tests.yml               # CI/CD automation
```

### Installation Script

```bash
# tests/setup-testing.sh
#!/bin/bash

# Install test dependencies
npm install --save-dev playwright @playwright/test

# Create test structure
mkdir -p tests
cp ~/templates/test-runner.js tests/
cp ~/templates/functional-tests.js tests/
cp ~/templates/performance-regression.js tests/

# Setup git hooks
cp ~/templates/pre-commit .git/hooks/
chmod +x .git/hooks/pre-commit

# Setup GitHub Actions
mkdir -p .github/workflows
cp ~/templates/ci-tests.yml .github/workflows/

# Set performance baseline
node tests/performance-regression.js baseline

echo "✅ Testing infrastructure installed!"
```

## Test Runner Pattern

### Core Structure (test-runner.js)

```javascript
const http = require('http');
const API_BASE = 'http://localhost:PORT';
let passed = 0, failed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
        log(`  ✓ ${message}`, 'green');
    } else {
        failed++;
        log(`  ✗ ${message}`, 'red');
    }
}

async function testAPI() {
    // Test API endpoints
    const res = await fetch(`${API_BASE}/api/status`);
    assert(res.ok, 'API /status returns 200');
}

async function testComponents() {
    // Test components/widgets/modules
}

async function runTests(suite) {
    // Check server running
    // Run selected test suites
    // Report summary
    // Exit with code (0 = pass, 1 = fail)
}
```

### Customization Per Project

**Web App** (like SimGlass):
- Test widget accessibility
- Test shared resources
- Test cross-component communication

**API Service** (like Oracle):
- Test all endpoints
- Test authentication
- Test rate limiting
- Test error responses

**Desktop App** (like KittBox):
- Test window creation
- Test IPC communication
- Test file operations

**Background Service** (like Relay):
- Test database operations
- Test message queue
- Test scheduled tasks

## Functional Testing Pattern

### Playwright Setup

```javascript
// tests/functional-tests.js
const { chromium } = require('playwright');

async function testUserFlow() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Navigate
    await page.goto('http://localhost:PORT/app');

    // Interact
    await page.click('#submit-button');
    await page.fill('#input-field', 'test value');

    // Assert
    const result = await page.textContent('#result');
    assert(result === 'expected', 'User flow produces correct result');

    await browser.close();
}
```

### What to Test

**Critical user journeys**:
- Login/logout flow
- Primary feature usage
- Form submissions
- Navigation between views
- Error handling (bad inputs)

**Widget-specific** (SimGlass pattern):
- Mode switching (triggers lazy loads)
- Aircraft/item selection (triggers data loads)
- Settings changes (persistence)
- Real-time updates (WebSocket data)

**Don't test**:
- Every single button (too brittle)
- Visual styling (use screenshot tests instead)
- Third-party library internals

## Performance Regression Pattern

### Metrics to Track

```javascript
{
  "timestamp": "2026-02-07T21:42:50.000Z",
  "bundles": {
    "main.js": { "size": 45000, "target": 50000 },
    "vendor.js": { "size": 120000, "target": 150000 }
  },
  "loadTimes": {
    "homePage": { "loadTime": 450 },
    "dashboard": { "loadTime": 320 }
  },
  "memory": {
    "idle": { "heapUsed": 15000000 },
    "active": { "heapUsed": 28000000 }
  }
}
```

### Thresholds

**Bundle size**: >10% increase = regression
**Load time**: >50ms AND >50% increase = regression
**Memory**: >20% increase = regression

**Why dual thresholds**: Prevents false positives from timing variance (0ms→1ms)

### Baseline Management

```bash
# Set baseline after optimization
npm run baseline

# Check for regressions
npm run test:performance

# Update baseline after intentional changes
npm run baseline
git add tests/performance-baseline.json
git commit -m "chore: Update performance baseline"
```

## Pre-Commit Hook Pattern

### Standard Hook

```bash
#!/bin/sh
# Run tests before commit

echo "🧪 Running test suite..."
npm test

if [ $? -ne 0 ]; then
    echo "❌ Tests failed! Commit blocked."
    echo "   Fix tests or use --no-verify to skip"
    exit 1
fi

echo "✅ Tests passed!"
exit 0
```

### Fast vs Complete

```bash
# Fast mode (for rapid iteration)
if [ "$SKIP_SLOW_TESTS" = "1" ]; then
    npm test  # Unit tests only (~1s)
else
    npm run test:all  # All tests (~10s)
fi
```

**Usage**:
```bash
# Normal commit (runs all tests)
git commit -m "message"

# Skip tests (careful!)
git commit -m "message" --no-verify

# Fast tests only
SKIP_SLOW_TESTS=1 git commit -m "message"
```

## GitHub Actions Pattern

### Standard Workflow

```yaml
name: Tests

on:
  push:
    branches: [ master ]
  pull_request:
    branches: [ master ]

jobs:
  test:
    runs-on: $OS  # windows-latest, ubuntu-latest, macos-latest

    steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-node@v4
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm ci

    - name: Start server (if needed)
      run: |
        npm start &
        sleep 5

    - name: Run tests
      run: npm test

    - name: Run functional tests
      run: npm run test:functional

    - name: Check performance
      run: npm run test:performance
```

### Multi-Service Testing

For projects with multiple services:

```yaml
jobs:
  test-frontend:
    runs-on: ubuntu-latest
    steps: [test frontend]

  test-backend:
    runs-on: ubuntu-latest
    steps: [test backend]

  test-integration:
    runs-on: ubuntu-latest
    needs: [test-frontend, test-backend]
    steps: [test services together]
```

## NPM Scripts Standard

### Required Scripts

```json
{
  "scripts": {
    "test": "node tests/test-runner.js",
    "test:functional": "node tests/functional-tests.js",
    "test:performance": "node tests/performance-regression.js",
    "test:all": "npm test && npm run test:functional && npm run test:performance",
    "baseline": "node tests/performance-regression.js baseline"
  }
}
```

### Optional Scripts

```json
{
  "test:unit": "node tests/test-runner.js unit",
  "test:integration": "node tests/test-runner.js integration",
  "test:watch": "nodemon --exec 'npm test'",
  "test:coverage": "c8 npm test",
  "test:debug": "node --inspect-brk tests/test-runner.js"
}
```

## Applying to Existing Projects

### Step 1: Install Test Runner

```bash
cd project/
mkdir -p tests
cp ~/templates/test-runner-template.js tests/test-runner.js
# Edit to match your project's APIs
```

### Step 2: Write Initial Tests

**Minimum viable tests**:
- Server responds (GET /api/status or equivalent)
- Core functionality works (1-2 critical paths)
- No JavaScript errors on page load

**Example - Oracle (LLM backend)**:
```javascript
async function testOracle() {
    // Test health endpoint
    const health = await fetch('http://localhost:3002/api/health');
    assert(health.ok, 'Oracle health check passes');

    // Test LLM completion
    const completion = await fetch('http://localhost:3002/api/complete', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test' })
    });
    assert(completion.ok, 'Oracle completes prompts');
}
```

### Step 3: Add Playwright Tests

```bash
npm install --save-dev playwright
cp ~/templates/functional-tests-template.js tests/functional-tests.js
# Customize for your UI flows
```

### Step 4: Add Performance Tracking

```bash
cp ~/templates/performance-regression.js tests/
node tests/performance-regression.js baseline
```

### Step 5: Setup Automation

```bash
# Git hook
cp ~/templates/pre-commit .git/hooks/
chmod +x .git/hooks/pre-commit

# GitHub Actions
mkdir -p .github/workflows
cp ~/templates/ci-tests.yml .github/workflows/
# Edit to match your project's start command
```

### Step 6: Document

```bash
cp ~/templates/tests-README.md tests/README.md
# Update with project-specific test details
```

## Per-Project Checklist

For each Hive project:

- [ ] test-runner.js with core tests (minimum 5 tests)
- [ ] functional-tests.js for critical user flows (minimum 2 flows)
- [ ] performance-regression.js with baseline
- [ ] Pre-commit hook installed and working
- [ ] GitHub Actions workflow committed
- [ ] NPM scripts configured (test, test:functional, test:performance)
- [ ] tests/README.md with project-specific docs
- [ ] All tests passing (100% pass rate)

## Current Hive Project Status

### SimGlass (C:\LLM-DevOSWE\simwidget-hybrid)
- ✅ 106 core tests
- ✅ 27 code splitting tests
- ✅ Functional tests (Playwright)
- ✅ Performance regression tracking
- ✅ Pre-commit hook active
- ✅ GitHub Actions configured
- **Status**: ⭐⭐⭐⭐⭐ Gold Standard

### Oracle (C:\LLM-Oracle)
- ⚠️ Basic health checks only
- ❌ No functional tests
- ❌ No performance tracking
- ❌ No automation
- **Status**: Needs testing infrastructure

### Relay (Admin/relay)
- ⚠️ Database tests only
- ❌ No functional tests
- ❌ No automation
- **Status**: Needs expansion

### KittBox (kittbox-modules)
- ❌ No automated tests
- **Status**: Needs complete test suite

### Orchestrator (Admin/orchestrator)
- ⚠️ Service health checks
- ❌ No automated tests
- **Status**: Needs test suite

## Migration Plan for Existing Projects

### Phase 1: Core Tests (Week 1)
**Projects**: Oracle, Relay, KittBox, Orchestrator

**Actions**:
1. Create tests/ directory
2. Copy test-runner.js template
3. Write 5-10 core tests per project
4. Setup NPM scripts
5. Verify tests pass

**Goal**: Every project has basic validation

### Phase 2: Automation (Week 2)
**Projects**: All from Phase 1

**Actions**:
1. Install pre-commit hooks
2. Create GitHub Actions workflows
3. Configure per project (ports, start commands)
4. Test automation works

**Goal**: Every commit is validated

### Phase 3: Functional Tests (Week 3)
**Projects**: Oracle (API flows), KittBox (UI flows)

**Actions**:
1. Install Playwright
2. Write critical user flow tests
3. Add to CI/CD pipeline

**Goal**: UI interactions validated

### Phase 4: Performance Tracking (Week 4)
**Projects**: All

**Actions**:
1. Set performance baselines
2. Add regression tests
3. Monitor bundle sizes
4. Track load times

**Goal**: Performance degradation prevented

## Template Repository

### Location
`C:\LLM-DevOSWE\templates\testing-infrastructure\`

### Contents
```
testing-infrastructure/
├── test-runner-template.js       # Customizable test framework
├── functional-tests-template.js  # Playwright UI tests
├── performance-regression.js     # Performance tracking
├── pre-commit                    # Git hook
├── ci-workflow-template.yml      # GitHub Actions
├── package.json                  # Test dependencies
└── README.md                     # Setup instructions
```

### Usage

```bash
# For new project
cd new-project/
cp -r ~/templates/testing-infrastructure/* .
npm install
# Customize test-runner.js for your APIs
# Set baseline: npm run baseline
# Commit: git add . && git commit -m "test: Add test infrastructure"
```

## Key Metrics to Track

### Universal Metrics (All Projects)
- ✅ API response time (<200ms typical)
- ✅ Error rate (<0.1%)
- ✅ Memory usage (baseline ±20%)
- ✅ Test execution time (<5s unit, <60s full)

### Web Projects (SimGlass, KittBox UI)
- ✅ Bundle sizes (per widget/component)
- ✅ Page load time (<3s)
- ✅ Time to Interactive (<5s)
- ✅ First Contentful Paint (<1.5s)

### Backend Services (Oracle, Relay)
- ✅ Throughput (requests/second)
- ✅ Latency (p50, p95, p99)
- ✅ Database query time
- ✅ WebSocket connection count

### Desktop Apps (KittBox)
- ✅ Startup time (<2s)
- ✅ Memory footprint (<200MB idle)
- ✅ CPU usage (<5% idle)
- ✅ Disk I/O (read/write speeds)

## Success Criteria

### Project is "Test Ready" When:
- [ ] ≥10 automated tests
- [ ] 100% pass rate
- [ ] Pre-commit hook active
- [ ] GitHub Actions configured
- [ ] Performance baseline set
- [ ] Documentation complete
- [ ] All tests run in <60s

### Project is "Gold Standard" When:
- [ ] ≥50 automated tests
- [ ] Functional tests cover critical flows
- [ ] Performance regression tracking active
- [ ] <1% flaky tests
- [ ] <5s test execution (unit tests)
- [ ] CI/CD with automatic deployment
- [ ] Test coverage reports

## SimGlass as Reference Implementation

### What SimGlass Got Right

1. **Comprehensive Coverage**: 106 tests across 4 categories
2. **Fast Execution**: 0.44s for 106 tests (optimized)
3. **Smart Automation**: Pre-commit catches issues early
4. **Performance Focus**: Bundle size enforcement prevents bloat
5. **Code Splitting Tests**: Validates architecture, not just accessibility
6. **Clear Output**: Color-coded, actionable failure messages

### Patterns to Replicate

**From SimGlass test-runner.js**:
- Suite filtering (run specific test groups)
- Color-coded output (easy to scan)
- Timing measurements (track slow tests)
- Server health check before tests
- Clear error messages

**From SimGlass functional-tests.js**:
- Headless browser (fast, no UI needed)
- Async/await patterns (clean code)
- Setup/teardown (browser lifecycle)
- Real user interactions (clicks, forms)

**From SimGlass performance-regression.js**:
- Baseline comparison (not absolute values)
- Dual thresholds (absolute + relative)
- Bundle budget enforcement
- Automatic regression detection

## Rollout Strategy

### Immediate (This Week)
1. ✅ SimGlass - Complete (gold standard reference)
2. 🔄 Create template repository with reusable files
3. 🔄 Document in SERVICE-REGISTRY.md which services have tests

### Short-Term (Next 2 Weeks)
1. Oracle - Add API endpoint tests + performance tracking
2. Relay - Add database operation tests
3. KittBox - Add UI functional tests
4. Orchestrator - Add service management tests

### Long-Term (Next Month)
1. All 16 Hive services have test suites
2. All GitHub repos have CI/CD
3. Dashboard shows test status for all services
4. Weekly test coverage reports

## Measuring Success

### Team Metrics
- **Test Coverage**: % of projects with ≥10 tests
- **Automation Rate**: % of projects with pre-commit hooks
- **CI/CD Adoption**: % of repos with GitHub Actions
- **Regression Prevention**: # of bugs caught by tests

### Quality Metrics
- **Bug Escape Rate**: % of bugs not caught by tests
- **Test Reliability**: % of flaky tests
- **Test Speed**: Average execution time
- **Coverage**: % of code with tests

### Target (End of Month)
- 100% of Hive projects have ≥10 tests
- 100% have pre-commit hooks
- 80% have functional tests
- 100% have performance baselines
- 0 test-related deployment failures

## Example Implementations

### Oracle Testing

```javascript
// tests/test-runner.js
async function testOracleAPI() {
    // POST /api/project/create
    const create = await fetch('http://localhost:3002/api/project/create', {
        method: 'POST',
        body: JSON.stringify({ name: 'test-project' })
    });
    assert(create.ok, 'Project creation works');

    // GET /api/project/list
    const list = await fetch('http://localhost:3002/api/project/list');
    const projects = await list.json();
    assert(projects.length > 0, 'Project list returns data');
}
```

### Relay Testing

```javascript
// tests/test-runner.js
async function testRelay() {
    // POST /api/task/create
    const task = await fetch('http://localhost:8600/api/task/create', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test task', priority: 'high' })
    });
    assert(task.ok, 'Task creation works');

    // GET /api/tasks
    const tasks = await fetch('http://localhost:8600/api/tasks');
    const data = await tasks.json();
    assert(Array.isArray(data), 'Tasks endpoint returns array');
}
```

### KittBox Testing

```javascript
// tests/functional-tests.js (Playwright)
async function testKittBoxUI() {
    await page.goto('http://localhost:8585');

    // Test command input
    await page.fill('#command-input', 'test command');
    await page.click('#submit-btn');

    // Verify result
    const result = await page.textContent('#output');
    assert(result.includes('success'), 'Command executes');
}
```

## Maintenance

### Weekly
- Review test failures in CI/CD
- Update baselines after intentional optimizations
- Fix flaky tests (>5% failure rate)

### Monthly
- Review test coverage (add tests for new features)
- Update Playwright version
- Check test execution time (should stay <60s)

### Quarterly
- Audit all project test suites
- Update testing standards based on learnings
- Share best practices across team

## Benefits Realized

### From SimGlass Implementation

**Before Testing**:
- Manual verification required
- Breaking changes deployed
- Performance degradation unnoticed
- Time wasted on broken commits

**After Testing**:
- ✅ Automated validation (106 tests, 0.44s)
- ✅ Pre-commit catches breaks before commit
- ✅ Bundle size enforced (78% optimization verified)
- ✅ Confidence in deployments

**Time Saved**:
- ~5 min per commit (manual testing eliminated)
- ~30 min per day (across team)
- ~10 hours per month
- **ROI**: Test setup (4 hours) pays off in Week 1

## Conclusion

**Testing is now a Hive standard**. Every project gets:
1. Automated test suite
2. Pre-commit validation
3. CI/CD pipeline
4. Performance tracking

**SimGlass serves as the reference implementation** for all future projects.

**Next steps**: Apply this pattern to Oracle, Relay, KittBox, and all 16 Hive services.
