const http = require('http');

function post(path) {
  return new Promise(resolve => {
    const req = http.request({hostname:'192.168.1.42', port:8080, path, method:'POST'}, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(JSON.parse(d)));
    }); req.end();
  });
}

function getState() {
  return new Promise(resolve => {
    http.get('http://192.168.1.42:8080/api/ai-autopilot/state', res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(JSON.parse(d)));
    });
  });
}

function getStatus() {
  return new Promise(resolve => {
    http.get('http://192.168.1.42:8080/api/status', res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(JSON.parse(d)));
    });
  });
}

async function main() {
  console.log('Waiting 10s for server init...');
  await new Promise(r => setTimeout(r, 10000));

  console.log('Enabling autopilot...');
  const e = await post('/api/ai-autopilot/enable');
  console.log('Enabled:', e.success);

  await new Promise(r => setTimeout(r, 1000));

  console.log('Requesting taxi...');
  const t = await post('/api/ai-autopilot/request-taxi');
  console.log('Taxi:', t.success, t.icao, t.runway);
  if (t.route) console.log('Route:', t.route.waypointCount, 'waypoints,', t.route.distance_ft, 'ft');

  // Monitor every 3s for 60s
  for (let i = 0; i < 20; i++) {
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
    console.log(`[${(i+1)*3}s] GS:${gs}kt HDG:${hdg} THR:${thr}% RUD:${rud} LAT:${lat} | ATC:${atcPhase} WP:${wpIdx} → ${wp}`);

    if (atcPhase === 'HOLD_SHORT' || atcPhase === 'AIRBORNE') {
      console.log('=== REACHED', atcPhase, '===');
      break;
    }
  }
}

main().catch(console.error);
