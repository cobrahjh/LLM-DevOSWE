/**
 * SimWidget Dashboard
 * Multi-widget layout with drag-and-drop
 */

class Dashboard {
    constructor() {
        this.widgets = [];
        this.isEditing = true;
        this.draggedWidget = null;

        this.availableWidgets = [
            { id: 'simbrief', name: 'SimBrief', icon: '📋', url: '/ui/simbrief-widget/', desc: 'Flight planning OFP' },
            { id: 'flightplan', name: 'Flight Plan', icon: '🛫', url: '/ui/flightplan-widget/', desc: 'Waypoint tracker' },
            { id: 'map', name: 'Map', icon: '🗺️', url: '/ui/map-widget/', desc: 'Live position map', size: 'large' },
            { id: 'weather', name: 'Weather', icon: '🌦️', url: '/ui/weather-widget/', desc: 'METAR display' },
            { id: 'checklist', name: 'Checklist', icon: '✅', url: '/ui/checklist-widget/', desc: 'Aircraft checklists' },
            { id: 'timer', name: 'Timer', icon: '⏱️', url: '/ui/timer-widget/', desc: 'Stopwatch/countdown' },
            { id: 'navigraph', name: 'Navigraph', icon: '🗺️', url: '/ui/navigraph-widget/', desc: 'Airport charts' },
            { id: 'notepad', name: 'Notepad', icon: '📝', url: '/ui/notepad-widget/', desc: 'Quick notes' },
            { id: 'copilot', name: 'AI Copilot', icon: '🧑‍✈️', url: '/ui/copilot-widget/', desc: 'AI assistant' },
            { id: 'voice', name: 'Voice Control', icon: '🎤', url: '/ui/voice-control/', desc: 'Voice commands' },
            { id: 'camera', name: 'Camera', icon: '📷', url: '/ui/camera-controller/', desc: 'Camera views' },
            { id: 'gtn750', name: 'GTN750', icon: '🛰️', url: '/ui/gtn750/', desc: 'GPS navigator' }
        ];

        this.presets = {
            'flight-planning': [
                { widgetId: 'simbrief', size: 'medium' },
                { widgetId: 'weather', size: 'small' },
                { widgetId: 'map', size: 'large' },
                { widgetId: 'navigraph', size: 'medium' }
            ],
            'in-flight': [
                { widgetId: 'flightplan', size: 'medium' },
                { widgetId: 'map', size: 'large' },
                { widgetId: 'checklist', size: 'medium' },
                { widgetId: 'timer', size: 'small' }
            ],
            'streaming': [
                { widgetId: 'map', size: 'large' },
                { widgetId: 'flightplan', size: 'medium' },
                { widgetId: 'weather', size: 'small' }
            ]
        };

        this.initElements();
        this.initEvents();
        this.loadLayout();
    }

    initElements() {
        this.grid = document.getElementById('dashboard-grid');
        this.picker = document.getElementById('widget-picker');
        this.pickerGrid = document.getElementById('picker-grid');
        this.addBtn = document.getElementById('btn-add');
        this.lockBtn = document.getElementById('btn-lock');
        this.saveBtn = document.getElementById('btn-save');
        this.presetBtns = document.querySelectorAll('.preset-btn');
    }

    initEvents() {
        this.addBtn.addEventListener('click', () => this.showPicker());
        document.getElementById('picker-close').addEventListener('click', () => this.hidePicker());
        document.querySelector('.picker-overlay').addEventListener('click', () => this.hidePicker());

        this.lockBtn.addEventListener('click', () => this.toggleEdit());
        this.saveBtn.addEventListener('click', () => this.saveLayout());

        this.presetBtns.forEach(btn => {
            btn.addEventListener('click', () => this.loadPreset(btn.dataset.preset));
        });

        this.populatePicker();
    }

