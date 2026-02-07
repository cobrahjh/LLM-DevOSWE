/**
 * Flow Pro API Compatibility Layer v1.0.0
 * 
 * Provides Flow Pro compatible $api interface for SimGlass widgets.
 * Allows widgets written for Flow Pro to work with minimal changes.
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\shared-ui\flow-api.js
 * 
 * Usage:
 *   <script src="/shared-ui/flow-api.js"></script>
 *   <script>
 *     const widget = new FlowWidget(wsConnection);
 *     widget.run(() => {
 *       this.$api.variables.set("K:TOGGLE_NAV_LIGHTS", "Bool", 1);
 *     });
 *   </script>
 * 
 * Changelog:
 * v1.0.0 - Initial Flow Pro API compatibility layer
 */

class FlowAPI {
    constructor(wsConnection, flightData = {}) {
        this.ws = wsConnection;
        this.flightData = flightData;
        this.datastore = new Map();
        
        // SimVar to flightData property mapping
        this.simVarMap = {
            // Aircraft state
            'A:PLANE ALTITUDE': 'altitude',
            'A:AIRSPEED INDICATED': 'speed',
            'A:PLANE HEADING DEGREES MAGNETIC': 'heading',
            'A:VERTICAL SPEED': 'verticalSpeed',
            'A:GROUND VELOCITY': 'groundSpeed',
            
            // Gear/Flaps
            'A:GEAR HANDLE POSITION': 'gearDown',
            'A:FLAPS HANDLE INDEX': 'flapsIndex',
            'A:BRAKE PARKING POSITION': 'parkingBrake',
            
            // Lights
            'A:LIGHT NAV': 'navLight',
            'A:LIGHT BEACON': 'beaconLight',
            'A:LIGHT STROBE': 'strobeLight',
            'A:LIGHT LANDING': 'landingLight',
            'A:LIGHT TAXI': 'taxiLight',
            
            // Engine
            'A:ENG COMBUSTION:1': 'engineRunning',
            'A:GENERAL ENG THROTTLE LEVER POSITION:1': 'throttle',
            'A:GENERAL ENG PROPELLER LEVER POSITION:1': 'propeller',
            'A:GENERAL ENG MIXTURE LEVER POSITION:1': 'mixture',
            
            // Fuel
            'A:FUEL TOTAL QUANTITY': 'fuelTotal',
            'A:FUEL TOTAL CAPACITY': 'fuelCapacity',
            'A:ENG FUEL FLOW GPH:1': 'fuelFlow',
            'A:FUEL LEFT QUANTITY': 'fuelLeft',
            'A:FUEL RIGHT QUANTITY': 'fuelRight',
            
            // Autopilot
            'A:AUTOPILOT MASTER': 'apMaster',
            'A:AUTOPILOT HEADING LOCK': 'apHdgLock',
            'A:AUTOPILOT ALTITUDE LOCK': 'apAltLock',
            'A:AUTOPILOT VERTICAL HOLD': 'apVsLock',
            'A:AUTOPILOT AIRSPEED HOLD': 'apSpdLock',
            'A:AUTOPILOT HEADING LOCK DIR': 'apHdgSet',
            'A:AUTOPILOT ALTITUDE LOCK VAR': 'apAltSet',
            'A:AUTOPILOT VERTICAL HOLD VAR': 'apVsSet',
            'A:AUTOPILOT AIRSPEED HOLD VAR': 'apSpdSet',
            
            // Flight controls
            'A:AILERON POSITION': 'aileron',
            'A:ELEVATOR POSITION': 'elevator',
            'A:RUDDER POSITION': 'rudder',
            
            // Environment
            'A:AMBIENT WIND DIRECTION': 'windDirection',
            'A:AMBIENT WIND VELOCITY': 'windSpeed',
            'A:LOCAL TIME': 'localTime'
        };
        
        // K: event to SimConnect command mapping
        this.eventMap = {
            // Lights
            'K:TOGGLE_NAV_LIGHTS': 'TOGGLE_NAV_LIGHTS',
            'K:TOGGLE_BEACON_LIGHTS': 'TOGGLE_BEACON_LIGHTS',
            'K:STROBES_TOGGLE': 'STROBES_TOGGLE',
            'K:LANDING_LIGHTS_TOGGLE': 'LANDING_LIGHTS_TOGGLE',
            'K:TOGGLE_TAXI_LIGHTS': 'TOGGLE_TAXI_LIGHTS',
            'K:TOGGLE_LOGO_LIGHTS': 'TOGGLE_LOGO_LIGHTS',
            'K:TOGGLE_WING_LIGHTS': 'TOGGLE_WING_LIGHTS',
            'K:TOGGLE_CABIN_LIGHTS': 'TOGGLE_CABIN_LIGHTS',
            'K:PANEL_LIGHTS_TOGGLE': 'PANEL_LIGHTS_TOGGLE',
            
            // Controls
            'K:PARKING_BRAKES': 'PARKING_BRAKES',
            'K:GEAR_TOGGLE': 'GEAR_TOGGLE',
            'K:FLAPS_UP': 'FLAPS_UP',
            'K:FLAPS_DOWN': 'FLAPS_DOWN',
            'K:SPOILERS_TOGGLE': 'SPOILERS_TOGGLE',
            
            // Autopilot
            'K:AP_MASTER': 'AP_MASTER',
            'K:AP_HDG_HOLD': 'AP_HDG_HOLD',
            'K:AP_ALT_HOLD': 'AP_ALT_HOLD',
            'K:AP_VS_HOLD': 'AP_VS_HOLD',
            'K:AP_PANEL_SPEED_HOLD': 'AP_PANEL_SPEED_HOLD',
            'K:HEADING_BUG_SET': 'HEADING_BUG_SET',
            'K:HEADING_BUG_INC': 'HEADING_BUG_INC',
            'K:HEADING_BUG_DEC': 'HEADING_BUG_DEC',
            'K:AP_ALT_VAR_SET_ENGLISH': 'AP_ALT_VAR_SET_ENGLISH',
            'K:AP_ALT_VAR_INC': 'AP_ALT_VAR_INC',
            'K:AP_ALT_VAR_DEC': 'AP_ALT_VAR_DEC',
            'K:AP_VS_VAR_SET_ENGLISH': 'AP_VS_VAR_SET_ENGLISH',
            'K:AP_VS_VAR_INC': 'AP_VS_VAR_INC',
            'K:AP_VS_VAR_DEC': 'AP_VS_VAR_DEC',
            'K:AP_SPD_VAR_SET': 'AP_SPD_VAR_SET',
            'K:AP_SPD_VAR_INC': 'AP_SPD_VAR_INC',
            'K:AP_SPD_VAR_DEC': 'AP_SPD_VAR_DEC',
            
            // Engine
            'K:THROTTLE_SET': 'THROTTLE_SET',
            'K:PROP_PITCH_SET': 'PROP_PITCH_SET',
            'K:MIXTURE_SET': 'MIXTURE_SET',
            
            // Flight controls
            'K:AXIS_AILERONS_SET': 'AXIS_AILERONS_SET',
            'K:AXIS_ELEVATOR_SET': 'AXIS_ELEVATOR_SET',
            'K:AXIS_RUDDER_SET': 'AXIS_RUDDER_SET',
            'K:CENTER_AILER_RUDDER': 'CENTER_AILER_RUDDER',
            
            // Views
            'K:VIEW_MODE': 'VIEW_MODE',
            
            // Fuel
            'K:ADD_FUEL_QUANTITY': 'ADD_FUEL_QUANTITY'
        };
    }
    
