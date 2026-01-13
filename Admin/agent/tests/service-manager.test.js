/**
 * Service Manager Tests v1.0.0
 * Last Updated: 2026-01-09
 * 
 * Automated tests for ServiceManager functionality
 * Run: node tests/service-manager.test.js
 */

const { ServiceManager, SERVICES } = require('../service-manager');
const http = require('http');

// Test results
const results = {
    passed: 0,
    failed: 0,
    tests: []
};

// Test helpers
function log(msg, type = 'info') {
    const colors = { pass: '\x1b[32m', fail: '\x1b[31m', info: '\x1b[36m', reset: '\x1b[0m' };
    console.log(`${colors[type]}${msg}${colors.reset}`);
}

function assert(condition, testName, details = '') {
    if (condition) {
        results.passed++;
        results.tests.push({ name: testName, passed: true });
        log(`  ✓ ${testName}`, 'pass');
    } else {
        results.failed++;
        results.tests.push({ name: testName, passed: false, details });
        log(`  ✗ ${testName}: ${details}`, 'fail');
    }
}

async function checkPort(port) {
    return new Promise((resolve) => {
        const req = http.request({ host: 'localhost', port, timeout: 2000 }, (res) => {
            resolve(true);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
        req.end();
    });
}

// ==================== TESTS ====================

async function testServiceDefinitions() {
    log('\n📋 Testing Service Definitions...');
    
    assert(SERVICES.agent !== undefined, 'Agent service defined');
    assert(SERVICES.simwidget !== undefined, 'SimWidget service defined');
    assert(SERVICES.remote !== undefined, 'Remote service defined');
    
    assert(SERVICES.agent.port === 8585, 'Agent port correct', `Got ${SERVICES.agent.port}`);
    assert(SERVICES.simwidget.port === 8080, 'SimWidget port correct', `Got ${SERVICES.simwidget.port}`);
    assert(SERVICES.remote.port === 8590, 'Remote port correct', `Got ${SERVICES.remote.port}`);
    
    for (const [name, svc] of Object.entries(SERVICES)) {
        assert(svc.name !== undefined, `${name} has Windows service name`);
        assert(svc.displayName !== undefined, `${name} has display name`);
        assert(svc.script !== undefined, `${name} has script path`);
    }
}

async function testServiceManager() {
    log('\n🔧 Testing ServiceManager Class...');
    
    const sm = new ServiceManager();
    
    assert(sm !== undefined, 'ServiceManager instantiates');
    assert(typeof sm.getMode === 'function', 'getMode method exists');
    assert(typeof sm.setMode === 'function', 'setMode method exists');
    assert(typeof sm.start === 'function', 'start method exists');
    assert(typeof sm.stop === 'function', 'stop method exists');
    assert(typeof sm.restart === 'function', 'restart method exists');
    assert(typeof sm.status === 'function', 'status method exists');
    assert(typeof sm.statusAll === 'function', 'statusAll method exists');
}

async function testModeManagement() {
    log('\n⚙️ Testing Mode Management...');
    
    const sm = new ServiceManager();
    const originalMode = sm.getMode();
    
    assert(['dev', 'service'].includes(originalMode), 'Mode is valid', `Got ${originalMode}`);
    
    // Test mode switching
    sm.setMode('dev');
    assert(sm.getMode() === 'dev', 'Can set dev mode');
    
    sm.setMode('service');
    assert(sm.getMode() === 'service', 'Can set service mode');
    
    // Test invalid mode
    const invalidResult = sm.setMode('invalid');
    assert(invalidResult === false, 'Rejects invalid mode');
    
    // Restore original mode
    sm.setMode(originalMode);
}

async function testStatusChecks() {
    log('\n📊 Testing Status Checks...');
    
    const sm = new ServiceManager();
    
    // Test individual status
    const agentStatus = await sm.status('agent');
    assert(agentStatus !== undefined, 'Agent status returns');
    assert(typeof agentStatus.online === 'boolean', 'Status has online flag');
    assert(agentStatus.port === 8585, 'Status includes port');
    
    // Test unknown service
    const unknownStatus = await sm.status('nonexistent');
    assert(unknownStatus.error !== undefined, 'Unknown service returns error');
    
    // Test status all
    const allStatus = await sm.statusAll();
    assert(Object.keys(allStatus).length === 3, 'StatusAll returns 3 services');
}

async function testPortUtilities() {
    log('\n🔌 Testing Port Utilities...');
    
    const sm = new ServiceManager();
    
    // Check if agent port is in use (should be running)
    const agentPortInUse = await sm.checkPort(8585);
    log(`    Agent port (8585) in use: ${agentPortInUse}`, 'info');
    
    // Check unused port
    const unusedPort = await sm.checkPort(59999);
    assert(unusedPort === false, 'Detects unused port');
}

async function testDevModeOperations() {
    log('\n🛠️ Testing Dev Mode Operations...');
    
    const sm = new ServiceManager();
    sm.setMode('dev');
    
    // Test status in dev mode
    const status = await sm.status('agent');
    assert(status.mode === 'dev', 'Status reports dev mode');
    
    // Note: Actually starting/stopping services would disrupt current testing
    // Just verify the methods exist and return proper structure
    assert(typeof sm.startDev === 'function', 'startDev method exists');
    assert(typeof sm.stopDev === 'function', 'stopDev method exists');
    assert(typeof sm.restartDev === 'function', 'restartDev method exists');
}

async function testServiceModeOperations() {
    log('\n🪟 Testing Service Mode Operations...');
    
    const sm = new ServiceManager();
    
    // Just verify methods exist - don't actually install services
    assert(typeof sm.installService === 'function', 'installService method exists');
    assert(typeof sm.uninstallService === 'function', 'uninstallService method exists');
    assert(typeof sm.startService === 'function', 'startService method exists');
    assert(typeof sm.stopService === 'function', 'stopService method exists');
    assert(typeof sm.restartService === 'function', 'restartService method exists');
    assert(typeof sm.getServiceStatus === 'function', 'getServiceStatus method exists');
    
    // Test service status check (won't fail even if service doesn't exist)
    const svcStatus = await sm.getServiceStatus('agent');
    assert(svcStatus.status !== undefined, 'Service status returns status field');
}

async function testBatchOperations() {
    log('\n📦 Testing Batch Operations...');
    
    const sm = new ServiceManager();
    
    assert(typeof sm.installAll === 'function', 'installAll method exists');
    assert(typeof sm.uninstallAll === 'function', 'uninstallAll method exists');
    assert(typeof sm.startAll === 'function', 'startAll method exists');
    assert(typeof sm.stopAll === 'function', 'stopAll method exists');
}

async function testAPIEndpoints() {
    log('\n🌐 Testing API Endpoints...');
    
    const baseUrl = 'http://localhost:8585';
    
    // Test /api/services endpoint
    try {
        const res = await fetch(`${baseUrl}/api/services`);
        const data = await res.json();
        
        assert(res.ok, 'GET /api/services returns 200');
        assert(data.mode !== undefined, 'Response includes mode');
        assert(data.services !== undefined, 'Response includes services');
        assert(data.definitions !== undefined, 'Response includes definitions');
    } catch (err) {
        assert(false, 'GET /api/services accessible', err.message);
    }
    
    // Test /api/services/:name endpoint
    try {
        const res = await fetch(`${baseUrl}/api/services/agent`);
        const data = await res.json();
        
        assert(res.ok, 'GET /api/services/agent returns 200');
        assert(typeof data.online === 'boolean', 'Response includes online status');
    } catch (err) {
        assert(false, 'GET /api/services/agent accessible', err.message);
    }
}

// ==================== RUN TESTS ====================

async function runTests() {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║          Service Manager Test Suite v1.0.0            ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    
    const startTime = Date.now();
    
    try {
        await testServiceDefinitions();
        await testServiceManager();
        await testModeManagement();
        await testStatusChecks();
        await testPortUtilities();
        await testDevModeOperations();
        await testServiceModeOperations();
        await testBatchOperations();
        await testAPIEndpoints();
    } catch (err) {
        log(`\n❌ Test suite error: ${err.message}`, 'fail');
    }
    
    const duration = Date.now() - startTime;
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`Total: ${results.passed + results.failed} | ` +
                `Passed: ${results.passed} | ` +
                `Failed: ${results.failed} | ` +
                `Time: ${duration}ms`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Output JSON for automated parsing
    const output = {
        suite: 'service-manager',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        duration,
        summary: {
            total: results.passed + results.failed,
            passed: results.passed,
            failed: results.failed,
            passRate: Math.round((results.passed / (results.passed + results.failed)) * 100)
        },
        tests: results.tests
    };
    
    console.log('JSON Output:');
    console.log(JSON.stringify(output, null, 2));
    
    process.exit(results.failed > 0 ? 1 : 0);
}

runTests();
