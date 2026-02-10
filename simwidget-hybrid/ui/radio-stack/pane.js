const PRESETS = [
    { name: 'UNICOM', freq: '122.800' },
    { name: 'GUARD', freq: '121.500' },
    { name: 'ATIS', freq: '127.850' },
    { name: 'CTAF', freq: '122.900' },
    { name: 'FSS', freq: '122.200' },
    { name: 'CENTER', freq: '132.450' }
];

class RadioStack extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'radio-stack',
            widgetVersion: '2.0.0',
            autoConnect: false  // HTTP polling for radio data
        });

        this.radios = {
            com1: { active: '118.000', standby: '121.500' },
            com2: { active: '121.500', standby: '122.800' },
            nav1: { active: '110.00', standby: '108.00' }
        };

        // Compact mode
        this.compactMode = localStorage.getItem('radio-stack-compact') === 'true';

        this.init();
    }

    init() {
        document.querySelectorAll('.btn-swap').forEach(btn => {
            btn.addEventListener('click', () => this.swap(btn.dataset.radio));
        });

        document.querySelectorAll('.xpdr-btns button').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('xpdr-code').value = btn.dataset.code;
            });
        });

        this.setupCompactToggle();
        this.renderPresets();
        this._syncInterval = setInterval(() => this.sync(), 5000);
    }

    swap(radio) {
        const r = this.radios[radio];
        [r.active, r.standby] = [r.standby, r.active];
        document.getElementById(radio + '-active').textContent = r.active;
        document.getElementById(radio + '-standby').value = r.standby;
        this.updateCompact();
    }

    /**
     * Setup compact mode toggle button
     */
    setupCompactToggle() {
        const toggleBtn = document.getElementById('compact-toggle');
        const root = document.getElementById('widget-root');
        if (!toggleBtn || !root) return;

        // Wire compact swap buttons
        document.querySelectorAll('.rs-compact-swap').forEach(btn => {
            btn.addEventListener('click', () => this.swap(btn.dataset.radio));
        });

        // Apply saved state
        if (this.compactMode) {
            root.classList.add('compact');
            toggleBtn.classList.add('active');
        }

        toggleBtn.addEventListener('click', () => {
            this.compactMode = !this.compactMode;
            root.classList.toggle('compact', this.compactMode);
            toggleBtn.classList.toggle('active', this.compactMode);
            localStorage.setItem('radio-stack-compact', this.compactMode);
            this.updateCompact();
        });
    }

    /**
     * Update compact mode display elements
     */
    updateCompact() {
        if (!this.compactMode) return;

        const el = (id) => document.getElementById(id);

        // COM1 active/standby
        const rsCom1Active = el('rs-com1-active');
        if (rsCom1Active) rsCom1Active.textContent = this.radios.com1.active;
        const rsCom1Standby = el('rs-com1-standby');
        if (rsCom1Standby) rsCom1Standby.textContent = this.radios.com1.standby;

        // NAV1 active/standby
        const rsNav1Active = el('rs-nav1-active');
        if (rsNav1Active) rsNav1Active.textContent = this.radios.nav1.active;
        const rsNav1Standby = el('rs-nav1-standby');
        if (rsNav1Standby) rsNav1Standby.textContent = this.radios.nav1.standby;

        // Transponder code
        const rsXpdrCode = el('rs-xpdr-code');
        const xpdrInput = el('xpdr-code');
        if (rsXpdrCode && xpdrInput) {
            rsXpdrCode.textContent = xpdrInput.value;
        }
    }

    renderPresets() {
        const grid = document.getElementById('presets-grid');
        PRESETS.forEach(p => {
            const btn = document.createElement('button');
            btn.className = 'preset-btn';
            btn.innerHTML = '<span class="preset-name">' + p.name + '</span><span class="preset-freq">' + p.freq + '</span>';
            btn.onclick = () => { document.getElementById('com1-standby').value = p.freq; };
            grid.appendChild(btn);
        });
    }

    async sync() {
        try {
            const res = await fetch('/api/simvars');
            if (res.ok) {
                const d = await res.json();
                if (d.COM_ACTIVE_FREQUENCY_1) {
                    this.radios.com1.active = d.COM_ACTIVE_FREQUENCY_1.toFixed(3);
                    document.getElementById('com1-active').textContent = this.radios.com1.active;
                }
                this.updateCompact();
            }
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'updateFromSim',
                    glass: 'radio-stack',
                    dataType: typeof data
                });
            }
        }
    }

    destroy() {
        if (this._syncInterval) {
            clearInterval(this._syncInterval);
            this._syncInterval = null;
        }

        // Call parent destroy
        super.destroy();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.radioStack = new RadioStack();
    window.addEventListener('beforeunload', () => window.radioStack?.destroy());
});
