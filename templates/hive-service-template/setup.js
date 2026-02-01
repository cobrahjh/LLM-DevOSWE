#!/usr/bin/env node
/**
 * Hive Service Setup Script (Interactive)
 *
 * Creates a new Hive-compatible service from template
 *
 * Usage: node setup.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

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

const net = require('net');

const templateDir = __dirname;

// Common ports that are likely available (8900-8999 range)
const suggestedPorts = [8900, 8901, 8902, 8903, 8905, 8910, 8920, 8950];

/**
 * Check if a port is available
 * @param {number} port - Port to check
 * @returns {Promise<boolean>} - true if available, false if in use
 */
function checkPort(port) {
    return new Promise(resolve => {
        const server = net.createServer();

        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(false); // Port in use
            } else {
                resolve(false); // Other error, assume unavailable
            }
        });

        server.once('listening', () => {
            server.close();
            resolve(true); // Port available
        });

        server.listen(port, '127.0.0.1');
    });
}

/**
 * Find next available port starting from given port
 * @param {number} startPort - Port to start checking from
 * @returns {Promise<number>} - First available port
 */
async function findAvailablePort(startPort) {
    for (let port = startPort; port < startPort + 100; port++) {
        if (await checkPort(port)) {
            return port;
        }
    }
    return startPort; // Fallback
}

