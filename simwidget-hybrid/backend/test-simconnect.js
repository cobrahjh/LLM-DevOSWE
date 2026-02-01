const { open, Protocol } = require('node-simconnect');

async function testConnection() {
    try {
        console.log('Testing SimConnect connection...');
        const { recvOpen, handle } = await open('TestApp', Protocol.KittyHawk, {});
        console.log('SUCCESS! Connected to:', recvOpen.applicationName);
        handle.close();
        process.exit(0);
    } catch (err) {
        console.log('FAILED:', err.message);
        console.log('Full error:', err);
        process.exit(1);
    }
}

testConnection();
