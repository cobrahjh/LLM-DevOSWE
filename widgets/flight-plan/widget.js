/**
 * Flight Plan Widget
 * SimWidget Engine v1.0.0
 */

class FlightPlanWidget {
    constructor() {
        this.ws = null;
        this.elements = {};
        this.flightPlan = {
            origin: 'KJFK',
            destination: 'KLAX',
            waypoints: [
                { id: 'KJFK', alt: 0, dist: 0, passed: true },
                { id: 'MERIT', alt: 15000, dist: 45, passed: true },
                { id: 'GREKI', alt: 28000, dist: 120, passed: false, active: true },
                { id: 'OTTTO', alt: 35000, dist: 280, passed: false },
                { id: 'REVUE', alt: 35000, dist: 450, passed: false },
                { id: 'DINTY', alt: 35000, dist: 890, passed: false },
                { id: 'BAYST', alt: 28000, dist: 1100, passed: false },
                { id: 'KLAX', alt: 0, dist: 1200, passed: false }
            ],
            totalDist: 1200,
            currentDist: 95,
            groundSpeed: 450
        };
        this.init();
    }

    init() {
        this.cacheElements();
        this.connect();
        this.render();
        this.startMockUpdates();
    }

    cacheElements() {
        this.elements = {
            conn: document.getElementById('conn'),
            route: document.getElementById('route'),
            progressPct: document.getElementById('progress-pct'),
            progressBar: document.getElementById('progress-bar'),
            nextWpt: document.getElementById('next-wpt'),
            nextDist: document.getElementById('next-dist'),
            nextBrg: document.getElementById('next-brg'),
            nextEte: document.getElementById('next-ete'),
            waypointList: document.getElementById('waypoint-list'),
            destIcao: document.getElementById('dest-icao'),
            destDist: document.getElementById('dest-dist'),
            destEta: document.getElementById('dest-eta'),
            btnDirect: document.getElementById('btn-direct')
        };

        this.elements.btnDirect.addEventListener('click', () => this.directTo());
    }

    connect() {
        const host = window.location.hostname || 'localhost';
        this.ws = new WebSocket(`ws://${host}:8080`);

        this.ws.onopen = () => {
            this.elements.conn.classList.add('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'flightPlan') {
                    this.updateFlightPlan(msg.data);
                }
            } catch (e) {}
        };

        this.ws.onclose = () => {
            this.elements.conn.classList.remove('connected');
            setTimeout(() => this.connect(), 3000);
        };
    }

    render() {
        const fp = this.flightPlan;

        // Route
        this.elements.route.textContent = `${fp.origin} → ${fp.destination}`;

        // Progress
        const progress = Math.round((fp.currentDist / fp.totalDist) * 100);
        this.elements.progressPct.textContent = progress + '%';
        this.elements.progressBar.style.width = progress + '%';

        // Next waypoint
        const activeWpt = fp.waypoints.find(w => w.active);
        if (activeWpt) {
            const distToNext = activeWpt.dist - fp.currentDist;
            const eteMinutes = Math.round((distToNext / fp.groundSpeed) * 60);

            this.elements.nextWpt.textContent = activeWpt.id;
            this.elements.nextDist.textContent = distToNext.toFixed(0) + ' NM';
            this.elements.nextBrg.textContent = (Math.random() * 360).toFixed(0).padStart(3, '0') + '°';
            this.elements.nextEte.textContent = this.formatTime(eteMinutes);
        }

        // Waypoint list
        let listHtml = '';
        fp.waypoints.forEach(wpt => {
            const cls = wpt.passed ? 'passed' : (wpt.active ? 'active' : '');
            const distRemaining = Math.max(0, wpt.dist - fp.currentDist);
            const ete = fp.groundSpeed > 0 ? Math.round((distRemaining / fp.groundSpeed) * 60) : 0;

            listHtml += `
                <div class="fp-list-item ${cls}">
                    <span>${wpt.id}</span>
                    <span>${wpt.alt > 0 ? 'FL' + (wpt.alt / 100) : '---'}</span>
                    <span>${distRemaining > 0 ? distRemaining.toFixed(0) : '--'}</span>
                    <span>${ete > 0 ? this.formatTime(ete) : '--:--'}</span>
                </div>
            `;
        });
        this.elements.waypointList.innerHTML = listHtml;

        // Destination
        this.elements.destIcao.textContent = fp.destination;
        const distToDest = fp.totalDist - fp.currentDist;
        this.elements.destDist.textContent = distToDest.toFixed(0) + ' NM';
        const etaMinutes = Math.round((distToDest / fp.groundSpeed) * 60);
        const now = new Date();
        now.setMinutes(now.getMinutes() + etaMinutes);
        this.elements.destEta.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    formatTime(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}:${m.toString().padStart(2, '0')}`;
    }

    directTo() {
        console.log('Direct-to selected waypoint');
    }

    startMockUpdates() {
        setInterval(() => {
            // Simulate progress
            if (this.flightPlan.currentDist < this.flightPlan.totalDist) {
                this.flightPlan.currentDist += this.flightPlan.groundSpeed / 3600 * 2; // 2 seconds

                // Update passed/active waypoints
                this.flightPlan.waypoints.forEach((wpt, i) => {
                    if (wpt.dist <= this.flightPlan.currentDist) {
                        wpt.passed = true;
                        wpt.active = false;
                    } else if (!wpt.passed && !this.flightPlan.waypoints.slice(0, i).some(w => !w.passed)) {
                        wpt.active = true;
                    } else {
                        wpt.active = false;
                    }
                });

                this.render();
            }
        }, 2000);
    }

    updateFlightPlan(data) {
        this.flightPlan = { ...this.flightPlan, ...data };
        this.render();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.flightPlanWidget = new FlightPlanWidget();
});
