/**
 * TinyWidget: Heading Hold Toggle
 */
export default {
    id: "autopilot-hdg-hold",
    name: "HDG",
    category: "autopilot",
    icon: "🧭",
    color: "#3b82f6",
    description: "Toggle heading hold",
    simvar: "AUTOPILOT HEADING LOCK",
    event: "AP_HDG_HOLD",
    display: "led",
    
    action(api, state) {
        api.send("AP_HDG_HOLD");
        return { active: !state.active };
    },
    
    update(flightData) {
        return { active: flightData.apHdgHold };
    }
};
