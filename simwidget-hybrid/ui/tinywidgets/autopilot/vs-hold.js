/**
 * TinyWidget: Vertical Speed Hold Toggle
 */
export default {
    id: "autopilot-vs-hold",
    name: "VS",
    category: "autopilot",
    icon: "↕️",
    color: "#3b82f6",
    description: "Toggle vertical speed hold",
    simvar: "AUTOPILOT VERTICAL HOLD",
    event: "AP_VS_HOLD",
    display: "led",
    
    action(api, state) {
        api.send("AP_VS_HOLD");
        return { active: !state.active };
    },
    
    update(flightData) {
        return { active: flightData.apVsHold };
    }
};
