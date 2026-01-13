// Test different ChasePlane WebSocket message formats
const WebSocket = require('ws');

console.log('Connecting to ChasePlane WebSocket...');
const ws = new WebSocket('ws://localhost:8652');

ws.on('open', function() {
    console.log('Connected!');
    ws.send('a02e89fb-87e0-45a7-a333-324cfc016930');
    
    const testMessages = [
        // Try event formats
        'TRIGGER_EVENT::CAM_SET_CINEMATIC',
        'CTRL_EVENT::CAM_SET_CINEMATIC::1',
        'INPUT::CAM_SET_CINEMATIC::1',
        'BUTTON::1|1|164|1',  // keyboard device, button 164 (Alt)
        'BUTTON_PRESS::CAM_SET_CINEMATIC',
        // Try simulating vJoy button (device 6, button 0)
        'CTRL_INPUT::6|0|1',
        'DEVICE_INPUT::83a01980-5f2d-11f0-8002-444553540000|0|1',
        // Try direct command
        'CMD::CAM_SET_CINEMATIC',
        'EXECUTE::CAM_SET_CINEMATIC'
    ];
    
    let i = 0;
    const interval = setInterval(function() {
        if (i >= testMessages.length) {
            clearInterval(interval);
            console.log('\nAll tests complete');
            setTimeout(() => process.exit(0), 1000);
            return;
        }
        console.log('Sending:', testMessages[i]);
        ws.send(testMessages[i]);
        i++;
    }, 1500);
});

ws.on('message', function(data) {
    const msg = data.toString();
    // Filter out ping messages for clarity
    if (!msg.includes('PING') && !msg.includes('CLOUD_SYNC')) {
        console.log('  <- Received:', msg.substring(0, 100) + (msg.length > 100 ? '...' : ''));
    }
});

ws.on('error', function(err) {
    console.error('Error:', err.message);
});
