const http = require('http');

function sendCmd(command, value) {
  return new Promise(resolve => {
    const data = JSON.stringify({command, value});
    const req = http.request({
      hostname: '192.168.1.42', port: 8080, path: '/api/command',
      method: 'POST', headers: {'Content-Type': 'application/json'}
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.write(data);
    req.end();
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
  // Send full throttle via InputEvent
  console.log('Sending THROTTLE_SET 100...');
  await sendCmd('THROTTLE_SET', 100);

  // Monitor GS every second for 10 seconds
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const status = await getStatus();
    const fd = status.flightData || {};
    console.log(`[${i+1}s] GS: ${fd.groundSpeed?.toFixed(2)} | throttle: ${fd.throttle} | lat: ${fd.latitude?.toFixed(6)} | heading: ${fd.heading?.toFixed(1)}`);
  }

  // Release throttle
  console.log('Releasing throttle...');
  await sendCmd('THROTTLE_SET', 0);
}

main().catch(console.error);
