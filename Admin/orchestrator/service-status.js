/**
 * Master (O) Service Status Check
 * v1.0.0 - 2026-01-09
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\Admin\orchestrator\service-status.js
 */

const { exec } = require('child_process');

console.log('');
console.log('╔════════════════════════════════════════╗');
console.log('║  SimWidget Master (O) Service Status   ║');
console.log('╚════════════════════════════════════════╝');
console.log('');

exec('sc query "SimWidget Master O"', (err, stdout, stderr) => {
    if (err) {
        console.log('Status: ❌ NOT INSTALLED as Windows Service');
        console.log('');
        console.log('To install: Run as Admin: node service-install.js');
        return;
    }
    
    const lines = stdout.split('\n');
    let state = 'UNKNOWN';
    
    for (const line of lines) {
        if (line.includes('STATE')) {
            if (line.includes('RUNNING')) state = '🟢 RUNNING';
            else if (line.includes('STOPPED')) state = '🔴 STOPPED';
            else if (line.includes('PENDING')) state = '🟡 PENDING';
        }
    }
    
    console.log('Service: SimWidget Master O');
    console.log(`Status:  ${state}`);
    console.log('Port:    8500');
    console.log('');
    console.log('Commands:');
    console.log('  Start:  net start "SimWidget Master O"');
    console.log('  Stop:   net stop "SimWidget Master O"');
    console.log('  Remove: node service-uninstall.js');
});
