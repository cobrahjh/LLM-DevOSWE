/**
 * SimWidget File Inspector v1.0.0
 * 
 * Inspects various file types: DLL, EXE, LIB, node modules, configs, etc.
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\tests\lib\file-inspector.js
 * Last Updated: 2025-01-08
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Magic byte signatures for file type detection
const FILE_SIGNATURES = {
    // Executables
    'exe': { magic: [0x4D, 0x5A], name: 'Windows Executable' },
    'dll': { magic: [0x4D, 0x5A], name: 'Dynamic Link Library' },
    'lib': { magic: [0x21, 0x3C, 0x61, 0x72, 0x63, 0x68, 0x3E], name: 'Static Library (ar)' },
    'lib-coff': { magic: [0x4C, 0x01], name: 'COFF Library' },
    
    // Archives
    'zip': { magic: [0x50, 0x4B, 0x03, 0x04], name: 'ZIP Archive' },
    'gz': { magic: [0x1F, 0x8B], name: 'GZIP Archive' },
    '7z': { magic: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], name: '7-Zip Archive' },
    'rar': { magic: [0x52, 0x61, 0x72, 0x21], name: 'RAR Archive' },
    'tar': { magic: [0x75, 0x73, 0x74, 0x61, 0x72], name: 'TAR Archive', offset: 257 },
    
    // Images
    'png': { magic: [0x89, 0x50, 0x4E, 0x47], name: 'PNG Image' },
    'jpg': { magic: [0xFF, 0xD8, 0xFF], name: 'JPEG Image' },
    'gif': { magic: [0x47, 0x49, 0x46, 0x38], name: 'GIF Image' },
    'bmp': { magic: [0x42, 0x4D], name: 'BMP Image' },
    'ico': { magic: [0x00, 0x00, 0x01, 0x00], name: 'ICO Icon' },
    
    // Documents
    'pdf': { magic: [0x25, 0x50, 0x44, 0x46], name: 'PDF Document' },
    
    // Node/JS
    'node': { magic: [0x4E, 0x41, 0x50, 0x49], name: 'Node Addon' },
    
    // SQLite
    'sqlite': { magic: [0x53, 0x51, 0x4C, 0x69, 0x74, 0x65], name: 'SQLite Database' },
    
    // WASM
    'wasm': { magic: [0x00, 0x61, 0x73, 0x6D], name: 'WebAssembly' }
};

// Dangerous patterns to scan for
const DANGEROUS_PATTERNS = {
    binary: [
        { pattern: Buffer.from('CreateRemoteThread'), name: 'Remote Thread Creation' },
        { pattern: Buffer.from('VirtualAllocEx'), name: 'Remote Memory Allocation' },
        { pattern: Buffer.from('WriteProcessMemory'), name: 'Process Memory Write' },
        { pattern: Buffer.from('LoadLibraryA'), name: 'Dynamic Library Load' },
        { pattern: Buffer.from('GetProcAddress'), name: 'Dynamic Function Resolution' },
        { pattern: Buffer.from('WinExec'), name: 'Command Execution' },
        { pattern: Buffer.from('ShellExecute'), name: 'Shell Execution' },
        { pattern: Buffer.from('cmd.exe'), name: 'Command Prompt Reference' },
        { pattern: Buffer.from('powershell'), name: 'PowerShell Reference' }
    ],
    text: [
        { pattern: /eval\s*\(/, name: 'Eval Usage' },
        { pattern: /new\s+Function\s*\(/, name: 'Dynamic Function' },
        { pattern: /child_process/, name: 'Child Process' },
        { pattern: /require\s*\(\s*['"`]fs['"`]\s*\)/, name: 'File System Access' },
        { pattern: /\.exec\s*\(/, name: 'Exec Call' },
        { pattern: /process\.env/, name: 'Environment Access' },
        { pattern: /__dirname|__filename/, name: 'Path Exposure' },
        { pattern: /Buffer\.from\s*\([^)]*,\s*['"]base64['"]/, name: 'Base64 Decode' }
    ]
};

class FileInspector {
    constructor(options = {}) {
        this.maxFileSize = options.maxFileSize || 50 * 1024 * 1024; // 50MB
        this.scanDepth = options.scanDepth || 1024; // bytes to scan
    }

    /**
     * Detect file type from magic bytes
     */
    detectType(filePath) {
        const buffer = Buffer.alloc(512);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, 512, 0);
        fs.closeSync(fd);

        for (const [type, sig] of Object.entries(FILE_SIGNATURES)) {
            const offset = sig.offset || 0;
            let match = true;
            
            for (let i = 0; i < sig.magic.length; i++) {
                if (buffer[offset + i] !== sig.magic[i]) {
                    match = false;
                    break;
                }
            }
            
            if (match) {
                return { type, name: sig.name, extension: path.extname(filePath) };
            }
        }

        const ext = path.extname(filePath).toLowerCase().slice(1);
        return { type: ext || 'unknown', name: 'Unknown', extension: '.' + ext };
    }

    /**
     * Get file metadata
     */
    getMetadata(filePath) {
        const stats = fs.statSync(filePath);
        const buffer = fs.readFileSync(filePath);
        
        return {
            path: filePath,
            name: path.basename(filePath),
            extension: path.extname(filePath),
            size: stats.size,
            sizeHuman: this.formatSize(stats.size),
            created: stats.birthtime,
            modified: stats.mtime,
            isExecutable: this.isExecutable(filePath),
            md5: crypto.createHash('md5').update(buffer).digest('hex'),
            sha256: crypto.createHash('sha256').update(buffer).digest('hex')
        };
    }

    /**
     * Check if file is executable
     */
    isExecutable(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const execExts = ['.exe', '.dll', '.bat', '.cmd', '.ps1', '.vbs', '.js', '.node'];
        return execExts.includes(ext);
    }

    /**
     * Scan binary file for dangerous patterns
     */
    scanBinary(filePath) {
        const stats = fs.statSync(filePath);
        if (stats.size > this.maxFileSize) {
            return { skipped: true, reason: 'File too large' };
        }

        const buffer = fs.readFileSync(filePath);
        const findings = [];

        for (const check of DANGEROUS_PATTERNS.binary) {
            const index = buffer.indexOf(check.pattern);
            if (index !== -1) {
                findings.push({
                    pattern: check.name,
                    offset: index,
                    severity: 'warning'
                });
            }
        }

        return { scanned: true, size: stats.size, findings, clean: findings.length === 0 };
    }

    /**
     * Scan text file for dangerous patterns
     */
    scanText(filePath) {
        const stats = fs.statSync(filePath);
        if (stats.size > this.maxFileSize) {
            return { skipped: true, reason: 'File too large' };
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const findings = [];
        const lines = content.split('\n');

        for (const check of DANGEROUS_PATTERNS.text) {
            for (let i = 0; i < lines.length; i++) {
                if (check.pattern.test(lines[i])) {
                    findings.push({
                        pattern: check.name,
                        line: i + 1,
                        preview: lines[i].substring(0, 80),
                        severity: 'info'
                    });
                }
            }
        }

        return { scanned: true, size: stats.size, lines: lines.length, findings, clean: findings.length === 0 };
    }

    /**
     * Inspect PE (DLL/EXE) file
     */
    inspectPE(filePath) {
        const meta = this.getMetadata(filePath);
        const type = this.detectType(filePath);
        const scan = this.scanBinary(filePath);
        const buffer = fs.readFileSync(filePath);
        let peInfo = { valid: false };

        if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
            const peOffset = buffer.readUInt32LE(0x3C);
            if (buffer[peOffset] === 0x50 && buffer[peOffset + 1] === 0x45) {
                const machine = buffer.readUInt16LE(peOffset + 4);
                const characteristics = buffer.readUInt16LE(peOffset + 22);
                peInfo = {
                    valid: true,
                    architecture: machine === 0x8664 ? 'x64' : machine === 0x14c ? 'x86' : `0x${machine.toString(16)}`,
                    timestamp: new Date(buffer.readUInt32LE(peOffset + 8) * 1000),
                    characteristics,
                    isDLL: (characteristics & 0x2000) !== 0,
                    isExecutable: (characteristics & 0x0002) !== 0
                };
            }
        }

        return { ...meta, type, pe: peInfo, scan };
    }

    /**
     * Inspect Node native addon (.node)
     */
    inspectNodeAddon(filePath) {
        const result = this.inspectPE(filePath);
        result.isNodeAddon = true;
        return result;
    }

    /**
     * Inspect JavaScript file
     */
    inspectJS(filePath) {
        const meta = this.getMetadata(filePath);
        const scan = this.scanText(filePath);
        const content = fs.readFileSync(filePath, 'utf8');

        const requires = [], imports = [];
        let match;
        
        const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
        
        while ((match = requireRegex.exec(content)) !== null) requires.push(match[1]);
        while ((match = importRegex.exec(content)) !== null) imports.push(match[1]);

        return {
            ...meta,
            type: { type: 'javascript', name: 'JavaScript' },
            dependencies: { requires: [...new Set(requires)], imports: [...new Set(imports)] },
            scan
        };
    }

    /**
     * Inspect JSON file
     */
    inspectJSON(filePath) {
        const meta = this.getMetadata(filePath);
        
        try {
            const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return {
                ...meta,
                type: { type: 'json', name: 'JSON' },
                valid: true,
                keys: Object.keys(content),
                isPackageJson: 'name' in content && 'version' in content,
                isManifest: 'id' in content && 'entry' in content
            };
        } catch (e) {
            return { ...meta, type: { type: 'json', name: 'JSON' }, valid: false, error: e.message };
        }
    }

    /**
     * Inspect CSS file
     */
    inspectCSS(filePath) {
        const meta = this.getMetadata(filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        
        const variables = (content.match(/--[\w-]+/g) || []);
        const imports = (content.match(/@import\s+['"]([^'"]+)['"]/g) || []);
        const selectors = (content.match(/[.#][\w-]+/g) || []);

        return {
            ...meta,
            type: { type: 'css', name: 'CSS Stylesheet' },
            analysis: {
                variableCount: [...new Set(variables)].length,
                importCount: imports.length,
                selectorCount: [...new Set(selectors)].length
            }
        };
    }

    /**
     * Inspect HTML file
     */
    inspectHTML(filePath) {
        const meta = this.getMetadata(filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        
        const scripts = (content.match(/<script[^>]*>/g) || []);
        const styles = (content.match(/<link[^>]*stylesheet[^>]*>/g) || []);
        const hasDoctype = content.toLowerCase().includes('<!doctype');

        return {
            ...meta,
            type: { type: 'html', name: 'HTML Document' },
            analysis: {
                hasDoctype,
                scriptTags: scripts.length,
                stylesheetLinks: styles.length,
                inlineScripts: scripts.filter(s => !s.includes('src=')).length
            }
        };
    }

    /**
     * Inspect static library (.lib, .a)
     */
    inspectLibrary(filePath) {
        const meta = this.getMetadata(filePath);
        const type = this.detectType(filePath);
        return { ...meta, type, isLibrary: true };
    }

    /**
     * Inspect SQLite database
     */
    inspectSQLite(filePath) {
        const meta = this.getMetadata(filePath);
        const type = this.detectType(filePath);
        return { ...meta, type, isDatabase: true };
    }

    /**
     * Inspect any file (auto-detect)
     */
    inspect(filePath) {
        if (!fs.existsSync(filePath)) {
            return { error: 'File not found', path: filePath };
        }

        const ext = path.extname(filePath).toLowerCase();
        
        switch (ext) {
            case '.dll':
            case '.exe':
                return this.inspectPE(filePath);
            case '.node':
                return this.inspectNodeAddon(filePath);
            case '.js':
            case '.mjs':
            case '.cjs':
                return this.inspectJS(filePath);
            case '.json':
                return this.inspectJSON(filePath);
            case '.css':
                return this.inspectCSS(filePath);
            case '.html':
            case '.htm':
                return this.inspectHTML(filePath);
            case '.lib':
            case '.a':
                return this.inspectLibrary(filePath);
            case '.sqlite':
            case '.db':
                return this.inspectSQLite(filePath);
            default:
                return this.inspectGeneric(filePath);
        }
    }

    /**
     * Generic file inspection
     */
    inspectGeneric(filePath) {
        const meta = this.getMetadata(filePath);
        const type = this.detectType(filePath);
        
        const buffer = Buffer.alloc(512);
        const fd = fs.openSync(filePath, 'r');
        const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
        fs.closeSync(fd);

        let isBinary = false;
        for (let i = 0; i < bytesRead; i++) {
            if (buffer[i] === 0) { isBinary = true; break; }
        }

        const scan = isBinary ? this.scanBinary(filePath) : this.scanText(filePath);
        return { ...meta, type, isBinary, scan };
    }

    /**
     * Scan directory recursively
     */
    scanDirectory(dirPath, options = {}) {
        const results = {
            path: dirPath,
            files: [],
            summary: { total: 0, byType: {}, byExtension: {}, totalSize: 0, warnings: 0, errors: 0 }
        };

        const maxDepth = options.maxDepth || 5;
        const excludeDirs = options.excludeDirs || ['node_modules', '.git', 'dist', 'build'];

        const scan = (dir, depth = 0) => {
            if (depth > maxDepth) return;
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        if (!excludeDirs.includes(entry.name)) scan(fullPath, depth + 1);
                    } else {
                        try {
                            const info = this.inspect(fullPath);
                            results.files.push(info);
                            results.summary.total++;
                            results.summary.totalSize += info.size || 0;
                            
                            const typeName = info.type?.type || 'unknown';
                            results.summary.byType[typeName] = (results.summary.byType[typeName] || 0) + 1;
                            
                            const ext = info.extension || '.unknown';
                            results.summary.byExtension[ext] = (results.summary.byExtension[ext] || 0) + 1;
                            
                            if (info.scan?.findings?.length > 0) {
                                results.summary.warnings += info.scan.findings.length;
                            }
                        } catch { results.summary.errors++; }
                    }
                }
            } catch { results.summary.errors++; }
        };

        scan(dirPath);
        results.summary.totalSizeHuman = this.formatSize(results.summary.totalSize);
        return results;
    }

    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes, unit = 0;
        while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++; }
        return `${size.toFixed(2)} ${units[unit]}`;
    }
}

module.exports = FileInspector;
