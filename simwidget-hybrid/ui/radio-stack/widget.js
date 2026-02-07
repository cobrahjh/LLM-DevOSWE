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

        this.renderPresets();
        this._syncInterval = setInterval(() => this.sync(), 5000);
    }

    swap(radio) {
        const r = this.radios[radio];
        [r.active, r.standby] = [r.standby, r.active];
        document.getElementById(radio + '-active').textContent = r.active;
        document.getElementById(radio + '-standby').value = r.standby;
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
            }
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'updateFromSim',
                    widget: 'radio-stack',
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
