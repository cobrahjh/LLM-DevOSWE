#!/usr/bin/env node
/**
 * File State Tracking Hook for Claude Code
 *
 * Automatically reports file operations (Read/Edit/Write) to Relay API
 *
 * Install: Add to .claude/settings.local.json hooks.PostToolUse
 */

const http = require('http');

const RELAY_URL = process.env.RELAY_URL || 'http://127.0.0.1:8600';
const SESSION_ID = process.env.CLAUDE_SESSION_ID || `claude-${Date.now()}`;

// Tools that involve file operations
const FILE_TOOLS = {
    'Read': 'read',
    'Edit': 'edit',
    'Write': 'create',  // Write creates or overwrites
    'Glob': 'read',     // Glob reads file system
    'Grep': 'read'      // Grep reads files
};

let input = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
    input += chunk;
});

process.stdin.on('end', () => {
    try {
        const hookData = JSON.parse(input);
        processHook(hookData);
    } catch (err) {
        // Silent fail
    }
});

function processHook(data) {
    const toolName = data.tool_name;

    // Only process file-related tools
    if (!FILE_TOOLS[toolName]) return;

    const operation = FILE_TOOLS[toolName];
    let filePath = null;
    let metadata = {};

    // Extract file path based on tool
    try {
        const toolInput = typeof data.tool_input === 'string'
            ? JSON.parse(data.tool_input)
            : data.tool_input;

        if (toolName === 'Read' || toolName === 'Write') {
            filePath = toolInput?.file_path;
        } else if (toolName === 'Edit') {
            filePath = toolInput?.file_path;
            metadata.old_string_length = toolInput?.old_string?.length;
            metadata.new_string_length = toolInput?.new_string?.length;
        } else if (toolName === 'Glob') {
            filePath = toolInput?.pattern;
            metadata.type = 'glob_pattern';
        } else if (toolName === 'Grep') {
            filePath = toolInput?.path || toolInput?.pattern;
            metadata.type = 'grep_search';
        }
    } catch (e) {
        // Could be plain string input
        filePath = data.tool_input;
    }

    if (!filePath) return;

    // Report to Relay
    reportFileOperation(filePath, operation, metadata);
}

function reportFileOperation(filePath, operation, metadata) {
    const payload = JSON.stringify({
        session_id: SESSION_ID,
        file_path: filePath,
        operation: operation,
        metadata: {
            ...metadata,
            source: 'claude-code-hook',
            timestamp: new Date().toISOString()
        }
    });

    const url = new URL(`${RELAY_URL}/api/session/files`);

    const req = http.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    }, (res) => {
        // Silent on success
    });

    req.on('error', (err) => {
        // Silent on error - don't interrupt Claude
    });

    req.write(payload);
    req.end();
}
