/**
 * Deploy updated files to COMMANDER-PC C:\LLM-DevOSWE\simwidget-hybrid
 */
const {spawnSync} = require('child_process');
const path = require('path');

const SSH_OPTS = ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-i', 'C:/Users/Stone-PC/.ssh/id_ed25519'];
const HOST = 'hjhar@192.168.1.42';
const REMOTE_BASE = 'C:/LLM-DevOSWE/simwidget-hybrid';
const LOCAL_BASE = path.resolve(__dirname, '..');

const FILES = [
    'ui/ai-autopilot/modules/rule-engine-core.js',
    'ui/ai-autopilot/pane.js',
    'ui/ai-autopilot/browser-console-test.js',
    'backend/ai-pilot-api.js',
];

function scp(src, dst) {
    const filename = src.split('/').pop();
    process.stdout.write('  Copying ' + filename + '... ');
    const r = spawnSync('scp', [...SSH_OPTS, src, HOST + ':' + dst], {encoding: 'utf8', timeout: 30000});
    const err = (r.stderr || '').replace(/\*\* WARNING[\s\S]*?pq\.html\r?\n/g, '').trim();
    if (r.status !== 0) { console.log('❌ ' + err.slice(0, 100)); return false; }
    console.log('✅');
    return true;
}

function ssh(cmd) {
    const r = spawnSync('ssh', [...SSH_OPTS, HOST, cmd], {encoding: 'utf8', timeout: 15000});
    return (r.stdout || '').trim();
}

let ok = 0, fail = 0;
console.log('Deploying to COMMANDER-PC (192.168.1.42)');
console.log('Target: ' + REMOTE_BASE + '\n');

for (const f of FILES) {
    const src = path.join(LOCAL_BASE, f).replace(/\\/g, '/');
    const dst = REMOTE_BASE + '/' + f;
    if (scp(src, dst)) ok++; else fail++;
}

console.log('\nResult: ' + ok + ' deployed, ' + fail + ' failed');

if (fail === 0) {
    // Verify rule-engine-core has getNavGuidance
    const v = ssh('node -e "const fs=require(\'fs\');const c=fs.readFileSync(\'C:/LLM-DevOSWE/simwidget-hybrid/ui/ai-autopilot/modules/rule-engine-core.js\',\'utf8\');console.log(c.includes(\'getNavGuidance\')?\'✅ getNavGuidance present\':\'❌ MISSING\',\'size:\'+c.length)"');
    console.log('\nVerification:', v || '(no output)');

    // Restart the server to pick up changes
    console.log('\nRestarting simwidget server on COMMANDER-PC...');
    const pid = ssh('(Get-NetTCPConnection -LocalPort 8080 -State Listen -EA SilentlyContinue).OwningProcess');
    if (pid) {
        const kill = ssh('Stop-Process -Id ' + pid.trim() + ' -ErrorAction SilentlyContinue; Start-Sleep 1; echo "killed"');
        console.log('Killed PID ' + pid.trim() + ':', kill);
        // Restart via orchestrator or directly
        const restart = ssh('Start-Process -FilePath "node" -ArgumentList "C:/LLM-DevOSWE/simwidget-hybrid/backend/server.js" -WorkingDirectory "C:/LLM-DevOSWE/simwidget-hybrid/backend" -WindowStyle Hidden; echo "started"');
        console.log('Restart:', restart);
    } else {
        console.log('Port 8080 PID not found — server may need manual restart');
    }
}
