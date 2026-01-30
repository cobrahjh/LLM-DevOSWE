/**
 * SimWidget Quick Search / Launcher v1.0.0
 * Fuzzy search and quick launch for all widgets
 */

class WidgetSearch {
    constructor() {
        this.widgets = [];
        this.isOpen = false;
        this.selectedIndex = 0;

        this.loadWidgets();
        this.createDialog();
        this.bindEvents();
    }

    loadWidgets() {
        this.widgets = [
            { id: 'aircraft-control', name: 'Aircraft Control', icon: '✈️', tags: ['control', 'flight', 'autopilot'] },
            { id: 'checklist-widget', name: 'Checklist', icon: '✅', tags: ['check', 'preflight', 'procedure'] },
            { id: 'map-widget', name: 'Map', icon: '🗺️', tags: ['navigation', 'position', 'gps'] },
            { id: 'weather-widget', name: 'Weather', icon: '🌦️', tags: ['metar', 'taf', 'wx'] },
            { id: 'flightplan-widget', name: 'Flight Plan', icon: '🛫', tags: ['route', 'waypoint', 'navigation'] },
            { id: 'simbrief-widget', name: 'SimBrief', icon: '📋', tags: ['ofp', 'dispatch', 'fuel'] },
            { id: 'timer-widget', name: 'Timer', icon: '⏱️', tags: ['stopwatch', 'countdown', 'time'] },
            { id: 'radio-stack', name: 'Radio Stack', icon: '📻', tags: ['com', 'nav', 'frequency'] },
            { id: 'fuel-widget', name: 'Fuel', icon: '⛽', tags: ['tanks', 'gallons', 'endurance'] },
            { id: 'camera-widget', name: 'Camera', icon: '📷', tags: ['view', 'drone', 'external'] },
            { id: 'copilot-widget', name: 'AI Copilot', icon: '🧑‍✈️', tags: ['assistant', 'voice', 'help'] },
            { id: 'landing-widget', name: 'Landing Rate', icon: '🛬', tags: ['touchdown', 'fpm', 'grade'] },
            { id: 'performance-widget', name: 'Performance', icon: '📈', tags: ['fps', 'gpu', 'cpu'] },
            { id: 'atc-widget', name: 'ATC Comm', icon: '📡', tags: ['radio', 'frequency', 'phrase'] },
            { id: 'flightlog-widget', name: 'Flight Log', icon: '📓', tags: ['logbook', 'history', 'hours'] },
            { id: 'multiplayer-widget', name: 'Multiplayer', icon: '👥', tags: ['vatsim', 'ivao', 'traffic'] },
            { id: 'notepad-widget', name: 'Notepad', icon: '📝', tags: ['notes', 'atis', 'clearance'] },
            { id: 'voice-control', name: 'Voice Control', icon: '🎤', tags: ['speech', 'command', 'mic'] },
            { id: 'keymap-editor', name: 'Keymap Editor', icon: '⌨️', tags: ['keys', 'bindings', 'hotkey'] },
            { id: 'flight-recorder', name: 'Flight Recorder', icon: '🎬', tags: ['replay', 'record', 'playback'] },
            { id: 'environment', name: 'Environment', icon: '🌤️', tags: ['time', 'weather', 'conditions'] },
            { id: 'gtn750', name: 'GTN750', icon: '🗺️', tags: ['garmin', 'gps', 'fms'] },
            { id: 'toolbar-panel', name: 'Toolbar Panel', icon: '🎛️', tags: ['msfs', 'ingame', 'compact'] },
            { id: 'flight-dashboard', name: 'Flight Dashboard', icon: '🎯', tags: ['overview', 'all', 'combined'] },
            { id: 'weight-balance', name: 'Weight & Balance', icon: '⚖️', tags: ['cg', 'load', 'weight'] },
            { id: 'fuel-planner', name: 'Fuel Planner', icon: '🛢️', tags: ['calculate', 'reserve', 'trip'] },
            { id: 'holding-calc', name: 'Holding Calculator', icon: '🔄', tags: ['pattern', 'entry', 'hold'] },
            { id: 'kneeboard-widget', name: 'Kneeboard', icon: '📒', tags: ['notes', 'reference', 'info'] },
            { id: 'flight-instructor', name: 'Flight Instructor', icon: '👨‍🏫', tags: ['coaching', 'tips', 'learn'] },
            { id: 'charts-widget', name: 'Charts', icon: '📊', tags: ['approach', 'sid', 'star'] },
            { id: 'navigraph-widget', name: 'Navigraph', icon: '🗺️', tags: ['charts', 'plates', 'approach'] },
            { id: 'autopilot', name: 'Autopilot', icon: '🎛️', tags: ['ap', 'heading', 'altitude', 'vs', 'speed', 'nav'] },
            { id: 'engine-monitor', name: 'Engine Monitor', icon: '🔧', tags: ['rpm', 'engine', 'oil', 'egt', 'cht', 'throttle'] },
            { id: 'fuel-monitor', name: 'Fuel Monitor', icon: '⛽', tags: ['fuel', 'tanks', 'endurance', 'range', 'flow'] }
        ];
    }