    populatePicker() {
        this.pickerGrid.replaceChildren();

        this.availableWidgets.forEach(widget => {
            const item = document.createElement('div');
            item.className = 'picker-item';

            const icon = document.createElement('div');
            icon.className = 'picker-icon';
            icon.textContent = widget.icon;

            const name = document.createElement('div');
            name.className = 'picker-name';
            name.textContent = widget.name;

            const desc = document.createElement('div');
            desc.className = 'picker-desc';
            desc.textContent = widget.desc;

            item.appendChild(icon);
            item.appendChild(name);
            item.appendChild(desc);

            item.addEventListener('click', () => {
                this.addWidget(widget.id);
                this.hidePicker();
            });

            this.pickerGrid.appendChild(item);
        });
    }

    showPicker() {
        this.picker.style.display = 'flex';
    }

    hidePicker() {
        this.picker.style.display = 'none';
    }

    toggleEdit() {
        this.isEditing = !this.isEditing;

        if (this.isEditing) {
            this.lockBtn.textContent = '🔓 Edit';
            this.lockBtn.classList.remove('locked');
        } else {
            this.lockBtn.textContent = '🔒 Locked';
            this.lockBtn.classList.add('locked');
        }

        this.grid.querySelectorAll('.widget-panel').forEach(panel => {
            panel.classList.toggle('editing', this.isEditing);
        });
    }

    addWidget(widgetId, size) {
        const widgetDef = this.availableWidgets.find(w => w.id === widgetId);
        if (!widgetDef) return;

        const instanceId = widgetId + '-' + Date.now();
        const widgetSize = size || widgetDef.size || 'medium';

        const widget = {
            instanceId,
            widgetId,
            size: widgetSize
        };

        this.widgets.push(widget);
        this.renderWidget(widget, widgetDef);
        this.updateEmptyState();
    }

    renderWidget(widget, widgetDef) {
        const panel = document.createElement('div');
        panel.className = 'widget-panel size-' + widget.size;
        panel.dataset.instanceId = widget.instanceId;
        if (this.isEditing) panel.classList.add('editing');

        // Header
        const header = document.createElement('div');
        header.className = 'panel-header';

        const title = document.createElement('div');
        title.className = 'panel-title';
        title.textContent = widgetDef.icon + ' ' + widgetDef.name;

        const controls = document.createElement('div');
        controls.className = 'panel-controls';

        const sizeBtn = document.createElement('button');
        sizeBtn.className = 'panel-btn';
        sizeBtn.textContent = '⊞';
        sizeBtn.title = 'Cycle size';
        sizeBtn.addEventListener('click', () => this.cycleSize(widget.instanceId));

        const closeBtn = document.createElement('button');
        closeBtn.className = 'panel-btn close';
        closeBtn.textContent = '×';
        closeBtn.title = 'Remove';
        closeBtn.addEventListener('click', () => this.removeWidget(widget.instanceId));

        controls.appendChild(sizeBtn);
        controls.appendChild(closeBtn);

        header.appendChild(title);
        header.appendChild(controls);

        // Content
        const content = document.createElement('div');
        content.className = 'panel-content';

        const iframe = document.createElement('iframe');
        iframe.src = widgetDef.url;
        iframe.loading = 'lazy';
        content.appendChild(iframe);

        panel.appendChild(header);
        panel.appendChild(content);

        // Drag events
        header.draggable = true;
        header.addEventListener('dragstart', (e) => this.onDragStart(e, panel));
        header.addEventListener('dragend', (e) => this.onDragEnd(e, panel));

        panel.addEventListener('dragover', (e) => this.onDragOver(e, panel));
        panel.addEventListener('drop', (e) => this.onDrop(e, panel));
        panel.addEventListener('dragleave', (e) => this.onDragLeave(e, panel));

        this.grid.appendChild(panel);
    }

    removeWidget(instanceId) {
        const panel = this.grid.querySelector('[data-instance-id="' + instanceId + '"]');
        if (panel) {
            panel.remove();
        }
        this.widgets = this.widgets.filter(w => w.instanceId !== instanceId);
        this.updateEmptyState();
    }

