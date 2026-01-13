// Find Flow Pro and ChasePlane DLLs
const fs = require('fs');
const path = require('path');

const searchPaths = [
    'C:\\Program Files',
    'C:\\Program Files (x86)',
    process.env.LOCALAPPDATA,
    process.env.APPDATA
];

const keywords = ['flowpro', 'flow pro', 'chaseplane', 'chase plane'];

function searchDir(dir, depth = 0) {
    if (depth > 3) return [];
    const results = [];
    
    try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const lower = item.toLowerCase();
            
            // Check if folder matches keywords
            if (keywords.some(k => lower.includes(k.replace(' ', '')))) {
                console.log('Found folder:', fullPath);
                // Search for DLLs in this folder
                try {
                    const files = fs.readdirSync(fullPath);
                    for (const f of files) {
                        if (f.toLowerCase().endsWith('.dll')) {
                            results.push(path.join(fullPath, f));
                        }
                    }
                } catch (e) {}
            }
            
            // Recurse into subdirs
            try {
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    results.push(...searchDir(fullPath, depth + 1));
                }
            } catch (e) {}
        }
    } catch (e) {}
    
    return results;
}

console.log('Searching for Flow Pro and ChasePlane DLLs...\n');

for (const searchPath of searchPaths) {
    if (searchPath && fs.existsSync(searchPath)) {
        console.log('Scanning:', searchPath);
        const found = searchDir(searchPath);
        if (found.length > 0) {
            console.log('Found DLLs:');
            found.forEach(f => console.log('  ', f));
        }
    }
}
