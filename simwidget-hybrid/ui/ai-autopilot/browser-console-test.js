/**
 * PASTE THIS INTO AI AUTOPILOT BROWSER CONSOLE
 * Or load with: fetch('/ui/ai-autopilot/browser-console-test.js').then(r=>r.text()).then(eval)
 */
(async function testNavGuidance() {
    console.clear();
    console.log('%c============================================================', 'color: cyan');
    console.log('%c  AI AUTOPILOT NAV GUIDANCE - LIVE TEST', 'color: cyan; font-weight: bold');
    console.log('%c============================================================', 'color: cyan');
    const results = { pass: [], fail: [], warn: [] };
    const pass = (n,v) => { results.pass.push(n); console.log('%c✅ '+n, 'color:green', v||''); };
    const fail = (n,v) => { results.fail.push(n); console.log('%c❌ '+n, 'color:red', v||''); };
    const warn = (n,v) => { results.warn.push(n); console.log('%c⚠️  '+n, 'color:orange', v||''); };

    pass('Widget exists', typeof widget !== 'undefined');
    if (typeof widget === 'undefined') { console.log('Cannot run — widget not loaded'); return; }

    pass('Rule engine exists', !!widget.ruleEngine);
    pass('FlightPhase exists', !!widget.flightPhase);
    (widget.syncChannel) ? pass('SyncChannel active') : warn('SyncChannel null');

    const hasGetNav = typeof widget.ruleEngine?.getNavGuidance === 'function';
    hasGetNav ? pass('getNavGuidance() exists') : fail('getNavGuidance() MISSING — needs rule-engine-core.js update');

    console.log('%c\n📡 Nav State (from GTN750):', 'color:cyan;font-weight:bold');
    const nav = widget._navState;
    if (!nav) {
        warn('No nav-state — open GTN750 tab and wait 1s');
    } else {
        const age = Date.now() - (nav.timestamp || 0);
        age < 10000 ? pass('nav-state fresh', age+'ms old') : fail('nav-state stale', age+'ms old — GTN750 not broadcasting?');
        nav.activeWaypoint ? pass('activeWaypoint present', nav.activeWaypoint.ident+' '+nav.activeWaypoint.distNm?.toFixed(1)+'nm') : warn('activeWaypoint null (no flight plan in GTN750)');
        nav.cdi ? pass('CDI present', 'src:'+nav.cdi.source+' dtk:'+nav.cdi.dtk+'° xtrk:'+nav.cdi.xtrk?.toFixed(2)+'nm toFrom:'+nav.cdi.toFrom) : fail('CDI missing');
        nav.destDistNm != null ? pass('destDistNm present', nav.destDistNm?.toFixed(0)+'nm') : warn('destDistNm null (no flight plan)');
    }

    console.log('%c\n📊 Nav Guidance (rule engine):', 'color:cyan;font-weight:bold');
    const ng = hasGetNav ? widget.ruleEngine.getNavGuidance() : null;
    if (!ng) {
        warn('No nav guidance', nav ? 'nav-state present but guidance null — check rule engine' : 'open GTN750 first');
    } else {
        console.log('Guidance:', ng);
        ng.cdiSource != null ? pass('cdiSource', ng.cdiSource) : warn('cdiSource null');
        ng.dtk != null ? pass('dtk', ng.dtk+'°') : warn('dtk null');
        ng.xtrk != null ? pass('xtrk', ng.xtrk?.toFixed(2)+'nm') : warn('xtrk null');
        ng.navMode != null ? pass('navMode', ng.navMode) : fail('navMode null');
        ng.interceptHdg != null ? pass('interceptHdg', ng.interceptHdg+'°') : warn('interceptHdg null (on course or no DTK)');
        if (ng.xtrk != null && Math.abs(ng.xtrk) > 0.1 && ng.interceptHdg != null) {
            const rightOfCourse = ng.xtrk > 0;
            const turnsLeft = ng.interceptHdg < ng.dtk || (ng.dtk < 30 && ng.interceptHdg > 330);
            rightOfCourse === turnsLeft ? pass('Intercept direction correct', 'XTRK '+ng.xtrk?.toFixed(2)+'nm '+( rightOfCourse?'R':'L')+' → HDG '+ng.interceptHdg+'°') : fail('Intercept direction wrong');
        }
    }

    console.log('%c\n📍 FlightPhase destDist:', 'color:cyan;font-weight:bold');
    const dd = widget.flightPhase?.destinationDist;
    (dd != null && isFinite(dd)) ? pass('destinationDist set', dd.toFixed(0)+'nm') : (dd === Infinity ? warn('destinationDist = Infinity (no flight plan — expected)') : warn('destinationDist null'));

    console.log('%c\n🖥️  UI heading target:', 'color:cyan;font-weight:bold');
    const el = document.getElementById('target-hdg') || document.querySelector('.heading-target,[data-field=heading-target]');
    if (el) {
        const txt = el.textContent.trim();
        console.log('%c  Shows: ' + txt, 'color:gray');
        if (ng?.wpIdent) txt.includes(ng.wpIdent) ? pass('Shows waypoint ident', txt) : warn('Still raw heading', txt+' (enable AI Controls)');
        else warn('No wpIdent to compare', 'open GTN750 with flight plan');
    } else { warn('heading target element not found'); }

    console.log('%c\n============================================================', 'color:cyan');
    console.log('%c  PASSED: '+results.pass.length+'  FAILED: '+results.fail.length+'  WARNINGS: '+results.warn.length,'color:cyan;font-weight:bold');
    if (!results.fail.length && !results.warn.length) console.log('%c🎉 ALL CLEAR', 'color:green;font-size:14px;font-weight:bold');
    else if (!results.fail.length) console.log('%c✅ No failures (warnings expected without active flight plan)', 'color:orange;font-size:13px');
    console.log('%c============================================================', 'color:cyan');
    return { passed: results.pass.length, failed: results.fail.length, warnings: results.warn.length, ng, fails: results.fail, warns: results.warn };
})();
