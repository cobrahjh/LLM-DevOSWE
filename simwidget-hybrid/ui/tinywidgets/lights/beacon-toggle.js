/**
 * TinyWidget: Beacon Lights Toggle
 */
export default {
    id: "lights-beacon-toggle",
    name: "BCN",
    category: "lights",
    icon: "🔴",
    color: "#ef4444",
    description: "Toggle beacon lights",
    simvar: "LIGHT BEACON",
    event: "TOGGLE_BEACON_LIGHTS",
    display: "led",
    
    action(api, state) {
        api.send("TOGGLE_BEACON_LIGHTS");
        return { active: !state.active };
    },
    
    update(flightData) {
        return { active: flightData.beaconLight };
    }
};
