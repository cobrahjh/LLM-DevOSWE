/**
 * Speed Mini Widget
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
                    const spd = Math.round(msg.data.speed || msg.data.airspeed || 0);
                    valueEl.textContent = spd;
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
        let spd = 280;
        valueEl.textContent = spd;

        setInterval(() => {
            if (mockMode) {
                spd = 280 + Math.sin(Date.now() / 4000) * 20;
                valueEl.textContent = Math.round(spd);
            }
        }, 100);
    }

    connect();
    startMockUpdate();
})();
