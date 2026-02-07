/**
 * Hot Reload Client for SimGlass Widgets
 * Auto-reload widget when files change during development
 *
 * Usage in widget HTML:
 *   <script src="/ui/shared/hot-reload-client.js"></script>
 *
 * Or import in widget.js:
 *   import '/ui/shared/hot-reload-client.js';
 */

(function() {
    // Only enable in development
    const isDev = window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1' ||
                  window.location.search.includes('hotreload=true');

    if (!isDev) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = protocol + '//' + window.location.host;

    let ws;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 10;

    // Track which widget we are
    const widgetPath = window.location.pathname;

    function log(msg, ...args) {
        console.log('%c[HotReload]%c ' + msg, 'color: #ff6b35; font-weight: bold', 'color: inherit', ...args);
    }

    function connect() {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            log('Max reconnect attempts reached, giving up');
            return;
        }

        try {
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                reconnectAttempts = 0;
                log('Connected ✓');
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'hot-reload-connected') {
                        log('Hot reload active');
                        return;
                    }

                    if (data.type === 'file-changed' || data.type === 'file-added') {
                        handleFileChange(data);
                    }

                    if (data.type === 'file-deleted') {
                        log('File deleted:', data.path);
                        // Full reload on delete
                        setTimeout(() => window.location.reload(), 500);
                    }
                } catch (e) {
                    // Ignore parse errors (might be other WS messages)
                }
            };

            ws.onclose = () => {
                log('Disconnected, reconnecting...');
                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    setTimeout(connect, Math.min(2000 * reconnectAttempts, 10000));
                }
            };

            ws.onerror = (error) => {
                // WebSocket errors trigger onclose, so we'll reconnect there
            };
        } catch (e) {
            log('Connection error:', e.message);
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                setTimeout(connect, 5000);
            }
        }
    }

    function handleFileChange(data) {
        const changedPath = data.path;

        // Check if this change affects current widget
        const widgetName = widgetPath.split('/').filter(Boolean)[1]; // e.g., 'gtn750' from '/ui/gtn750/'
        const isRelevant = changedPath.includes('ui/' + widgetName) ||
                          changedPath.includes('ui/shared') ||
                          changedPath.includes('config/');

        if (!isRelevant) return;

        log('File changed:', changedPath);

        // Smart reload based on file type
        if (data.type === 'css') {
            reloadCSS();
        } else if (data.type === 'javascript') {
            // For JS, we need full reload (no HMR)
            log('JavaScript changed, reloading page...');
            setTimeout(() => window.location.reload(), 300);
        } else if (data.type === 'html') {
            log('HTML changed, reloading page...');
            setTimeout(() => window.location.reload(), 300);
        } else if (data.type === 'json') {
            log('Config changed, reloading page...');
            setTimeout(() => window.location.reload(), 500);
        }
    }

    function reloadCSS() {
        log('Reloading CSS...');
        let reloadedCount = 0;

        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            const href = link.href;
            const url = new URL(href);

            // Add cache-busting timestamp
            url.searchParams.set('v', Date.now());

            // Create new link element
            const newLink = document.createElement('link');
            newLink.rel = 'stylesheet';
            newLink.href = url.toString();

            // Replace old link once new one loads
            newLink.onload = () => {
                link.remove();
                reloadedCount++;
            };

            link.parentNode.insertBefore(newLink, link.nextSibling);
        });

        if (reloadedCount > 0) {
            log(`Reloaded ${reloadedCount} stylesheet(s)`);
        }
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (ws) {
            ws.onclose = null; // Prevent reconnect
            ws.close();
        }
    });

    // Start connection
    connect();

    // Expose API for manual control
    window.__hotReload = {
        reconnect: connect,
        disconnect: () => {
            if (ws) {
                ws.onclose = null;
                ws.close();
                log('Manually disconnected');
            }
        },
        status: () => {
            return {
                connected: ws && ws.readyState === WebSocket.OPEN,
                attempts: reconnectAttempts
            };
        }
    };
})();
