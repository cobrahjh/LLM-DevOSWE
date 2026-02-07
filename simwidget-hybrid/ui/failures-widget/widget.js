/**
 * Failures Monitor Widget
 * Displays active system failures from SimConnect
 */

class FailuresWidget extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'failures-monitor',
            widgetVersion: '2.0.0',
            autoConnect: true
        });

        this.failures = new Map();
        this.announcer = typeof VoiceAnnouncer !== 'undefined' ? new VoiceAnnouncer() : null;
        this.systems = {
            engine1: { name: 'Engine 1', icon: '🔧', status: 'ok' },
            engine2: { name: 'Engine 2', icon: '🔧', status: 'ok' },
            electrical: { name: 'Electrical', icon: '⚡', status: 'ok' },
            hydraulic: { name: 'Hydraulics', icon: '💧', status: 'ok' },
            fuel: { name: 'Fuel', icon: '⛽', status: 'ok' },
            avionics: { name: 'Avionics', icon: '📡', status: 'ok' },
            gear: { name: 'Landing Gear', icon: '🛞', status: 'ok' },
            flaps: { name: 'Flaps', icon: '✈️', status: 'ok' }
        };

        this.init();
    }

    init() {
        this.bindEvents();
        this.startPolling();
    }

    // SimGlassBase override: handle incoming messages
    onMessage(msg) {
        if (msg.type === 'simData' || msg.type === 'flightData') {
            this.checkFailures(msg.data);
        }
        if (msg.type === 'failures') {
            this.updateFromFailureData(msg.data);
        }
    }

    // SimGlassBase override: called when connected
    onConnect() {
        console.log('[Failures] WebSocket connected');
    }

    // SimGlassBase override: called when disconnected
    onDisconnect() {
        console.log('[Failures] WebSocket disconnected');
    }

    checkFailures(data) {
        // Check engine failures
        if (data.eng1Combustion !== undefined) {
            this.setSystemStatus('engine1', data.eng1Combustion ? 'ok' : 'fail', 'No combustion');
        }
        if (data.eng2Combustion !== undefined) {
            this.setSystemStatus('engine2', data.eng2Combustion ? 'ok' : 'fail', 'No combustion');
        }

        // Check electrical (bus voltage)
        if (data.electricalMainBusVoltage !== undefined) {
            const voltage = data.electricalMainBusVoltage;
            if (voltage < 20) {
                this.setSystemStatus('electrical', 'fail', `Low voltage: ${voltage.toFixed(1)}V`);
            } else if (voltage < 24) {
                this.setSystemStatus('electrical', 'warn', `Voltage: ${voltage.toFixed(1)}V`);
            } else {
                this.setSystemStatus('electrical', 'ok');
            }
        }

        // Check hydraulic pressure
        if (data.hydraulicPressure !== undefined) {
            const pressure = data.hydraulicPressure;
            if (pressure < 1500) {
                this.setSystemStatus('hydraulic', 'fail', `Low pressure: ${pressure} PSI`);
            } else if (pressure < 2500) {
                this.setSystemStatus('hydraulic', 'warn', `Pressure: ${pressure} PSI`);
            } else {
                this.setSystemStatus('hydraulic', 'ok');
            }
        }

        // Check fuel
        if (data.fuelTotalQuantity !== undefined) {
            const fuel = data.fuelTotalQuantity;
            if (fuel < 100) {
                this.setSystemStatus('fuel', 'fail', 'Critically low');
            } else if (fuel < 500) {
                this.setSystemStatus('fuel', 'warn', 'Low fuel');
            } else {
                this.setSystemStatus('fuel', 'ok');
            }
        }

        // Check gear
        if (data.gearDamageBySpeed !== undefined && data.gearDamageBySpeed > 0) {
            this.setSystemStatus('gear', 'fail', 'Damage detected');
        } else if (data.gearPosition !== undefined) {
            this.setSystemStatus('gear', 'ok');
        }

        // Check flaps
        if (data.flapsDamageBySpeed !== undefined && data.flapsDamageBySpeed > 0) {
            this.setSystemStatus('flaps', 'fail', 'Overspeed damage');
        } else {
            this.setSystemStatus('flaps', 'ok');
        }

        // Check avionics
        if (data.avionicsMasterSwitch !== undefined) {
            this.setSystemStatus('avionics', data.avionicsMasterSwitch ? 'ok' : 'warn', 'Master OFF');
        }

        this.updateDisplay();
    }

    updateFromFailureData(failureData) {
        // Handle explicit failure data from server
        if (failureData.activeFailures) {
            failureData.activeFailures.forEach(failure => {
                this.setSystemStatus(failure.system, 'fail', failure.detail);
            });
        }
        this.updateDisplay();
    }

    setSystemStatus(system, status, detail = '') {
        if (!this.systems[system]) return;

        const prevStatus = this.systems[system].status;
        this.systems[system].status = status;
        this.systems[system].detail = detail;

        // Track failure
        if (status === 'fail' && prevStatus !== 'fail') {
            this.failures.set(system, {
                system,
                name: this.systems[system].name,
                icon: this.systems[system].icon,
                detail,
                time: new Date()
            });

            // Voice alert for new failure
            if (this.announcer) {
                this.announcer.speak(`Warning: ${this.systems[system].name} failure`);
            }
        } else if (status === 'ok' && this.failures.has(system)) {
            this.failures.delete(system);
        }
    }

    updateDisplay() {
        // Update system cards
        Object.keys(this.systems).forEach(system => {
            const card = document.querySelector(`.system-card[data-system="${system}"]`);
            const statusEl = document.getElementById(`status-${system}`);

            if (card && statusEl) {
                const { status } = this.systems[system];
                card.classList.remove('failed', 'warning');
                statusEl.classList.remove('ok', 'warn', 'fail');

                if (status === 'fail') {
                    card.classList.add('failed');
                    statusEl.classList.add('fail');
                    statusEl.textContent = 'FAIL';
                } else if (status === 'warn') {
                    card.classList.add('warning');
                    statusEl.classList.add('warn');
                    statusEl.textContent = 'WARN';
                } else {
                    statusEl.classList.add('ok');
                    statusEl.textContent = 'OK';
                }
            }
        });

        // Update overall status
        const overallStatus = document.getElementById('overall-status');
        const failCount = [...Object.values(this.systems)].filter(s => s.status === 'fail').length;
        const warnCount = [...Object.values(this.systems)].filter(s => s.status === 'warn').length;

        overallStatus.classList.remove('ok', 'warning', 'critical');

        if (failCount > 0) {
            overallStatus.classList.add('critical');
            overallStatus.querySelector('.status-icon').textContent = '⚠️';
            overallStatus.querySelector('.status-text').textContent =
                `${failCount} System${failCount > 1 ? 's' : ''} Failed`;
        } else if (warnCount > 0) {
            overallStatus.classList.add('warning');
            overallStatus.querySelector('.status-icon').textContent = '⚡';
            overallStatus.querySelector('.status-text').textContent =
                `${warnCount} Warning${warnCount > 1 ? 's' : ''}`;
        } else {
            overallStatus.classList.add('ok');
            overallStatus.querySelector('.status-icon').textContent = '✓';
            overallStatus.querySelector('.status-text').textContent = 'All Systems Normal';
        }

        // Update failures list
        this.updateFailuresList();
    }

    updateFailuresList() {
        const listContent = document.getElementById('list-content');
        listContent.textContent = '';

        if (this.failures.size === 0) {
            const noFailures = document.createElement('div');
            noFailures.className = 'no-failures';
            noFailures.textContent = 'No active failures';
            listContent.appendChild(noFailures);
            return;
        }

        this.failures.forEach((failure, system) => {
            const item = document.createElement('div');
            item.className = 'failure-item';

            const icon = document.createElement('span');
            icon.className = 'icon';
            icon.textContent = failure.icon;

            const name = document.createElement('span');
            name.className = 'name';
            name.textContent = failure.name;

            const detail = document.createElement('span');
            detail.className = 'detail';
            detail.textContent = failure.detail || 'Failed';

            const time = document.createElement('span');
            time.className = 'time';
            time.textContent = this.formatTime(failure.time);

            item.appendChild(icon);
            item.appendChild(name);
            item.appendChild(detail);
            item.appendChild(time);
            listContent.appendChild(item);
        });
    }

    formatTime(date) {
        const mins = Math.floor((Date.now() - date.getTime()) / 60000);
        if (mins < 1) return 'Just now';
        if (mins === 1) return '1 min ago';
        return `${mins} mins ago`;
    }

    bindEvents() {
        // Clear failures button
        document.getElementById('btn-clear')?.addEventListener('click', () => {
            this.clearAllFailures();
        });

        // Quick failure buttons (for testing)
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const system = btn.dataset.failure;
                this.toggleTestFailure(system);
                btn.classList.toggle('active');
            });
        });
    }

    toggleTestFailure(system) {
        if (this.systems[system].status === 'fail') {
            this.setSystemStatus(system, 'ok');
        } else {
            this.setSystemStatus(system, 'fail', 'Test failure');
        }
        this.updateDisplay();
    }

    clearAllFailures() {
        Object.keys(this.systems).forEach(system => {
            this.setSystemStatus(system, 'ok');
        });
        this.failures.clear();
        this.updateDisplay();

        // Clear active buttons
        document.querySelectorAll('.action-btn.active').forEach(btn => {
            btn.classList.remove('active');
        });

        this.showToast('All failures cleared');
    }

    showToast(message) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 2000);
    }

    destroy() {
        this._destroyed = true;
        if (this._pollInterval) {
            clearInterval(this._pollInterval);
            this._pollInterval = null;
        }
        super.destroy();
    }

    async startPolling() {
        // Poll for failure data
        this._pollInterval = setInterval(async () => {
            try {
                const response = await fetch('/api/failures');
                if (response.ok) {
                    const data = await response.json();
                    this.updateFromFailureData(data);
                }
            } catch (e) {
                // Silent fail
            }
        }, 2000);
    }
}

// Toast styles
const toastStyle = document.createElement('style');
toastStyle.textContent = `
    .toast {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--widget-success, #22c55e);
        color: white;
        padding: 10px 20px;
        border-radius: 20px;
        font-size: 13px;
        z-index: 1000;
        animation: toastFade 2s ease-in-out;
    }
    @keyframes toastFade {
        0%, 100% { opacity: 0; transform: translateX(-50%) translateY(10px); }
        15%, 85% { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
`;
document.head.appendChild(toastStyle);

// Initialize
const failuresWidget = new FailuresWidget();
window.addEventListener('beforeunload', () => failuresWidget.destroy());
