/**
 * Weight & Balance glass - SimGlass v2.0.0
 * CG calculations with visual envelope display
 */

const AIRCRAFT_DATA = {
    c172: {
        name: 'Cessna 172S',
        emptyWeight: 1680,
        emptyArm: 40.5,
        maxWeight: 2550,
        fuelCapacity: 53,
        fuelArm: 48.0,
        stations: {
            front: { arm: 37.0, max: 400 },
            rear: { arm: 73.0, max: 400 },
            baggage: { arm: 95.0, max: 120 }
        },
        envelope: [
            { cg: 35.0, weight: 1500 },
            { cg: 35.0, weight: 1950 },
            { cg: 41.0, weight: 2550 },
            { cg: 47.3, weight: 2550 },
            { cg: 47.3, weight: 1500 }
        ],
        cgRange: { min: 35.0, max: 47.3 }
    },
    c208: {
        name: 'Cessna 208 Caravan',
        emptyWeight: 4570,
        emptyArm: 156.0,
        maxWeight: 8750,
        fuelCapacity: 335,
        fuelArm: 161.0,
        stations: {
            front: { arm: 143.0, max: 500 },
            rear: { arm: 180.0, max: 1200 },
            baggage: { arm: 220.0, max: 500 }
        },
        envelope: [
            { cg: 146.0, weight: 4500 },
            { cg: 146.0, weight: 7000 },
            { cg: 156.0, weight: 8750 },
            { cg: 164.0, weight: 8750 },
            { cg: 164.0, weight: 4500 }
        ],
        cgRange: { min: 146.0, max: 164.0 }
    },
    tbm930: {
        name: 'TBM 930',
        emptyWeight: 4629,
        emptyArm: 144.8,
        maxWeight: 7394,
        fuelCapacity: 282,
        fuelArm: 148.0,
        stations: {
            front: { arm: 137.0, max: 440 },
            rear: { arm: 178.0, max: 440 },
            baggage: { arm: 205.0, max: 220 }
        },
        envelope: [
            { cg: 139.0, weight: 4500 },
            { cg: 139.0, weight: 6000 },
            { cg: 143.0, weight: 7394 },
            { cg: 150.0, weight: 7394 },
            { cg: 150.0, weight: 4500 }
        ],
        cgRange: { min: 139.0, max: 150.0 }
    },
    pa28: {
        name: 'Piper PA-28 Cherokee',
        emptyWeight: 1410,
        emptyArm: 83.7,
        maxWeight: 2325,
        fuelCapacity: 50,
        fuelArm: 95.0,
        stations: {
            front: { arm: 80.5, max: 400 },
            rear: { arm: 118.1, max: 400 },
            baggage: { arm: 142.8, max: 200 }
        },
        envelope: [
            { cg: 82.0, weight: 1400 },
            { cg: 82.0, weight: 2100 },
            { cg: 87.0, weight: 2325 },
            { cg: 93.0, weight: 2325 },
            { cg: 93.0, weight: 1400 }
        ],
        cgRange: { min: 82.0, max: 93.0 }
    }
};

