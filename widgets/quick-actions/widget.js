/**
 * Quick Actions Wheel Widget
 * SimWidget Engine v1.0.0
 */

class QuickActionsWidget {
    constructor() {
        this.ws = null;
        this.actions = [
            { id: 'pause', icon: '⏸', label: 'Pause', command: 'PAUSE_TOGGLE', color: 'yellow' },
            { id: 'active-pause', icon: '⏯', label: 'Active', command: 'PAUSE_SET', color: 'orange' },
            { id: 'screenshot', icon: '📷', label: 'Photo', command: 'CAPTURE_SCREENSHOT', color: 'cyan' },
            { id: 'weather', icon: '🌤', label: 'Weather', command: 'SIMUI_WEATHER', color: 'purple' },
            { id: 'atc', icon: '🎙', label: 'ATC', command: 'ATC_MENU_OPEN', color: 'green' },
            { id: 'camera', icon: '🎥', label: 'Camera', command: 'VIEW_MODE', color: 'cyan' },
            { id: 'time', icon: '⏰', label: 'Time', command: 'SIMUI_TIME', color: 'yellow' },
            { id: 'map', icon: '🗺', label: 'Map', command: 'SIMUI_MAP', color: 'green' }
        ];
        this.init();
    }

    init() {
        this.connect();
        this.buildWheel();
    }

    connect() {
        const host = window.location.hostname || 'localhost';
        this.ws = new WebSocket(`ws://${host}:8080`);

        this.ws.onopen = () => {
            document.getElementById('conn').classList.add('connected');
        };

        this.ws.onclose = () => {
            document.getElementById('conn').classList.remove('connected');
            setTimeout(() => this.connect(), 3000);
        };
    }

    buildWheel() {
        const wheel = document.getElementById('action-wheel');
        const centerX = 110;
        const centerY = 110;
        const radius = 80;
        const count = this.actions.length;

        wheel.innerHTML = '';

        this.actions.forEach((action, i) => {
            const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            const btn = document.createElement('button');
            btn.className = 'qa-action';
            btn.dataset.action = action.id;
            btn.dataset.color = action.color;
            btn.style.left = `${x}px`;
            btn.style.top = `${y}px`;
            btn.innerHTML = `
                <span class="qa-action-icon">${action.icon}</span>
                <span class="qa-action-label">${action.label}</span>
            `;

            btn.addEventListener('mouseenter', () => {
                document.getElementById('action-label').textContent = action.label.toUpperCase();
            });

            btn.addEventListener('mouseleave', () => {
                document.getElementById('action-label').textContent = 'SELECT';
            });

            btn.addEventListener('click', () => {
                this.executeAction(action);
            });

            wheel.appendChild(btn);
        });
    }

    executeAction(action) {
        const status = document.getElementById('status');
        status.textContent = `Executing: ${action.label}...`;
        status.className = 'qa-status';

        // Visual feedback
        const btn = document.querySelector(`[data-action="${action.id}"]`);
        btn.classList.add('active');

        // Send command
        this.sendCommand(action.command);

        // Reset after delay
        setTimeout(() => {
            btn.classList.remove('active');
            status.textContent = `${action.label} executed`;
            status.className = 'qa-status success';

            setTimeout(() => {
                status.textContent = 'Ready';
                status.className = 'qa-status';
            }, 1500);
        }, 300);
    }

    sendCommand(cmd) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'command', command: cmd }));
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.quickActionsWidget = new QuickActionsWidget();
});
