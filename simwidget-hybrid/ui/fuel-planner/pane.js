/**
 * Fuel Planner pane - SimGlass v2.0.0
 * Calculate trip fuel, reserves, endurance
 */

const AIRCRAFT_PROFILES = {
    c172: { name: 'Cessna 172', burn: 8.5, speed: 120, capacity: 53 },
    c208: { name: 'Cessna 208 Caravan', burn: 50, speed: 175, capacity: 335 },
    tbm930: { name: 'TBM 930', burn: 37, speed: 330, capacity: 282 },
    cj4: { name: 'Citation CJ4', burn: 165, speed: 450, capacity: 756 },
    '737': { name: 'Boeing 737-800', burn: 850, speed: 460, capacity: 6875 },
    a320: { name: 'Airbus A320', burn: 800, speed: 450, capacity: 6400 },
    custom: { name: 'Custom', burn: 10, speed: 150, capacity: 100 }
};

class FuelPlanner extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'fuel-planner',
            widgetVersion: '2.0.0',
            autoConnect: false  // Calculator only, no WebSocket
        });

        this.aircraft = 'c172';
        this.initElements();
        this.initEvents();
        this.calculate();
    }

    initElements() {
        this.aircraftSelect = document.getElementById('aircraft-select');
        this.distanceInput = document.getElementById('distance');
        this.cruiseSpeedInput = document.getElementById('cruise-speed');
        this.windSpeedInput = document.getElementById('wind-speed');
        this.windComponentSelect = document.getElementById('wind-component');
        this.fuelBurnInput = document.getElementById('fuel-burn');
        this.taxiFuelInput = document.getElementById('taxi-fuel');
        this.fuelLoadSlider = document.getElementById('fuel-load');
        this.calculateBtn = document.getElementById('btn-calculate');
        this.notepadBtn = document.getElementById('btn-to-notepad');
    }

    initEvents() {
        this.aircraftSelect.addEventListener('change', () => this.onAircraftChange());
        this.calculateBtn.addEventListener('click', () => this.calculate());
        this.notepadBtn.addEventListener('click', () => this.sendToNotepad());
        this.fuelLoadSlider.addEventListener('input', () => this.updateFuelLoad());

        // Auto-calculate on input change
        [this.distanceInput, this.cruiseSpeedInput, this.windSpeedInput,
         this.windComponentSelect, this.fuelBurnInput, this.taxiFuelInput].forEach(el => {
            el.addEventListener('change', () => this.calculate());
        });
    }

    onAircraftChange() {
        this.aircraft = this.aircraftSelect.value;
        const profile = AIRCRAFT_PROFILES[this.aircraft];

        this.fuelBurnInput.value = profile.burn;
        this.cruiseSpeedInput.value = profile.speed;
        this.fuelLoadSlider.max = profile.capacity;
        this.fuelLoadSlider.value = profile.capacity * 0.75;

        this.calculate();
    }

    calculate() {
        const distance = parseFloat(this.distanceInput.value) || 0;
        const cruiseSpeed = parseFloat(this.cruiseSpeedInput.value) || 1;
        const windSpeed = parseFloat(this.windSpeedInput.value) || 0;
        const windComponent = this.windComponentSelect.value;
        const fuelBurn = parseFloat(this.fuelBurnInput.value) || 0;
        const taxiFuel = parseFloat(this.taxiFuelInput.value) || 0;

        // Calculate ground speed
        let groundSpeed = cruiseSpeed;
        if (windComponent === 'head') groundSpeed -= windSpeed;
        if (windComponent === 'tail') groundSpeed += windSpeed;
        groundSpeed = Math.max(groundSpeed, 10);

        // Calculate times
        const flightTimeHrs = distance / groundSpeed;
        const flightTimeMins = Math.round(flightTimeHrs * 60);

        // Calculate fuel
        const tripFuel = flightTimeHrs * fuelBurn;
        const reserveFuel = (45 / 60) * fuelBurn; // 45 min reserve
        const alternateFuel = (30 / 60) * fuelBurn; // 30 min alternate
        const totalFuel = tripFuel + reserveFuel + alternateFuel + taxiFuel;

        // Calculate endurance and range with current fuel load
        const profile = AIRCRAFT_PROFILES[this.aircraft];
        const fuelLoad = parseFloat(this.fuelLoadSlider.value) || 0;
        const enduranceHrs = (fuelLoad - taxiFuel) / fuelBurn;
        const range = enduranceHrs * groundSpeed;

        // Update display
        document.getElementById('trip-fuel').textContent = tripFuel.toFixed(1) + ' gal';
        document.getElementById('reserve-fuel').textContent = reserveFuel.toFixed(1) + ' gal';
        document.getElementById('alternate-fuel').textContent = alternateFuel.toFixed(1) + ' gal';
        document.getElementById('total-fuel').textContent = totalFuel.toFixed(1) + ' gal';
        document.getElementById('flight-time').textContent = this.formatTime(flightTimeMins);
        document.getElementById('ground-speed').textContent = Math.round(groundSpeed) + ' kt';
        document.getElementById('endurance').textContent = this.formatTime(Math.round(enduranceHrs * 60));
        document.getElementById('range').textContent = Math.round(range) + ' nm';

        this.updateFuelLoad();
        this.lastCalc = { tripFuel, reserveFuel, alternateFuel, totalFuel, flightTimeMins, groundSpeed, enduranceHrs, range };
    }

    formatTime(mins) {
        const hrs = Math.floor(mins / 60);
        const m = mins % 60;
        return `${hrs}:${m.toString().padStart(2, '0')}`;
    }

    updateFuelLoad() {
        const profile = AIRCRAFT_PROFILES[this.aircraft];
        const fuelLoad = parseFloat(this.fuelLoadSlider.value) || 0;
        const totalRequired = this.lastCalc?.totalFuel || 0;

        document.getElementById('fuel-load-gal').textContent = Math.round(fuelLoad);

        const statusEl = document.getElementById('fuel-status');
        if (fuelLoad >= totalRequired * 1.1) {
            statusEl.textContent = 'OK';
            statusEl.className = 'fuel-status ok';
        } else if (fuelLoad >= totalRequired) {
            statusEl.textContent = 'MIN';
            statusEl.className = 'fuel-status low';
        } else {
            statusEl.textContent = 'LOW';
            statusEl.className = 'fuel-status critical';
        }
    }

    sendToNotepad() {
        if (!this.lastCalc) return;

        const profile = AIRCRAFT_PROFILES[this.aircraft];
        const text = `FUEL PLAN - ${profile.name}
Distance: ${this.distanceInput.value} nm
Trip Fuel: ${this.lastCalc.tripFuel.toFixed(1)} gal
Reserve: ${this.lastCalc.reserveFuel.toFixed(1)} gal
Total Required: ${this.lastCalc.totalFuel.toFixed(1)} gal
Flight Time: ${this.formatTime(this.lastCalc.flightTimeMins)}
Ground Speed: ${Math.round(this.lastCalc.groundSpeed)} kt`;

        const channel = new SafeChannel('SimGlass-sync');
        channel.postMessage({ type: 'copy-route', data: { text } });
        channel.close();
    }

    destroy() {
        // Call parent destroy
        super.destroy();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.fuelPlanner = new FuelPlanner();
    window.addEventListener('beforeunload', () => window.fuelPlanner?.destroy());
});
