/**
 * Altitude Mini Widget
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
                    const alt = Math.round(msg.data.altitude || 0);
                    valueEl.textContent = alt.toLocaleString();
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
        let alt = 35000;
        valueEl.textContent = alt.toLocaleString();

        setInterval(() => {
            if (mockMode) {
                alt += Math.sin(Date.now() / 5000) * 10;
                valueEl.textContent = Math.round(alt).toLocaleString();
            }
        }, 100);
    }

    connect();
    startMockUpdate();
})();
