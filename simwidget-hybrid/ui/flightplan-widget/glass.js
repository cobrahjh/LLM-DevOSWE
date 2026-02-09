/**
 * Flight Plan glass - SimGlass
 * Displays active flight plan with waypoints and progress
 *
 * glass Interconnection:
 * - Broadcasts waypoint-select when user clicks waypoint
 * - Broadcasts route-update when flight plan changes
 * - Broadcasts copy-route for notepad glass
 *
 * Voice Features:
 * - Click speaker icon to announce next waypoint
 * - Auto-announce waypoint changes (optional)
 */

class FlightPlanGlass extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'flight-plan',
            widgetVersion: '2.0.0',
            autoConnect: true
        });

        this.flightPlan = null;
        this.currentPosition = null;
        this.groundSpeed = 0;
        this.lastAnnouncedWaypoint = null;

        // Voice announcer
        this.announcer = typeof VoiceAnnouncer !== 'undefined' ? new VoiceAnnouncer() : null;

        // Cross-glass communication
        this.syncChannel = new SafeChannel('SimGlass-sync');
        this.syncChannel.onmessage = (event) => {
            const { type, data } = event.data;
            if (type === 'simbrief-plan') {
                this.importSimBriefPlan(data);
            }
        };

        this.initElements();
        this.initControls();
        this.pollFlightPlan();
    }

    importSimBriefPlan(data) {
        // Convert SimBrief format to our format
        const waypoints = data.waypoints.map((wp, index) => ({
            ident: wp.ident,
            name: wp.name,
            type: index === 0 ? 'departure' : (index === data.waypoints.length - 1 ? 'arrival' : wp.type || 'fix'),
            lat: wp.lat,
            lng: wp.lng,
            alt: wp.altitude,
            altitude: wp.altitude,
            distanceFromPrev: wp.distanceFromPrev,
            passed: false,
            active: index === 0
        }));

        const flightPlan = {
            source: 'simbrief',
            departure: typeof data.departure === 'string' ? data.departure : (data.departure?.icao_code || waypoints[0]?.ident || '----'),
            arrival: typeof data.arrival === 'string' ? data.arrival : (data.arrival?.icao_code || waypoints[waypoints.length - 1]?.ident || '----'),
            totalDistance: data.totalDistance || 0,
            waypoints: waypoints
        };

        this.updateFlightPlan(flightPlan);
        this.showFeedback('SimBrief plan loaded!');
    }

    initElements() {
        this.depAirport = document.getElementById('dep-airport');
        this.arrAirport = document.getElementById('arr-airport');
        this.totalDist = document.getElementById('total-dist');
        this.totalEte = document.getElementById('total-ete');
        this.progressFill = document.getElementById('progress-fill');
        this.progressPercent = document.getElementById('progress-percent');
        this.progressRemaining = document.getElementById('progress-remaining');
        this.waypointCount = document.getElementById('waypoint-count');
        this.waypointsList = document.getElementById('waypoints-list');
        this.nextName = document.getElementById('next-name');
        this.nextDist = document.getElementById('next-dist');
        this.nextEte = document.getElementById('next-ete');
        this.nextBearing = document.getElementById('next-bearing');
        this.refreshBtn = document.getElementById('btn-refresh');
    }

    initControls() {
        this.refreshBtn.addEventListener('click', () => {
            this.refreshBtn.classList.add('spinning');
            this.pollFlightPlan();
            setTimeout(() => this.refreshBtn.classList.remove('spinning'), 1000);
        });

        // Copy route to notepad
        document.getElementById('btn-copy-route').addEventListener('click', () => {
            this.copyRouteToNotepad();
        });

        // Speak next waypoint
        document.getElementById('btn-speak-next').addEventListener('click', () => {
            this.speakNextWaypoint();
        });
    }

    speakNextWaypoint() {
        if (!this.flightPlan || !this.flightPlan.nextWaypoint) {
            this.showFeedback('No waypoint data');
            return;
        }

        const wp = this.flightPlan.nextWaypoint;

        if (this.announcer) {
            this.announcer.speakWaypoint(wp);
        } else if (typeof VoiceAnnouncer !== 'undefined') {
            VoiceAnnouncer.announceWaypoint(wp);
        }

        // Visual feedback
        const btn = document.getElementById('btn-speak-next');
        btn.classList.add('speaking');
        setTimeout(() => btn.classList.remove('speaking'), 3000);
    }

    copyRouteToNotepad() {
        if (!this.flightPlan || !this.flightPlan.waypoints) {
            this.showFeedback('No flight plan loaded');
            return;
        }

        const routeText = this.flightPlan.waypoints
            .map(wp => wp.ident || wp.name || 'WP')
            .join(' ');

        const details = `Route: ${this.flightPlan.departure || '----'} → ${this.flightPlan.arrival || '----'}
Dist: ${this.flightPlan.totalDistance ? Math.round(this.flightPlan.totalDistance) + ' nm' : '---'}
WPTs: ${routeText}`;

        // Broadcast to notepad glass
        this.syncChannel.postMessage({
            type: 'copy-route',
            data: { text: details }
        });

        this.showFeedback('Sent to Notepad');
    }

    showFeedback(message) {
        const existing = document.querySelector('.copy-feedback');
        if (existing) existing.remove();

        const feedback = document.createElement('div');
        feedback.className = 'copy-feedback';
        feedback.textContent = message;
        document.body.appendChild(feedback);

        setTimeout(() => feedback.remove(), 1500);
    }

    // SimGlassBase override: handle incoming messages
    onMessage(data) {
        if (data.type === 'simvar' || data.type === 'position' || data.type === 'flightData') {
            this.updatePosition(data);
        }
        if (data.type === 'flightplan') {
            this.updateFlightPlan(data);
        }
    }

    // SimGlassBase override: called when connected
    onConnect() {
        console.log('[FlightPlan] WebSocket connected');
    }

    // SimGlassBase override: called when disconnected
    onDisconnect() {
        console.log('[FlightPlan] WebSocket disconnected');
    }

    async pollFlightPlan() {
        if (this._destroyed) return;

        try {
            // Try to get flight plan from API
            const response = await fetch('/api/flightplan');
            if (response.ok) {
                const data = await response.json();
                if (data && data.waypoints && data.waypoints.length > 0) {
                    this.updateFlightPlan(data);
                }
            }
        } catch (e) {
            console.log('Flight plan fetch failed:', e);
        }

        // Also poll position
        try {
            const posResponse = await fetch('/api/simvars');
            if (posResponse.ok) {
                const posData = await posResponse.json();
                this.updatePosition(posData);
            }
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'pollPosition',
                    glass: 'flightplan-glass',
                    url: '/api/simvars'
                });
            }
        }

        // Poll every 5 seconds
        if (!this._destroyed) {
            this._pollTimeout = setTimeout(() => this.pollFlightPlan(), 5000);
        }
    }

    updatePosition(data) {
        const lat = data.PLANE_LATITUDE || data.latitude || data.lat;
        const lng = data.PLANE_LONGITUDE || data.longitude || data.lng || data.lon;
        this.groundSpeed = data.GROUND_VELOCITY || data.groundSpeed || data.gs || 0;

        if (lat && lng) {
            this.currentPosition = { lat, lng };
            this.updateProgress();
        }
    }

    updateFlightPlan(data) {
        this.flightPlan = data;

        // Update summary
        if (data.departure) {
            this.depAirport.textContent = data.departure.icao || data.departure;
        }
        if (data.arrival) {
            this.arrAirport.textContent = data.arrival.icao || data.arrival;
        }
        if (data.totalDistance) {
            this.totalDist.textContent = Math.round(data.totalDistance) + ' nm';
        }

        // Render waypoints
        this.renderWaypoints(data.waypoints || []);
        this.updateProgress();

        // Broadcast route update to other widgets (map, notepad)
        this.syncChannel.postMessage({
            type: 'route-update',
            data: data
        });
    }

    renderWaypoints(waypoints) {
        if (!waypoints || waypoints.length === 0) {
            this.showNoFlightPlan();
            return;
        }

        this.waypointsList.replaceChildren();
        this.waypointCount.textContent = '0/' + waypoints.length;

        let passedCount = 0;

        waypoints.forEach((wp, index) => {
            const div = document.createElement('div');
            div.className = 'waypoint';

            // Determine status
            const isPassed = wp.passed || false;
            const isActive = wp.active || (index === this.findActiveWaypointIndex(waypoints));

            if (isPassed) {
                div.classList.add('passed');
                passedCount++;
            } else if (isActive) {
                div.classList.add('active');
            } else {
                div.classList.add('upcoming');
            }

            // Icon
            const icon = document.createElement('span');
            icon.className = 'waypoint-icon';
            icon.textContent = this.getWaypointIcon(wp.type || wp.waypointType);

            // Info
            const info = document.createElement('div');
            info.className = 'waypoint-info';

            const name = document.createElement('div');
            name.className = 'waypoint-name';
            name.textContent = wp.ident || wp.name || wp.id || ('WP' + (index + 1));

            const type = document.createElement('div');
            type.className = 'waypoint-type';
            type.textContent = this.formatWaypointType(wp.type || wp.waypointType);

            info.appendChild(name);
            info.appendChild(type);

            // Data
            const dataDiv = document.createElement('div');
            dataDiv.className = 'waypoint-data';

            if (wp.distanceFromPrev || wp.legDistance) {
                const dist = document.createElement('div');
                dist.className = 'waypoint-dist';
                dist.textContent = Math.round(wp.distanceFromPrev || wp.legDistance) + ' nm';
                dataDiv.appendChild(dist);
            }

            if (wp.altitude || wp.alt) {
                const alt = document.createElement('div');
                alt.className = 'waypoint-alt';
                alt.textContent = this.formatAltitude(wp.altitude || wp.alt);
                dataDiv.appendChild(alt);
            }

            div.appendChild(icon);
            div.appendChild(info);
            div.appendChild(dataDiv);

            // Click to broadcast waypoint selection to map
            if (wp.lat && wp.lng) {
                div.style.cursor = 'pointer';
                div.addEventListener('click', () => {
                    this.syncChannel.postMessage({
                        type: 'waypoint-select',
                        data: {
                            index,
                            ident: wp.ident || wp.name,
                            lat: wp.lat,
                            lng: wp.lng
                        }
                    });
                    // Highlight selected waypoint
                    this.waypointsList.querySelectorAll('.waypoint').forEach(w => w.classList.remove('selected'));
                    div.classList.add('selected');
                });
            }

            this.waypointsList.appendChild(div);
        });

        this.waypointCount.textContent = passedCount + '/' + waypoints.length;
    }

    showNoFlightPlan() {
        this.waypointsList.replaceChildren();

        const div = document.createElement('div');
        div.className = 'no-plan';

        const icon = document.createElement('div');
        icon.className = 'icon';
        icon.textContent = '✈️';

        const text = document.createElement('div');
        text.className = 'text';
        text.textContent = 'No active flight plan';

        const hint = document.createElement('div');
        hint.className = 'hint';
        hint.textContent = 'Load a flight plan in MSFS';

        div.appendChild(icon);
        div.appendChild(text);
        div.appendChild(hint);
        this.waypointsList.appendChild(div);
    }

    findActiveWaypointIndex(waypoints) {
        if (!this.currentPosition || !waypoints.length) return 0;

        // Find first non-passed waypoint
        for (let i = 0; i < waypoints.length; i++) {
            if (!waypoints[i].passed) {
                return i;
            }
        }
        return waypoints.length - 1;
    }

    updateProgress() {
        if (!this.flightPlan || !this.flightPlan.waypoints) return;

        const waypoints = this.flightPlan.waypoints;
        const activeIndex = this.findActiveWaypointIndex(waypoints);
        const activeWp = waypoints[activeIndex];

        if (activeWp) {
            // Update next waypoint display
            this.nextName.textContent = activeWp.ident || activeWp.name || '----';

            if (this.currentPosition && activeWp.lat && activeWp.lng) {
                const dist = this.calculateDistance(
                    this.currentPosition.lat, this.currentPosition.lng,
                    activeWp.lat, activeWp.lng
                );
                this.nextDist.textContent = dist.toFixed(1) + ' nm';

                // ETE based on ground speed
                if (this.groundSpeed > 0) {
                    const eteMinutes = (dist / this.groundSpeed) * 60;
                    this.nextEte.textContent = this.formatTime(eteMinutes);
                } else {
                    this.nextEte.textContent = '--:--';
                }

                // Bearing
                const bearing = this.calculateBearing(
                    this.currentPosition.lat, this.currentPosition.lng,
                    activeWp.lat, activeWp.lng
                );
                this.nextBearing.textContent = Math.round(bearing) + '°';
            }
        }

        // Update overall progress
        const totalDist = this.flightPlan.totalDistance || 0;
        if (totalDist > 0) {
            // Calculate distance flown
            let distanceFlown = 0;
            for (let i = 0; i < activeIndex; i++) {
                distanceFlown += waypoints[i].distanceFromPrev || waypoints[i].legDistance || 0;
            }

            const percent = Math.min(100, (distanceFlown / totalDist) * 100);
            this.progressFill.style.width = percent + '%';
            this.progressPercent.textContent = Math.round(percent) + '%';

            const remaining = totalDist - distanceFlown;
            this.progressRemaining.textContent = Math.round(remaining) + ' nm remaining';

            // Total ETE
            if (this.groundSpeed > 0) {
                const totalEte = (remaining / this.groundSpeed) * 60;
                this.totalEte.textContent = this.formatTime(totalEte);
            }
        }
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 3440.065; // Earth radius in nautical miles
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    calculateBearing(lat1, lon1, lat2, lon2) {
        const dLon = this.toRad(lon2 - lon1);
        const y = Math.sin(dLon) * Math.cos(this.toRad(lat2));
        const x = Math.cos(this.toRad(lat1)) * Math.sin(this.toRad(lat2)) -
                  Math.sin(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.cos(dLon);
        let bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360;
    }

    toRad(deg) {
        return deg * Math.PI / 180;
    }

    formatTime(minutes) {
        if (minutes < 0 || !isFinite(minutes)) return '--:--';
        const hrs = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        return hrs.toString().padStart(2, '0') + ':' + mins.toString().padStart(2, '0');
    }

    formatAltitude(alt) {
        if (!alt) return '';
        const feet = typeof alt === 'number' ? alt : parseInt(alt);
        if (feet >= 18000) {
            return 'FL' + Math.round(feet / 100);
        }
        return feet.toLocaleString() + ' ft';
    }

    getWaypointIcon(type) {
        const icons = {
            'airport': '🛫',
            'departure': '🛫',
            'arrival': '🛬',
            'vor': '📡',
            'ndb': '📻',
            'fix': '📍',
            'waypoint': '📍',
            'intersection': '✕',
            'runway': '🛬',
            'ils': '📶',
            'dme': '📡',
            'user': '⭐'
        };
        return icons[type?.toLowerCase()] || '📍';
    }

    destroy() {
        this._destroyed = true;
        if (this._pollTimeout) {
            clearTimeout(this._pollTimeout);
            this._pollTimeout = null;
        }
        if (this.syncChannel) {
            this.syncChannel.close();
            this.syncChannel = null;
        }
        super.destroy();
    }

    formatWaypointType(type) {
        if (!type) return '';
        const types = {
            'airport': 'Airport',
            'departure': 'Departure',
            'arrival': 'Arrival',
            'vor': 'VOR',
            'ndb': 'NDB',
            'fix': 'Fix',
            'waypoint': 'Waypoint',
            'intersection': 'Intersection',
            'runway': 'Runway',
            'ils': 'ILS',
            'dme': 'DME',
            'user': 'User Waypoint'
        };
        return types[type?.toLowerCase()] || type;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.flightPlanGlass = new FlightPlanGlass();
    window.addEventListener('beforeunload', () => window.flightPlanGlass?.destroy());
});
