#!/usr/bin/env node
/**
 * SimWidget Auto-Documentation Generator v1.0.0
 * 
 * Generates markdown documentation from codebase
 * 
 * Usage:
 *   node generate-docs.js           - Generate all docs
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\tools\generate-docs.js
 * Last Updated: 2025-01-08
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const UI_DIR = path.join(ROOT, 'ui');
const BACKEND_DIR = path.join(ROOT, 'backend');
const CONFIG_DIR = path.join(ROOT, 'config');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readFile(filepath) {
    try { return fs.readFileSync(filepath, 'utf8'); } catch { return null; }
}

function getDirs(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true })
        .filter(d => d.isDirectory()).map(d => d.name);
}

function extractVersion(content) {
    const match = content.match(/v(\d+\.\d+\.\d+)/);
    return match ? match[1] : 'unknown';
}

function extractDescription(content) {
    const match = content.match(/\/\*\*[\s\S]*?\*\//);
    if (match) {
        const lines = match[0].split('\n')
            .map(l => l.replace(/^\s*\*\s?/, '').trim())
            .filter(l => l && !l.startsWith('/') && !l.startsWith('@') && !l.includes('Path:') && !l.includes('Last Updated'));
        return lines.slice(0, 2).join(' ').trim();
    }
    return '';
}

function generateWidgetDocs() {
    const widgets = getDirs(UI_DIR).filter(d => d !== 'shared');
    let md = `# SimWidget Widgets\n\nAuto-generated widget documentation.\n\nGenerated: ${new Date().toISOString().split('T')[0]}\n\n`;
    md += `| Widget | Version | Description |\n|--------|---------|-------------|\n`;

    const details = [];
    for (const widget of widgets) {
        const jsContent = readFile(path.join(UI_DIR, widget, 'widget.js')) || '';
        const version = extractVersion(jsContent);
        const desc = extractDescription(jsContent);
        const title = widget.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        md += `| [${title}](#${widget}) | ${version} | ${desc.slice(0, 50)}${desc.length > 50 ? '...' : ''} |\n`;
        details.push({ widget, title, version, desc, jsContent });
    }
    
    md += `\n---\n`;
    for (const { widget, title, version, desc, jsContent } of details) {
        md += `\n## ${title} {#${widget}}\n\n`;
        md += `**Version:** ${version}  \n`;
        md += `**URL:** http://localhost:8080/ui/${widget}/\n\n`;
        if (desc) md += `${desc}\n\n`;
        
        const features = [];
        if (jsContent.includes('WebSocket')) features.push('WebSocket');
        if (jsContent.includes('localStorage')) features.push('Persistent settings');
        if (jsContent.includes('transparent')) features.push('Transparency');
        if (features.length) md += `**Features:** ${features.join(', ')}\n\n`;
    }
    return md;
}

function generateAPIDocs() {
    const content = readFile(path.join(BACKEND_DIR, 'server.js')) || '';
    const version = extractVersion(content);
    
    let md = `# SimWidget API\n\n**Version:** ${version}  \n**Base URL:** http://localhost:8080\n\nGenerated: ${new Date().toISOString().split('T')[0]}\n\n## Endpoints\n\n`;
    
    const endpoints = [];
    for (const match of content.matchAll(/app\.get\(['"]([^'"]+)['"]/g)) {
        endpoints.push({ method: 'GET', path: match[1] });
    }
    for (const match of content.matchAll(/app\.post\(['"]([^'"]+)['"]/g)) {
        endpoints.push({ method: 'POST', path: match[1] });
    }
    
    md += `| Method | Endpoint |\n|--------|----------|\n`;
    for (const ep of endpoints) {
        md += `| \`${ep.method}\` | \`${ep.path}\` |\n`;
    }
    
    md += `\n## WebSocket\n\nConnect: \`ws://localhost:8080\`\n\n`;
    md += `### flightData Message\n\`\`\`json\n{\n  "type": "flightData",\n  "data": {\n    "altitude": 5000,\n    "speed": 250,\n    "heading": 180,\n    "latitude": 39.123,\n    "longitude": -76.456\n  }\n}\n\`\`\`\n`;
    return md;
}

function generateConfigDocs() {
    let md = `# SimWidget Configuration\n\nGenerated: ${new Date().toISOString().split('T')[0]}\n\n`;
    md += `## Keymaps\n\n**Path:** \`/config/keymaps.json\`\n\n`;
    md += `### Structure\n\`\`\`json\n{\n  "category": {\n    "action-id": {\n      "name": "Action Name",\n      "key": "A"\n    }\n  }\n}\n\`\`\`\n\n`;
    md += `### Key Format\n- Single: \`A\`, \`F1\`\n- Modifiers: \`CTRL+A\`, \`ALT+F1\`\n`;
    return md;
}

function generateReadme() {
    const pkg = JSON.parse(readFile(path.join(ROOT, 'package.json')) || '{}');
    const widgets = getDirs(UI_DIR).filter(d => d !== 'shared');
    
    let md = `# SimWidget Engine\n\n**Version:** ${pkg.version || 'unknown'}  \n**Port:** 8080\n\n`;
    md += `## Quick Start\n\`\`\`bash\nnpm start      # Start server\nnpm run dev    # Dev with hot reload\nnpm test       # Run tests\n\`\`\`\n\n`;
    md += `## Widgets (${widgets.length})\n\n| Widget | URL |\n|--------|-----|\n`;
    for (const w of widgets) {
        const title = w.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
        md += `| ${title} | http://localhost:8080/ui/${w}/ |\n`;
    }
    md += `\n## Tools\n- \`node tools/create-widget.js <name>\` - Scaffold widget\n- \`tools/deploy.ps1\` - Server management\n- \`npm test\` - Run tests\n- \`node tools/generate-docs.js\` - Generate docs\n\n`;
    md += `## Docs\n- [Widgets](docs/WIDGETS.md)\n- [API](docs/API.md)\n- [Config](docs/CONFIG.md)\n`;
    return md;
}

function generate() {
    console.log('\\n╔═══════════════════════════════════════════╗');
    console.log('║   SimWidget Doc Generator v1.0.0          ║');
    console.log('╚═══════════════════════════════════════════╝\\n');

    ensureDir(DOCS_DIR);

    const docs = [
        { name: 'WIDGETS.md', fn: generateWidgetDocs },
        { name: 'API.md', fn: generateAPIDocs },
        { name: 'CONFIG.md', fn: generateConfigDocs }
    ];

    for (const doc of docs) {
        fs.writeFileSync(path.join(DOCS_DIR, doc.name), doc.fn());
        console.log(`✓ Generated docs/${doc.name}`);
    }

    fs.writeFileSync(path.join(ROOT, 'README.md'), generateReadme());
    console.log('✓ Generated README.md');

    console.log(`\\n✅ Documentation generated in /docs/\\n`);
}

generate();
