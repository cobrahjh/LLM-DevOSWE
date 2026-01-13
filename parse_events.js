// Parse control_events.json to extract event order
const fs = require('fs');
const json = JSON.parse(fs.readFileSync('C:/Users/hjhar/AppData/Local/Packages/Microsoft.Limitless_8wekyb3d8bbwe/LocalCache/Packages/Community/p42-util-chaseplane/HTML_UI/InGamePanels/P42ChasePlane/configs/control_events.json', 'utf8'));

let i = 0;
json.forEach(cat => {
    console.log(`\n=== ${cat.category} ===`);
    cat.events.forEach(ev => {
        console.log(`${String(i).padStart(2, '0')}: ${ev.event_id} - ${ev.title}`);
        i++;
        if (ev.directionals) {
            ev.directionals.forEach(d => {
                console.log(`${String(i).padStart(2, '0')}: ${d.event_id} - ${d.title}`);
                i++;
            });
        }
    });
});
console.log(`\nTotal events: ${i}`);
