/**
 * SimWidget Telemetry Service v1.0.0
 * Last Updated: 2025-01-07
 * 
 * Error capture and feedback submission to Supabase.
 * Include: <script src="/ui/shared/telemetry.js"></script>
 */

class TelemetryService {
    constructor(options = {}) {
        // Supabase config - will be set via environment/config
        this.supabaseUrl = options.supabaseUrl || '';
        this.supabaseKey = options.supabaseKey || '';
        this.enabled = options.enabled !== false;
        
        // Widget context
        this.widget = options.widget || 'unknown';
        this.version = options.version || '0.0.0';
        this.platform = this.detectPlatform();
        this.sessionId = this.generateSessionId();
        
        // Error deduplication
        this.errorCache = new Map(); // hash -> { count, firstSeen, lastSeen }
        this.errorQueue = [];
        this.maxQueueSize = 50;
        
        // Batch settings
        this.batchInterval = options.batchInterval || 60000; // 60 seconds
        this.batchTimer = null;
        
        // Start batch processor
        if (this.enabled && this.supabaseUrl) {
            this.startBatchProcessor();
        }
        
        // Global error handler
        if (options.captureGlobalErrors !== false) {
            this.setupGlobalErrorHandler();
        }
    }
    
    detectPlatform() {
        if (window.name === 'ingamepanel' || typeof Coherent !== 'undefined') {
            return 'msfs-panel';
        }
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            return 'mobile';
        }
        return 'desktop';
    }
    
    generateSessionId() {
        return 'sess_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Generate error signature for deduplication
     */
    hashError(message, source) {
        const str = `${this.widget}:${message}:${source || ''}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'err_' + Math.abs(hash).toString(36);
    }
    
    /**
     * Capture an error (deduplicated)
     */
    captureError(error, context = {}) {
        if (!this.enabled) return;
        
        const message = error.message || String(error);
        const stack = error.stack || '';
        const source = stack.split('\n')[1]?.trim() || '';
        const hash = this.hashError(message, source);
        
        // Check if already captured this session
        if (this.errorCache.has(hash)) {
            const cached = this.errorCache.get(hash);
            cached.count++;
            cached.lastSeen = new Date().toISOString();
            return; // Don't queue duplicate
        }
        
        // New unique error
        const errorData = {
            id: hash,
            widget: this.widget,
            version: this.version,
            platform: this.platform,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            severity: context.severity || 'error',
            message: message.substring(0, 500), // Limit length
            stack: stack.substring(0, 1000),
            context: {
                url: window.location.href,
                userAgent: navigator.userAgent.substring(0, 200),
                ...context
            },
            count: 1
        };
        
        this.errorCache.set(hash, {
            count: 1,
            firstSeen: errorData.timestamp,
            lastSeen: errorData.timestamp
        });
        
        this.errorQueue.push(errorData);
        
        // Trim queue if too large
        if (this.errorQueue.length > this.maxQueueSize) {
            this.errorQueue.shift();
        }
        
        console.debug('[Telemetry] Captured error:', hash, message);
    }
    
    /**
     * Capture a warning
     */
    captureWarning(message, context = {}) {
        this.captureError({ message }, { ...context, severity: 'warning' });
    }
    
    /**
     * Setup global error handler
     */
    setupGlobalErrorHandler() {
        window.addEventListener('error', (event) => {
            this.captureError(event.error || { message: event.message }, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.captureError(event.reason || { message: 'Unhandled Promise rejection' }, {
                type: 'unhandledrejection'
            });
        });
    }
    
    /**
     * Start batch processor
     */
    startBatchProcessor() {
        this.batchTimer = setInterval(() => this.flushErrors(), this.batchInterval);
    }
    
    /**
     * Flush error queue to Supabase
     */
    async flushErrors() {
        if (this.errorQueue.length === 0 || !this.supabaseUrl) return;
        
        const errors = [...this.errorQueue];
        this.errorQueue = [];
        
        try {
            const response = await fetch(`${this.supabaseUrl}/rest/v1/errors`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(errors)
            });
            
            if (!response.ok) {
                console.warn('[Telemetry] Failed to flush errors:', response.status);
                // Re-queue failed errors
                this.errorQueue.push(...errors);
            } else {
                console.debug('[Telemetry] Flushed', errors.length, 'errors');
            }
        } catch (e) {
            console.warn('[Telemetry] Flush failed:', e.message);
            this.errorQueue.push(...errors);
        }
    }
    
    /**
     * Submit user feedback
     */
    async submitFeedback(feedback, rating = null) {
        if (!this.supabaseUrl) {
            console.warn('[Telemetry] Supabase not configured');
            return { success: false, error: 'Not configured' };
        }
        
        const data = {
            widget: this.widget,
            version: this.version,
            platform: this.platform,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            feedback: feedback.substring(0, 200), // Limit to 200 chars
            rating: rating,
            context: {
                url: window.location.href
            }
        };
        
        try {
            const response = await fetch(`${this.supabaseUrl}/rest/v1/feedback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                console.debug('[Telemetry] Feedback submitted');
                return { success: true };
            } else {
                return { success: false, error: `HTTP ${response.status}` };
            }
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
    
    /**
     * Get error stats for this session
     */
    getStats() {
        let totalErrors = 0;
        this.errorCache.forEach(e => totalErrors += e.count);
        
        return {
            uniqueErrors: this.errorCache.size,
            totalErrors,
            queuedErrors: this.errorQueue.length,
            sessionId: this.sessionId
        };
    }
    
    /**
     * Cleanup
     */
    destroy() {
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
        }
        this.flushErrors(); // Final flush
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TelemetryService;
}
