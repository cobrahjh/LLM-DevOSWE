/**
 * Heading Mini Widget
 * SimWidget Engine v2.0.0 - Responsive Edition
 */

(function() {
    const valueEl = document.getElementById('value');
    const connEl = document.getElementById('conn');
    let ws = null;
    let mockMode = true;

    function connect() {
        const host = window.location.hostname || 'localhost';
        ws = new WebSocket(`ws://${host}:8080`);

        ws.onopen = () => {
            connEl.classList.add('connected');
            mockMode = false;
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'flightData') {
                    const hdg = Math.round(msg.data.heading || 0) % 360;
                    valueEl.textContent = String(hdg).padStart(3, '0') + '°';
                }
            } catch (e) {}
        };

        ws.onclose = () => {
            connEl.classList.remove('connected');
            mockMode = true;
            setTimeout(connect, 3000);
        };
    }

    function startMockUpdate() {
        // Mock data for testing
        let hdg = 270;
        valueEl.textContent = String(hdg).padStart(3, '0') + '°';

        setInterval(() => {
            if (mockMode) {
                hdg = (hdg + 0.2) % 360;
                valueEl.textContent = String(Math.round(hdg)).padStart(3, '0') + '°';
            }
        }, 100);
    }

    connect();
    startMockUpdate();
})();
