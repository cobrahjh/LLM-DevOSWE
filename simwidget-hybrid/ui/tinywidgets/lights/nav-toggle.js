/**
 * TinyWidget: NAV Lights Toggle
 * Category: Lights
 */
export default {
    id: "lights-nav-toggle",
    name: "NAV",
    category: "lights",
    icon: "💡",
    color: "#4ade80",
    description: "Toggle navigation lights",
    simvar: "LIGHT NAV",
    event: "TOGGLE_NAV_LIGHTS",
    display: "led",
    
    action(api, state) {
        api.send("TOGGLE_NAV_LIGHTS");
        return { active: !state.active };
    },
    
    update(flightData) {
        return { active: flightData.lightNav };
    }
};
