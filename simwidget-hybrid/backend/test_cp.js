// Test ChasePlane WebSocket control
const WebSocket = require('ws');

console.log('Connecting to ChasePlane WebSocket on port 8652...');
const ws = new WebSocket('ws://localhost:8652');

ws.on('open', function() {
    console.log('Connected!');
    
    // Send authentication GUID
    ws.send('a02e89fb-87e0-45a7-a333-324cfc016930');
    console.log('Sent auth GUID');
    
    // Try sending cinematic event after 1 second
    setTimeout(function() {
        console.log('Sending: CAM_SET_CINEMATIC::1');
        ws.send('CAM_SET_CINEMATIC::1');
    }, 1000);
    
    setTimeout(function() {
        console.log('Sending: EVENT::CAM_SET_CINEMATIC::1');
        ws.send('EVENT::CAM_SET_CINEMATIC::1');
    }, 3000);
});

ws.on('message', function(data) {
    console.log('Received:', data.toString());
});

ws.on('error', function(err) {
    console.error('Error:', err.message);
});

ws.on('close', function() {
    console.log('Connection closed');
});

setTimeout(function() {
    console.log('Test complete, exiting...');
    process.exit(0);
}, 6000);
