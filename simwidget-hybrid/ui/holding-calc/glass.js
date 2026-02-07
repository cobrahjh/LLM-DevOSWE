/**
 * Holding Pattern Calculator - SimGlass v2.0.0
 * Entry type, timing, wind correction
 */

class HoldingCalculator extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'holding-calc',
            widgetVersion: '2.0.0',
            autoConnect: false  // No WebSocket needed for calculator
        });

        this.canvas = document.getElementById('holding-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.synth = window.speechSynthesis;

        this.initElements();
        this.initEvents();
        this.calculate();
    }

    initElements() {
        this.inboundCourseInput = document.getElementById('inbound-course');
        this.turnDirectionSelect = document.getElementById('turn-direction');
        this.currentHeadingInput = document.getElementById('current-heading');
        this.groundSpeedInput = document.getElementById('ground-speed');
        this.windDirectionInput = document.getElementById('wind-direction');
        this.windSpeedInput = document.getElementById('wind-speed');
        this.speakBtn = document.getElementById('btn-speak');
    }

    initEvents() {
        [this.inboundCourseInput, this.turnDirectionSelect, this.currentHeadingInput,
         this.groundSpeedInput, this.windDirectionInput, this.windSpeedInput].forEach(el => {
            el.addEventListener('input', () => this.calculate());
        });

        this.speakBtn.addEventListener('click', () => this.speakEntry());
    }

    calculate() {
        const inboundCourse = parseInt(this.inboundCourseInput.value) || 360;
        const turnRight = this.turnDirectionSelect.value === 'right';
        const currentHeading = parseInt(this.currentHeadingInput.value) || 180;
        const groundSpeed = parseInt(this.groundSpeedInput.value) || 120;
        const windDir = parseInt(this.windDirectionInput.value) || 0;
        const windSpeed = parseInt(this.windSpeedInput.value) || 0;

        // Calculate outbound course
        const outboundCourse = (inboundCourse + 180) % 360 || 360;

        // Calculate relative bearing to fix
        let relativeBearing = (inboundCourse - currentHeading + 360) % 360;

        // Determine entry type based on relative bearing
        // For right turns: Direct 0-110, Teardrop 110-250, Parallel 250-360
        // For left turns: mirror image
        let entryType, entryClass;

        if (turnRight) {
            if (relativeBearing >= 0 && relativeBearing <= 110) {
                entryType = 'DIRECT';
                entryClass = 'direct';
            } else if (relativeBearing > 110 && relativeBearing <= 250) {
                entryType = 'TEARDROP';
                entryClass = 'teardrop';
            } else {
                entryType = 'PARALLEL';
                entryClass = 'parallel';
            }
        } else {
            if (relativeBearing >= 250 || relativeBearing <= 0) {
                entryType = 'DIRECT';
                entryClass = 'direct';
            } else if (relativeBearing >= 110 && relativeBearing < 250) {
                entryType = 'PARALLEL';
                entryClass = 'parallel';
            } else {
                entryType = 'TEARDROP';
                entryClass = 'teardrop';
            }
        }

        // Calculate wind correction
        const windAngle = (windDir - inboundCourse + 360) % 360;
        const crosswindComponent = windSpeed * Math.sin(windAngle * Math.PI / 180);
        const windCorrection = Math.round(Math.asin(crosswindComponent / Math.max(groundSpeed, 1)) * 180 / Math.PI);

        // Inbound heading with wind correction
        const inboundHeading = (inboundCourse - windCorrection + 360) % 360 || 360;
        const outboundHeading = (outboundCourse + windCorrection * 3 + 360) % 360 || 360; // Triple correction outbound

        // Outbound time (1 minute standard, adjust for wind)
        const headwindComponent = windSpeed * Math.cos(windAngle * Math.PI / 180);
        let outboundTime = 60; // seconds
        if (headwindComponent > 0) {
            outboundTime = Math.round(60 + (headwindComponent / groundSpeed) * 60);
        } else {
            outboundTime = Math.round(60 - (Math.abs(headwindComponent) / groundSpeed) * 30);
        }
        outboundTime = Math.max(45, Math.min(90, outboundTime));

        // Update display
        const entryEl = document.getElementById('entry-type');
        entryEl.textContent = entryType;
        entryEl.className = 'entry-type ' + entryClass;

        document.getElementById('outbound-heading').textContent = outboundHeading + '°';
        document.getElementById('outbound-time').textContent = Math.floor(outboundTime / 60) + ':' + (outboundTime % 60).toString().padStart(2, '0');
        document.getElementById('wind-correction').textContent = (windCorrection >= 0 ? '+' : '') + windCorrection + '°';
        document.getElementById('inbound-heading').textContent = inboundHeading + '°';

        this.drawHoldingPattern(inboundCourse, outboundCourse, turnRight, currentHeading, entryType);

        this.lastCalc = {
            entryType, inboundCourse, outboundCourse, inboundHeading, outboundHeading,
            windCorrection, outboundTime, turnRight
        };
    }

    drawHoldingPattern(inbound, outbound, turnRight, currentHdg, entryType) {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w / 2;
        const cy = h / 2 + 20;

        ctx.clearRect(0, 0, w, h);

        // Draw fix
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#667eea';
        ctx.fill();

        // Calculate pattern dimensions
        const legLength = 60;
        const turnRadius = 25;
        const inboundRad = (90 - inbound) * Math.PI / 180;

        // Inbound leg start point
        const inboundStartX = cx + Math.cos(inboundRad) * legLength;
        const inboundStartY = cy - Math.sin(inboundRad) * legLength;

        // Draw inbound leg
        ctx.beginPath();
        ctx.moveTo(inboundStartX, inboundStartY);
        ctx.lineTo(cx, cy);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw outbound leg
        const outboundRad = (90 - outbound) * Math.PI / 180;
        const outboundEndX = cx + Math.cos(outboundRad) * legLength;
        const outboundEndY = cy - Math.sin(outboundRad) * legLength;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(outboundEndX, outboundEndY);
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw turns (simplified as arcs)
        const turnDir = turnRight ? 1 : -1;

        // Draw aircraft position
        const acRad = (90 - currentHdg) * Math.PI / 180;
        const acDist = 80;
        const acX = cx - Math.cos(acRad) * acDist;
        const acY = cy + Math.sin(acRad) * acDist;

        ctx.save();
        ctx.translate(acX, acY);
        ctx.rotate((currentHdg - 90) * Math.PI / 180);
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(-6, 10);
        ctx.lineTo(0, 6);
        ctx.lineTo(6, 10);
        ctx.closePath();
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.restore();

        // Draw entry arrow
        ctx.beginPath();
        ctx.moveTo(acX, acY);
        ctx.lineTo(cx, cy);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Labels
        ctx.fillStyle = '#888';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('FIX', cx, cy + 20);
        ctx.fillText(inbound + '° IN', cx + Math.cos(inboundRad) * 40, cy - Math.sin(inboundRad) * 40);

        // Turn direction indicator
        ctx.fillStyle = '#667eea';
        ctx.fillText(turnRight ? 'RIGHT TURNS' : 'LEFT TURNS', cx, 15);
    }

    speakEntry() {
        if (!this.lastCalc) return;

        const c = this.lastCalc;
        let text = `${c.entryType} entry. `;

        if (c.entryType === 'DIRECT') {
            text += `Fly direct to the fix, turn ${c.turnRight ? 'right' : 'left'} to heading ${c.outboundHeading} degrees. `;
        } else if (c.entryType === 'TEARDROP') {
            text += `At the fix, turn to heading ${c.outboundHeading} degrees for one minute, then turn ${c.turnRight ? 'right' : 'left'} to intercept inbound course. `;
        } else {
            text += `At the fix, turn to heading ${c.outboundHeading} degrees parallel to outbound, then turn back to intercept inbound. `;
        }

        text += `Inbound heading ${c.inboundHeading} degrees with ${Math.abs(c.windCorrection)} degrees wind correction.`;

        this.synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        this.synth.speak(utterance);
    }

    destroy() {
        // Call parent destroy
        super.destroy();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.holdingCalc = new HoldingCalculator();
    window.addEventListener('beforeunload', () => window.holdingCalc?.destroy());
});
