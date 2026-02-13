const http = require('http');
http.get('http://192.168.1.42:8080/api/status', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const j = JSON.parse(d);
    const fd = j.flightData || {};
    // Find all engine/throttle/fuel/power related keys
    const keys = Object.keys(fd).filter(k => {
      const lk = k.toLowerCase();
      return lk.includes('thro') || lk.includes('rpm') || lk.includes('engin') ||
             lk.includes('fuel') || lk.includes('power') || lk.includes('prop') ||
             lk.includes('manifold') || lk.includes('oil') || lk.includes('volt');
    });
    for (const k of keys) {
      console.log(`${k}: ${fd[k]}`);
    }
    console.log('---');
    console.log('GS:', fd.groundSpeed);
    console.log('parkingBrake:', fd.parkingBrake);
  });
});
