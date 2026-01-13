// SimWidget Panel - SimVar Integration
class SimWidgetPanel {
    constructor() {
        this.updateInterval = null;
        this.init();
    }

    init() {
        // Wait for SimVar to be available
        if (typeof SimVar === 'undefined') {
            setTimeout(() => this.init(), 500);
            return;
        }
        
        // Start update loop
        this.updateInterval = setInterval(() => this.update(), 100);
        
        // Setup button click handlers
        this.setupButtons();
        
        console.log('SimWidget Panel initialized');
    }

    update() {
        try {
            // Flight Data
            const alt = SimVar.GetSimVarValue("PLANE ALTITUDE", "feet");
            const spd = SimVar.GetSimVarValue("AIRSPEED INDICATED", "knots");
            const hdg = SimVar.GetSimVarValue("PLANE HEADING DEGREES MAGNETIC", "degrees");
            const vs = SimVar.GetSimVarValue("VERTICAL SPEED", "feet per minute");

            this.setText("acw-alt", Math.round(alt).toLocaleString() + " ft");
            this.setText("acw-spd", Math.round(spd) + " kts");
            this.setText("acw-hdg", Math.round(hdg).toString().padStart(3, '0') + "°");
            this.setText("acw-vs", Math.round(vs).toLocaleString() + " fpm");

            // Systems
            const pbrk = SimVar.GetSimVarValue("BRAKE PARKING POSITION", "bool");
            const gear = SimVar.GetSimVarValue("GEAR HANDLE POSITION", "bool");
            const flaps = SimVar.GetSimVarValue("FLAPS HANDLE INDEX", "number");

            this.setIndicator("btn-brk", pbrk);
            this.setIndicator("btn-gear", gear);
            this.setIndicator("btn-flaps", flaps > 0);

            // Lights
            const nav = SimVar.GetSimVarValue("LIGHT NAV", "bool");
            const bcn = SimVar.GetSimVarValue("LIGHT BEACON", "bool");
            const strb = SimVar.GetSimVarValue("LIGHT STROBE", "bool");
            const ldg = SimVar.GetSimVarValue("LIGHT LANDING", "bool");
            const taxi = SimVar.GetSimVarValue("LIGHT TAXI", "bool");

            this.setIndicator("btn-nav", nav);
            this.setIndicator("btn-bcn", bcn);
            this.setIndicator("btn-strb", strb);
            this.setIndicator("btn-ldg", ldg);
            this.setIndicator("btn-taxi", taxi);

            // Engine
            const eng = SimVar.GetSimVarValue("ENG COMBUSTION:1", "bool");
            const thr = SimVar.GetSimVarValue("GENERAL ENG THROTTLE LEVER POSITION:1", "percent");

            const engEl = document.getElementById("acw-eng");
            if (engEl) {
                engEl.textContent = eng ? "ON" : "OFF";
                engEl.className = "dv " + (eng ? "gn" : "rd");
            }
            this.setText("acw-thr", Math.round(thr) + "%");

            // Time
            const hrs = SimVar.GetSimVarValue("LOCAL TIME", "hours");
            const h = Math.floor(hrs);
            const m = Math.floor((hrs - h) * 60);
            this.setText("acw-time", h.toString().padStart(2, '0') + ":" + m.toString().padStart(2, '0'));

        } catch (e) {
            console.error("SimWidget update error:", e);
        }
    }

    setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    setIndicator(id, isOn) {
        const el = document.getElementById(id);
        if (el) {
            const dot = el.querySelector('.sd');
            if (dot) {
                dot.className = isOn ? 'sd on' : 'sd off';
            }
        }
    }

    setupButtons() {
        // Lights
        this.addClickHandler("btn-nav", () => SimVar.SetSimVarValue("K:TOGGLE_NAV_LIGHTS", "number", 0));
        this.addClickHandler("btn-bcn", () => SimVar.SetSimVarValue("K:TOGGLE_BEACON_LIGHTS", "number", 0));
        this.addClickHandler("btn-strb", () => SimVar.SetSimVarValue("K:STROBES_TOGGLE", "number", 0));
        this.addClickHandler("btn-ldg", () => SimVar.SetSimVarValue("K:LANDING_LIGHTS_TOGGLE", "number", 0));
        this.addClickHandler("btn-taxi", () => SimVar.SetSimVarValue("K:TOGGLE_TAXI_LIGHTS", "number", 0));

        // Systems
        this.addClickHandler("btn-brk", () => SimVar.SetSimVarValue("K:PARKING_BRAKES", "number", 0));
        this.addClickHandler("btn-gear", () => SimVar.SetSimVarValue("K:GEAR_TOGGLE", "number", 0));
        this.addClickHandler("btn-flaps", () => {
            const flaps = SimVar.GetSimVarValue("FLAPS HANDLE INDEX", "number");
            if (flaps > 0) {
                SimVar.SetSimVarValue("K:FLAPS_UP", "number", 0);
            } else {
                SimVar.SetSimVarValue("K:FLAPS_DOWN", "number", 0);
            }
        });
    }

    addClickHandler(id, callback) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("click", callback);
        }
    }
}

// Start when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    window.simWidgetPanel = new SimWidgetPanel();
});
