// Dump all InputEvent names from server log to find rudder/steering events
const http = require('http');

// Hit the server API to get current input event list
http.get('http://127.0.0.1:8080/api/status', res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        // The input events are stored in global on the server
        // Let's query the server's inputEventHashes
        console.log('Current stored hashes:');
        try {
            const status = JSON.parse(d);
            console.log('SimConnect connected:', status.simConnect?.connected);
        } catch(e) {}

        // Also request a fresh enumeration by hitting a custom endpoint
        // or just read what we have
        console.log('\nChecking global.inputEventHashes via eval...');
    });
}).on('error', e => console.log('Error:', e.message));
