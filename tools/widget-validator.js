/**
 * SimWidget Community Widget Validator v1.0.0
 * 
 * Validates community widget packages before installation
 * Checks security, structure, manifest, and compatibility
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\tools\widget-validator.js
 * Last Updated: 2025-01-08
 */

const fs = require('fs');
const path = require('path');
const SecurityInspector = require('./security-inspector');

// ============================================================
// VALIDATION RULES
// ============================================================

const REQUIRED_FILES = ['index.html'];
const RECOMMENDED_FILES = ['manifest.json', 'widget.js', 'widget.css'];

const MANIFEST_SCHEMA = {
    required: ['id', 'name', 'version', 'entry'],
    optional: ['type', 'author', 'description', 'category', 'width', 'height', 
               'minWidth', 'minHeight', 'resizable', 'transparent', 'simVars', 
               'commands', 'dependencies', 'settings', 'components'],
    types: {
        id: 'string',
        name: 'string',
        version: 'string',
        entry: 'string',
        type: 'string',
        author: 'string',
        description: 'string',
        category: 'string',
        width: 'number',
        height: 'number',
        minWidth: 'number',
        minHeight: 'number',
        resizable: 'boolean',
        transparent: 'boolean',
        simVars: 'array',
        commands: 'array',
        dependencies: 'array',
        settings: 'object',
        components: 'array'
    }
};

const BLOCKED_PATTERNS = {
    // File system access
    filenames: [
        /\.exe$/i,
        /\.dll$/i,
        /\.bat$/i,
        /\.cmd$/i,
        /\.ps1$/i,
        /\.vbs$/i,
        /\.sh$/i,
        /\.msi$/i,
        /\.scr$/i
    ],
    // Dangerous paths
    paths: [
        /\.\./,  // Path traversal
        /^[a-z]:\\/i,  // Absolute Windows paths
        /^\//  // Absolute Unix paths
    ]
};

// ============================================================
// VALIDATOR CLASS
// ============================================================

class WidgetValidator {
    constructor(options = {}) {
        this.options = {
            strict: false,  // Fail on warnings
            allowExternal: false,  // Allow external URLs
            maxFileSize: 5 * 1024 * 1024,  // 5MB per file
            maxTotalSize: 20 * 1024 * 1024,  // 20MB total
            ...options
        };
        
        this.inspector = new SecurityInspector();
        this.results = {
            valid: true,
            errors: [],
            warnings: [],
            info: [],
            security: null,
            structure: null,
            manifest: null
        };
    }

    /**
     * Validate a widget directory
     */
    async validate(widgetPath) {
        console.log(`Validating widget: ${widgetPath}\n`);
        
        // Reset results
        this.results = {
            valid: true,
            errors: [],
            warnings: [],
            info: [],
            security: null,
            structure: null,
            manifest: null,
            path: widgetPath
        };

        // Check if path exists
        if (!fs.existsSync(widgetPath)) {
            this.addError('Widget path does not exist');
            return this.results;
        }

        const stats = fs.statSync(widgetPath);
        if (!stats.isDirectory()) {
            this.addError('Widget path must be a directory');
            return this.results;
        }

        // Run validations
        await this.validateStructure(widgetPath);
        await this.validateManifest(widgetPath);
        await this.validateSecurity(widgetPath);
        await this.validateFiles(widgetPath);

        // Determine final validity
        this.results.valid = this.results.errors.length === 0 && 
            (this.options.strict ? this.results.warnings.length === 0 : true);

        return this.results;
    }

    /**
     * Validate directory structure
     */
    async validateStructure(widgetPath) {
        const files = fs.readdirSync(widgetPath);
        
        this.results.structure = {
            files: files,
            hasRequired: true,
            hasRecommended: true
        };

        // Check required files
        for (const required of REQUIRED_FILES) {
            if (!files.includes(required)) {
                this.addError(`Missing required file: ${required}`);
                this.results.structure.hasRequired = false;
            }
        }

        // Check recommended files
        for (const recommended of RECOMMENDED_FILES) {
            if (!files.includes(recommended)) {
                this.addWarning(`Missing recommended file: ${recommended}`);
                this.results.structure.hasRecommended = false;
            }
        }

        // Check for blocked file types
        for (const file of files) {
            for (const pattern of BLOCKED_PATTERNS.filenames) {
                if (pattern.test(file)) {
                    this.addError(`Blocked file type: ${file}`);
                }
            }
        }

        // Check total size
        const totalSize = this.calculateDirSize(widgetPath);
        this.results.structure.totalSize = totalSize;
        
        if (totalSize > this.options.maxTotalSize) {
            this.addError(`Widget exceeds max size: ${(totalSize / 1024 / 1024).toFixed(2)}MB > ${(this.options.maxTotalSize / 1024 / 1024)}MB`);
        }
    }

