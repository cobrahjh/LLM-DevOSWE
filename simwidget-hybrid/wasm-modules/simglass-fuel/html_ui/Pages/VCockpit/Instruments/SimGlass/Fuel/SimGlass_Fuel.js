/**
 * SimGlass Fuel Data Provider v1.0.0
 *
 * MSFS HTML Gauge that reads fuel data and broadcasts to external widgets
 * Uses localStorage and BroadcastChannel for communication
 */

class SimGlass_Fuel extends BaseInstrument {
    constructor() {
        super();
        this.updateInterval = 500; // Update every 500ms
        this.lastUpdate = 0;
    }

    get templateID() {
        return "TEMPLATE_SIMGLASS_FUEL";
    }

    connectedCallback() {
        super.connectedCallback();
        console.log('[SimGlass Fuel] Provider initialized');

        // Initialize storage
        this.initializeStorage();
    }

    initializeStorage() {
        const initialData = {
            connected: true,
            timestamp: Date.now(),
            fuelTotal: 0,
            fuelCapacity: 0,
            fuelFlow: 0,
            fuelTankLeftMain: 0,
            fuelTankRightMain: 0,
            fuelTankLeftAux: 0,
            fuelTankRightAux: 0,
            fuelTankCenter: 0,
            fuelTankCenter2: 0,
            fuelTankCenter3: 0,
            fuelTankLeftTip: 0,
            fuelTankRightTip: 0,
            fuelTankExternal1: 0,
            fuelTankExternal2: 0,
            fuelTankLeftMainCap: 0,
            fuelTankRightMainCap: 0,
            fuelTankLeftAuxCap: 0,
            fuelTankRightAuxCap: 0,
            fuelTankCenterCap: 0,
            fuelTankCenter2Cap: 0,
            fuelTankCenter3Cap: 0,
            fuelTankLeftTipCap: 0,
            fuelTankRightTipCap: 0,
            fuelTankExternal1Cap: 0,
            fuelTankExternal2Cap: 0
        };

        localStorage.setItem('simglass_fuel_data', JSON.stringify(initialData));
    }

    Update() {
        super.Update();

        const now = Date.now();
        if (now - this.lastUpdate < this.updateInterval) {
            return;
        }
        this.lastUpdate = now;

        try {
            const fuelData = {
                connected: true,
                timestamp: now,

                // Total fuel and capacity (gallons)
                fuelTotal: SimVar.GetSimVarValue("FUEL TOTAL QUANTITY", "gallons"),
                fuelCapacity: SimVar.GetSimVarValue("FUEL TOTAL CAPACITY", "gallons"),
                fuelFlow: SimVar.GetSimVarValue("ENG FUEL FLOW GPH:1", "gallons per hour"),

                // Individual tank levels (gallons)
                fuelTankLeftMain: SimVar.GetSimVarValue("FUEL TANK LEFT MAIN QUANTITY", "gallons"),
                fuelTankRightMain: SimVar.GetSimVarValue("FUEL TANK RIGHT MAIN QUANTITY", "gallons"),
                fuelTankLeftAux: SimVar.GetSimVarValue("FUEL TANK LEFT AUX QUANTITY", "gallons"),
                fuelTankRightAux: SimVar.GetSimVarValue("FUEL TANK RIGHT AUX QUANTITY", "gallons"),
                fuelTankCenter: SimVar.GetSimVarValue("FUEL TANK CENTER QUANTITY", "gallons"),
                fuelTankCenter2: SimVar.GetSimVarValue("FUEL TANK CENTER2 QUANTITY", "gallons"),
                fuelTankCenter3: SimVar.GetSimVarValue("FUEL TANK CENTER3 QUANTITY", "gallons"),
                fuelTankLeftTip: SimVar.GetSimVarValue("FUEL TANK LEFT TIP QUANTITY", "gallons"),
                fuelTankRightTip: SimVar.GetSimVarValue("FUEL TANK RIGHT TIP QUANTITY", "gallons"),
                fuelTankExternal1: SimVar.GetSimVarValue("FUEL TANK EXTERNAL1 QUANTITY", "gallons"),
                fuelTankExternal2: SimVar.GetSimVarValue("FUEL TANK EXTERNAL2 QUANTITY", "gallons"),

                // Tank capacities (gallons)
                fuelTankLeftMainCap: SimVar.GetSimVarValue("FUEL TANK LEFT MAIN CAPACITY", "gallons"),
                fuelTankRightMainCap: SimVar.GetSimVarValue("FUEL TANK RIGHT MAIN CAPACITY", "gallons"),
                fuelTankLeftAuxCap: SimVar.GetSimVarValue("FUEL TANK LEFT AUX CAPACITY", "gallons"),
                fuelTankRightAuxCap: SimVar.GetSimVarValue("FUEL TANK RIGHT AUX CAPACITY", "gallons"),
                fuelTankCenterCap: SimVar.GetSimVarValue("FUEL TANK CENTER CAPACITY", "gallons"),
                fuelTankCenter2Cap: SimVar.GetSimVarValue("FUEL TANK CENTER2 CAPACITY", "gallons"),
                fuelTankCenter3Cap: SimVar.GetSimVarValue("FUEL TANK CENTER3 CAPACITY", "gallons"),
                fuelTankLeftTipCap: SimVar.GetSimVarValue("FUEL TANK LEFT TIP CAPACITY", "gallons"),
                fuelTankRightTipCap: SimVar.GetSimVarValue("FUEL TANK RIGHT TIP CAPACITY", "gallons"),
                fuelTankExternal1Cap: SimVar.GetSimVarValue("FUEL TANK EXTERNAL1 CAPACITY", "gallons"),
                fuelTankExternal2Cap: SimVar.GetSimVarValue("FUEL TANK EXTERNAL2 CAPACITY", "gallons")
            };

            // Store in localStorage for widgets to access
            localStorage.setItem('simglass_fuel_data', JSON.stringify(fuelData));

            // Log occasionally for debugging
            if (now % 10000 < this.updateInterval) {
                console.log('[SimGlass Fuel] Data updated:', {
                    total: fuelData.fuelTotal.toFixed(1),
                    capacity: fuelData.fuelCapacity.toFixed(1),
                    flow: fuelData.fuelFlow.toFixed(1)
                });
            }
        } catch (error) {
            console.error('[SimGlass Fuel] Update error:', error);
        }
    }

    onInteractionEvent(_args) {
        // No interaction needed
    }
}

registerInstrument("simglass-fuel", SimGlass_Fuel);
