/**
 * Flight Log Widget - SimGlass
 * Auto-logs flights with stats and totals
 */

class FlightLogWidget extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'flight-log',
            widgetVersion: '2.0.0',
            autoConnect: true
        });

        this.flights = [];
        this.currentFlight = null;
        this.flightStartTime = null;
        this.timerInterval = null;
        this.lastData = null;
        this.wasOnGround = true;
        this.maxAltitude = 0;
        this.totalDistance = 0;
        this.lastPosition = null;

        this.initElements();
        this.initEvents();
        this.loadFlights();
        this.updateTotals();
    }

    initElements() {
        this.currentFlightEl = document.getElementById('current-flight');
        this.flightStatus = document.getElementById('flight-status');
        this.flightTimer = document.getElementById('flight-timer');
        this.departureEl = document.getElementById('departure');
        this.arrivalEl = document.getElementById('arrival');
        this.distanceEl = document.getElementById('distance');
        this.maxAltEl = document.getElementById('max-alt');
        this.logList = document.getElementById('log-list');

        this.totalFlightsEl = document.getElementById('total-flights');
        this.totalHoursEl = document.getElementById('total-hours');
        this.totalDistanceEl = document.getElementById('total-distance');
        this.totalLandingsEl = document.getElementById('total-landings');

        this.exportBtn = document.getElementById('btn-export');
        this.clearBtn = document.getElementById('btn-clear');
    }

    initEvents() {
        this.exportBtn.addEventListener('click', () => this.exportCSV());
        this.clearBtn.addEventListener('click', () => this.clearAll());
    }

    // SimGlassBase override: handle incoming messages
    onMessage(msg) {
        if (msg.type === 'flightData') {
            this.processFlightData(msg.data);
        }
    }

    // SimGlassBase override: called when connected
    onConnect() {
        console.log('[FlightLog] WebSocket connected');
    }

    // SimGlassBase override: called when disconnected
    onDisconnect() {
        console.log('[FlightLog] WebSocket disconnected');
    }

    processFlightData(data) {
        const onGround = data.onGround || data.altitude < 100;
        const altitude = data.altitude || 0;

        // Detect takeoff
        if (this.wasOnGround && !onGround && !this.currentFlight) {
            this.startFlight(data);
        }

        // Track max altitude
        if (this.currentFlight && altitude > this.maxAltitude) {
            this.maxAltitude = altitude;
            this.maxAltEl.textContent = Math.round(altitude).toLocaleString() + ' ft';
        }

        // Track distance
        if (this.currentFlight && data.latitude && data.longitude) {
            if (this.lastPosition) {
                const dist = this.calculateDistance(
                    this.lastPosition.lat, this.lastPosition.lon,
                    data.latitude, data.longitude
                );
                this.totalDistance += dist;
                this.distanceEl.textContent = Math.round(this.totalDistance) + ' nm';
            }
            this.lastPosition = { lat: data.latitude, lon: data.longitude };
        }

        // Detect landing
        if (!this.wasOnGround && onGround && this.currentFlight) {
            this.endFlight(data);
        }

        this.wasOnGround = onGround;
        this.lastData = data;
    }

    startFlight(data) {
        this.currentFlight = {
            departure: data.nearestAirport || 'ZZZZ',
            startTime: Date.now(),
            startLat: data.latitude,
            startLon: data.longitude
        };

        this.flightStartTime = Date.now();
        this.maxAltitude = 0;
        this.totalDistance = 0;
        this.lastPosition = null;

        this.currentFlightEl.classList.add('active');
        this.flightStatus.textContent = 'In Flight';
        this.departureEl.textContent = this.currentFlight.departure;
        this.arrivalEl.textContent = '----';

        this.startTimer();
    }

    endFlight(data) {
        if (!this.currentFlight) return;

        const duration = Date.now() - this.currentFlight.startTime;

        const flight = {
            id: Date.now(),
            departure: this.currentFlight.departure,
            arrival: data.nearestAirport || 'ZZZZ',
            date: new Date().toISOString(),
            duration: duration,
            distance: Math.round(this.totalDistance),
            maxAltitude: Math.round(this.maxAltitude)
        };

        this.flights.unshift(flight);
        this.flights = this.flights.slice(0, 50); // Keep last 50
        this.saveFlights();

        this.arrivalEl.textContent = flight.arrival;
        this.currentFlightEl.classList.remove('active');
        this.flightStatus.textContent = 'Flight Complete';

        this.stopTimer();
        this.renderFlights();
        this.updateTotals();

        // Reset for next flight after delay
        setTimeout(() => {
            this.currentFlight = null;
            this.resetDisplay();
        }, 5000);
    }

    startTimer() {
        this.stopTimer();
        this.timerInterval = setInterval(() => {
            if (this.flightStartTime) {
                const elapsed = Date.now() - this.flightStartTime;
                this.flightTimer.textContent = this.formatDuration(elapsed);
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    resetDisplay() {
        this.flightStatus.textContent = 'No Active Flight';
        this.flightTimer.textContent = '00:00:00';
        this.departureEl.textContent = '----';
        this.arrivalEl.textContent = '----';
        this.distanceEl.textContent = '-- nm';
        this.maxAltEl.textContent = '-- ft';
    }

    formatDuration(ms) {
        const totalSecs = Math.floor(ms / 1000);
        const hours = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        return [hours, mins, secs].map(n => n.toString().padStart(2, '0')).join(':');
    }

    formatHours(ms) {
        return (ms / 3600000).toFixed(1);
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 3440.065; // Earth radius in nm
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    renderFlights() {
        this.logList.replaceChildren();

        if (this.flights.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-log';
            empty.textContent = 'No flights logged yet';
            this.logList.appendChild(empty);
            return;
        }

        this.flights.slice(0, 10).forEach(flight => {
            const item = document.createElement('div');
            item.className = 'log-item';

            const route = document.createElement('div');
            route.className = 'log-route';

            const airports = document.createElement('div');
            airports.className = 'log-airports';
            airports.textContent = flight.departure + ' → ' + flight.arrival;

            const date = document.createElement('div');
            date.className = 'log-date';
            date.textContent = new Date(flight.date).toLocaleDateString();

            route.appendChild(airports);
            route.appendChild(date);

            const details = document.createElement('div');
            details.className = 'log-details';

            const duration = document.createElement('div');
            duration.className = 'log-duration';
            duration.textContent = this.formatDuration(flight.duration);

            const distance = document.createElement('div');
            distance.className = 'log-distance';
            distance.textContent = flight.distance + ' nm';

            details.appendChild(duration);
            details.appendChild(distance);

            item.appendChild(route);
            item.appendChild(details);
            this.logList.appendChild(item);
        });
    }

    updateTotals() {
        const totalFlights = this.flights.length;
        const totalHours = this.flights.reduce((sum, f) => sum + f.duration, 0);
        const totalDistance = this.flights.reduce((sum, f) => sum + f.distance, 0);

        this.totalFlightsEl.textContent = totalFlights;
        this.totalHoursEl.textContent = this.formatHours(totalHours);
        this.totalDistanceEl.textContent = totalDistance.toLocaleString();
        this.totalLandingsEl.textContent = totalFlights;
    }

    exportCSV() {
        if (this.flights.length === 0) return;

        const headers = ['Date', 'Departure', 'Arrival', 'Duration (hrs)', 'Distance (nm)', 'Max Altitude (ft)'];
        const rows = this.flights.map(f => [
            new Date(f.date).toLocaleDateString(),
            f.departure,
            f.arrival,
            this.formatHours(f.duration),
            f.distance,
            f.maxAltitude
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'flight-log-' + new Date().toISOString().split('T')[0] + '.csv';
        a.click();

        URL.revokeObjectURL(url);
    }

    clearAll() {
        if (confirm('Clear all flight logs?')) {
            this.flights = [];
            this.saveFlights();
            this.renderFlights();
            this.updateTotals();
        }
    }

    saveFlights() {
        try {
            localStorage.setItem('flightlog-widget-flights', JSON.stringify(this.flights));
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'saveFlights',
                    widget: 'flightlog-widget',
                    storage: 'localStorage'
                });
            }
        }
    }

    destroy() {
        this._destroyed = true;
        this.stopTimer();
        super.destroy();
    }

    loadFlights() {
        try {
            const saved = localStorage.getItem('flightlog-widget-flights');
            if (saved) {
                this.flights = JSON.parse(saved);
                this.renderFlights();
            }
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'loadFlights',
                    widget: 'flightlog-widget',
                    storage: 'localStorage'
                });
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.flightLogWidget = new FlightLogWidget();
    window.addEventListener('beforeunload', () => window.flightLogWidget?.destroy());
});
