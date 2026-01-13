/**
 * Documentation Index Generator v1.0.0
 * 
 * Scans all .md files and creates a master index
 * 
 * Path: C:\LLM-DevOSWE\tools\doc-indexer.js
 * Last Updated: 2025-01-08
 */

const fs = require('fs');
const path = require('path');

const ROOT = 'C:\\DevOSWE';
const OUTPUT = path.join(ROOT, 'DOCUMENTATION-INDEX.md');

// Find all .md files
function findMarkdownFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip node_modules and .git
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        
        if (entry.isDirectory()) {
            findMarkdownFiles(fullPath, files);
        } else if (entry.name.endsWith('.md')) {
            files.push(fullPath);
        }
    }
    
    return files;
}

// Extract metadata from markdown file
function extractMetadata(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').slice(0, 30); // First 30 lines
    const stats = fs.statSync(filePath);
    
    const metadata = {
        path: filePath.replace(ROOT + '\\', '').replace(/\\/g, '/'),
        filename: path.basename(filePath),
        size: stats.size,
        created: stats.birthtime.toISOString().split('T')[0],
        modified: stats.mtime.toISOString().split('T')[0],
        version: null,
        title: null,
        summary: null
    };
    
    // Extract title (first # heading)
    for (const line of lines) {
        if (line.startsWith('# ')) {
            metadata.title = line.replace('# ', '').trim();
            break;
        }
    }
    
    // Extract version
    const versionMatch = content.match(/\*\*Version[:\s]*\*\*\s*v?([\d.]+)/i) ||
                         content.match(/Version[:\s]*([\d.]+)/i) ||
                         content.match(/v([\d.]+)/);
    if (versionMatch) {
        metadata.version = versionMatch[1];
    }
    
    // Extract summary (first paragraph after title)
    let foundTitle = false;
    let summaryLines = [];
    for (const line of lines) {
        if (line.startsWith('# ')) {
            foundTitle = true;
            continue;
        }
        if (foundTitle && line.trim() && !line.startsWith('*') && !line.startsWith('-') && !line.startsWith('|') && !line.startsWith('#')) {
            summaryLines.push(line.trim());
            if (summaryLines.length >= 2) break;
        }
    }
    metadata.summary = summaryLines.join(' ').substring(0, 150);
    if (metadata.summary.length === 150) metadata.summary += '...';
    
    return metadata;
}

// Categorize files
function categorize(filePath) {
    if (filePath.includes('docs/')) return 'Documentation';
    if (filePath.includes('tests/')) return 'Testing';
    if (filePath.includes('tools/')) return 'Tools';
    if (filePath.includes('plugins/')) return 'Plugins';
    if (filePath.includes('simwidget-hybrid/')) return 'Hybrid Server';
    if (filePath.includes('msfs-')) return 'MSFS Templates';
    if (filePath.includes('overlay/')) return 'Overlay';
    return 'Root';
}

// Main
function main() {
    console.log('Scanning for markdown files...');
    const files = findMarkdownFiles(ROOT);
    console.log(`Found ${files.length} markdown files`);
    
    const docs = files.map(f => ({
        ...extractMetadata(f),
        category: categorize(f.replace(ROOT + '\\', ''))
    }));
    
    // Sort by category then filename
    docs.sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.filename.localeCompare(b.filename);
    });
    
    // Generate markdown
    let output = `# SimWidget Engine - Documentation Index
**Version:** 1.0.0  
**Generated:** ${new Date().toISOString().split('T')[0]}  
**Total Documents:** ${docs.length}

---

## Quick Links

| Document | Purpose |
|----------|---------|
| [CLAUDE.md](CLAUDE.md) | AI context & quick reference |
| [PROJECT-PLAN.md](PROJECT-PLAN.md) | Roadmap & milestones |
| [TODO.md](TODO.md) | Development backlog |
| [STANDARDS.md](STANDARDS.md) | Coding conventions |
| [docs/PLUGINS.md](docs/PLUGINS.md) | Plugin system |

---

## All Documents by Category

`;

    let currentCategory = '';
    for (const doc of docs) {
        if (doc.category !== currentCategory) {
            currentCategory = doc.category;
            output += `\n### ${currentCategory}\n\n`;
            output += '| File | Version | Modified | Summary |\n';
            output += '|------|---------|----------|--------|\n';
        }
        
        const version = doc.version || '-';
        const summary = doc.summary || '-';
        output += `| [${doc.filename}](${doc.path}) | ${version} | ${doc.modified} | ${summary} |\n`;
    }
    
    // Add detailed section
    output += `\n---\n\n## Document Details\n\n`;
    
    for (const doc of docs) {
        output += `### ${doc.filename}\n`;
        output += `- **Path:** \`${doc.path}\`\n`;
        output += `- **Title:** ${doc.title || 'N/A'}\n`;
        output += `- **Version:** ${doc.version || 'N/A'}\n`;
        output += `- **Created:** ${doc.created}\n`;
        output += `- **Modified:** ${doc.modified}\n`;
        output += `- **Size:** ${(doc.size / 1024).toFixed(2)} KB\n`;
        if (doc.summary) output += `- **Summary:** ${doc.summary}\n`;
        output += '\n';
    }
    
    // Write output
    fs.writeFileSync(OUTPUT, output);
    console.log(`\nIndex written to: ${OUTPUT}`);
    
    // Also output JSON for programmatic use
    const jsonOutput = path.join(ROOT, 'docs', 'documentation-index.json');
    fs.writeFileSync(jsonOutput, JSON.stringify(docs, null, 2));
    console.log(`JSON index written to: ${jsonOutput}`);
    
    return docs;
}

main();
