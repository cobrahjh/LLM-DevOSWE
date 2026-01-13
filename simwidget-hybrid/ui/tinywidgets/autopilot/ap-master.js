/**
 * TinyWidget: AP Master Toggle
 */
export default {
    id: "autopilot-ap-master",
    name: "AP",
    category: "autopilot",
    icon: "🎯",
    color: "#3b82f6",
    description: "Toggle autopilot master",
    simvar: "AUTOPILOT MASTER",
    event: "AP_MASTER",
    display: "led",
    
    action(api, state) {
        api.send("AP_MASTER");
        return { active: !state.active };
    },
    
    update(flightData) {
        return { active: flightData.apMaster };
    }
};