    createDialog() {
        const style = document.createElement('style');
        style.textContent = `
            .widget-search-dialog {
                position: fixed; top: 20%; left: 50%; transform: translateX(-50%);
                background: #1a1a2e; border: 1px solid #333; border-radius: 12px;
                width: 90%; max-width: 500px; z-index: 10001;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                display: none;
            }
            .widget-search-dialog.open { display: block; }
            .widget-search-input {
                width: 100%; padding: 16px 20px; background: transparent;
                border: none; border-bottom: 1px solid #333; color: #fff;
                font-size: 16px; outline: none;
            }
            .widget-search-input::placeholder { color: #666; }
            .widget-search-results { max-height: 400px; overflow-y: auto; }
            .widget-search-item {
                display: flex; align-items: center; gap: 12px;
                padding: 12px 20px; cursor: pointer; transition: background 0.15s;
            }
            .widget-search-item:hover, .widget-search-item.selected {
                background: rgba(102, 126, 234, 0.2);
            }
            .widget-search-icon { font-size: 24px; }
            .widget-search-name { color: #fff; font-size: 14px; }
            .widget-search-tags { color: #666; font-size: 11px; }
            .widget-search-hint {
                padding: 10px 20px; font-size: 11px; color: #666;
                border-top: 1px solid #333; text-align: center;
            }
            .widget-search-backdrop {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.5); z-index: 10000; display: none;
            }
            .widget-search-backdrop.open { display: block; }
            .widget-search-empty {
                padding: 20px; text-align: center; color: #666;
            }
        `;
        document.head.appendChild(style);

        this.backdrop = document.createElement('div');
        this.backdrop.className = 'widget-search-backdrop';
        this.backdrop.onclick = () => this.close();
        document.body.appendChild(this.backdrop);

        this.dialog = document.createElement('div');
        this.dialog.className = 'widget-search-dialog';

        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.className = 'widget-search-input';
        this.input.placeholder = 'Search widgets... (Ctrl+K)';

        this.results = document.createElement('div');
        this.results.className = 'widget-search-results';

        const hint = document.createElement('div');
        hint.className = 'widget-search-hint';
        hint.textContent = '↑↓ Navigate • Enter Open • Esc Close';

        this.dialog.appendChild(this.input);
        this.dialog.appendChild(this.results);
        this.dialog.appendChild(hint);
        document.body.appendChild(this.dialog);
    }

    bindEvents() {
        this.input.addEventListener('input', () => this.search(this.input.value));
        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
    }

    handleKeydown(e) {
        const items = this.results.querySelectorAll('.widget-search-item');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
            this.updateSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
            this.updateSelection();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const selected = items[this.selectedIndex];
            if (selected) {
                this.openWidget(selected.dataset.id);
            }
        } else if (e.key === 'Escape') {
            this.close();
        }
    }

    updateSelection() {
        const items = this.results.querySelectorAll('.widget-search-item');
        items.forEach((item, i) => {
            item.classList.toggle('selected', i === this.selectedIndex);
        });
        items[this.selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }

    search(query) {
        const q = query.toLowerCase().trim();
        let filtered = this.widgets;

        if (q) {
            filtered = this.widgets.filter(w => {
                const searchText = (w.name + ' ' + w.tags.join(' ')).toLowerCase();
                return searchText.includes(q) || this.fuzzyMatch(q, w.name.toLowerCase());
            });
        }

        this.renderResults(filtered.slice(0, 10));
        this.selectedIndex = 0;
        this.updateSelection();
    }

    fuzzyMatch(query, text) {
        let qi = 0;
        for (let i = 0; i < text.length && qi < query.length; i++) {
            if (text[i] === query[qi]) qi++;
        }
        return qi === query.length;
    }

    renderResults(widgets) {
        this.results.replaceChildren();

        if (widgets.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'widget-search-empty';
            empty.textContent = 'No widgets found';
            this.results.appendChild(empty);
            return;
        }

        widgets.forEach(w => {
            const item = document.createElement('div');
            item.className = 'widget-search-item';
            item.dataset.id = w.id;

            const icon = document.createElement('span');
            icon.className = 'widget-search-icon';
            icon.textContent = w.icon;

            const info = document.createElement('div');
            info.style.flex = '1';

            const name = document.createElement('div');
            name.className = 'widget-search-name';
            name.textContent = w.name;

            const tags = document.createElement('div');
            tags.className = 'widget-search-tags';
            tags.textContent = w.tags.join(', ');

            info.appendChild(name);
            info.appendChild(tags);
            item.appendChild(icon);
            item.appendChild(info);

            item.onclick = () => this.openWidget(w.id);
            this.results.appendChild(item);
        });
    }

    openWidget(id) {
        window.open('/ui/' + id + '/', '_blank');
        this.close();
    }

    open() {
        this.isOpen = true;
        this.dialog.classList.add('open');
        this.backdrop.classList.add('open');
        this.input.value = '';
        this.search('');
        this.input.focus();
    }

    close() {
        this.isOpen = false;
        this.dialog.classList.remove('open');
        this.backdrop.classList.remove('open');
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }
}

// Auto-init
if (typeof window !== 'undefined') {
    window.widgetSearch = new WidgetSearch();
}
