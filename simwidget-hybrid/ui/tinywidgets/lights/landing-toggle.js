/**
 * TinyWidget: Landing Lights Toggle
 */
export default {
    id: "lights-landing-toggle",
    name: "LAND",
    category: "lights",
    icon: "🔦",
    color: "#f0f0f0",
    description: "Toggle landing lights",
    simvar: "LIGHT LANDING",
    event: "LANDING_LIGHTS_TOGGLE",
    display: "led",
    
    action(api, state) {
        api.send("LANDING_LIGHTS_TOGGLE");
        return { active: !state.active };
    },
    
    update(flightData) {
        return { active: flightData.lightLanding };
    }
};
