const http = require('http');

function getState() {
  return new Promise(resolve => {
    http.get('http://192.168.1.42:8080/api/ai-autopilot/state', res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
  });
}

function getStatus() {
  return new Promise(resolve => {
    http.get('http://192.168.1.42:8080/api/status', res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
  });
}

async function main() {
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const [state, status] = await Promise.all([getState(), getStatus()]);
    const fd = status.flightData || {};
    const atc = state.atc || {};
    const nxt = atc.nextWaypoint;
    const gs = fd.groundSpeed?.toFixed(1) || '?';
    const hdg = fd.heading?.toFixed(0) || '?';
    const thr = state.live?.throttle || '?';
    const rud = state.live?.rudder?.toFixed(0) || 0;
    const wp = nxt ? `${nxt.name} brg:${nxt.bearing?.toFixed(0)}` : 'none';
    const atcPhase = atc.phase || '?';
    const wpIdx = atc.route?.currentWaypoint || '?';
    const lat = fd.latitude?.toFixed(5) || '?';
    const lon = fd.longitude?.toFixed(5) || '?';
    console.log(`[${(i+1)*3}s] GS:${gs}kt HDG:${hdg} THR:${thr}% RUD:${rud} ${lat},${lon} | ${atcPhase} WP:${wpIdx}/6 → ${wp}`);

    if (atcPhase === 'HOLD_SHORT' || atcPhase === 'AIRBORNE' || atcPhase === 'INACTIVE') {
      console.log('=== REACHED', atcPhase, '===');
      break;
    }
  }
}

main().catch(console.error);