    cycleSize(instanceId) {
        const sizes = ['small', 'medium', 'large'];
        const widget = this.widgets.find(w => w.instanceId === instanceId);
        if (!widget) return;

        const currentIndex = sizes.indexOf(widget.size);
        const newSize = sizes[(currentIndex + 1) % sizes.length];
        widget.size = newSize;

        const panel = this.grid.querySelector('[data-instance-id="' + instanceId + '"]');
        if (panel) {
            panel.className = 'widget-panel size-' + newSize;
            if (this.isEditing) panel.classList.add('editing');
        }
    }

    onDragStart(e, panel) {
        if (!this.isEditing) {
            e.preventDefault();
            return;
        }
        this.draggedWidget = panel;
        panel.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    onDragEnd(e, panel) {
        panel.classList.remove('dragging');
        this.draggedWidget = null;
        this.grid.querySelectorAll('.widget-panel').forEach(p => p.classList.remove('drag-over'));
    }

    onDragOver(e, panel) {
        if (!this.isEditing || !this.draggedWidget || this.draggedWidget === panel) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        panel.classList.add('drag-over');
    }

    onDragLeave(e, panel) {
        panel.classList.remove('drag-over');
    }

    onDrop(e, panel) {
        if (!this.isEditing || !this.draggedWidget || this.draggedWidget === panel) return;
        e.preventDefault();
        panel.classList.remove('drag-over');

        // Swap positions in DOM
        const allPanels = Array.from(this.grid.children);
        const draggedIndex = allPanels.indexOf(this.draggedWidget);
        const targetIndex = allPanels.indexOf(panel);

        if (draggedIndex < targetIndex) {
            panel.after(this.draggedWidget);
        } else {
            panel.before(this.draggedWidget);
        }

        // Update widgets array order
        this.updateWidgetsOrder();
    }

    updateWidgetsOrder() {
        const newOrder = [];
        this.grid.querySelectorAll('.widget-panel').forEach(panel => {
            const instanceId = panel.dataset.instanceId;
            const widget = this.widgets.find(w => w.instanceId === instanceId);
            if (widget) newOrder.push(widget);
        });
        this.widgets = newOrder;
    }

    loadPreset(presetName) {
        const preset = this.presets[presetName];
        if (!preset) return;

        // Clear current widgets
        this.grid.replaceChildren();
        this.widgets = [];

        // Add preset widgets
        preset.forEach(item => {
            this.addWidget(item.widgetId, item.size);
        });

        // Update active button
        this.presetBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.preset === presetName);
        });

        this.showToast('Loaded ' + presetName + ' preset');
    }

    updateEmptyState() {
        const existing = this.grid.querySelector('.empty-state');
        if (existing) existing.remove();

        if (this.widgets.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';

            const icon = document.createElement('div');
            icon.className = 'empty-icon';
            icon.textContent = '🎛️';

            const text = document.createElement('div');
            text.className = 'empty-text';
            text.textContent = 'No widgets added';

            const hint = document.createElement('div');
            hint.className = 'empty-hint';
            hint.textContent = 'Click "+ Add Widget" or select a preset';

            empty.appendChild(icon);
            empty.appendChild(text);
            empty.appendChild(hint);
            this.grid.appendChild(empty);
        }
    }

    saveLayout() {
        try {
            const layout = this.widgets.map(w => ({
                widgetId: w.widgetId,
                size: w.size
            }));
            localStorage.setItem('dashboard-layout', JSON.stringify(layout));
            this.showToast('Layout saved');
        } catch (e) {
            console.error('Failed to save layout:', e);
        }
    }

    loadLayout() {
        try {
            const saved = localStorage.getItem('dashboard-layout');
            if (saved) {
                const layout = JSON.parse(saved);
                if (layout.length > 0) {
                    layout.forEach(item => {
                        this.addWidget(item.widgetId, item.size);
                    });
                    return;
                }
            }
        } catch (e) {
            console.error('Failed to load layout:', e);
        }

        // Load default preset if no saved layout
        this.loadPreset('flight-planning');
    }

    showToast(message) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#667eea;color:white;padding:10px 20px;border-radius:6px;font-size:13px;z-index:1000;';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});
