#!/usr/bin/env node
/**
 * DocSync Agent - Automated document sync with AI processing
 * Watches for doc changes, processes with tinyAI, syncs to Google Drive
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// Configuration
const CONFIG = {
    googleDrive: 'G:\\My Drive\\AI Development',
    projects: {
        'LLM-DevOSWE': {
            watchPaths: ['C:\\LLM-DevOSWE', 'C:\\LLM-DevOSWE\\docs', 'C:\\LLM-DevOSWE\\Admin\\tools'],
            patterns: ['*.md', '*.json', '*.bat', '*.ps1'],
            rootFiles: ['CLAUDE.md', 'STANDARDS.md', 'SERVICE-REGISTRY.md', 'PROJECT-INDEX.md', 'ARCHITECTURE.md', 'TODO.md']
        },
        'kittbox-web': {
            watchPaths: ['C:\\kittbox-web'],
            patterns: ['*.md', '*.json', '*.bat', '*.ps1']
        }
    },
    relay: {
        host: 'localhost',
        port: 8600
    },
    ollama: {
        host: 'localhost',
        port: 11434,
        model: 'qwen2.5-coder:7b'  // Fast model for summaries
    },
    pollInterval: 5000,  // 5 seconds
    enableAI: true
};

// State
const syncQueue = [];
const syncedFiles = new Map();  // Track last sync time
const STATE_FILE = path.join(__dirname, 'docsync-state.json');

// Load state
function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        for (const [file, time] of Object.entries(state.syncedFiles || {})) {
            syncedFiles.set(file, time);
        }
    }
}

function saveState() {
    const state = {
        syncedFiles: Object.fromEntries(syncedFiles),
        lastSave: new Date().toISOString()
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Logging
function log(level, msg, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = { info: '📄', warn: '⚠️', error: '❌', success: '✅', ai: '🤖' }[level] || '•';
    console.log(`${timestamp} ${prefix} ${msg}`);
    if (data) console.log('  ', data);
}

// Check if file needs sync
function needsSync(filePath) {
    if (!fs.existsSync(filePath)) return false;

    const stats = fs.statSync(filePath);
    const mtime = stats.mtime.getTime();
    const lastSync = syncedFiles.get(filePath) || 0;

    return mtime > lastSync;
}

// Get project for file
function getProjectForFile(filePath) {
    for (const [project, config] of Object.entries(CONFIG.projects)) {
        for (const watchPath of config.watchPaths) {
            if (filePath.toLowerCase().startsWith(watchPath.toLowerCase())) {
                return project;
            }
        }
    }
    return null;
}

// Match file against patterns
function matchesPattern(filePath, patterns) {
    const ext = path.extname(filePath).toLowerCase();
    return patterns.some(p => {
        if (p.startsWith('*')) {
            return ext === p.slice(1).toLowerCase();
        }
        return path.basename(filePath).toLowerCase() === p.toLowerCase();
    });
}

// Scan for changed files
function scanForChanges() {
    const changedFiles = [];

    for (const [project, config] of Object.entries(CONFIG.projects)) {
        for (const watchPath of config.watchPaths) {
            if (!fs.existsSync(watchPath)) continue;

            const scanDir = (dir) => {
                try {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry.name);
                        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                            scanDir(fullPath);
                        } else if (entry.isFile() && matchesPattern(fullPath, config.patterns)) {
                            if (needsSync(fullPath)) {
                                changedFiles.push({ project, filePath: fullPath });
                            }
                        }
                    }
                } catch (err) {
                    // Skip inaccessible directories
                }
            };

            scanDir(watchPath);
        }
    }

    return changedFiles;
}

// Call Ollama for AI processing
async function processWithAI(content, filePath) {
    if (!CONFIG.enableAI) return null;

    const prompt = `Summarize this document in 1-2 sentences. Just the summary, no preamble:

${content.slice(0, 2000)}`;

    return new Promise((resolve) => {
        const postData = JSON.stringify({
            model: CONFIG.ollama.model,
            prompt: prompt,
            stream: false
        });

        const req = http.request({
            hostname: CONFIG.ollama.host,
            port: CONFIG.ollama.port,
            path: '/api/generate',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 30000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result.response?.trim() || null);
                } catch {
                    resolve(null);
                }
            });
        });

        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.write(postData);
        req.end();
    });
}

// Sync file to Google Drive
async function syncFile(project, filePath) {
    const fileName = path.basename(filePath);
    const destDir = path.join(CONFIG.googleDrive, project);
    const destPath = path.join(destDir, fileName);

    try {
        // Ensure destination directory exists
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
            log('info', `Created directory: ${destDir}`);
        }

        // Read source file
        const content = fs.readFileSync(filePath, 'utf8');

        // Process with AI if enabled
        let summary = null;
        if (CONFIG.enableAI && filePath.endsWith('.md')) {
            log('ai', `Processing with AI: ${fileName}`);
            summary = await processWithAI(content, filePath);
            if (summary) {
                log('ai', `Summary: ${summary}`);
            }
        }

        // Copy file
        fs.copyFileSync(filePath, destPath);

        // Update sync time
        syncedFiles.set(filePath, Date.now());
        saveState();

        log('success', `Synced: ${fileName} → ${project}/`);

        // Post to relay for notification
        postToRelay({
            type: 'docsync',
            project,
            file: fileName,
            summary,
            timestamp: new Date().toISOString()
        });

        return true;
    } catch (err) {
        log('error', `Failed to sync ${fileName}: ${err.message}`);
        return false;
    }
}

// Post notification to relay
function postToRelay(data) {
    const postData = JSON.stringify(data);

    const req = http.request({
        hostname: CONFIG.relay.host,
        port: CONFIG.relay.port,
        path: '/api/docsync/log',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    }, () => {});

    req.on('error', () => {});  // Ignore relay errors
    req.write(postData);
    req.end();
}

// Main loop
async function runLoop() {
    log('info', 'Scanning for changes...');

    const changes = scanForChanges();

    if (changes.length === 0) {
        log('info', 'No changes detected');
        return;
    }

    log('info', `Found ${changes.length} file(s) to sync`);

    for (const { project, filePath } of changes) {
        await syncFile(project, filePath);
    }
}

// Start agent
async function main() {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  DocSync Agent - AI-Powered Document Sync');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Google Drive: ${CONFIG.googleDrive}`);
    console.log(`  AI Processing: ${CONFIG.enableAI ? 'Enabled' : 'Disabled'}`);
    console.log(`  Poll Interval: ${CONFIG.pollInterval / 1000}s`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    loadState();

    // Initial scan
    await runLoop();

    // Continuous polling
    if (process.argv.includes('--watch')) {
        log('info', 'Watching for changes (Ctrl+C to stop)...');
        setInterval(runLoop, CONFIG.pollInterval);
    }
}

// CLI commands
if (process.argv.includes('--sync-all')) {
    // Force sync all files
    loadState();
    syncedFiles.clear();
    saveState();
    log('info', 'Cleared sync state - will sync all files');
    runLoop();
} else if (process.argv.includes('--status')) {
    loadState();
    console.log(`Tracked files: ${syncedFiles.size}`);
    console.log(`Google Drive: ${CONFIG.googleDrive}`);
    console.log(`Projects: ${Object.keys(CONFIG.projects).join(', ')}`);
} else {
    main().catch(console.error);
}