async function main() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║              HIVE SERVICE TEMPLATE SETUP                     ║
╠══════════════════════════════════════════════════════════════╣
║  Creates a new Hive-compatible service with:                 ║
║  - Health endpoint (Orchestrator compatible)                 ║
║  - Relay integration helpers                                 ║
║  - CLAUDE.md context file                                    ║
║  - Standard project structure                                ║
╚══════════════════════════════════════════════════════════════╝
`);

    // Get project name
    const projectName = await prompt('Project name (e.g., my-cool-service)');
    if (!projectName) {
        console.error('\nError: Project name is required');
        rl.close();
        process.exit(1);
    }

    // Validate project name
    if (!/^[a-z0-9-]+$/.test(projectName)) {
        console.error('\nError: Project name should be lowercase with hyphens only (e.g., my-service)');
        rl.close();
        process.exit(1);
    }

    // Show available ports
    console.log(`\nSuggested available ports: ${suggestedPorts.join(', ')}`);
    console.log('Check SERVICE-REGISTRY.md for full port list');

    // Get port
    let port;
    let portValid = false;

    while (!portValid) {
        const portStr = await prompt('Port number', '8900');
        port = parseInt(portStr);

        if (isNaN(port) || port < 1000 || port > 65535) {
            console.error('  ✗ Port must be a number between 1000 and 65535');
            continue;
        }

        // Test if port is available
        process.stdout.write('  Checking port availability... ');
        const available = await checkPort(port);

        if (available) {
            console.log('✓ Available');
            portValid = true;
        } else {
            console.log('✗ In use');
            const nextAvailable = await findAvailablePort(port + 1);
            const tryNext = await prompt(`  Port ${port} is in use. Try ${nextAvailable} instead? (y/n)`, 'y');
            if (tryNext.toLowerCase() === 'y') {
                port = nextAvailable;
                console.log(`  ✓ Using port ${port}`);
                portValid = true;
            }
        }
    }

    // Get target directory
    console.log('\nWhere should the project be created?');
    console.log('  1. C:\\LLM-DevOSWE\\Admin\\          (Hive Admin services)');
    console.log('  2. C:\\LLM-DevOSWE\\                 (Main project root)');
    console.log('  3. C:\\Projects\\                    (Separate projects)');
    console.log('  4. Custom path');

    const dirChoice = await prompt('Choose (1-4)', '1');

    let targetDir;
    switch (dirChoice) {
        case '1':
            targetDir = 'C:\\LLM-DevOSWE\\Admin';
            break;
        case '2':
            targetDir = 'C:\\LLM-DevOSWE';
            break;
        case '3':
            targetDir = 'C:\\Projects';
            break;
        case '4':
            targetDir = await prompt('Enter full path');
            break;
        default:
            targetDir = 'C:\\LLM-DevOSWE\\Admin';
    }

    const projectDir = path.join(targetDir, projectName);

    // Get description
    const description = await prompt('Brief description', 'A Hive-compatible service');

    // Confirm
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                      CONFIRM SETUP                           ║
╠══════════════════════════════════════════════════════════════╣
  Project:     ${projectName}
  Port:        ${port}
  Location:    ${projectDir}
  Description: ${description}
╚══════════════════════════════════════════════════════════════╝
`);

    const confirm = await prompt('Create project? (y/n)', 'y');
    if (confirm.toLowerCase() !== 'y') {
        console.log('\nAborted.');
        rl.close();
        process.exit(0);
    }

    // Create project
    console.log('\nCreating project...\n');

    // Create project directory
    if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
    }

    // Files to copy and transform
    const files = ['server.js', 'package.json', 'config.json', 'CLAUDE.md'];

    files.forEach(file => {
        const sourcePath = path.join(templateDir, file);
        const destPath = path.join(projectDir, file);

        if (fs.existsSync(sourcePath)) {
            let content = fs.readFileSync(sourcePath, 'utf8');

            // Replace placeholders
            content = content.replace(/\[PROJECT_NAME\]/g, projectName);
            content = content.replace(/\[PORT\]/g, port.toString());
            content = content.replace(/\[DESCRIPTION\]/g, description);
            content = content.replace(/hive-service-template/g, projectName);
            content = content.replace(/"8900"/g, `"${port}"`);
            content = content.replace(/: 8900/g, `: ${port}`);

            fs.writeFileSync(destPath, content);
            console.log(`  ✓ Created: ${file}`);
        }
    });

    // Create .gitignore
    fs.writeFileSync(path.join(projectDir, '.gitignore'), `node_modules/
.env
*.log
.DS_Store
`);
    console.log('  ✓ Created: .gitignore');

    // Ask about additional setup
    console.log('');
    const runNpm = await prompt('Run npm install now? (y/n)', 'y');

    if (runNpm.toLowerCase() === 'y') {
        console.log('\nInstalling dependencies...');
        const { execSync } = require('child_process');
        try {
            execSync('npm install', { cwd: projectDir, stdio: 'inherit' });
            console.log('  ✓ Dependencies installed');
        } catch (err) {
            console.log('  ⚠ npm install failed, run manually');
        }
    }

    // Create Claude Code launcher
    const createLauncher = await prompt('\nCreate Claude Code launcher shortcut? (y/n)', 'y');
    if (createLauncher.toLowerCase() === 'y') {
        const launcherPath = path.join(projectDir, `claude-${projectName}.bat`);
        const launcherContent = `@echo off
:: Claude Code launcher for ${projectName}
:: Double-click to open project in Claude Code
cd /d "${projectDir}"
claude
`;
        fs.writeFileSync(launcherPath, launcherContent);
        console.log(`  ✓ Created: claude-${projectName}.bat`);

        // Also create desktop shortcut
        const desktopPath = path.join(process.env.USERPROFILE, 'Desktop', `Claude - ${projectName}.bat`);
        fs.writeFileSync(desktopPath, launcherContent);
        console.log(`  ✓ Created desktop shortcut: Claude - ${projectName}.bat`);
    }

    const addToRegistry = await prompt('\nAdd to SERVICE-REGISTRY.md? (y/n)', 'y');
    if (addToRegistry.toLowerCase() === 'y') {
        const registryPath = 'C:\\LLM-DevOSWE\\SERVICE-REGISTRY.md';
        if (fs.existsSync(registryPath)) {
            let registry = fs.readFileSync(registryPath, 'utf8');
            const entry = `| ${port} | ${projectName} | Optional | \`node ${projectDir.replace(/\\/g, '/')}\\server.js\` |`;

            // Find the table and add entry
            const tableEnd = registry.lastIndexOf('|------|---------|--------|---------------|');
            if (tableEnd > -1) {
                // Find next empty line after table header
                const insertPoint = registry.indexOf('\n\n', tableEnd);
                if (insertPoint > -1) {
                    registry = registry.slice(0, insertPoint) + '\n' + entry + registry.slice(insertPoint);
                    fs.writeFileSync(registryPath, registry);
                    console.log('  ✓ Added to SERVICE-REGISTRY.md');
                }
            }
        }
    }

    // Final output
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    SETUP COMPLETE!                           ║
╚══════════════════════════════════════════════════════════════╝

Next steps:
───────────
  cd ${projectDir}
  npm start

Test endpoints:
───────────────
  Health: curl http://localhost:${port}/api/health
  Status: curl http://localhost:${port}/api/status

To register with Orchestrator:
──────────────────────────────
  Add to: C:/LLM-DevOSWE/Admin/orchestrator/orchestrator-config.json

  {
    "name": "${projectName}",
    "port": ${port},
    "healthEndpoint": "/api/health"
  }

Documentation:
──────────────
  Edit: ${projectDir}\\CLAUDE.md

Happy coding! 🚀
`);

    rl.close();
}

main().catch(err => {
    console.error('Error:', err);
    rl.close();
    process.exit(1);
});
