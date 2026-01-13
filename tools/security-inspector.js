/**
 * SimWidget Security Inspector v1.0.0
 * 
 * Multi-file inspector with security scanning for community widgets
 * Detects malicious code patterns, suspicious URLs, obfuscation
 * 
 * Supported: JS, HTML, CSS, JSON, DLL, EXE, ZIP
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\tools\security-inspector.js
 * Last Updated: 2025-01-08
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ============================================================
// SECURITY PATTERNS
// ============================================================

const SECURITY_RULES = {
    // JavaScript dangerous patterns
    js: {
        critical: [
            { pattern: /eval\s*\(/gi, message: 'eval() - Code execution vulnerability' },
            { pattern: /new\s+Function\s*\(/gi, message: 'new Function() - Dynamic code execution' },
            { pattern: /document\.write\s*\(/gi, message: 'document.write() - DOM injection risk' },
            { pattern: /\.innerHTML\s*=/gi, message: 'innerHTML assignment - XSS vulnerability' },
            { pattern: /\.outerHTML\s*=/gi, message: 'outerHTML assignment - XSS vulnerability' },
            { pattern: /document\.cookie/gi, message: 'Cookie access - Data theft risk' },
            { pattern: /localStorage\s*\.\s*(setItem|getItem|removeItem)/gi, message: 'localStorage access - Check data handling' },
            { pattern: /sessionStorage/gi, message: 'sessionStorage access - Check data handling' },
            { pattern: /indexedDB/gi, message: 'IndexedDB access - Local database manipulation' },
        ],
        high: [
            { pattern: /fetch\s*\(\s*['"`]https?:\/\/(?!localhost|127\.0\.0\.1)/gi, message: 'External fetch() - Data exfiltration risk' },
            { pattern: /XMLHttpRequest/gi, message: 'XMLHttpRequest - Network access' },
            { pattern: /new\s+WebSocket\s*\(\s*['"`]wss?:\/\/(?!localhost|127\.0\.0\.1)/gi, message: 'External WebSocket - Unauthorized connection' },
            { pattern: /navigator\.(geolocation|mediaDevices|credentials|clipboard)/gi, message: 'Sensitive API access' },
            { pattern: /window\.(open|location|parent|top|frames)/gi, message: 'Window manipulation - Redirect/framing risk' },
            { pattern: /document\.(domain|referrer|URL)/gi, message: 'Document property access' },
            { pattern: /\.src\s*=\s*['"`]https?:\/\//gi, message: 'Dynamic external resource loading' },
            { pattern: /atob\s*\(|btoa\s*\(/gi, message: 'Base64 encoding - Possible obfuscation' },
            { pattern: /String\.fromCharCode/gi, message: 'Character code conversion - Possible obfuscation' },
            { pattern: /\\x[0-9a-f]{2}/gi, message: 'Hex escape sequences - Possible obfuscation' },
            { pattern: /\\u[0-9a-f]{4}/gi, message: 'Unicode escapes - Check for obfuscation' },
        ],
        medium: [
            { pattern: /setTimeout\s*\(\s*['"`]/gi, message: 'setTimeout with string - Use function instead' },
            { pattern: /setInterval\s*\(\s*['"`]/gi, message: 'setInterval with string - Use function instead' },
            { pattern: /\.insertAdjacentHTML/gi, message: 'insertAdjacentHTML - Sanitize input' },
            { pattern: /\.createElement\s*\(\s*['"`]script/gi, message: 'Dynamic script creation' },
            { pattern: /import\s*\(\s*['"`]https?:\/\//gi, message: 'Dynamic import from URL' },
            { pattern: /require\s*\(\s*['"`]child_process/gi, message: 'Node.js child_process - Command execution' },
            { pattern: /require\s*\(\s*['"`]fs/gi, message: 'Node.js fs - File system access' },
            { pattern: /require\s*\(\s*['"`]net/gi, message: 'Node.js net - Network access' },
            { pattern: /process\.env/gi, message: 'Environment variable access' },
            { pattern: /__dirname|__filename/gi, message: 'Path disclosure' },
        ],
        info: [
            { pattern: /console\.(log|warn|error|debug)/gi, message: 'Console logging - Remove in production' },
            { pattern: /debugger;/gi, message: 'Debugger statement' },
            { pattern: /\/\/\s*TODO|FIXME|HACK|XXX/gi, message: 'Development comment' },
        ]
    },

    // HTML dangerous patterns
    html: {
        critical: [
            { pattern: /<script[^>]*src\s*=\s*['"]https?:\/\/(?!localhost|127\.0\.0\.1)[^'"]+['"]/gi, message: 'External script - Unauthorized code loading' },
            { pattern: /on(click|load|error|mouseover|mouseout|focus|blur|change|submit|keydown|keyup)\s*=/gi, message: 'Inline event handler - Move to JS file' },
            { pattern: /javascript:/gi, message: 'javascript: protocol - XSS vector' },
            { pattern: /data:\s*text\/html/gi, message: 'data: HTML - XSS vector' },
            { pattern: /<iframe[^>]*src\s*=\s*['"]https?:\/\//gi, message: 'External iframe - Clickjacking risk' },
            { pattern: /<object|<embed|<applet/gi, message: 'Plugin element - Security risk' },
        ],
        high: [
            { pattern: /<link[^>]*href\s*=\s*['"]https?:\/\/(?!localhost|127\.0\.0\.1|cdnjs|unpkg|jsdelivr)/gi, message: 'External stylesheet - Check source' },
            { pattern: /<img[^>]*src\s*=\s*['"]https?:\/\/(?!localhost|127\.0\.0\.1)/gi, message: 'External image - Tracking pixel risk' },
            { pattern: /<form[^>]*action\s*=\s*['"]https?:\/\//gi, message: 'External form action - Data exfiltration' },
            { pattern: /<meta[^>]*http-equiv\s*=\s*['"]refresh/gi, message: 'Meta refresh - Redirect risk' },
            { pattern: /<base[^>]*href/gi, message: 'Base tag - URL hijacking' },
        ],
        medium: [
            { pattern: /<!--[\s\S]*?-->/g, message: 'HTML comment - Check for sensitive data' },
            { pattern: /<input[^>]*type\s*=\s*['"]hidden/gi, message: 'Hidden input - Check value' },
        ]
    },

    // CSS dangerous patterns
    css: {
        high: [
            { pattern: /@import\s+url\s*\(\s*['"]https?:\/\/(?!localhost|127\.0\.0\.1|cdnjs|unpkg|jsdelivr)/gi, message: 'External CSS import' },
            { pattern: /url\s*\(\s*['"]https?:\/\/(?!localhost|127\.0\.0\.1)/gi, message: 'External URL reference' },
            { pattern: /expression\s*\(/gi, message: 'CSS expression - IE XSS vector' },
            { pattern: /behavior\s*:/gi, message: 'CSS behavior - IE security issue' },
            { pattern: /-moz-binding/gi, message: 'Firefox XBL binding - Security risk' },
        ],
        medium: [
            { pattern: /url\s*\(\s*['"]data:/gi, message: 'Data URL in CSS - Check content' },
        ]
    },

    // JSON patterns
    json: {
        high: [
            { pattern: /https?:\/\/(?!localhost|127\.0\.0\.1|api\.simwidget)/gi, message: 'External URL in config' },
            { pattern: /"(password|secret|key|token|apikey|api_key)":/gi, message: 'Sensitive field - Check if needed' },
        ],
        medium: [
            { pattern: /"(eval|exec|shell|cmd|command)":/gi, message: 'Command-related field' },
        ]
    }
};

// Allowed external domains (CDNs, known safe)
const ALLOWED_DOMAINS = [
    'localhost',
    '127.0.0.1',
    'cdnjs.cloudflare.com',
    'unpkg.com',
    'jsdelivr.net',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
];

// ============================================================
// INSPECTOR CLASS
// ============================================================

class SecurityInspector {
    constructor() {
        this.results = {
            file: null,
            type: null,
            size: 0,
            hash: null,
            issues: [],
            metadata: {},
            safe: true
        };
    }

    /**
     * Inspect a file or directory
     */
    async inspect(targetPath) {
        const stats = fs.statSync(targetPath);
        
        if (stats.isDirectory()) {
            return this.inspectDirectory(targetPath);
        }
        
        return this.inspectFile(targetPath);
    }

    /**
     * Inspect entire widget directory
     */
    async inspectDirectory(dirPath) {
        const results = {
            directory: dirPath,
            files: [],
            summary: {
                total: 0,
                critical: 0,
                high: 0,
                medium: 0,
                info: 0,
                safe: true
            }
        };

        const files = this.walkDir(dirPath);
        
        for (const file of files) {
            const fileResult = await this.inspectFile(file);
            results.files.push(fileResult);
            
            // Aggregate counts
            results.summary.total++;
            for (const issue of fileResult.issues) {
                results.summary[issue.severity]++;
                if (issue.severity === 'critical' || issue.severity === 'high') {
                    results.summary.safe = false;
                }
            }
        }

        return results;
    }

    /**
     * Walk directory recursively
     */
    walkDir(dir, files = []) {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                // Skip node_modules, .git
                if (!['node_modules', '.git', 'dist', 'build'].includes(item)) {
                    this.walkDir(fullPath, files);
                }
            } else {
                files.push(fullPath);
            }
        }
        
        return files;
    }

    /**
     * Inspect single file
     */
    async inspectFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const content = fs.readFileSync(filePath);
        
        this.results = {
            file: filePath,
            filename: path.basename(filePath),
            type: ext,
            size: content.length,
            hash: {
                md5: crypto.createHash('md5').update(content).digest('hex'),
                sha256: crypto.createHash('sha256').update(content).digest('hex')
            },
            issues: [],
            metadata: {},
            safe: true
        };

        switch (ext) {
            case '.js':
            case '.mjs':
                this.scanJavaScript(content.toString());
                break;
            case '.html':
            case '.htm':
                this.scanHTML(content.toString());
                break;
            case '.css':
                this.scanCSS(content.toString());
                break;
            case '.json':
                this.scanJSON(content.toString());
                break;
            case '.dll':
                await this.scanDLL(filePath);
                break;
            case '.exe':
                await this.scanEXE(filePath);
                break;
            case '.zip':
                this.scanZIP(filePath);
                break;
            default:
                this.results.metadata.note = 'Unrecognized file type';
        }

        // Check obfuscation
        if (['.js', '.html'].includes(ext)) {
            this.checkObfuscation(content.toString());
        }

        // Determine safety
        this.results.safe = !this.results.issues.some(i => 
            i.severity === 'critical' || i.severity === 'high'
        );

        return this.results;
    }

    /**
     * Scan JavaScript for security issues
     */
    scanJavaScript(content) {
        this.results.metadata.lines = content.split('\n').length;
        this.results.metadata.characters = content.length;
        
        for (const [severity, rules] of Object.entries(SECURITY_RULES.js)) {
            for (const rule of rules) {
                const matches = content.match(rule.pattern);
                if (matches) {
                    this.results.issues.push({
                        severity,
                        message: rule.message,
                        count: matches.length,
                        samples: matches.slice(0, 3)
                    });
                }
            }
        }

        // Check for minified/obfuscated code
        const avgLineLength = content.length / (content.split('\n').length || 1);
        if (avgLineLength > 500) {
            this.results.issues.push({
                severity: 'high',
                message: 'Heavily minified/obfuscated code detected',
                count: 1,
                samples: [`Average line length: ${Math.round(avgLineLength)}`]
            });
        }

        // Extract URLs
        const urls = content.match(/https?:\/\/[^\s'"`)]+/g) || [];
        this.results.metadata.externalUrls = [...new Set(urls)].filter(url => 
            !ALLOWED_DOMAINS.some(d => url.includes(d))
        );
    }

    /**
     * Scan HTML for security issues
     */
    scanHTML(content) {
        this.results.metadata.lines = content.split('\n').length;
        
        for (const [severity, rules] of Object.entries(SECURITY_RULES.html)) {
            for (const rule of rules) {
                const matches = content.match(rule.pattern);
                if (matches) {
                    this.results.issues.push({
                        severity,
                        message: rule.message,
                        count: matches.length,
                        samples: matches.slice(0, 3)
                    });
                }
            }
        }

        // Check for inline scripts
        const inlineScripts = content.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
        if (inlineScripts.length > 0) {
            this.results.metadata.inlineScripts = inlineScripts.length;
            // Scan inline script content
            for (const script of inlineScripts) {
                const scriptContent = script.replace(/<\/?script[^>]*>/gi, '');
                if (scriptContent.trim()) {
                    this.scanJavaScript(scriptContent);
                }
            }
        }
    }

    /**
     * Scan CSS for security issues
     */
    scanCSS(content) {
        this.results.metadata.lines = content.split('\n').length;
        
        for (const [severity, rules] of Object.entries(SECURITY_RULES.css)) {
            for (const rule of rules) {
                const matches = content.match(rule.pattern);
                if (matches) {
                    this.results.issues.push({
                        severity,
                        message: rule.message,
                        count: matches.length,
                        samples: matches.slice(0, 3)
                    });
                }
            }
        }
    }

    /**
     * Scan JSON for security issues
     */
    scanJSON(content) {
        try {
            const parsed = JSON.parse(content);
            this.results.metadata.valid = true;
            this.results.metadata.keys = Object.keys(parsed);
            
            // Check for suspicious patterns in stringified content
            for (const [severity, rules] of Object.entries(SECURITY_RULES.json)) {
                for (const rule of rules) {
                    const matches = content.match(rule.pattern);
                    if (matches) {
                        this.results.issues.push({
                            severity,
                            message: rule.message,
                            count: matches.length,
                            samples: matches.slice(0, 3)
                        });
                    }
                }
            }

            // Validate widget manifest if applicable
            if (parsed.id && parsed.entry) {
                this.validateWidgetManifest(parsed);
            }
        } catch (err) {
            this.results.metadata.valid = false;
            this.results.issues.push({
                severity: 'high',
                message: 'Invalid JSON - Parse error',
                count: 1,
                samples: [err.message]
            });
        }
    }

    /**
     * Validate widget manifest schema
     */
    validateWidgetManifest(manifest) {
        const required = ['id', 'name', 'version', 'entry'];
        const missing = required.filter(f => !manifest[f]);
        
        if (missing.length > 0) {
            this.results.issues.push({
                severity: 'medium',
                message: 'Missing required manifest fields',
                count: missing.length,
                samples: missing
            });
        }

        // Check for suspicious commands
        if (manifest.commands) {
            const suspicious = manifest.commands.filter(c => 
                /exec|shell|cmd|eval|rm|del/i.test(c)
            );
            if (suspicious.length > 0) {
                this.results.issues.push({
                    severity: 'high',
                    message: 'Suspicious commands in manifest',
                    count: suspicious.length,
                    samples: suspicious
                });
            }
        }
    }

    /**
     * Scan DLL file
     */
    async scanDLL(filePath) {
        try {
            // Get PE info using PowerShell
            const cmd = `
                $dll = [System.Reflection.Assembly]::LoadFile('${filePath.replace(/'/g, "''")}')
                @{
                    Name = $dll.GetName().Name
                    Version = $dll.GetName().Version.ToString()
                    Culture = $dll.GetName().CultureInfo.Name
                    PublicKeyToken = [BitConverter]::ToString($dll.GetName().GetPublicKeyToken()).Replace('-','')
                    Signed = $dll.GetName().GetPublicKeyToken().Length -gt 0
                    Types = $dll.GetExportedTypes().Count
                } | ConvertTo-Json
            `;
            
            const result = execSync(`powershell -Command "${cmd.replace(/"/g, '\\"')}"`, {
                encoding: 'utf8',
                timeout: 10000
            });
            
            const info = JSON.parse(result);
            this.results.metadata = { ...this.results.metadata, ...info };
            
            if (!info.Signed) {
                this.results.issues.push({
                    severity: 'medium',
                    message: 'DLL is not signed',
                    count: 1,
                    samples: ['No public key token']
                });
            }
        } catch (err) {
            // Try basic PE header analysis
            this.scanPEHeader(filePath);
        }
    }

    /**
     * Scan EXE file
     */
    async scanEXE(filePath) {
        this.scanPEHeader(filePath);
        
        // Check for known suspicious patterns in strings
        const content = fs.readFileSync(filePath);
        const strings = this.extractStrings(content);
        
        const suspicious = strings.filter(s => 
            /cmd\.exe|powershell|regsvr32|mshta|wscript|cscript/i.test(s)
        );
        
        if (suspicious.length > 0) {
            this.results.issues.push({
                severity: 'high',
                message: 'Suspicious strings in executable',
                count: suspicious.length,
                samples: suspicious.slice(0, 5)
            });
        }

        // Check for packed/encrypted sections
        const packerSignatures = ['UPX', 'ASPack', 'PECompact', 'Themida'];
        const packerFound = strings.filter(s => 
            packerSignatures.some(p => s.includes(p))
        );
        
        if (packerFound.length > 0) {
            this.results.issues.push({
                severity: 'high',
                message: 'Packer detected - Code may be obfuscated',
                count: 1,
                samples: packerFound
            });
        }
    }

    /**
     * Basic PE header analysis
     */
    scanPEHeader(filePath) {
        const content = fs.readFileSync(filePath);
        
        // Check MZ header
        if (content[0] !== 0x4D || content[1] !== 0x5A) {
            this.results.issues.push({
                severity: 'high',
                message: 'Invalid PE file - Missing MZ header',
                count: 1,
                samples: []
            });
            return;
        }

        // Get PE offset
        const peOffset = content.readUInt32LE(0x3C);
        
        // Check PE signature
        if (content.readUInt32LE(peOffset) !== 0x00004550) {
            this.results.issues.push({
                severity: 'high',
                message: 'Invalid PE signature',
                count: 1,
                samples: []
            });
            return;
        }

        // Parse COFF header
        const machine = content.readUInt16LE(peOffset + 4);
        const sections = content.readUInt16LE(peOffset + 6);
        const timestamp = content.readUInt32LE(peOffset + 8);
        
        this.results.metadata.architecture = machine === 0x8664 ? 'x64' : machine === 0x14c ? 'x86' : `0x${machine.toString(16)}`;
        this.results.metadata.sections = sections;
        this.results.metadata.compiled = new Date(timestamp * 1000).toISOString();

        // Check for suspicious timestamp
        const compileDate = new Date(timestamp * 1000);
        const now = new Date();
        if (compileDate > now || compileDate < new Date('1990-01-01')) {
            this.results.issues.push({
                severity: 'medium',
                message: 'Suspicious compile timestamp',
                count: 1,
                samples: [this.results.metadata.compiled]
            });
        }
    }

    /**
     * Extract printable strings from binary
     */
    extractStrings(buffer, minLength = 4) {
        const strings = [];
        let current = '';
        
        for (let i = 0; i < buffer.length; i++) {
            const char = buffer[i];
            if (char >= 32 && char <= 126) {
                current += String.fromCharCode(char);
            } else {
                if (current.length >= minLength) {
                    strings.push(current);
                }
                current = '';
            }
        }
        
        return [...new Set(strings)];
    }

    /**
     * Scan ZIP file
     */
    scanZIP(filePath) {
        // Basic ZIP header check
        const content = fs.readFileSync(filePath);
        
        if (content[0] !== 0x50 || content[1] !== 0x4B) {
            this.results.issues.push({
                severity: 'high',
                message: 'Invalid ZIP file header',
                count: 1,
                samples: []
            });
            return;
        }

        this.results.metadata.note = 'ZIP file detected - Extract and scan contents individually';
        this.results.issues.push({
            severity: 'info',
            message: 'Archive file - Requires extraction for full scan',
            count: 1,
            samples: []
        });
    }

    /**
     * Check for code obfuscation
     */
    checkObfuscation(content) {
        // Entropy check
        const entropy = this.calculateEntropy(content);
        this.results.metadata.entropy = entropy.toFixed(2);
        
        if (entropy > 5.5) {
            this.results.issues.push({
                severity: 'medium',
                message: `High entropy (${entropy.toFixed(2)}) - Possible obfuscation`,
                count: 1,
                samples: []
            });
        }

        // Variable name patterns (single letter, hex-like)
        const obfuscatedVars = content.match(/\b_0x[a-f0-9]+\b|\b[a-z](?:\d+)?\b(?=\s*[=\(])/gi) || [];
        if (obfuscatedVars.length > 50) {
            this.results.issues.push({
                severity: 'medium',
                message: 'Obfuscated variable names detected',
                count: obfuscatedVars.length,
                samples: [...new Set(obfuscatedVars)].slice(0, 5)
            });
        }
    }

    /**
     * Calculate Shannon entropy
     */
    calculateEntropy(content) {
        const freq = {};
        for (const char of content) {
            freq[char] = (freq[char] || 0) + 1;
        }
        
        let entropy = 0;
        const len = content.length;
        
        for (const count of Object.values(freq)) {
            const p = count / len;
            entropy -= p * Math.log2(p);
        }
        
        return entropy;
    }
}

// ============================================================
// CLI
// ============================================================

const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    bold: '\x1b[1m'
};

function printResults(results) {
    console.log(`\n${COLORS.blue}${COLORS.bold}╔════════════════════════════════════════╗${COLORS.reset}`);
    console.log(`${COLORS.blue}${COLORS.bold}║   SimWidget Security Inspector v1.0.0  ║${COLORS.reset}`);
    console.log(`${COLORS.blue}${COLORS.bold}╚════════════════════════════════════════╝${COLORS.reset}\n`);

    if (results.directory) {
        // Directory results
        console.log(`${COLORS.bold}Directory:${COLORS.reset} ${results.directory}`);
        console.log(`${COLORS.bold}Files Scanned:${COLORS.reset} ${results.summary.total}\n`);
        
        console.log(`${COLORS.bold}Summary:${COLORS.reset}`);
        console.log(`  ${COLORS.red}Critical: ${results.summary.critical}${COLORS.reset}`);
        console.log(`  ${COLORS.red}High: ${results.summary.high}${COLORS.reset}`);
        console.log(`  ${COLORS.yellow}Medium: ${results.summary.medium}${COLORS.reset}`);
        console.log(`  Info: ${results.summary.info}`);
        console.log();

        const status = results.summary.safe 
            ? `${COLORS.green}✓ SAFE${COLORS.reset}`
            : `${COLORS.red}✗ ISSUES FOUND${COLORS.reset}`;
        console.log(`${COLORS.bold}Status:${COLORS.reset} ${status}\n`);

        // Show files with issues
        const filesWithIssues = results.files.filter(f => f.issues.length > 0);
        if (filesWithIssues.length > 0) {
            console.log(`${COLORS.bold}Files with Issues:${COLORS.reset}\n`);
            for (const file of filesWithIssues) {
                printFileIssues(file);
            }
        }
    } else {
        // Single file results
        printFileIssues(results);
    }
}

function printFileIssues(file) {
    const icon = file.safe ? `${COLORS.green}✓${COLORS.reset}` : `${COLORS.red}✗${COLORS.reset}`;
    console.log(`${icon} ${COLORS.bold}${file.filename}${COLORS.reset} (${file.type})`);
    console.log(`  Size: ${file.size} bytes | Hash: ${file.hash.md5.substring(0, 8)}...`);
    
    if (file.metadata.lines) {
        console.log(`  Lines: ${file.metadata.lines}`);
    }
    if (file.metadata.entropy) {
        console.log(`  Entropy: ${file.metadata.entropy}`);
    }
    if (file.metadata.externalUrls?.length > 0) {
        console.log(`  External URLs: ${file.metadata.externalUrls.length}`);
    }

    if (file.issues.length > 0) {
        console.log(`\n  ${COLORS.bold}Issues:${COLORS.reset}`);
        
        const grouped = {};
        for (const issue of file.issues) {
            if (!grouped[issue.severity]) grouped[issue.severity] = [];
            grouped[issue.severity].push(issue);
        }

        for (const [severity, issues] of Object.entries(grouped)) {
            const color = severity === 'critical' || severity === 'high' 
                ? COLORS.red 
                : severity === 'medium' 
                    ? COLORS.yellow 
                    : COLORS.reset;
            
            for (const issue of issues) {
                console.log(`  ${color}[${severity.toUpperCase()}]${COLORS.reset} ${issue.message} (${issue.count}x)`);
                if (issue.samples?.length > 0) {
                    for (const sample of issue.samples.slice(0, 2)) {
                        const truncated = sample.length > 60 ? sample.substring(0, 60) + '...' : sample;
                        console.log(`    → ${truncated}`);
                    }
                }
            }
        }
    }
    console.log();
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        console.log(`
Usage: node security-inspector.js <path> [options]

Options:
  --json     Output as JSON
  --help     Show this help

Examples:
  node security-inspector.js widget.js
  node security-inspector.js ./my-widget/
  node security-inspector.js addon.dll --json
`);
        process.exit(0);
    }

    const targetPath = args.find(a => !a.startsWith('--'));
    const jsonOutput = args.includes('--json');

    if (!fs.existsSync(targetPath)) {
        console.error(`Error: Path not found: ${targetPath}`);
        process.exit(1);
    }

    const inspector = new SecurityInspector();
    const results = await inspector.inspect(targetPath);

    if (jsonOutput) {
        console.log(JSON.stringify(results, null, 2));
    } else {
        printResults(results);
    }

    // Exit code based on safety
    const safe = results.safe ?? results.summary?.safe;
    process.exit(safe ? 0 : 1);
}

// Export for module use
module.exports = SecurityInspector;

// Run CLI if executed directly
if (require.main === module) {
    main().catch(console.error);
}
