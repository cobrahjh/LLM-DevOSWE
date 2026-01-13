/**
 * TinyWidget: Cockpit View
 */
export default {
    id: "camera-cockpit-view",
    name: "CPT",
    category: "camera",
    icon: "🎯",
    color: "#8b5cf6",
    description: "Switch to cockpit view",
    event: "VIEW_COCKPIT_FORWARD",
    display: "button",
    
    action(api) {
        api.send("VIEW_COCKPIT_FORWARD");
        return { flash: true };
    }
};
