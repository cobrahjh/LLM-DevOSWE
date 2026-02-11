// Set MSFS 2024 mixture via InputEvent API
const { open, Protocol } = require('node-simconnect');

const targetValue = process.argv[2] !== undefined ? parseFloat(process.argv[2]) : 100;  // 0-100 percent

open('SimGlass Mixture', Protocol.KittyHawk)
    .then(({ recvOpen, handle }) => {
        console.log('Connected to:', recvOpen.applicationName);

        handle.on('inputEventsList', recv => {
            const mixtureEvent = recv.inputEventDescriptors.find(e =>
                e.name === 'FUEL_MIXTURE_1'
            );

            if (!mixtureEvent) {
                console.log('FUEL_MIXTURE_1 not found!');
                process.exit(1);
            }

            const hash = mixtureEvent.inputEventIdHash;
            console.log(`Found FUEL_MIXTURE_1 [hash: ${hash}]`);

            // Get params info first
            handle.enumerateInputEventParams(hash);

            // Try BOTH ranges — 0-1 and 0-100
            const normalized = targetValue / 100;
            console.log(`Setting mixture to ${targetValue}% (normalized: ${normalized}, raw: ${targetValue})`);
            console.log('Trying normalized (0-1)...');
            handle.setInputEvent(hash, normalized);
            setTimeout(() => {
                console.log('Trying raw (0-100)...');
                handle.setInputEvent(hash, targetValue);
            }, 1000);

            setTimeout(() => {
                console.log('Done.');
                process.exit(0);
            }, 2000);
        });

        handle.on('enumerateInputEventParams', recv => {
            console.log('Input event params:', recv.value);
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

setTimeout(() => { console.log('Timeout'); process.exit(1); }, 10000);
