/**
 * Altitude Mini Widget
 * SimWidget Engine v1.0.0
 */

(function() {
    const valueEl = document.getElementById('value');
    const connEl = document.getElementById('conn');
    let ws = null;

    function connect() {
        const host = window.location.hostname || 'localhost';
        ws = new WebSocket(`ws://${host}:8080`);

        ws.onopen = () => {
            connEl.classList.add('connected');
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
            setTimeout(connect, 3000);
        };
    }

    connect();
})();
