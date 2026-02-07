#!/bin/bash
# Run all SimGlass tests
# Usage: ./run-all-tests.sh [fast|full]

MODE=${1:-fast}

echo "╔═══════════════════════════════════════════╗"
echo "║     SimGlass Test Suite Runner           ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# Check if server is running
echo "🔍 Checking server status..."
curl -s http://localhost:8080/api/status > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Server not running on localhost:8080"
    echo "   Start server with: node backend/server.js"
    exit 1
fi
echo "✅ Server is running"
echo ""

TOTAL_PASSED=0
TOTAL_FAILED=0

# Run GTN750 code splitting tests
if [ -f "tests/test-gtn750-code-splitting.js" ]; then
    echo "═══════════════════════════════════════════"
    echo "📦 GTN750 Code Splitting Tests"
    echo "═══════════════════════════════════════════"
    node tests/test-gtn750-code-splitting.js
    if [ $? -eq 0 ]; then
        ((TOTAL_PASSED++))
    else
        ((TOTAL_FAILED++))
    fi
    echo ""
fi

# Run full test suite if requested
if [ "$MODE" = "full" ]; then
    if [ -f "tests/test-runner.js" ]; then
        echo "═══════════════════════════════════════════"
        echo "🧪 Full Test Suite"
        echo "═══════════════════════════════════════════"
        node tests/test-runner.js
        if [ $? -eq 0 ]; then
            ((TOTAL_PASSED++))
        else
            ((TOTAL_FAILED++))
        fi
        echo ""
    fi
fi

# Summary
echo "═══════════════════════════════════════════"
echo "📊 Test Suite Summary"
echo "═══════════════════════════════════════════"
echo "  Test Suites Passed: $TOTAL_PASSED"
echo "  Test Suites Failed: $TOTAL_FAILED"
echo "═══════════════════════════════════════════"

if [ $TOTAL_FAILED -gt 0 ]; then
    echo ""
    echo "❌ Some test suites failed"
    exit 1
else
    echo ""
    echo "✅ All test suites passed!"
    exit 0
fi
