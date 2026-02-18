/**
 * Deploy navdata UI files to COMMANDER-PC
 */
const {spawnSync} = require('child_process');
const path = require('path');

const SSH_OPTS = ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-i', 'C:/Users/Stone-PC/.ssh/id_ed25519'];
const HOST = 'hjhar@192.168.1.42';
const REMOTE_BASE = 'C:/LLM-DevOSWE/simwidget-hybrid';
const LOCAL_BASE = path.resolve(__dirname, '..');

const FILES = [
    'backend/navdata-api.js',
    'ui/gtn750/index.html',
    'ui/gtn750/pages/page-system.js',
    'ui/gtn750/styles.css',
];

function scp(src, dst) {
    const filename = src.split('/').pop();
    process.stdout.write('  ' + filename + '... ');
    const r = spawnSync('scp', [...SSH_OPTS, src, HOST + ':' + dst], {encoding: 'utf8', timeout: 30000});
    const err = (r.stderr || '').replace(/\*\* WARNING[\s\S]*?pq\.html\r?\n/g, '').trim();
    if (r.status !== 0) { console.log('FAIL: ' + err.slice(0, 100)); return false; }
    console.log('OK');
    return true;
}

function ssh(cmd) {
    const r = spawnSync('ssh', [...SSH_OPTS, HOST, cmd], {encoding: 'utf8', timeout: 15000});
    return (r.stdout || '').trim();
}

let ok = 0, fail = 0;
console.log('Deploying navdata UI to COMMANDER-PC...');

for (const f of FILES) {
    const src = path.join(LOCAL_BASE, f).replace(/\\/g, '/');
    const dst = REMOTE_BASE + '/' + f;
    if (scp(src, dst)) ok++; else fail++;
}

console.log('\nResult: ' + ok + ' deployed, ' + fail + ' failed');

if (fail === 0) {
    // Verify /api/navdb/status returns airac_expiry
    console.log('\nVerifying navdb API...');
    const v = ssh('node -e "const h=require(\'http\');h.get(\'http://localhost:8080/api/navdb/status\',r=>{let d=\'\';r.on(\'data\',c=>d+=c);r.on(\'end\',()=>{try{const j=JSON.parse(d);console.log(\'cycle:\'+j.airac_cycle,\'expiry:\'+j.airac_expiry)}catch(e){console.log(\'parse err:\'+d.slice(0,100))}})}).on(\'error\',e=>console.log(\'err:\'+e.message))"');
    console.log('NavDB status:', v || '(no response — server may need restart)');
}
