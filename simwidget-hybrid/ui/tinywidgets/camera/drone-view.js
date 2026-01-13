/**
 * TinyWidget: Drone Camera View
 */
export default {
    id: "camera-drone-view",
    name: "DRN",
    category: "camera",
    icon: "🚁",
    color: "#8b5cf6",
    description: "Switch to drone camera",
    event: "VIEW_DRONE",
    display: "button",
    
    action(api) {
        api.send("VIEW_DRONE");
        return { flash: true };
    }
};
