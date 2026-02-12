/**
 * PASTE THIS INTO AI AUTOPILOT BROWSER CONSOLE
 * Tests nav guidance integration in real-time
 */

(async function testNavGuidance() {
    console.clear();
    console.log('%c============================================================', 'color: cyan');
    console.log('%c  AI AUTOPILOT NAV GUIDANCE - LIVE TEST', 'color: cyan; font-weight: bold');
    console.log('%c============================================================', 'color: cyan');
    console.log('');

    const results = {
        pass: [],
        fail: [],
        warn: []
    };

    function test(name, condition, actual) {
        if (condition) {
            results.pass.push(name);
            console.log(`%c✅ ${name}`, 'color: green', actual || '');
        } else {
            results.fail.push(name);
            console.log(`%c❌ ${name}`, 'color: red', actual || '');
        }
    }

    function warn(name, actual) {
        results.warn.push(name);
        console.log(`%c⚠️  ${name}`, 'color: orange', actual || '');
    }

    // Test 1: Widget exists
    test('Widget object exists', typeof widget !== 'undefined');

    if (typeof widget === 'undefined') {
        console.log('%c\nCannot run tests - widget not loaded', 'color: red');
        return;
    }

    // Test 2: Rule engine exists
    test('Rule engine exists', widget.ruleEngine !== undefined);

    // Test 3: getNavGuidance method exists
    test('getNavGuidance() method exists', typeof widget.ruleEngine.getNavGuidance === 'function');

    // Test 4: Get nav guidance data
    console.log('\n%c📊 Nav Guidance Data:', 'color: cyan; font-weight: bold');
    const ng = widget.ruleEngine.getNavGuidance();

    if (!ng) {
        warn('No nav guidance data', 'GTN750 not open or no flight plan');
        console.log('\n%c💡 To fix: Open http://localhost:8080/ui/gtn750/ in another tab', 'color: yellow');
    } else {
        console.log('Raw data:', ng);
        console.log('');

        test('Waypoint ident present', ng.wpIdent !== null, `→ ${ng.wpIdent}`);
        test('Waypoint distance present', ng.wpDist !== null, `→ ${ng.wpDist?.toFixed(1)}nm`);
        test('Waypoint bearing present', ng.wpBearing !== null, `→ ${ng.wpBearing}°`);
        test('CDI source present', ng.cdiSource !== null, `→ ${ng.cdiSource}`);
        test('Cross-track present', ng.xtrk !== null, `→ ${ng.xtrk?.toFixed(2)}nm`);
        test('DTK present', ng.dtk !== null, `→ ${ng.dtk}°`);
        test('Nav mode determined', ng.navMode !== null, `→ ${ng.navMode}`);

        if (ng.interceptHdg !== null) {
            console.log(`%c✅ Intercept heading computed`, 'color: green', `→ ${ng.interceptHdg}°`);

            // Check intercept logic
            if (ng.xtrk !== null && ng.dtk !== null) {
                const expectedLeft = ng.xtrk > 0; // Right of course → turn left
                const actualLeft = ng.interceptHdg < ng.dtk;
                if (Math.abs(ng.xtrk) > 0.1) {
                    test('Intercept direction correct',
                        expectedLeft === actualLeft,
                        `XTRK ${ng.xtrk.toFixed(2)}nm ${ng.xtrk > 0 ? 'RIGHT' : 'LEFT'} → turn ${actualLeft ? 'LEFT' : 'RIGHT'}`
                    );
                }
            }
        }

        if (ng.destDist !== null) {
            console.log(`%c  Destination distance: ${ng.destDist.toFixed(0)}nm`, 'color: gray');
        }
    }

    // Test 5: AI enabled
    console.log('\n%c🤖 AI Status:', 'color: cyan; font-weight: bold');
    test('AI Autopilot enabled', widget.aiEnabled === true);
    if (!widget.aiEnabled) {
        warn('AI not enabled', 'Click ON button to enable');
    }

    // Test 6: Phase
    console.log(`%c  Current phase: ${widget.flightPhase?.phase || 'UNKNOWN'}`, 'color: gray');

    // Test 7: UI elements
    console.log('\n%c🖥️  UI Elements:', 'color: cyan; font-weight: bold');
    const targetHdgEl = document.getElementById('target-hdg');
    if (targetHdgEl) {
        const text = targetHdgEl.textContent;
        const hasWaypoint = ng?.wpIdent && text.includes(ng.wpIdent);
        const hasRawHeading = text.match(/HDG \d{3}°/);

        test('Heading element exists', true, `→ "${text}"`);
        if (ng?.wpIdent) {
            test('Shows waypoint (not raw heading)', hasWaypoint && !hasRawHeading);
            if (hasRawHeading && !hasWaypoint) {
                warn('Still showing raw heading', 'Should show waypoint ident + distance');
            }
        }
    } else {
        warn('Heading target element not found', 'Check UI structure');
    }

    // Test 8: Check for console errors
    console.log('\n%c🔍 Console Check:', 'color: cyan; font-weight: bold');
    console.log('  Check for any red errors above this test output');

    // Summary
    console.log('\n%c============================================================', 'color: cyan');
    console.log('%c  SUMMARY', 'color: cyan; font-weight: bold');
    console.log('%c============================================================', 'color: cyan');
    console.log(`%c✅ PASSED: ${results.pass.length}`, 'color: green; font-weight: bold');
    console.log(`%c❌ FAILED: ${results.fail.length}`, 'color: red; font-weight: bold');
    console.log(`%c⚠️  WARNINGS: ${results.warn.length}`, 'color: orange; font-weight: bold');

    if (results.fail.length === 0 && results.warn.length === 0) {
        console.log('\n%c🎉 ALL TESTS PASSED! Nav guidance working perfectly!', 'color: green; font-size: 14px; font-weight: bold');
    } else if (results.fail.length === 0) {
        console.log('\n%c✅ Tests passed but with warnings (likely GTN750 not open)', 'color: orange; font-size: 14px');
    } else {
        console.log('\n%c⚠️  Some tests failed - check details above', 'color: red; font-size: 14px');
    }

    console.log('%c============================================================', 'color: cyan');
    console.log('');

    return {
        passed: results.pass.length,
        failed: results.fail.length,
        warnings: results.warn.length,
        navGuidance: ng
    };
})();
