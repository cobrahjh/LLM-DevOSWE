/**
 * PASTE THIS INTO GTN750 BROWSER CONSOLE
 * Checks if GTN750 is broadcasting nav-state
 */

(function checkGTN750Broadcast() {
    console.clear();
    console.log('%c============================================================', 'color: cyan');
    console.log('%c  GTN750 NAV-STATE BROADCAST CHECK', 'color: cyan; font-weight: bold');
    console.log('%c============================================================', 'color: cyan');
    console.log('');

    // Check if widget exists
    if (typeof widget === 'undefined') {
        console.log('%c❌ Widget not found - are you in the GTN750 tab?', 'color: red');
        console.log('%cOpen: http://localhost:8080/ui/gtn750/', 'color: yellow');
        return;
    }

    console.log('%c✅ GTN750 widget exists', 'color: green');

    // Check if syncChannel exists
    if (!widget.syncChannel) {
        console.log('%c❌ syncChannel not initialized', 'color: red');
        return;
    }

    console.log('%c✅ SafeChannel initialized', 'color: green');

    // Listen for outgoing broadcasts
    let broadcastCount = 0;
    const originalPostMessage = widget.syncChannel.postMessage.bind(widget.syncChannel);

    widget.syncChannel.postMessage = function(msg) {
        if (msg.type === 'nav-state') {
            broadcastCount++;
            const wp = msg.data?.activeWaypoint;
            console.log(`%c[${broadcastCount}] Broadcasting nav-state:`, 'color: green',
                        wp?.ident || 'NO WAYPOINT',
                        wp?.distNm?.toFixed(1) + 'nm' || 'N/A');
        }
        return originalPostMessage(msg);
    };

    console.log('\n%c📡 Listening for broadcasts... (wait 5 seconds)', 'color: cyan');

    setTimeout(() => {
        console.log('\n%c============================================================', 'color: cyan');
        console.log(`%c  Total broadcasts in 5s: ${broadcastCount}`, 'color: cyan; font-weight: bold');
        console.log('%c============================================================', 'color: cyan');

        if (broadcastCount >= 3) {
            console.log('%c✅ GTN750 IS broadcasting nav-state!', 'color: green; font-size: 14px; font-weight: bold');
            console.log('%cIf AI Autopilot not receiving, check if both tabs are in same browser window', 'color: yellow');
        } else if (broadcastCount > 0) {
            console.log('%c⚠️  GTN750 broadcasting but slowly', 'color: orange');
        } else {
            console.log('%c❌ GTN750 NOT broadcasting!', 'color: red; font-size: 14px; font-weight: bold');
            console.log('%cCheck if flight plan is loaded in MSFS GPS', 'color: yellow');
        }
    }, 5000);

    return 'Listening... check back in 5 seconds';
})();