    /**
     * Validate manifest.json
     */
    async validateManifest(widgetPath) {
        const manifestPath = path.join(widgetPath, 'manifest.json');
        
        if (!fs.existsSync(manifestPath)) {
            this.addWarning('No manifest.json - using defaults');
            this.results.manifest = { exists: false };
            return;
        }

        try {
            const content = fs.readFileSync(manifestPath, 'utf8');
            const manifest = JSON.parse(content);
            
            this.results.manifest = {
                exists: true,
                valid: true,
                data: manifest
            };

            // Check required fields
            for (const field of MANIFEST_SCHEMA.required) {
                if (!manifest[field]) {
                    this.addError(`Missing required manifest field: ${field}`);
                    this.results.manifest.valid = false;
                }
            }

            // Validate field types
            for (const [field, type] of Object.entries(MANIFEST_SCHEMA.types)) {
                if (manifest[field] !== undefined) {
                    const actualType = Array.isArray(manifest[field]) ? 'array' : typeof manifest[field];
                    if (actualType !== type) {
                        this.addWarning(`Manifest field '${field}' should be ${type}, got ${actualType}`);
                    }
                }
            }

            // Check for unknown fields
            const knownFields = [...MANIFEST_SCHEMA.required, ...MANIFEST_SCHEMA.optional];
            for (const field of Object.keys(manifest)) {
                if (!knownFields.includes(field)) {
                    this.addInfo(`Unknown manifest field: ${field}`);
                }
            }

            // Validate entry file exists
            if (manifest.entry) {
                const entryPath = path.join(widgetPath, manifest.entry);
                if (!fs.existsSync(entryPath)) {
                    this.addError(`Entry file not found: ${manifest.entry}`);
                }
            }

            // Validate version format
            if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
                this.addWarning('Version should follow semver (x.y.z)');
            }

            // Validate ID format
            if (manifest.id && !/^[a-z0-9-]+$/.test(manifest.id)) {
                this.addWarning('ID should be lowercase alphanumeric with hyphens');
            }

            // Check for suspicious commands
            if (manifest.commands) {
                for (const cmd of manifest.commands) {
                    if (/eval|exec|shell|rm|del|format/i.test(cmd)) {
                        this.addError(`Suspicious command in manifest: ${cmd}`);
                    }
                }
            }

        } catch (err) {
            this.addError(`Invalid manifest.json: ${err.message}`);
            this.results.manifest = { exists: true, valid: false, error: err.message };
        }
    }

    /**
     * Run security scan
     */
    async validateSecurity(widgetPath) {
        const securityResults = await this.inspector.inspect(widgetPath);
        this.results.security = securityResults;

        // Process security issues
        if (securityResults.summary) {
            if (securityResults.summary.critical > 0) {
                this.addError(`${securityResults.summary.critical} critical security issues found`);
            }
            if (securityResults.summary.high > 0) {
                this.addError(`${securityResults.summary.high} high security issues found`);
            }
            if (securityResults.summary.medium > 0) {
                this.addWarning(`${securityResults.summary.medium} medium security issues found`);
            }
        }

        // Check for external URLs if not allowed
        if (!this.options.allowExternal && securityResults.files) {
            for (const file of securityResults.files) {
                if (file.metadata?.externalUrls?.length > 0) {
                    this.addError(`External URLs found in ${file.filename}: ${file.metadata.externalUrls.join(', ')}`);
                }
            }
        }
    }

    /**
     * Validate individual files
     */
    async validateFiles(widgetPath) {
        const files = this.walkDir(widgetPath);
        
        for (const file of files) {
            const relPath = path.relative(widgetPath, file);
            const stats = fs.statSync(file);
            
            // Check file size
            if (stats.size > this.options.maxFileSize) {
                this.addError(`File too large: ${relPath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
            }

            // Check for path traversal
            for (const pattern of BLOCKED_PATTERNS.paths) {
                if (pattern.test(relPath)) {
                    this.addError(`Suspicious path: ${relPath}`);
                }
            }
        }
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
                if (!['node_modules', '.git'].includes(item)) {
                    this.walkDir(fullPath, files);
                }
            } else {
                files.push(fullPath);
            }
        }
        
        return files;
    }

    /**
     * Calculate directory size
     */
    calculateDirSize(dir) {
        let size = 0;
        const files = this.walkDir(dir);
        
        for (const file of files) {
            size += fs.statSync(file).size;
        }
        
        return size;
    }

    // Result helpers
    addError(message) {
        this.results.errors.push(message);
        this.results.valid = false;
    }

    addWarning(message) {
        this.results.warnings.push(message);
    }

    addInfo(message) {
        this.results.info.push(message);
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
    console.log(`${COLORS.blue}${COLORS.bold}║   SimWidget Widget Validator v1.0.0    ║${COLORS.reset}`);
    console.log(`${COLORS.blue}${COLORS.bold}╚════════════════════════════════════════╝${COLORS.reset}\n`);

    console.log(`${COLORS.bold}Widget:${COLORS.reset} ${results.path}\n`);

    // Structure
    if (results.structure) {
        console.log(`${COLORS.bold}Structure:${COLORS.reset}`);
        console.log(`  Files: ${results.structure.files.length}`);
        console.log(`  Size: ${(results.structure.totalSize / 1024).toFixed(1)} KB`);
        console.log(`  Required files: ${results.structure.hasRequired ? COLORS.green + '✓' : COLORS.red + '✗'}${COLORS.reset}`);
        console.log(`  Recommended files: ${results.structure.hasRecommended ? COLORS.green + '✓' : COLORS.yellow + '○'}${COLORS.reset}`);
        console.log();
    }

    // Manifest
    if (results.manifest) {
        console.log(`${COLORS.bold}Manifest:${COLORS.reset}`);
        if (results.manifest.exists) {
            console.log(`  Valid: ${results.manifest.valid ? COLORS.green + '✓' : COLORS.red + '✗'}${COLORS.reset}`);
            if (results.manifest.data) {
                console.log(`  ID: ${results.manifest.data.id || 'N/A'}`);
                console.log(`  Name: ${results.manifest.data.name || 'N/A'}`);
                console.log(`  Version: ${results.manifest.data.version || 'N/A'}`);
            }
        } else {
            console.log(`  ${COLORS.yellow}No manifest.json${COLORS.reset}`);
        }
        console.log();
    }

    // Security
    if (results.security?.summary) {
        console.log(`${COLORS.bold}Security Scan:${COLORS.reset}`);
        console.log(`  ${COLORS.red}Critical: ${results.security.summary.critical}${COLORS.reset}`);
        console.log(`  ${COLORS.red}High: ${results.security.summary.high}${COLORS.reset}`);
        console.log(`  ${COLORS.yellow}Medium: ${results.security.summary.medium}${COLORS.reset}`);
        console.log(`  Info: ${results.security.summary.info}`);
        console.log();
    }

    // Errors
    if (results.errors.length > 0) {
        console.log(`${COLORS.red}${COLORS.bold}Errors:${COLORS.reset}`);
        for (const error of results.errors) {
            console.log(`  ${COLORS.red}✗${COLORS.reset} ${error}`);
        }
        console.log();
    }

    // Warnings
    if (results.warnings.length > 0) {
        console.log(`${COLORS.yellow}${COLORS.bold}Warnings:${COLORS.reset}`);
        for (const warning of results.warnings) {
            console.log(`  ${COLORS.yellow}⚠${COLORS.reset} ${warning}`);
        }
        console.log();
    }

    // Info
    if (results.info.length > 0) {
        console.log(`${COLORS.bold}Info:${COLORS.reset}`);
        for (const info of results.info) {
            console.log(`  ℹ ${info}`);
        }
        console.log();
    }

    // Final verdict
    const status = results.valid 
        ? `${COLORS.green}${COLORS.bold}✓ VALID - Safe to install${COLORS.reset}`
        : `${COLORS.red}${COLORS.bold}✗ INVALID - Do not install${COLORS.reset}`;
    
    console.log(`${COLORS.bold}Result:${COLORS.reset} ${status}\n`);
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        console.log(`
Usage: node widget-validator.js <widget-path> [options]

Options:
  --strict          Fail on warnings
  --allow-external  Allow external URLs
  --json            Output as JSON
  --help            Show this help

Examples:
  node widget-validator.js ./my-widget/
  node widget-validator.js ./downloaded-widget/ --strict
  node widget-validator.js ./community-widget/ --json
`);
        process.exit(0);
    }

    const widgetPath = args.find(a => !a.startsWith('--'));
    const options = {
        strict: args.includes('--strict'),
        allowExternal: args.includes('--allow-external')
    };
    const jsonOutput = args.includes('--json');

    const validator = new WidgetValidator(options);
    const results = await validator.validate(widgetPath);

    if (jsonOutput) {
        console.log(JSON.stringify(results, null, 2));
    } else {
        printResults(results);
    }

    process.exit(results.valid ? 0 : 1);
}

// Export for module use
module.exports = WidgetValidator;

// Run CLI if executed directly
if (require.main === module) {
    main().catch(console.error);
}
