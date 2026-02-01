#!/usr/bin/env node
/**
 * Hive Service Removal Script (Interactive)
 *
 * Removes a Hive service and all associated files/entries
 *
 * Usage: node remove.js [project-name]
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const prompt = (question, defaultValue = '') => {
    return new Promise(resolve => {
        const suffix = defaultValue ? ` [${defaultValue}]` : '';
        rl.question(question + suffix + ': ', answer => {
            resolve(answer.trim() || defaultValue);
        });
    });
};

// Known project locations to search
const searchPaths = [
    'C:\\LLM-DevOSWE\\Admin',
    'C:\\LLM-DevOSWE',
    'C:\\Projects',
    'C:\\DevClaude'
];

async function main() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║              HIVE SERVICE REMOVAL TOOL                       ║
╠══════════════════════════════════════════════════════════════╣
║  Removes a Hive service and cleans up:                       ║
║  - Project directory                                         ║
║  - Desktop shortcuts                                         ║
║  - SERVICE-REGISTRY.md entry                                 ║
║  - Orchestrator config entry                                 ║
║  - Windows service (if exists)                               ║
╚══════════════════════════════════════════════════════════════╝
`);

    // Get project name (from arg or prompt)
    let projectName = process.argv[2];

    if (!projectName) {
        projectName = await prompt('Project name to remove');
    }

    if (!projectName) {
        console.error('\nError: Project name is required');
        rl.close();
        process.exit(1);
    }

    console.log(`\nSearching for project: ${projectName}`);

    // Find project directory
    let projectDir = null;
    for (const searchPath of searchPaths) {
        const testPath = path.join(searchPath, projectName);
        if (fs.existsSync(testPath)) {
            projectDir = testPath;
            console.log(`  ✓ Found: ${projectDir}`);
            break;
        }
    }

    if (!projectDir) {
        // Try custom path
        const customPath = await prompt('Project not found in common locations. Enter full path (or leave empty to cancel)');
        if (customPath && fs.existsSync(customPath)) {
            projectDir = customPath;
        } else {
            console.log('\nProject not found. Exiting.');
            rl.close();
            process.exit(0);
        }
    }

    // Gather info about what will be removed
    console.log('\n─────────────────────────────────────');
    console.log('Items to remove:');
    console.log('─────────────────────────────────────');

    const itemsToRemove = [];

    // 1. Project directory
    if (fs.existsSync(projectDir)) {
        const files = fs.readdirSync(projectDir);
        console.log(`  ✓ Project directory: ${projectDir} (${files.length} files)`);
        itemsToRemove.push({ type: 'directory', path: projectDir });
    }

    // 2. Desktop shortcut
    const desktopShortcut = path.join(process.env.USERPROFILE, 'Desktop', `Claude - ${projectName}.bat`);
    if (fs.existsSync(desktopShortcut)) {
        console.log(`  ✓ Desktop shortcut: ${desktopShortcut}`);
        itemsToRemove.push({ type: 'file', path: desktopShortcut });
    }

    // 3. SERVICE-REGISTRY.md entry
    const registryPath = 'C:\\LLM-DevOSWE\\SERVICE-REGISTRY.md';
    let registryHasEntry = false;
    if (fs.existsSync(registryPath)) {
        const registry = fs.readFileSync(registryPath, 'utf8');
        if (registry.includes(projectName)) {
            console.log(`  ✓ SERVICE-REGISTRY.md entry`);
            registryHasEntry = true;
            itemsToRemove.push({ type: 'registry', path: registryPath, name: projectName });
        }
    }

    // 4. Orchestrator config entry
    const orchConfigPath = 'C:\\LLM-DevOSWE\\Admin\\orchestrator\\orchestrator-config.json';
    let orchHasEntry = false;
    if (fs.existsSync(orchConfigPath)) {
        const orchConfig = fs.readFileSync(orchConfigPath, 'utf8');
        if (orchConfig.includes(projectName)) {
            console.log(`  ✓ Orchestrator config entry`);
            orchHasEntry = true;
            itemsToRemove.push({ type: 'orchestrator', path: orchConfigPath, name: projectName });
        }
    }

    // 5. Check for Windows service
    let hasWindowsService = false;
    try {
        const serviceCheck = execSync(`sc query "${projectName}" 2>&1`, { encoding: 'utf8' });
        if (!serviceCheck.includes('does not exist')) {
            console.log(`  ✓ Windows service: ${projectName}`);
            hasWindowsService = true;
            itemsToRemove.push({ type: 'service', name: projectName });
        }
    } catch (e) {
        // Service doesn't exist
    }

    // Also check for Hive-prefixed service
    try {
        const hiveName = `Hive${projectName.charAt(0).toUpperCase() + projectName.slice(1).replace(/-/g, '')}`;
        const serviceCheck = execSync(`sc query "${hiveName}" 2>&1`, { encoding: 'utf8' });
        if (!serviceCheck.includes('does not exist')) {
            console.log(`  ✓ Windows service: ${hiveName}`);
            hasWindowsService = true;
            itemsToRemove.push({ type: 'service', name: hiveName });
        }
    } catch (e) {
        // Service doesn't exist
    }

    if (itemsToRemove.length === 0) {
        console.log('\n  No items found to remove.');
        rl.close();
        process.exit(0);
    }

    console.log('─────────────────────────────────────\n');

    // Confirm removal
    const confirm = await prompt(`Remove ${projectName} and all associated items? (type project name to confirm)`);

    if (confirm !== projectName) {
        console.log('\nConfirmation failed. Exiting.');
        rl.close();
        process.exit(0);
    }

    console.log('\nRemoving...\n');

    // Process removals
    for (const item of itemsToRemove) {
        try {
            switch (item.type) {
                case 'service':
                    console.log(`  Stopping service ${item.name}...`);
                    try {
                        execSync(`sc stop "${item.name}" 2>&1`, { encoding: 'utf8' });
                    } catch (e) { /* may already be stopped */ }

                    console.log(`  Removing service ${item.name}...`);
                    execSync(`sc delete "${item.name}" 2>&1`, { encoding: 'utf8' });
                    console.log(`  ✓ Removed Windows service: ${item.name}`);
                    break;

                case 'file':
                    fs.unlinkSync(item.path);
                    console.log(`  ✓ Removed file: ${item.path}`);
                    break;

                case 'directory':
                    fs.rmSync(item.path, { recursive: true, force: true });
                    console.log(`  ✓ Removed directory: ${item.path}`);
                    break;

                case 'registry':
                    let registry = fs.readFileSync(item.path, 'utf8');
                    // Remove line containing project name from table
                    const lines = registry.split('\n');
                    const filtered = lines.filter(line => !line.includes(item.name) || line.startsWith('#') || line.startsWith('|--'));
                    fs.writeFileSync(item.path, filtered.join('\n'));
                    console.log(`  ✓ Removed from SERVICE-REGISTRY.md`);
                    break;

                case 'orchestrator':
                    let orchConfig = JSON.parse(fs.readFileSync(item.path, 'utf8'));
                    if (orchConfig.services) {
                        orchConfig.services = orchConfig.services.filter(s => s.name !== item.name);
                        fs.writeFileSync(item.path, JSON.stringify(orchConfig, null, 2));
                        console.log(`  ✓ Removed from orchestrator config`);
                    }
                    break;
            }
        } catch (err) {
            console.log(`  ⚠ Failed to remove ${item.type}: ${err.message}`);
        }
    }

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                   REMOVAL COMPLETE                           ║
╚══════════════════════════════════════════════════════════════╝

${projectName} has been removed.
`);

    rl.close();
}

main().catch(err => {
    console.error('Error:', err);
    rl.close();
    process.exit(1);
});
