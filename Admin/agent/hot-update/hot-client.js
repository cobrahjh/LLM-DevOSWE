/**
 * Hot Update Client v1.0.0
 * Browser-side hot reload handler
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\Admin\agent\hot-update\hot-client.js
 * Last Updated: 2025-01-08
 * 
 * Features:
 * - WebSocket connection to HotEngine
 * - CSS hot swap without reload
 * - State preservation
 * - Auto-reconnect on server restart
 * 
 * Usage: Include this script in your HTML
 *   <script src="hot-update/hot-client.js"></script>
 */

(function() {
    const HOT_WS_PATH = '/hot';
    let ws = null;
    let reconnectAttempts = 0;
    let maxReconnectAttempts = 10;
    let reconnectDelay = 1000;
    let isRestarting = false;

    // State preservation
    const state = {
        scrollPos: 0,
        inputValues: {},
        openPanels: []
    };

    function connect() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${location.host}${HOT_WS_PATH}`;
        
        try {
            ws = new WebSocket(wsUrl);
        } catch (e) {
            console.log('[Hot] WebSocket not available');
            return;
        }

        ws.onopen = () => {
            console.log('[Hot] Connected');
            reconnectAttempts = 0;
            showIndicator('connected');
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                handleMessage(msg);
            } catch (e) {
                console.error('[Hot] Parse error:', e);
            }
        };

        ws.onclose = () => {
            console.log('[Hot] Disconnected');
            if (!isRestarting) {
                scheduleReconnect();
            }
        };

        ws.onerror = (err) => {
            console.error('[Hot] Error');
        };
    }

    function handleMessage(msg) {
        switch (msg.type) {
            case 'connected':
                console.log('[Hot] Ready for updates');
                break;

            case 'update':
                handleUpdate(msg);
                break;

            case 'restart':
                handleRestart(msg);
                break;
        }
    }

    function handleUpdate(msg) {
        console.log(`[Hot] Update: ${msg.changeType} - ${msg.filename}`);
        showIndicator('updating');

        switch (msg.changeType) {
            case 'css':
                hotSwapCSS(msg.filename);
                break;

            case 'html':
            case 'js':
                saveState();
                setTimeout(() => location.reload(), 100);
                break;

            case 'data':
                // Emit event for app to handle
                window.dispatchEvent(new CustomEvent('hot-data-update', { detail: msg }));
                break;
        }
    }

    function hotSwapCSS(filename) {
        // Find and reload matching stylesheets
        const links = document.querySelectorAll('link[rel="stylesheet"]');
        let found = false;

        links.forEach(link => {
            if (link.href.includes(filename.replace(/\\/g, '/'))) {
                const newHref = link.href.split('?')[0] + '?hot=' + Date.now();
                link.href = newHref;
                found = true;
                console.log('[Hot] CSS swapped:', filename);
            }
        });

        // Also check inline style elements with data-hot attribute
        if (!found) {
            // Reload all CSS as fallback
            links.forEach(link => {
                const newHref = link.href.split('?')[0] + '?hot=' + Date.now();
                link.href = newHref;
            });
        }

        showIndicator('updated');
    }

    function handleRestart(msg) {
        console.log(`[Hot] Server restarting, reconnecting in ${msg.reconnectIn}ms`);
        isRestarting = true;
        showIndicator('restarting');

        setTimeout(() => {
            isRestarting = false;
            connect();
        }, msg.reconnectIn);
    }

    function saveState() {
        // Save scroll position
        state.scrollPos = window.scrollY;
        sessionStorage.setItem('hot-scroll', state.scrollPos);

        // Save input values
        document.querySelectorAll('input, textarea, select').forEach(el => {
            if (el.id) {
                state.inputValues[el.id] = el.value;
            }
        });
        sessionStorage.setItem('hot-inputs', JSON.stringify(state.inputValues));

        // Save open panels (elements with .active class)
        state.openPanels = [];
        document.querySelectorAll('.active').forEach(el => {
            if (el.id) state.openPanels.push(el.id);
        });
        sessionStorage.setItem('hot-panels', JSON.stringify(state.openPanels));
    }

    function restoreState() {
        // Restore scroll
        const scroll = sessionStorage.getItem('hot-scroll');
        if (scroll) {
            setTimeout(() => window.scrollTo(0, parseInt(scroll)), 100);
            sessionStorage.removeItem('hot-scroll');
        }

        // Restore inputs
        const inputs = sessionStorage.getItem('hot-inputs');
        if (inputs) {
            try {
                const values = JSON.parse(inputs);
                Object.keys(values).forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = values[id];
                });
            } catch (e) {}
            sessionStorage.removeItem('hot-inputs');
        }

        // Restore panels
        const panels = sessionStorage.getItem('hot-panels');
        if (panels) {
            try {
                const ids = JSON.parse(panels);
                ids.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.classList.add('active');
                });
            } catch (e) {}
            sessionStorage.removeItem('hot-panels');
        }
    }

    function scheduleReconnect() {
        if (reconnectAttempts >= maxReconnectAttempts) {
            console.log('[Hot] Max reconnect attempts reached');
            showIndicator('disconnected');
            return;
        }

        reconnectAttempts++;
        const delay = reconnectDelay * Math.min(reconnectAttempts, 5);
        
        console.log(`[Hot] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
        setTimeout(connect, delay);
    }

    // Visual indicator
    let indicator = null;

    function showIndicator(status) {
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'hot-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                left: 50%;
                transform: translateX(-50%) translateY(-20px);
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 11px;
                font-family: system-ui, sans-serif;
                font-weight: 500;
                z-index: 99999;
                transition: all 0.3s ease;
                opacity: 0;
            `;
            document.body.appendChild(indicator);
        }

        const styles = {
            connected: { bg: '#22c55e', color: '#fff', text: '● Hot-Updates Ready!' },
            updating: { bg: '#f59e0b', color: '#fff', text: '↻ Updating...' },
            updated: { bg: '#22c55e', color: '#fff', text: '✓ Updated' },
            restarting: { bg: '#f59e0b', color: '#fff', text: '↻ Server restarting...' },
            disconnected: { bg: '#ef4444', color: '#fff', text: '○ Disconnected' }
        };

        const s = styles[status] || styles.disconnected;
        indicator.style.background = s.bg;
        indicator.style.color = s.color;
        indicator.textContent = s.text;
        indicator.style.opacity = '1';
        indicator.style.transform = 'translateX(-50%) translateY(0)';

        // Auto-hide after success states
        if (status === 'connected' || status === 'updated') {
            setTimeout(() => {
                indicator.style.opacity = '0';
                indicator.style.transform = 'translateX(-50%) translateY(-20px)';
            }, 2000);
        }
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
        restoreState();
        connect();
    });

    // Expose for debugging
    window.HotClient = {
        reconnect: connect,
        getState: () => state
    };
})();

