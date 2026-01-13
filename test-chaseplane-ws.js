// Test ChasePlane WebSocket API
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8652');

ws.on('open', () => {
    console.log('Connected to ChasePlane!');
    // Send auth GUID (found in their code)
    ws.send('a02e89fb-87e0-45a7-a333-324cfc016930');
    
    // Try sending a camera event
    setTimeout(() => {
        // Try drone view
        console.log('Sending CAM_SET_DRONE event...');
        ws.send('EVENT::CAM_SET_DRONE');
    }, 500);
    
    setTimeout(() => {
        console.log('Sending CAM_SET_CINEMATIC event...');
        ws.send('EVENT::CAM_SET_CINEMATIC');
    }, 2000);
});

ws.on('message', (data) => {
    console.log('Received:', data.toString());
});

ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
});

ws.on('close', () => {
    console.log('Connection closed');
});

// Keep alive for 5 seconds
setTimeout(() => {
    ws.close();
    process.exit(0);
}, 5000);