    // Update flight data from WebSocket
    updateFlightData(data) {
        this.flightData = data;
    }
    
    // Variables API (Flow Pro compatible)
    variables = {
        /**
         * Get a SimVar value
         * @param {string} simvar - SimVar name (e.g., "A:FUEL TOTAL QUANTITY")
         * @param {string} units - Unit type (e.g., "Gallons") - currently ignored, uses internal mapping
         * @returns {*} The value or null if not found
         */
        get: (simvar, units) => {
            // Normalize simvar name
            const normalized = simvar.toUpperCase().trim();
            
            // Look up in our mapping
            const propName = this.simVarMap[normalized];
            if (propName && this.flightData.hasOwnProperty(propName)) {
                return this.flightData[propName];
            }
            
            // Try direct property access (for custom additions)
            const directProp = simvar.split(':').pop().toLowerCase().replace(/\s+/g, '');
            if (this.flightData.hasOwnProperty(directProp)) {
                return this.flightData[directProp];
            }
            
            console.warn(`[FlowAPI] Unknown SimVar: ${simvar}`);
            return null;
        },
        
        /**
         * Set a SimVar / Send K: event
         * @param {string} event - Event name (e.g., "K:TOGGLE_NAV_LIGHTS")
         * @param {string} type - Type (e.g., "Bool", "Number")
         * @param {*} value - Value to set
         */
        set: (event, type, value) => {
            const normalized = event.toUpperCase().trim();
            
            // Map to SimConnect command
            const command = this.eventMap[normalized] || normalized.replace('K:', '');
            
            // Send via WebSocket
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'command',
                    command: command,
                    value: value
                }));
                console.log(`[FlowAPI] Sent: ${command} = ${value}`);
            } else {
                console.warn(`[FlowAPI] WebSocket not connected, cannot send: ${command}`);
            }
        }
    };
    
    // Datastore API (Flow Pro compatible) - local storage for widget state
    datastore = {
        get: (key) => {
            // Try localStorage first
            const stored = localStorage.getItem(`flowapi_${key}`);
            if (stored !== null) {
                try {
                    return JSON.parse(stored);
                } catch {
                    return stored;
                }
            }
            // Fall back to in-memory
            return this._datastore?.get(key) ?? null;
        },
        
        set: (key, value) => {
            // Store in localStorage
            try {
                localStorage.setItem(`flowapi_${key}`, JSON.stringify(value));
            } catch (e) {
                console.warn(`[FlowAPI] localStorage failed, using memory: ${e.message}`);
            }
            // Also keep in memory
            if (!this._datastore) this._datastore = new Map();
            this._datastore.set(key, value);
        },
        
        remove: (key) => {
            localStorage.removeItem(`flowapi_${key}`);
            this._datastore?.delete(key);
        }
    };
}

/**
 * FlowWidget - Flow Pro compatible widget wrapper
 */
class FlowWidget {
    constructor(wsConnection, flightData = {}) {
        this.$api = new FlowAPI(wsConnection, flightData);
        this._runFn = null;
        this._infoFn = null;
    }
    
    // Update flight data
    updateData(data) {
        this.$api.updateFlightData(data);
    }
    
    // Register run function (called on widget click)
    run(fn) {
        this._runFn = fn.bind(this);
    }
    
    // Register info function (called to get display text)
    info(fn) {
        this._infoFn = fn.bind(this);
    }
    
    // Execute the run function
    execute() {
        if (this._runFn) {
            try {
                this._runFn();
            } catch (e) {
                console.error('[FlowWidget] Run error:', e);
            }
        }
    }
    
    // Get info text
    getInfo() {
        if (this._infoFn) {
            try {
                return this._infoFn();
            } catch (e) {
                console.error('[FlowWidget] Info error:', e);
                return 'Error';
            }
        }
        return '';
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FlowAPI, FlowWidget };
}
