/**
 * TinyWidget: Strobe Lights Toggle
 */
export default {
    id: "lights-strobe-toggle",
    name: "STRB",
    category: "lights",
    icon: "⚡",
    color: "#fbbf24",
    description: "Toggle strobe lights",
    simvar: "LIGHT STROBE",
    event: "STROBES_TOGGLE",
    display: "led",
    
    action(api, state) {
        api.send("STROBES_TOGGLE");
        return { active: !state.active };
    },
    
    update(flightData) {
        return { active: flightData.strobeLight };
    }
};
