/**
 * TinyWidgets Container
 * Loads mini toggle/button widgets from manifest and renders as a compact grid
 * Each tiny widget is defined in its own ES module file (lights/, autopilot/, camera/)
 */
class TinyWidgetsContainer {
    constructor() {
        this._destroyed = false;
        this.ws = null;
        this.connected = false;
        this.flightData = {};
        this.widgets = [];
        this.widgetStates = {};
        this.manifest = null;
        this.grid = document.getElementById('widget-container');
        this.statusDot = document.getElementById('status-dot');

        this.init();
    }

    async init() {
        await this.loadManifest();
        await this.loadWidgets();
        this.render();
        this.connectWebSocket();
    }

    async loadManifest() {
        try {
            const res = await fetch('manifest.json');
            this.manifest = await res.json();
        } catch (e) {
            console.error('[TinyWidgets] Failed to load manifest:', e);
            this.manifest = { categories: {}, widgets: [] };
        }
    }

    async loadWidgets() {
        for (const path of this.manifest.widgets) {
            try {
                const mod = await import('./' + path + '.js');
                const def = mod.default;
                this.widgets.push(def);
                this.widgetStates[def.id] = { active: false, value: null };
            } catch (e) {
                console.warn('[TinyWidgets] Failed to load:', path, e);
            }
        }
    }

    render() {
        this.grid.innerHTML = '';
        const grouped = {};

        // Group by category
        for (const w of this.widgets) {
            if (!grouped[w.category]) grouped[w.category] = [];
            grouped[w.category].push(w);
        }

        // Render each category
        for (const [catId, widgets] of Object.entries(grouped)) {
            const catInfo = this.manifest.categories[catId] || { name: catId, icon: '', color: '#888' };

            const section = document.createElement('div');
            section.className = 'category-section';

            const label = document.createElement('div');
            label.className = 'category-label';
            label.innerHTML = `<span class="category-dot" style="background:${catInfo.color}"></span>${catInfo.icon} ${catInfo.name}`;
            section.appendChild(label);

            const grid = document.createElement('div');
            grid.className = 'widget-grid';

            for (const w of widgets) {
                const btn = document.createElement('button');
                btn.className = 'tiny-widget';
                btn.dataset.id = w.id;
                btn.title = w.description;

                let html = '';
                if (w.display === 'led') {
                    html += `<span class="led" style="color:${w.color}"></span>`;
                }
                html += `<span class="tw-icon">${w.icon}</span>`;
                html += `<span class="tw-name">${w.name}</span>`;
                if (w.display === 'button' && w.update) {
                    html += `<span class="tw-value" data-val="${w.id}"></span>`;
                }
                btn.innerHTML = html;

                btn.addEventListener('click', () => this.handleClick(w, btn));
                grid.appendChild(btn);
            }

            section.appendChild(grid);
            this.grid.appendChild(section);
        }
    }

    handleClick(widget, btn) {
        const state = this.widgetStates[widget.id] || {};
        const api = { send: (event, value) => this.sendCommand(event, value) };
        const result = widget.action(api, state, this.flightData);

        if (result) {
            if (result.active !== undefined) {
                this.widgetStates[widget.id].active = result.active;
                btn.classList.toggle('on', result.active);
            }
            if (result.flash) {
                btn.classList.add('flash');
                setTimeout(() => btn.classList.remove('flash'), 200);
            }
            if (result.value !== undefined) {
                this.widgetStates[widget.id].value = result.value;
                const valEl = btn.querySelector('.tw-value');
                if (valEl) valEl.textContent = result.value;
            }
        }
    }

    sendCommand(event, value = 0) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'command', event, value }));
        } else {
            fetch('/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: event, value })
            }).catch(() => {});
        }
    }

    connectWebSocket() {
        if (this._destroyed) return;

        const host = location.hostname || '127.0.0.1';
        const port = location.port || '8080';
        this.ws = new WebSocket('ws://' + host + ':' + port);

        this.ws.onopen = () => {
            this.connected = true;
            this.statusDot.classList.add('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.flightData = data;
                this.updateWidgets(data);
            } catch (e) {}
        };

        this.ws.onclose = () => {
            this.connected = false;
            this.statusDot.classList.remove('connected');
            if (!this._destroyed) {
                setTimeout(() => this.connectWebSocket(), 3000);
            }
        };

        this.ws.onerror = () => {
            this.connected = false;
            this.statusDot.classList.remove('connected');
        };
    }

    updateWidgets(flightData) {
        for (const w of this.widgets) {
            if (!w.update) continue;

            const result = w.update(flightData);
            if (!result) continue;

            const btn = this.grid.querySelector(`[data-id="${w.id}"]`);
            if (!btn) continue;

            if (result.active !== undefined) {
                this.widgetStates[w.id].active = result.active;
                btn.classList.toggle('on', result.active);
            }
            if (result.value !== undefined) {
                this.widgetStates[w.id].value = result.value;
                const valEl = btn.querySelector('.tw-value');
                if (valEl) valEl.textContent = result.value;
            }
        }
    }

    destroy() {
        this._destroyed = true;

        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
            this.ws = null;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.tinyWidgets = new TinyWidgetsContainer();
    window.addEventListener('beforeunload', () => window.tinyWidgets?.destroy());
});
