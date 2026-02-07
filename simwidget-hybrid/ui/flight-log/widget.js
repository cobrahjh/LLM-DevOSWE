class FlightLog extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'flight-log',
            widgetVersion: '2.0.0',
            autoConnect: false  // HTTP polling for flight data
        });

        this._destroyed = false;
        this.recording = false;
        this.startTime = null;
        this.flightData = { maxAlt: 0, distance: 0, landings: 0, lastPos: null, wasOnGround: true };
        this.flights = [];
        this.load();
        this.init();
    }

    init() {
        document.getElementById('btn-record').onclick = () => this.startRecording();
        document.getElementById('btn-stop').onclick = () => this.stopRecording();
        document.getElementById('btn-export').onclick = () => this.exportLog();
        this.renderHistory();
        this.updateTotals();
        this._updateInterval = setInterval(() => this.update(), 1000);
    }

    startRecording() {
        this.recording = true;
        this.startTime = Date.now();
        this.flightData = { maxAlt: 0, distance: 0, landings: 0, lastPos: null, wasOnGround: true };
        document.getElementById('flight-status').textContent = '● RECORDING';
        document.getElementById('flight-status').classList.add('recording');
        document.getElementById('btn-record').disabled = true;
        document.getElementById('btn-stop').disabled = false;
    }

    stopRecording() {
        this.recording = false;
        const duration = Math.round((Date.now() - this.startTime) / 1000);
        const flight = {
            date: new Date().toISOString(),
            departure: document.getElementById('departure').value.toUpperCase() || '----',
            arrival: document.getElementById('arrival').value.toUpperCase() || '----',
            duration, ...this.flightData
        };
        this.flights.unshift(flight);
        this.save();
        this.renderHistory();
        this.updateTotals();
        document.getElementById('flight-status').textContent = 'NOT RECORDING';
        document.getElementById('flight-status').classList.remove('recording');
        document.getElementById('btn-record').disabled = false;
        document.getElementById('btn-stop').disabled = true;
        document.getElementById('duration').textContent = '00:00';
    }

    async update() {
        if (!this.recording) return;
        const elapsed = Math.round((Date.now() - this.startTime) / 1000);
        const m = Math.floor(elapsed / 60), s = elapsed % 60;
        document.getElementById('duration').textContent = m.toString().padStart(2,'0') + ':' + s.toString().padStart(2,'0');

        try {
            const res = await fetch('/api/simvars');
            if (res.ok) {
                const d = await res.json();
                const alt = d.PLANE_ALTITUDE || 0;
                const lat = d.PLANE_LATITUDE || 0;
                const lon = d.PLANE_LONGITUDE || 0;
                const onGround = d.SIM_ON_GROUND || false;

                if (alt > this.flightData.maxAlt) this.flightData.maxAlt = Math.round(alt);
                document.getElementById('max-alt').textContent = this.flightData.maxAlt + ' ft';

                if (this.flightData.lastPos) {
                    const dist = this.haversine(this.flightData.lastPos.lat, this.flightData.lastPos.lon, lat, lon);
                    this.flightData.distance += dist;
                    document.getElementById('distance').textContent = Math.round(this.flightData.distance) + ' nm';
                }
                this.flightData.lastPos = { lat, lon };

                if (!this.flightData.wasOnGround && onGround) {
                    this.flightData.landings++;
                    document.getElementById('landings').textContent = this.flightData.landings;
                }
                this.flightData.wasOnGround = onGround;
            }
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'updateFromSim',
                    widget: 'flight-log',
                    dataType: typeof data
                });
            }
        }
    }

    haversine(lat1, lon1, lat2, lon2) {
        const R = 3440.065; // nm
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    renderHistory() {
        const list = document.getElementById('history-list');
        list.innerHTML = '';
        this.flights.slice(0, 10).forEach(f => {
            const item = document.createElement('div');
            item.className = 'history-item';
            const m = Math.floor(f.duration/60), s = f.duration % 60;
            item.innerHTML = '<div><span class="history-route">' + f.departure + ' → ' + f.arrival + '</span><br><span class="history-date">' + new Date(f.date).toLocaleDateString() + '</span></div><span class="history-time">' + m + ':' + s.toString().padStart(2,'0') + '</span>';
            list.appendChild(item);
        });
    }

    updateTotals() {
        document.getElementById('total-flights').textContent = this.flights.length;
        const totalSec = this.flights.reduce((a, f) => a + f.duration, 0);
        const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60);
        document.getElementById('total-time').textContent = h + ':' + m.toString().padStart(2, '0');
        document.getElementById('total-distance').textContent = Math.round(this.flights.reduce((a, f) => a + f.distance, 0)) + ' nm';
    }

    save() { localStorage.setItem('flight-log', JSON.stringify(this.flights)); }
    load() { try { this.flights = JSON.parse(localStorage.getItem('flight-log')) || []; } catch (e) { this.flights = []; } }
    exportLog() {
        const csv = 'Date,Departure,Arrival,Duration,Distance,MaxAlt,Landings\n' + this.flights.map(f => [f.date, f.departure, f.arrival, f.duration, f.distance, f.maxAlt, f.landings].join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'flight-log.csv'; a.click();
    }

    destroy() {
        this._destroyed = true;

        if (this._updateInterval) {
            clearInterval(this._updateInterval);
            this._updateInterval = null;
        }

        // Call parent destroy
        super.destroy();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.flightLog = new FlightLog();
    window.addEventListener('beforeunload', () => window.flightLog?.destroy());
});
