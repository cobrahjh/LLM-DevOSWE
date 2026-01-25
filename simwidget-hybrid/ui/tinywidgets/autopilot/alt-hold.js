/**
 * TinyWidget: Altitude Hold Toggle
 */
export default {
    id: "autopilot-alt-hold",
    name: "ALT",
    category: "autopilot",
    icon: "⬆️",
    color: "#3b82f6",
    description: "Toggle altitude hold",
    simvar: "AUTOPILOT ALTITUDE LOCK",
    event: "AP_ALT_HOLD",
    display: "led",
    
    action(api, state) {
        api.send("AP_ALT_HOLD");
        return { active: !state.active };
    },
    
    update(flightData) {
        return { active: flightData.apAltLock };
    }
};
