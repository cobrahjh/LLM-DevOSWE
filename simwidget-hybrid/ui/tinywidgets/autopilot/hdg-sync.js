/**
 * TinyWidget: Sync Heading Bug to Current Heading
 */
export default {
    id: "autopilot-hdg-sync",
    name: "SYNC",
    category: "autopilot",
    icon: "↻",
    color: "#10b981",
    description: "Sync heading bug to current heading",
    event: "HEADING_BUG_SET",
    display: "button",
    
    action(api, state, flightData) {
        const hdg = Math.round(flightData.heading);
        api.send("HEADING_BUG_SET", hdg);
        return { value: hdg, flash: true };
    },
    
    update(flightData) {
        return { value: Math.round(flightData.apHdgSet) };
    }
};