class WeightBalance extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'weight-balance',
            widgetVersion: '2.0.0',
            autoConnect: false  // No WebSocket needed for calculator
        });

        this.aircraft = 'c172';
        this.canvas = document.getElementById('envelope-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.initElements();
        this.initEvents();
        this.loadAircraft();
        this.calculate();
    }

    initElements() {
        this.aircraftSelect = document.getElementById('aircraft-select');
        this.emptyWeightInput = document.getElementById('empty-weight');
        this.frontWeightInput = document.getElementById('front-weight');
        this.rearWeightInput = document.getElementById('rear-weight');
        this.baggageWeightInput = document.getElementById('baggage-weight');
        this.fuelSlider = document.getElementById('fuel-weight');
        this.fuelLbsDisplay = document.getElementById('fuel-lbs');
        this.fuelGalDisplay = document.getElementById('fuel-gal');
        this.resetBtn = document.getElementById('btn-reset');
        this.notepadBtn = document.getElementById('btn-to-notepad');
    }

    initEvents() {
        this.aircraftSelect.addEventListener('change', () => {
            this.aircraft = this.aircraftSelect.value;
            this.loadAircraft();
            this.calculate();
        });

        [this.frontWeightInput, this.rearWeightInput, this.baggageWeightInput].forEach(el => {
            el.addEventListener('input', () => this.calculate());
        });

        this.fuelSlider.addEventListener('input', () => {
            const lbs = parseInt(this.fuelSlider.value);
            this.fuelLbsDisplay.textContent = lbs;
            this.fuelGalDisplay.textContent = Math.round(lbs / 6);
            this.calculate();
        });

        this.resetBtn.addEventListener('click', () => this.reset());
        this.notepadBtn.addEventListener('click', () => this.sendToNotepad());
    }

    loadAircraft() {
        const data = AIRCRAFT_DATA[this.aircraft];
        this.emptyWeightInput.value = data.emptyWeight;
        this.fuelSlider.max = data.fuelCapacity * 6;
        this.fuelSlider.value = data.fuelCapacity * 6 * 0.75;
        this.fuelLbsDisplay.textContent = Math.round(data.fuelCapacity * 6 * 0.75);
        this.fuelGalDisplay.textContent = Math.round(data.fuelCapacity * 0.75);

        document.getElementById('weight-limit').textContent = 'Max: ' + data.maxWeight;
        document.getElementById('cg-limit').textContent = data.cgRange.min.toFixed(1) + ' - ' + data.cgRange.max.toFixed(1);
    }

    calculate() {
        const data = AIRCRAFT_DATA[this.aircraft];

        const emptyWeight = data.emptyWeight;
        const emptyMoment = emptyWeight * data.emptyArm;

        const frontWeight = parseFloat(this.frontWeightInput.value) || 0;
        const frontMoment = frontWeight * data.stations.front.arm;

        const rearWeight = parseFloat(this.rearWeightInput.value) || 0;
        const rearMoment = rearWeight * data.stations.rear.arm;

        const baggageWeight = parseFloat(this.baggageWeightInput.value) || 0;
        const baggageMoment = baggageWeight * data.stations.baggage.arm;

        const fuelWeight = parseFloat(this.fuelSlider.value) || 0;
        const fuelMoment = fuelWeight * data.fuelArm;

        const grossWeight = emptyWeight + frontWeight + rearWeight + baggageWeight + fuelWeight;
        const totalMoment = emptyMoment + frontMoment + rearMoment + baggageMoment + fuelMoment;
        const cg = totalMoment / grossWeight;

        // Landing CG (less fuel)
        const landingFuel = fuelWeight * 0.3;
        const landingWeight = emptyWeight + frontWeight + rearWeight + baggageWeight + landingFuel;
        const landingMoment = emptyMoment + frontMoment + rearMoment + baggageMoment + (landingFuel * data.fuelArm);
        const landingCG = landingMoment / landingWeight;

        // Update display
        document.getElementById('gross-weight').textContent = Math.round(grossWeight) + ' lbs';
        document.getElementById('cg-position').textContent = cg.toFixed(1) + ' in';

        // Check status
        const withinWeight = grossWeight <= data.maxWeight;
        const withinCG = cg >= data.cgRange.min && cg <= data.cgRange.max;
        const statusEl = document.getElementById('status');

        if (withinWeight && withinCG) {
            statusEl.textContent = 'OK';
            statusEl.className = 'result-value status-indicator ok';
        } else if (!withinWeight) {
            statusEl.textContent = 'OVERWEIGHT';
            statusEl.className = 'result-value status-indicator danger';
        } else {
            statusEl.textContent = 'CG OUT';
            statusEl.className = 'result-value status-indicator warning';
        }

        this.drawEnvelope(data, grossWeight, cg, landingWeight, landingCG);
        this.lastCalc = { grossWeight, cg, landingWeight, landingCG, withinWeight, withinCG };
    }

    drawEnvelope(data, toWeight, toCG, ldgWeight, ldgCG) {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const padding = 30;

        ctx.clearRect(0, 0, w, h);

        // Calculate scale
        const envelope = data.envelope;
        const minCG = Math.min(...envelope.map(p => p.cg)) - 2;
        const maxCG = Math.max(...envelope.map(p => p.cg)) + 2;
        const minW = Math.min(...envelope.map(p => p.weight)) - 200;
        const maxW = Math.max(...envelope.map(p => p.weight)) + 200;

        const scaleX = (w - padding * 2) / (maxCG - minCG);
        const scaleY = (h - padding * 2) / (maxW - minW);

        const toCanvasX = (cg) => padding + (cg - minCG) * scaleX;
        const toCanvasY = (wt) => h - padding - (wt - minW) * scaleY;

        // Draw envelope
        ctx.beginPath();
        ctx.moveTo(toCanvasX(envelope[0].cg), toCanvasY(envelope[0].weight));
        for (let i = 1; i < envelope.length; i++) {
            ctx.lineTo(toCanvasX(envelope[i].cg), toCanvasY(envelope[i].weight));
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
        ctx.fill();
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw grid
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        for (let cg = Math.ceil(minCG); cg <= maxCG; cg += 5) {
            ctx.beginPath();
            ctx.moveTo(toCanvasX(cg), padding);
            ctx.lineTo(toCanvasX(cg), h - padding);
            ctx.stroke();
        }

        // Draw axes labels
        ctx.fillStyle = '#888';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CG (inches)', w / 2, h - 5);

        // Draw takeoff point
        ctx.beginPath();
        ctx.arc(toCanvasX(toCG), toCanvasY(toWeight), 6, 0, Math.PI * 2);
        ctx.fillStyle = '#667eea';
        ctx.fill();

        // Draw landing point
        ctx.beginPath();
        ctx.arc(toCanvasX(ldgCG), toCanvasY(ldgWeight), 5, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e';
        ctx.fill();

        // Draw line between them
        ctx.beginPath();
        ctx.moveTo(toCanvasX(toCG), toCanvasY(toWeight));
        ctx.lineTo(toCanvasX(ldgCG), toCanvasY(ldgWeight));
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    reset() {
        this.frontWeightInput.value = 340;
        this.rearWeightInput.value = 0;
        this.baggageWeightInput.value = 20;
        this.loadAircraft();
        this.calculate();
    }

    sendToNotepad() {
        if (!this.lastCalc) return;
        const data = AIRCRAFT_DATA[this.aircraft];

        const text = `WEIGHT & BALANCE - ${data.name}
Gross Weight: ${Math.round(this.lastCalc.grossWeight)} lbs (Max: ${data.maxWeight})
CG Position: ${this.lastCalc.cg.toFixed(1)} in (${data.cgRange.min}-${data.cgRange.max})
Status: ${this.lastCalc.withinWeight && this.lastCalc.withinCG ? 'WITHIN LIMITS' : 'CHECK LIMITS'}`;

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
    window.weightBalance = new WeightBalance();
    window.addEventListener('beforeunload', () => window.weightBalance?.destroy());
});
