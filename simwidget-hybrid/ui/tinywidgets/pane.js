/**
 * TinyWidgets Container
 * Loads mini toggle/button widgets from manifest and renders as a compact grid
 * Each tiny glass is defined in its own ES module file (lights/, autopilot/, camera/)
 */
class TinyWidgetsContainer extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'tinywidgets',
            widgetVersion: '1.1.0',
            statusElementId: 'status-dot',
            autoConnect: false  // Connect after loading widgets
        });

        this.flightData = {};
        this.widgets = [];
        this.widgetStates = {};
        this.manifest = null;
        this.grid = document.getElementById('pane-container');
        this.statusDot = document.getElementById('status-dot');

        this.init();
    }

    async init() {
        await this.loadManifest();
        await this.loadWidgets();
        this.render();
        this.connect();  // Use parent's connect()
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
            grid.className = 'pane-grid';

            for (const w of widgets) {
                const btn = document.createElement('button');
                btn.className = 'tiny-pane';
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

    handleClick(glass, btn) {
        const state = this.widgetStates[glass.id] || {};
        const api = { send: (event, value) => this.sendCommand(event, value) };
        const result = glass.action(api, state, this.flightData);

        if (result) {
            if (result.active !== undefined) {
                this.widgetStates[glass.id].active = result.active;
                btn.classList.toggle('on', result.active);
            }
            if (result.flash) {
                btn.classList.add('flash');
                setTimeout(() => btn.classList.remove('flash'), 200);
            }
            if (result.value !== undefined) {
                this.widgetStates[glass.id].value = result.value;
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

    // SimGlassBase lifecycle hooks
    onConnect() {
        this.statusDot.classList.add('connected');
    }

    onDisconnect() {
        this.statusDot.classList.remove('connected');
    }

    onMessage(data) {
        this.flightData = data;
        this.updateWidgets(data);
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

}

document.addEventListener('DOMContentLoaded', () => {
    window.tinyPanes = new TinyWidgetsContainer();
    // SimGlassBase provides destroy() - wire to beforeunload
    window.addEventListener('beforeunload', () => window.tinyPanes?.destroy());
});
