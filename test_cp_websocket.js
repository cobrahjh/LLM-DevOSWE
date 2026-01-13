// Test ChasePlane WebSocket control
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8652');

ws.on('open', () => {
    console.log('Connected to ChasePlane WebSocket');
    
    // Send authentication GUID first
    ws.send('a02e89fb-87e0-45a7-a333-324cfc016930');
    console.log('Sent auth GUID');
    
    // Wait a moment then try sending event
    setTimeout(() => {
        // Try different message formats
        const formats = [
            'CAM_SET_CINEMATIC::1',
            'EVENT::CAM_SET_CINEMATIC::1',
            'CAM_SET_CINEMATIC',
            '{"event":"CAM_SET_CINEMATIC","value":1}'
        ];
        
        formats.forEach((msg, i) => {
            setTimeout(() => {
                console.log(`Trying: ${msg}`);
                ws.send(msg);
            }, i * 2000);
        });
        
        // Close after tests
        setTimeout(() => {
            console.log('Tests complete');
            ws.close();
        }, 10000);
    }, 1000);
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
