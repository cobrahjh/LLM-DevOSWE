/**
 * Interaction Wheel Widget - SimGlass v2.0.0
 * Flow Pro-style radial menu for quick flight actions
 */

// Define wheel segments - quick actions arranged in a circle
// Commands must match server.js eventMap entries
const WHEEL_ACTIONS = [
    { id: 'gear', icon: '\u2699', label: 'GEAR', command: 'GEAR_TOGGLE', category: 'flight', tooltip: 'Toggle landing gear' },
    { id: 'flaps-up', icon: '\u25B2', label: 'FLAPS-', command: 'FLAPS_UP', category: 'flight', tooltip: 'Retract flaps' },
    { id: 'flaps-dn', icon: '\u25BC', label: 'FLAPS+', command: 'FLAPS_DOWN', category: 'flight', tooltip: 'Extend flaps' },
    { id: 'nav', icon: '\u{1F6A9}', label: 'NAV', command: 'TOGGLE_NAV_LIGHTS', category: 'lights', tooltip: 'Toggle nav lights' },
    { id: 'ap', icon: '\u2708', label: 'A/P', command: 'AP_MASTER', category: 'autopilot', tooltip: 'Autopilot master' },
    { id: 'brake', icon: '\u25A0', label: 'BRAKE', command: 'PARKING_BRAKES', category: 'flight', tooltip: 'Parking brake' },
    { id: 'view', icon: '\u{1F4F7}', label: 'VIEW', command: 'VIEW_MODE', category: 'camera', tooltip: 'Cycle camera view' },
    { id: 'spoiler', icon: '\u2594', label: 'SPOIL', command: 'SPOILERS_TOGGLE', category: 'flight', tooltip: 'Toggle spoilers' }
];

class InteractionWheel extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'interaction-wheel',
            widgetVersion: '2.0.0',
            autoConnect: true
        });

        this.apiUrl = 'http://' + window.location.host;
        this.createWheel();
    }

    // SimGlassBase lifecycle hook
    onMessage(msg) {
        // Server sends { type: 'flightData', data: {...} }
        if (msg.type === 'flightData' && msg.data) {
            this.updateSegmentStates(msg.data);
        } else if (msg.gearDown !== undefined) {
            // Fallback for direct data format
            this.updateSegmentStates(msg);
        }
    }

    onConnect() {
        console.log('[Wheel] Connected to SimGlass');
        this.updateStatus(true, 'Connected');
    }

    onDisconnect() {
        console.log('[Wheel] Disconnected');
        this.updateStatus(false, 'Disconnected');
    }

    // Update connection status
    updateStatus(connected, text) {
        const statusDot = document.getElementById('status');
        const statusText = document.getElementById('statusText');

        if (statusDot) statusDot.classList.toggle('connected', connected);
        if (statusText) statusText.textContent = text;
    }

    // Update segment active states based on flight data
    updateSegmentStates(data) {
        const gearSeg = document.querySelector('[data-action="gear"]');
        if (gearSeg) gearSeg.classList.toggle('active', data.gearDown);

        const brakeSeg = document.querySelector('[data-action="brake"]');
        if (brakeSeg) brakeSeg.classList.toggle('active', data.parkingBrake);

        const apSeg = document.querySelector('[data-action="ap"]');
        if (apSeg) apSeg.classList.toggle('active', data.apMaster);

        const navSeg = document.querySelector('[data-action="nav"]');
        if (navSeg) navSeg.classList.toggle('active', data.navLight);
    }

    // Send command via REST API
    async sendCommand(command) {
        try {
            const response = await fetch(`${this.apiUrl}/api/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command, value: 0 })
            });
            const result = await response.json();
            console.log(`[Wheel] ${command}:`, result);
            return result;
        } catch (err) {
            console.error(`[Wheel] Command error:`, err);
            if (window.telemetry) {
                telemetry.captureError(err, {
                    operation: 'sendCommand',
                    widget: 'interaction-wheel',
                    command
                });
            }
            return { success: false, error: err.message };
        }
    }

    // Create wheel segments using safe DOM methods
    createWheel() {
        const wheel = document.getElementById('wheel');
        const segmentCount = WHEEL_ACTIONS.length;
        const angleStep = 360 / segmentCount;

        WHEEL_ACTIONS.forEach((action, index) => {
            const angle = index * angleStep - 90;
            const segment = document.createElement('div');
            segment.className = 'wheel-segment';
            segment.dataset.action = action.id;
            segment.dataset.category = action.category;
            segment.style.transform = `rotate(${angle}deg)`;

            // Create content using safe DOM methods
            const content = document.createElement('div');
            content.className = 'segment-content';
            content.style.transform = `translateY(-50%) rotate(${-angle}deg)`;

            const iconSpan = document.createElement('span');
            iconSpan.className = 'segment-icon';
            iconSpan.textContent = action.icon;

            const labelSpan = document.createElement('span');
            labelSpan.className = 'segment-label';
            labelSpan.textContent = action.label;

            content.appendChild(iconSpan);
            content.appendChild(labelSpan);
            segment.appendChild(content);

            // Click handler
            segment.addEventListener('click', async () => {
                segment.classList.add('active');
                await this.sendCommand(action.command);
                setTimeout(() => {
                    // Keep active state for toggle buttons (state will update via WebSocket)
                    if (!['gear', 'brake', 'ap', 'nav'].includes(action.id)) {
                        segment.classList.remove('active');
                    }
                }, 200);
            });

            // Tooltip handlers
            segment.addEventListener('mouseenter', (e) => this.showTooltip(e, action.tooltip));
            segment.addEventListener('mouseleave', () => this.hideTooltip());

            wheel.appendChild(segment);
        });

        // Hub click handler
        const hub = document.getElementById('hub');
        if (hub) {
            hub.addEventListener('click', () => {
                console.log('[Wheel] Hub clicked');
            });
        }
    }

    // Tooltip functions
    showTooltip(event, text) {
        const tooltip = document.getElementById('tooltip');
        if (tooltip) {
            tooltip.textContent = text;
            tooltip.style.left = event.pageX + 15 + 'px';
            tooltip.style.top = event.pageY + 15 + 'px';
            tooltip.classList.add('visible');
        }
    }

    hideTooltip() {
        const tooltip = document.getElementById('tooltip');
        if (tooltip) {
            tooltip.classList.remove('visible');
        }
    }

    // Cleanup - extends SimGlassBase.destroy()
    destroy() {
        // Call parent destroy for WebSocket cleanup
        super.destroy();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Wheel] Initializing Interaction Wheel...');
    window.interactionWheel = new InteractionWheel();
    window.addEventListener('beforeunload', () => window.interactionWheel?.destroy());
});
