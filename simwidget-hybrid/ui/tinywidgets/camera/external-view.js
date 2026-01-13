/**
 * TinyWidget: External View
 */
export default {
    id: "camera-external-view",
    name: "EXT",
    category: "camera",
    icon: "🛫",
    color: "#8b5cf6",
    description: "Switch to external/chase view",
    event: "VIEW_EXTERNAL",
    display: "button",
    
    action(api) {
        api.send("VIEW_EXTERNAL");
        return { flash: true };
    }
};
