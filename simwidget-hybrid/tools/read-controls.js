// Read control surface positions from MSFS to map joystick inputs
// Run this while moving your controls — it'll show elevator/aileron/rudder values
const http = require('http');

function poll() {
    http.get('http://192.168.1.42:8080/api/status', res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
            try {
                const s = JSON.parse(d);
                const fd = s.flightData || s;
                // Surface positions (where the surfaces actually are)
                const ep = fd.elevatorPos !== undefined ? fd.elevatorPos.toFixed(0) : '?';
                const ap = fd.aileronPos !== undefined ? fd.aileronPos.toFixed(0) : '?';
                const rp = fd.rudderPos !== undefined ? fd.rudderPos.toFixed(0) : '?';
                // Yoke/pedal inputs (what the pilot is commanding)
                const yy = fd.yokeY !== undefined ? fd.yokeY.toFixed(0) : '?';
                const yx = fd.yokeX !== undefined ? fd.yokeX.toFixed(0) : '?';
                const rpd = fd.rudderPedal !== undefined ? fd.rudderPedal.toFixed(0) : '?';
                console.log(
                    `SURFACES: elev=${ep} ail=${ap} rud=${rp}  |  ` +
                    `INPUTS: yokeY=${yy} yokeX=${yx} pedal=${rpd}  |  ` +
                    `pitch=${(fd.pitch||0).toFixed(1)}° bank=${(fd.bank||0).toFixed(1)}°`
                );
            } catch (e) {
                console.log('Parse error');
            }
        });
    }).on('error', () => console.log('API error'));
}

console.log('Reading control positions every 500ms. Move your yoke/pedals!');
console.log('SURFACES = actual surface deflection  |  INPUTS = joystick/pedal position');
console.log('Values in "Position" units (-16383 to +16383)\n');
setInterval(poll, 500);

// Auto-stop after 60 seconds
setTimeout(() => { console.log('\nDone.'); process.exit(0); }, 60000);
