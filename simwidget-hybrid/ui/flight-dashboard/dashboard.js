/**
 * Flight Dashboard - Multi-Widget Controller
 * Manages layout switching and widget communication
 */

class FlightDashboard {
    constructor() {
        this.grid = document.getElementById('dashboard-grid');
        this.layoutSelect = document.getElementById('layout-select');
        this.fullscreenBtn = document.getElementById('btn-fullscreen');

        this.initEvents();
        this.loadLayout();
        this.initPopouts();
    }

    initEvents() {
        // Layout switching
        this.layoutSelect.addEventListener('change', () => {
            this.setLayout(this.layoutSelect.value);
        });

        // Fullscreen toggle
        this.fullscreenBtn.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.fullscreenElement) {
                document.exitFullscreen();
            }
            if (e.key === 'f' && e.ctrlKey) {
                e.preventDefault();
                this.toggleFullscreen();
            }
            // Layout shortcuts: Ctrl+1,2,3,4
            if (e.ctrlKey && ['1', '2', '3', '4'].includes(e.key)) {
                e.preventDefault();
                const layouts = ['default', 'map-focus', 'planning', 'enroute'];
                this.setLayout(layouts[parseInt(e.key) - 1]);
                this.layoutSelect.value = layouts[parseInt(e.key) - 1];
            }
        });
    }

    setLayout(layout) {
        // Remove all layout classes
        this.grid.classList.remove('layout-default', 'layout-map-focus', 'layout-planning', 'layout-enroute');

        // Add new layout class (default has no special class)
        if (layout !== 'default') {
            this.grid.classList.add('layout-' + layout);
        }

        // Save preference
        localStorage.setItem('dashboard-layout', layout);

        // Resize iframes (they may need to redraw)
        setTimeout(() => {
            document.querySelectorAll('.widget-frame iframe').forEach(iframe => {
                iframe.contentWindow.dispatchEvent(new Event('resize'));
            });
        }, 100);
    }

    loadLayout() {
        const saved = localStorage.getItem('dashboard-layout');
        if (saved) {
            this.layoutSelect.value = saved;
            this.setLayout(saved);
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            document.body.classList.add('fullscreen');
        } else {
            document.exitFullscreen();
            document.body.classList.remove('fullscreen');
        }
    }

    initPopouts() {
        document.querySelectorAll('.btn-popout').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const frame = e.target.closest('.widget-frame');
                const iframe = frame.querySelector('iframe');
                const url = iframe.src;
                const widget = frame.dataset.widget;

                // Open in new window
                window.open(url, widget + '-popout', 'width=400,height=500,menubar=no,toolbar=no');
            });
        });
    }
}

// Connection status indicator
class ConnectionMonitor {
    constructor() {
        this.createIndicator();
        this.checkConnection();
        setInterval(() => this.checkConnection(), 5000);
    }

    createIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'connection-status';

        const dot = document.createElement('span');
        dot.className = 'connection-dot';

        const text = document.createElement('span');
        text.className = 'connection-text';
        text.textContent = 'Checking...';

        indicator.appendChild(dot);
        indicator.appendChild(text);
        document.body.appendChild(indicator);

        this.indicator = indicator;
        this.dot = dot;
        this.text = text;
    }

    async checkConnection() {
        try {
            const response = await fetch('/api/status');
            if (response.ok) {
                const data = await response.json();
                if (data.connected) {
                    this.dot.classList.remove('disconnected');
                    this.text.textContent = 'MSFS Connected';
                } else {
                    this.dot.classList.add('disconnected');
                    this.text.textContent = 'MSFS Offline';
                }
            }
        } catch (e) {
            this.dot.classList.add('disconnected');
            this.text.textContent = 'Server Offline';
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new FlightDashboard();
    window.connectionMonitor = new ConnectionMonitor();
});
