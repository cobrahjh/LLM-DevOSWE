/**
 * SimGlass Module Loader v1.0.0
 * Dynamic script loading utility for code splitting
 *
 * Features:
 * - Async script loading with Promise API
 * - Automatic caching (no duplicate loads)
 * - Dependency management
 * - Error handling with telemetry
 *
 * Usage:
 *   const loader = new ModuleLoader({ basePath: './modules' });
 *   await loader.load('my-module.js');
 *   await loader.loadMultiple(['mod1.js', 'mod2.js']); // parallel
 *
 * Path: C:\LLM-DevOSWE\simwidget-hybrid\ui\shared\module-loader.js
 * Last Updated: 2026-02-07
 */

class ModuleLoader {
    constructor(options = {}) {
        this.basePath = options.basePath || '';
        this.timeout = options.timeout || 30000; // 30s default
        this.cache = new Map(); // url -> Promise
        this.telemetry = options.telemetry || null;
    }

    /**
     * Load a single module dynamically
     * @param {string} url - Module URL (relative or absolute)
     * @param {Object} options - Loading options
     * @returns {Promise<void>}
     */
    load(url, options = {}) {
        const fullUrl = this._resolveUrl(url);

        // Return cached promise if already loading/loaded
        if (this.cache.has(fullUrl)) {
            return this.cache.get(fullUrl);
        }

        const loadPromise = this._loadScript(fullUrl, options);
        this.cache.set(fullUrl, loadPromise);
        return loadPromise;
    }

    /**
     * Load multiple modules in parallel
     * @param {string[]} urls - Array of module URLs
     * @param {Object} options - Loading options
     * @returns {Promise<void[]>}
     */
    loadMultiple(urls, options = {}) {
        return Promise.all(urls.map(url => this.load(url, options)));
    }

    /**
     * Load modules with a delay (useful for deferring non-critical modules)
     * @param {string|string[]} urls - Module URL(s)
     * @param {number} delayMs - Delay in milliseconds
     * @param {Object} options - Loading options
     * @returns {Promise<void>}
     */
    loadDeferred(urls, delayMs, options = {}) {
        return new Promise(resolve => {
            setTimeout(() => {
                const urlArray = Array.isArray(urls) ? urls : [urls];
                resolve(this.loadMultiple(urlArray, options));
            }, delayMs);
        });
    }

    /**
     * Check if a module is already loaded
     * @param {string} url - Module URL
     * @returns {boolean}
     */
    isLoaded(url) {
        const fullUrl = this._resolveUrl(url);
        return this.cache.has(fullUrl);
    }

    /**
     * Preload modules (fetch but don't execute yet)
     * @param {string[]} urls - Array of module URLs
     */
    preload(urls) {
        urls.forEach(url => {
            const fullUrl = this._resolveUrl(url);
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'script';
            link.href = fullUrl;
            document.head.appendChild(link);
        });
    }

    /**
     * Clear cache for a specific module or all modules
     * @param {string} [url] - Optional specific URL to clear
     */
    clearCache(url) {
        if (url) {
            const fullUrl = this._resolveUrl(url);
            this.cache.delete(fullUrl);
        } else {
            this.cache.clear();
        }
    }

    /**
     * Internal: Load script element
     * @private
     */
    _loadScript(url, options = {}) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;

            if (options.module) {
                script.type = 'module';
            }

            // Timeout handler
            const timeoutId = setTimeout(() => {
                cleanup();
                const error = new Error(`Module load timeout: ${url}`);
                this._handleError(error, url);
                reject(error);
            }, this.timeout);

            // Success handler
            script.onload = () => {
                cleanup();
                this._logSuccess(url);
                resolve();
            };

            // Error handler
            script.onerror = (e) => {
                cleanup();
                const error = new Error(`Failed to load module: ${url}`);
                this._handleError(error, url);
                reject(error);
            };

            function cleanup() {
                clearTimeout(timeoutId);
                script.onload = null;
                script.onerror = null;
            }

            document.head.appendChild(script);
        });
    }

    /**
     * Internal: Resolve relative URLs
     * @private
     */
    _resolveUrl(url) {
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
            return url;
        }
        return this.basePath ? `${this.basePath}/${url}` : url;
    }

    /**
     * Internal: Log successful load
     * @private
     */
    _logSuccess(url) {
        const fileName = url.split('/').pop();
        console.log(`[ModuleLoader] Loaded: ${fileName}`);
    }

    /**
     * Internal: Handle errors with telemetry
     * @private
     */
    _handleError(error, url) {
        console.error('[ModuleLoader]', error.message);

        if (this.telemetry && typeof this.telemetry.captureError === 'function') {
            this.telemetry.captureError(error, {
                context: 'ModuleLoader',
                url: url
            });
        }
    }
}

// Auto-expose to window for non-module usage
if (typeof window !== 'undefined') {
    window.ModuleLoader = ModuleLoader;
}
