/**
 * Quick module check script - paste into browser console
 * Run this on http://192.168.1.42:8080/ui/ai-autopilot/
 */

console.log('\n🔍 PHASE 2 MODULE STATUS CHECK\n');
console.log('═══════════════════════════════════════════\n');

// Check what's loaded
const modules = {
    'RuleEngineCore': typeof RuleEngineCore !== 'undefined',
    'ATCController': typeof ATCController !== 'undefined',
    'WindCompensation': typeof WindCompensation !== 'undefined',
    'LLMAdvisor': typeof LLMAdvisor !== 'undefined',
    'RuleEngineGround': typeof RuleEngineGround !== 'undefined',
    'RuleEngineTakeoff': typeof RuleEngineTakeoff !== 'undefined',
    'RuleEngineCruise': typeof RuleEngineCruise !== 'undefined',
    'RuleEngineApproach': typeof RuleEngineApproach !== 'undefined'
};

// Check widget instance
const widget = window.widget;
const hasWidget = typeof widget !== 'undefined';

console.log('📦 Module Classes (globally defined):');
for (const [name, loaded] of Object.entries(modules)) {
    const status = loaded ? '✅ LOADED' : '❌ NOT LOADED';
    const lines = {
        RuleEngineCore: 1223,
        ATCController: 343,
        WindCompensation: 189,
        LLMAdvisor: 248,
        RuleEngineGround: 204,
        RuleEngineTakeoff: 255,
        RuleEngineCruise: 151,
        RuleEngineApproach: 198
    }[name] || 0;
    console.log(`  ${status} - ${name} (${lines} lines)`);
}

console.log('\n📊 Widget Instance State:');
if (hasWidget) {
    console.log(`  ✅ Widget exists: ${widget.constructor.name}`);
    console.log(`  Current Phase: ${widget.flightPhase?.phase || 'UNKNOWN'}`);
    console.log(`  ATC Controller: ${widget.atcController ? '✅ Loaded' : '❌ Not loaded'}`);
    console.log(`  LLM Advisor: ${widget.llmAdvisor ? '✅ Loaded' : '❌ Not loaded'}`);
    console.log(`  Rule Engine: ${widget.ruleEngine?.constructor.name || 'None'}`);
    console.log(`  Conditional Modules: ${Array.from(widget._conditionalModules || []).join(', ') || 'None'}`);
    console.log(`  Wind Comp Loaded: ${widget._windCompLoaded ? 'Yes' : 'No'}`);
} else {
    console.log('  ❌ Widget not found');
}

console.log('\n📈 Memory Estimate:');
let totalLines = 0;
const loadedModules = [];

// Always loaded
totalLines += 1223; // RuleEngineCore
loadedModules.push('RuleEngineCore (1223)');

// Conditional modules
if (modules.ATCController) {
    totalLines += 343;
    loadedModules.push('ATCController (343)');
}
if (modules.WindCompensation) {
    totalLines += 189;
    loadedModules.push('WindCompensation (189)');
}
if (modules.LLMAdvisor) {
    totalLines += 248;
    loadedModules.push('LLMAdvisor (248)');
}

// Phase modules
const phaseLines = {
    RuleEngineGround: 204,
    RuleEngineTakeoff: 255,
    RuleEngineCruise: 151,
    RuleEngineApproach: 198
};
for (const [name, lines] of Object.entries(phaseLines)) {
    if (modules[name]) {
        totalLines += lines;
        loadedModules.push(`${name} (${lines})`);
        break; // Only one phase module loaded at a time
    }
}

console.log(`  Total Lines: ${totalLines.toLocaleString()}`);
console.log(`  Loaded: ${loadedModules.join(', ')}`);

console.log('\n✅ Expected for current phase:');
if (hasWidget) {
    const phase = widget.flightPhase?.phase || 'UNKNOWN';
    const isGround = ['PREFLIGHT', 'TAXI'].includes(phase);
    const isAirborne = ['TAKEOFF', 'DEPARTURE', 'CLIMB', 'CRUISE', 'DESCENT', 'APPROACH', 'LANDING'].includes(phase);

    if (isGround) {
        console.log(`  Phase: ${phase} (GROUND)`);
        console.log(`  Should load: ATCController ✅`);
        console.log(`  Should NOT load: WindCompensation ❌`);
        console.log(`  Expected lines: ~1427 (core + ground + ATC)`);
    } else if (isAirborne) {
        console.log(`  Phase: ${phase} (AIRBORNE)`);
        console.log(`  Should load: WindCompensation ✅`);
        console.log(`  Should NOT load: ATCController ❌`);
        console.log(`  Expected lines: ~1374-1478 (core + phase + wind)`);
    }
}

console.log('\n═══════════════════════════════════════════\n');
