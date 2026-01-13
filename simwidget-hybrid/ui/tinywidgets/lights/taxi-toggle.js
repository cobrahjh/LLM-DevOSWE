/**
 * TinyWidget: Taxi Lights Toggle
 */
export default {
    id: "lights-taxi-toggle",
    name: "TAXI",
    category: "lights",
    icon: "🚕",
    color: "#fbbf24",
    description: "Toggle taxi lights",
    simvar: "LIGHT TAXI",
    event: "TOGGLE_TAXI_LIGHTS",
    display: "led",
    
    action(api, state) {
        api.send("TOGGLE_TAXI_LIGHTS");
        return { active: !state.active };
    },
    
    update(flightData) {
        return { active: flightData.lightTaxi };
    }
};
