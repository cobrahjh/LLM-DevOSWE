// Enumerate MSFS 2024 InputEvents — find mixture and other controls
const { open, Protocol } = require('node-simconnect');

open('SimGlass InputEvents', Protocol.KittyHawk)
    .then(({ recvOpen, handle }) => {
        console.log('Connected to:', recvOpen.applicationName);

        const allEvents = [];
        let paramsReceived = 0;

        handle.on('inputEventsList', recv => {
            console.log(`Received ${recv.inputEventDescriptors.length} input events`);
            recv.inputEventDescriptors.forEach(e => {
                allEvents.push({
                    name: e.name,
                    hash: e.inputEventIdHash.toString(),
                });
                // Don't enumerate params for all — just collect names
            });

            // Filter for mixture-related events
            const mixtureEvents = allEvents.filter(e =>
                e.name.toLowerCase().includes('mixture') ||
                e.name.toLowerCase().includes('mix')
            );

            console.log('\n=== MIXTURE EVENTS ===');
            if (mixtureEvents.length === 0) {
                console.log('(none found)');
            } else {
                mixtureEvents.forEach(e => console.log(`  ${e.name} [hash: ${e.hash}]`));
            }

            // Also show throttle for comparison
            const throttleEvents = allEvents.filter(e =>
                e.name.toLowerCase().includes('throttle')
            );
            console.log('\n=== THROTTLE EVENTS ===');
            throttleEvents.forEach(e => console.log(`  ${e.name} [hash: ${e.hash}]`));

            // Show engine-related
            const engineEvents = allEvents.filter(e =>
                e.name.toLowerCase().includes('engine') ||
                e.name.toLowerCase().includes('eng_')
            );
            console.log('\n=== ENGINE EVENTS ===');
            engineEvents.forEach(e => console.log(`  ${e.name} [hash: ${e.hash}]`));

            console.log(`\nTotal events: ${allEvents.length}`);

            setTimeout(() => process.exit(0), 1000);
        });

        handle.on('exception', ex => {
            console.log('Exception:', ex);
        });

        handle.enumerateInputEvents(0);
    })
    .catch(error => {
        console.log('Failed to connect:', error);
        process.exit(1);
    });

// Timeout safety
setTimeout(() => {
    console.log('Timeout - no response');
    process.exit(1);
}, 10000);
