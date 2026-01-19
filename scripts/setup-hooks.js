#!/usr/bin/env node
/**
 * Setup Git Hooks
 *
 * Installs pre-commit hooks for linting and testing.
 * Run: node scripts/setup-hooks.js
 */

const fs = require('fs');
const path = require('path');

const HOOKS_DIR = path.join(__dirname, '..', '.git', 'hooks');
const PRE_COMMIT_HOOK = path.join(HOOKS_DIR, 'pre-commit');

const PRE_COMMIT_SCRIPT = `#!/bin/sh
#
# Pre-commit hook - Run lint and tests before commit
#

echo "Running pre-commit checks..."

# Run ESLint
echo "\\n[1/2] Running ESLint..."
npm run lint
LINT_EXIT=$?

if [ $LINT_EXIT -ne 0 ]; then
    echo "\\n❌ ESLint failed. Fix errors before committing."
    exit 1
fi

echo "✓ ESLint passed"

# Run unit tests
echo "\\n[2/2] Running unit tests..."
npm test -- --testPathPattern=unit --passWithNoTests
TEST_EXIT=$?

if [ $TEST_EXIT -ne 0 ]; then
    echo "\\n❌ Tests failed. Fix tests before committing."
    exit 1
fi

echo "✓ Tests passed"
echo "\\n✅ All pre-commit checks passed!"
`;

function setup() {
    console.log('Setting up Git hooks...\n');

    // Check if .git directory exists
    if (!fs.existsSync(path.join(__dirname, '..', '.git'))) {
        console.error('❌ Not a git repository. Run "git init" first.');
        process.exit(1);
    }

    // Create hooks directory if needed
    if (!fs.existsSync(HOOKS_DIR)) {
        fs.mkdirSync(HOOKS_DIR, { recursive: true });
    }

    // Write pre-commit hook
    fs.writeFileSync(PRE_COMMIT_HOOK, PRE_COMMIT_SCRIPT, { mode: 0o755 });
    console.log('✓ Created pre-commit hook');

    // Make executable (Unix)
    try {
        fs.chmodSync(PRE_COMMIT_HOOK, 0o755);
    } catch (e) {
        // Windows doesn't need chmod
    }

    console.log('\n✅ Git hooks installed successfully!');
    console.log('\nHooks will run automatically on git commit:');
    console.log('  - ESLint check');
    console.log('  - Unit tests');
}

setup();
