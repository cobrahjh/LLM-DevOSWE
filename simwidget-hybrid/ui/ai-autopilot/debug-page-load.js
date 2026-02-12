/**
 * PASTE THIS INTO AI AUTOPILOT BROWSER CONSOLE
 * Debugs why widget isn't loading
 */

(function debugPageLoad() {
    console.clear();
    console.log('%c============================================================', 'color: cyan');
    console.log('%c  AI AUTOPILOT PAGE DEBUG', 'color: cyan; font-weight: bold');
    console.log('%c============================================================', 'color: cyan');
    console.log('');

    // Check basic page elements
    console.log('%c1. Page URL Check:', 'color: yellow; font-weight: bold');
    console.log('   Current URL:', window.location.href);
    const correctPage = window.location.pathname.includes('ai-autopilot');
    console.log(correctPage ? '%c   ✅ Correct page' : '%c   ❌ Wrong page!',
                correctPage ? 'color: green' : 'color: red');

    // Check if scripts loaded
    console.log('\n%c2. Script Load Check:', 'color: yellow; font-weight: bold');
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    console.log('   Total scripts:', scripts.length);

    const criticalScripts = [
        'widget-base.js',
        'rule-engine.js',
        'flight-phase.js',
        'command-queue.js',
        'pane.js'
    ];

    criticalScripts.forEach(name => {
        const found = scripts.some(s => s.src.includes(name));
        console.log(found ? `   ✅ ${name} loaded` : `   ❌ ${name} MISSING`,
                    found ? 'color: green' : 'color: red');
    });

    // Check global objects
    console.log('\n%c3. Global Objects:', 'color: yellow; font-weight: bold');
    const globals = {
        'widget': typeof widget !== 'undefined',
        'SimGlassBase': typeof SimGlassBase !== 'undefined',
        'RuleEngine': typeof RuleEngine !== 'undefined',
        'FlightPhase': typeof FlightPhase !== 'undefined',
        'CommandQueue': typeof CommandQueue !== 'undefined'
    };

    for (const [name, exists] of Object.entries(globals)) {
        console.log(exists ? `   ✅ ${name}` : `   ❌ ${name}`,
                    exists ? 'color: green' : 'color: red');
    }

    // Check for errors
    console.log('\n%c4. Console Errors:', 'color: yellow; font-weight: bold');
    console.log('   Check above for any RED error messages');
    console.log('   Common issues:');
    console.log('   - 404 errors (file not found)');
    console.log('   - Syntax errors in JavaScript files');
    console.log('   - Class/constructor errors');

    // Check DOM ready
    console.log('\n%c5. DOM State:', 'color: yellow; font-weight: bold');
    console.log('   Document ready state:', document.readyState);
    console.log('   Body exists:', !!document.body);

    // Recommendations
    console.log('\n%c============================================================', 'color: cyan');
    console.log('%c  RECOMMENDATIONS', 'color: cyan; font-weight: bold');
    console.log('%c============================================================', 'color: cyan');

    if (!correctPage) {
        console.log('%c❌ You are NOT on the AI Autopilot page!', 'color: red; font-size: 14px');
        console.log('%c   Go to: http://localhost:8080/ui/ai-autopilot/', 'color: yellow');
    } else if (!globals.widget) {
        console.log('%c⚠️  Page is correct but widget not initialized', 'color: orange; font-size: 14px');
        console.log('\n   Try these fixes:');
        console.log('%c   1. Hard refresh: Ctrl+Shift+R', 'color: yellow');
        console.log('%c   2. Check for RED errors above', 'color: yellow');
        console.log('%c   3. Wait a few seconds and run this test again', 'color: yellow');
        console.log('%c   4. Check Network tab for failed file loads', 'color: yellow');
    } else {
        console.log('%c✅ Everything looks good!', 'color: green; font-size: 14px');
        console.log('%c   You can now run the nav guidance test', 'color: green');
    }

    console.log('%c============================================================', 'color: cyan');

    return {
        correctPage,
        widgetExists: globals.widget,
        scriptsLoaded: scripts.length,
        criticalScriptsFound: criticalScripts.filter(name =>
            scripts.some(s => s.src.includes(name))
        ).length
    };
})();
