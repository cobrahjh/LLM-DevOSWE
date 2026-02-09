/**
 * SimBrief pane - SimGlass v2.0.0
 * Fetches and displays SimBrief OFP data
 * API: https://developers.navigraph.com/docs/simbrief/
 */

class SimBriefPane extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'simbrief-glass',
            widgetVersion: '2.0.0',
            autoConnect: false  // No WebSocket needed for SimBrief API
        });

        this.ofpData = null;
        this.pilotId = null;

        this.initElements();
        this.initEvents();
        this.loadState();
    }

    initElements() {
        this.pilotInput = document.getElementById('pilot-id');
        this.fetchBtn = document.getElementById('btn-fetch');
        this.refreshBtn = document.getElementById('btn-refresh');
        this.content = document.getElementById('ofp-content');
        this.userInput = document.getElementById('user-input');
    }

    initEvents() {
        this.fetchBtn.addEventListener('click', () => this.fetchOFP());
        this.refreshBtn.addEventListener('click', () => this.refresh());

        this.pilotInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.fetchOFP();
        });
    }

    async fetchOFP() {
        const input = this.pilotInput.value.trim();
        if (!input) {
            this.showError('Please enter a Pilot ID or Username');
            return;
        }

        this.showLoading();
        this.fetchBtn.disabled = true;
        this.refreshBtn.classList.add('spinning');

        try {
            const isNumeric = /^\d+$/.test(input);
            const param = isNumeric ? 'userid' : 'username';

            const response = await fetch(`/api/simbrief/ofp?${param}=${encodeURIComponent(input)}`);

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to fetch OFP');
            }

            const data = await response.json();

            if (data.fetch && data.fetch.status === 'Error') {
                throw new Error(data.fetch.error || 'No flight plan found');
            }

            this.ofpData = data;
            this.pilotId = input;
            this.saveState();
            this.displayOFP(data);

        } catch (error) {
            this.showError(error.message || 'Could not fetch flight plan');
        }

        this.fetchBtn.disabled = false;
        this.refreshBtn.classList.remove('spinning');
    }

    displayOFP(data) {
        const ofp = data;

        const origin = ofp.origin?.icao_code || '----';
        const dest = ofp.destination?.icao_code || '----';
        const airline = ofp.general?.icao_airline || '';
        const flightNum = ofp.general?.flight_number || '';
        const aircraft = ofp.aircraft?.icaocode || ofp.aircraft?.name || '';
        const registration = ofp.aircraft?.reg || '';

        const airTime = this.formatMinutes(ofp.times?.est_time_enroute);
        const blockTime = this.formatMinutes(ofp.times?.est_block);
        const distance = ofp.general?.route_distance || 0;
        const altitude = ofp.general?.initial_altitude || 0;

        const fuel = ofp.fuel || {};
        const fuelTrip = parseInt(fuel.enroute_burn) || 0;
        const fuelCont = parseInt(fuel.contingency) || 0;
        const fuelAlt = parseInt(fuel.alternate_burn) || 0;
        const fuelRes = parseInt(fuel.reserve) || 0;
        const fuelTaxi = parseInt(fuel.taxi) || 0;
        const fuelTotal = parseInt(fuel.plan_ramp) || 0;

        const weights = ofp.weights || {};
        const zfw = parseInt(weights.est_zfw) || 0;
        const tow = parseInt(weights.est_tow) || 0;
        const ldw = parseInt(weights.est_ldw) || 0;
        const payload = parseInt(weights.payload) || 0;

        const route = ofp.general?.route || '';

        this.content.replaceChildren();

        // Flight header
        const header = this.createFlightHeader(origin, dest, airline, flightNum, aircraft, registration);
        this.content.appendChild(header);

        // Stats grid
        const stats = this.createStatsGrid(distance, airTime, blockTime, altitude, ofp.general?.costindex, ofp.weights?.pax_count);
        this.content.appendChild(stats);

        // Fuel section
        const fuelSection = this.createFuelSection(fuelTrip, fuelCont, fuelAlt, fuelRes, fuelTaxi, fuelTotal);
        this.content.appendChild(fuelSection);

        // Weights section
        const weightsSection = this.createWeightsSection(zfw, payload, tow, ldw);
        this.content.appendChild(weightsSection);

        // Route section
        if (route) {
            const routeSection = this.createRouteSection(route);
            this.content.appendChild(routeSection);
        }

        // Actions
        const actions = this.createActions(route, ofp.files?.pdf?.link);
        this.content.appendChild(actions);

        this.userInput.style.display = 'none';
    }

    createFlightHeader(origin, dest, airline, flightNum, aircraft, registration) {
        const header = document.createElement('div');
        header.className = 'flight-header';

        const routeDisplay = document.createElement('div');
        routeDisplay.className = 'route-display';

        const originCode = document.createElement('span');
        originCode.className = 'airport-code';
        originCode.textContent = origin;

        const arrow = document.createElement('span');
        arrow.className = 'route-arrow';
        arrow.textContent = '\u2192';

        const destCode = document.createElement('span');
        destCode.className = 'airport-code';
        destCode.textContent = dest;

        routeDisplay.appendChild(originCode);
        routeDisplay.appendChild(arrow);
        routeDisplay.appendChild(destCode);

        const flightInfo = document.createElement('div');
        flightInfo.className = 'flight-info';

        const flightNumber = document.createElement('div');
        flightNumber.className = 'flight-number';
        flightNumber.textContent = (airline + flightNum) || 'PRIV';

        const aircraftType = document.createElement('div');
        aircraftType.className = 'aircraft-type';
        aircraftType.textContent = aircraft + ' ' + registration;

        flightInfo.appendChild(flightNumber);
        flightInfo.appendChild(aircraftType);

        header.appendChild(routeDisplay);
        header.appendChild(flightInfo);

        return header;
    }

    createStatsGrid(distance, airTime, blockTime, altitude, costIndex, paxCount) {
        const grid = document.createElement('div');
        grid.className = 'stats-grid';

        const statsData = [
            { label: 'Distance', value: distance, unit: 'nm' },
            { label: 'Air Time', value: airTime, unit: '' },
            { label: 'Block', value: blockTime, unit: '' },
            { label: 'Cruise FL', value: 'FL' + Math.round(altitude / 100), unit: '' },
            { label: 'Cost Index', value: costIndex || '--', unit: '' },
            { label: 'Passengers', value: paxCount || '--', unit: '' }
        ];

        statsData.forEach(stat => {
            const item = document.createElement('div');
            item.className = 'stat-item';

            const label = document.createElement('div');
            label.className = 'stat-label';
            label.textContent = stat.label;

            const value = document.createElement('div');
            value.className = 'stat-value';
            value.textContent = stat.value;

            if (stat.unit) {
                const unit = document.createElement('span');
                unit.className = 'stat-unit';
                unit.textContent = stat.unit;
                value.appendChild(unit);
            }

            item.appendChild(label);
            item.appendChild(value);
            grid.appendChild(item);
        });

        return grid;
    }

    createFuelSection(trip, cont, alt, res, taxi, total) {
        const section = document.createElement('div');
        section.className = 'fuel-section';

        const title = document.createElement('div');
        title.className = 'section-title';
        title.textContent = '\u26fd Fuel Plan (' + this.formatWeight(total) + ' total)';
        section.appendChild(title);

        const bar = document.createElement('div');
        bar.className = 'fuel-bar';

        const segments = this.calculateFuelSegments(trip, cont, alt, res, taxi, total);
        segments.forEach(s => {
            const seg = document.createElement('div');
            seg.className = 'fuel-segment fuel-' + s.type;
            seg.style.width = s.percent + '%';
            if (parseFloat(s.percent) > 10) {
                seg.textContent = this.formatWeight(s.value);
            }
            bar.appendChild(seg);
        });
        section.appendChild(bar);

        const legend = document.createElement('div');
        legend.className = 'fuel-legend';

        const legendData = [
            { type: 'trip', label: 'Trip', value: trip },
            { type: 'contingency', label: 'Cont', value: cont },
            { type: 'alternate', label: 'Alt', value: alt },
            { type: 'reserve', label: 'Res', value: res },
            { type: 'taxi', label: 'Taxi', value: taxi }
        ];

        legendData.forEach(item => {
            const legendItem = document.createElement('div');
            legendItem.className = 'fuel-legend-item';

            const color = document.createElement('span');
            color.className = 'fuel-legend-color fuel-' + item.type;

            const text = document.createTextNode(item.label + ' ' + this.formatWeight(item.value));

            legendItem.appendChild(color);
            legendItem.appendChild(text);
            legend.appendChild(legendItem);
        });

        section.appendChild(legend);
        return section;
    }

    createWeightsSection(zfw, payload, tow, ldw) {
        const section = document.createElement('div');
        section.className = 'fuel-section';

        const title = document.createElement('div');
        title.className = 'section-title';
        title.textContent = '\u2696\ufe0f Weights';
        section.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'weights-grid';

        const weightsData = [
            { label: 'ZFW', value: zfw },
            { label: 'Payload', value: payload },
            { label: 'TOW', value: tow },
            { label: 'LDW', value: ldw }
        ];

        weightsData.forEach(w => {
            const item = document.createElement('div');
            item.className = 'weight-item';

            const label = document.createElement('span');
            label.className = 'weight-label';
            label.textContent = w.label;

            const value = document.createElement('span');
            value.className = 'weight-value';
            value.textContent = this.formatWeight(w.value);

            item.appendChild(label);
            item.appendChild(value);
            grid.appendChild(item);
        });

        section.appendChild(grid);
        return section;
    }

    createRouteSection(route) {
        const section = document.createElement('div');
        section.className = 'route-section';

        const title = document.createElement('div');
        title.className = 'section-title';
        title.textContent = '\ud83d\udee3\ufe0f Route';

        const routeStr = document.createElement('div');
        routeStr.className = 'route-string';
        routeStr.textContent = route;

        section.appendChild(title);
        section.appendChild(routeStr);
        return section;
    }

    createActions(route, pdfLink) {
        const actions = document.createElement('div');
        actions.className = 'ofp-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-action';
        copyBtn.textContent = '\ud83d\udccb Copy Route';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(route);
            this.showToast('Route copied to clipboard');
        });

        const sendBtn = document.createElement('button');
        sendBtn.className = 'btn-action';
        sendBtn.textContent = '\ud83d\udce4 Send to FMS';
        sendBtn.addEventListener('click', () => this.sendToFlightPlan());

        const pdfBtn = document.createElement('button');
        pdfBtn.className = 'btn-action primary';
        pdfBtn.textContent = '\ud83d\udcc4 Full OFP';
        pdfBtn.addEventListener('click', () => {
            if (pdfLink) {
                window.open(pdfLink, '_blank');
            }
        });

        actions.appendChild(copyBtn);
        actions.appendChild(sendBtn);
        actions.appendChild(pdfBtn);
        return actions;
    }

    calculateFuelSegments(trip, cont, alt, res, taxi, total) {
        if (total === 0) return [];

        return [
            { type: 'trip', value: trip, percent: (trip / total * 100).toFixed(1) },
            { type: 'contingency', value: cont, percent: (cont / total * 100).toFixed(1) },
            { type: 'alternate', value: alt, percent: (alt / total * 100).toFixed(1) },
            { type: 'reserve', value: res, percent: (res / total * 100).toFixed(1) },
            { type: 'taxi', value: taxi, percent: (taxi / total * 100).toFixed(1) }
        ].filter(s => s.value > 0);
    }

    formatMinutes(seconds) {
        if (!seconds) return '--:--';
        const mins = Math.round(parseInt(seconds) / 60);
        const hrs = Math.floor(mins / 60);
        const m = mins % 60;
        return hrs + ':' + m.toString().padStart(2, '0');
    }

    formatWeight(lbs) {
        if (!lbs) return '0';
        const kg = Math.round(lbs * 0.453592);
        return kg.toLocaleString() + 'kg';
    }

    async sendToFlightPlan() {
        if (!this.ofpData) return;

        try {
            const waypoints = this.parseRouteToWaypoints(this.ofpData);

            // Use unified sync channel for all widgets
            const syncChannel = new SafeChannel('SimGlass-sync');
            syncChannel.postMessage({
                type: 'simbrief-plan',
                data: {
                    departure: this.ofpData.origin?.icao_code || this.ofpData.origin,
                    arrival: this.ofpData.destination?.icao_code || this.ofpData.destination,
                    waypoints: waypoints,
                    totalDistance: parseInt(this.ofpData.general?.route_distance) || 0,
                    route: this.ofpData.general?.route || '',
                    altitude: this.ofpData.general?.initial_altitude || 0,
                    source: 'simbrief'
                }
            });

            // Also broadcast route update for Map pane
            syncChannel.postMessage({
                type: 'route-update',
                data: {
                    departure: this.ofpData.origin?.icao_code,
                    arrival: this.ofpData.destination?.icao_code,
                    waypoints: waypoints,
                    totalDistance: parseInt(this.ofpData.general?.route_distance) || 0
                }
            });

            syncChannel.close();

            this.showToast('Sent to Flight Plan & Map');
        } catch (e) {
            console.error('Failed to send to FMS:', e);
        }
    }

    parseRouteToWaypoints(ofp) {
        const navlog = ofp.navlog?.fix || [];
        return navlog.map((fix) => ({
            ident: fix.ident,
            name: fix.name,
            type: fix.type,
            lat: parseFloat(fix.pos_lat),
            lng: parseFloat(fix.pos_long),
            altitude: parseInt(fix.altitude_feet) || 0,
            distanceFromPrev: parseInt(fix.distance) || 0,
            ete: parseInt(fix.time_leg) || 0
        }));
    }

    showLoading() {
        this.content.replaceChildren();
        const div = document.createElement('div');
        div.className = 'placeholder';

        const icon = document.createElement('div');
        icon.className = 'placeholder-icon';
        icon.textContent = '\u23f3';

        const text = document.createElement('div');
        text.className = 'placeholder-text';
        text.textContent = 'Fetching flight plan...';

        div.appendChild(icon);
        div.appendChild(text);
        this.content.appendChild(div);
    }

    showError(message) {
        this.content.replaceChildren();
        const div = document.createElement('div');
        div.className = 'error-message';

        const icon = document.createElement('div');
        icon.className = 'error-icon';
        icon.textContent = '\u26a0\ufe0f';

        const text = document.createElement('div');
        text.textContent = message;

        div.appendChild(icon);
        div.appendChild(text);
        this.content.appendChild(div);

        this.userInput.style.display = 'flex';
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = 'var(--glass-accent, #667eea)';
        toast.style.color = 'white';
        toast.style.padding = '10px 20px';
        toast.style.borderRadius = '6px';
        toast.style.fontSize = '13px';
        toast.style.zIndex = '1000';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }

    refresh() {
        if (this.pilotId) {
            this.pilotInput.value = this.pilotId;
            this.fetchOFP();
        }
    }

    saveState() {
        try {
            localStorage.setItem('simbrief-glass-state', JSON.stringify({
                pilotId: this.pilotId
            }));
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'saveState',
                    glass: 'simbrief-glass',
                    storage: 'localStorage'
                });
            }
        }
    }

    loadState() {
        try {
            const saved = localStorage.getItem('simbrief-glass-state');
            if (saved) {
                const state = JSON.parse(saved);
                if (state.pilotId) {
                    this.pilotId = state.pilotId;
                    this.pilotInput.value = state.pilotId;
                }
            }
        } catch (e) {
            if (window.telemetry) {
                telemetry.captureError(e, {
                    operation: 'loadState',
                    glass: 'simbrief-glass',
                    storage: 'localStorage'
                });
            }
        }
    }

    destroy() {
        super.destroy();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.SimBriefPane = new SimBriefPane();
    window.addEventListener('beforeunload', () => window.SimBriefPane?.destroy());
});
