/**
 * SimWidget Security API v1.0.0
 * 
 * REST API endpoints for security scanning
 * Integrates with backend server
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\tools\security-api.js
 * Last Updated: 2025-01-08
 */

const SecurityInspector = require('./security-inspector');
const WidgetValidator = require('./widget-validator');
const path = require('path');
const fs = require('fs');

// ============================================================
// WIDGET-SAFE PATTERNS (Expected in SimWidget context)
// ============================================================

const WIDGET_SAFE_PATTERNS = {
    // These are expected/safe in widget context
    localStorage: true,       // Widgets store settings
    sessionStorage: true,     // Session data
    innerHTML: 'review',      // Flag for review but not block
    fetch_localhost: true,    // Local API calls
    websocket_localhost: true // Local WebSocket
};

/**
 * Register security API routes
 */
function registerSecurityRoutes(app) {
    
    /**
     * POST /api/security/scan
     * Scan a file or directory for security issues
     */
    app.post('/api/security/scan', async (req, res) => {
        try {
            const { path: targetPath, widgetMode = true } = req.body;
            
            if (!targetPath) {
                return res.status(400).json({ error: 'Path required' });
            }

            if (!fs.existsSync(targetPath)) {
                return res.status(404).json({ error: 'Path not found' });
            }

            const inspector = new SecurityInspector();
            const results = await inspector.inspect(targetPath);

            // Apply widget-safe filtering if enabled
            if (widgetMode) {
                filterWidgetSafeIssues(results);
            }

            res.json(results);
        } catch (err) {
            console.error('[Security API] Scan error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    /**
     * POST /api/security/validate
     * Validate a widget package for installation
     */
    app.post('/api/security/validate', async (req, res) => {
        try {
            const { path: widgetPath, strict = false, allowExternal = false } = req.body;
            
            if (!widgetPath) {
                return res.status(400).json({ error: 'Widget path required' });
            }

            if (!fs.existsSync(widgetPath)) {
                return res.status(404).json({ error: 'Widget path not found' });
            }

            const validator = new WidgetValidator({
                strict,
                allowExternal
            });
            
            const results = await validator.validate(widgetPath);

            // Apply widget-safe filtering
            filterWidgetSafeIssues(results.security);

            // Recalculate validity after filtering
            results.valid = results.errors.length === 0;

            res.json(results);
        } catch (err) {
            console.error('[Security API] Validate error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    /**
     * GET /api/security/rules
     * Get current security rules
     */
    app.get('/api/security/rules', (req, res) => {
        res.json({
            widgetSafePatterns: WIDGET_SAFE_PATTERNS,
            blockedFileTypes: ['.exe', '.dll', '.bat', '.cmd', '.ps1', '.vbs', '.sh'],
            allowedDomains: [
                'localhost',
                '127.0.0.1',
                'cdnjs.cloudflare.com',
                'unpkg.com',
                'jsdelivr.net'
            ],
            maxFileSize: '5MB',
            maxTotalSize: '20MB'
        });
    });

    /**
     * POST /api/security/hash
     * Calculate file hashes
     */
    app.post('/api/security/hash', (req, res) => {
        try {
            const { path: filePath } = req.body;
            
            if (!filePath || !fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'File not found' });
            }

            const crypto = require('crypto');
            const content = fs.readFileSync(filePath);

            res.json({
                file: filePath,
                size: content.length,
                md5: crypto.createHash('md5').update(content).digest('hex'),
                sha256: crypto.createHash('sha256').update(content).digest('hex'),
                sha512: crypto.createHash('sha512').update(content).digest('hex')
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    console.log('[Security API] Routes registered');
}

/**
 * Filter out widget-safe issues
 */
function filterWidgetSafeIssues(results) {
    if (!results) return;

    const filterIssues = (issues) => {
        return issues.filter(issue => {
            // Keep critical non-storage issues
            if (issue.severity === 'critical') {
                // Allow localStorage/sessionStorage in widgets
                if (issue.message.includes('localStorage') || 
                    issue.message.includes('sessionStorage')) {
                    issue.severity = 'info';
                    issue.message += ' (Expected in widget context)';
                    return true;
                }
            }

            // Downgrade innerHTML to medium (common in widgets)
            if (issue.message.includes('innerHTML')) {
                issue.severity = 'medium';
                issue.message += ' (Review for user input)';
            }

            // Allow localhost connections
            if (issue.message.includes('localhost') || 
                issue.message.includes('127.0.0.1')) {
                return false;
            }

            // Allow window.location for local navigation
            if (issue.message.includes('window') && 
                issue.message.includes('location')) {
                issue.severity = 'info';
            }

            return true;
        });
    };

    // Filter single file results
    if (results.issues) {
        results.issues = filterIssues(results.issues);
    }

    // Filter directory results
    if (results.files) {
        for (const file of results.files) {
            if (file.issues) {
                file.issues = filterIssues(file.issues);
            }
        }

        // Recalculate summary
        if (results.summary) {
            results.summary.critical = 0;
            results.summary.high = 0;
            results.summary.medium = 0;
            results.summary.info = 0;

            for (const file of results.files) {
                for (const issue of file.issues || []) {
                    results.summary[issue.severity]++;
                }
            }

            results.summary.safe = results.summary.critical === 0 && 
                                   results.summary.high === 0;
        }
    }
}

module.exports = { registerSecurityRoutes, filterWidgetSafeIssues };
