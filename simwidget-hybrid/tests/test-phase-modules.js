// Phase Module Tests - Cruise and Approach
const { RuleEngineGround } = require("../ui/ai-autopilot/modules/rule-engine-ground.js");
const { RuleEngineTakeoff } = require("../ui/ai-autopilot/modules/rule-engine-takeoff.js");
const { RuleEngineCruise } = require("../ui/ai-autopilot/modules/rule-engine-cruise.js");
const { RuleEngineApproach } = require("../ui/ai-autopilot/modules/rule-engine-approach.js");

const tests = [];

// Test cruise module loads
tests.push({ name: "RuleEngineCruise loads", fn: () => {
    const cruise = new RuleEngineCruise();
    if (!cruise) throw new Error("Failed to instantiate");
}});

// Test approach module loads
tests.push({ name: "RuleEngineApproach loads", fn: () => {
    const approach = new RuleEngineApproach();
    if (!approach) throw new Error("Failed to instantiate");
}});

// Test cruise evaluates CLIMB
tests.push({ name: "RuleEngineCruise evaluates CLIMB", fn: () => {
    const cruise = new RuleEngineCruise();
    const result = cruise._evaluatePhase("CLIMB", {heading: 90, altitude: 1000}, {});
    if (result.mode !== "CLIMB") throw new Error("Wrong mode");
}});

// Test cruise evaluates CRUISE
tests.push({ name: "RuleEngineCruise evaluates CRUISE", fn: () => {
    const cruise = new RuleEngineCruise();
    const result = cruise._evaluatePhase("CRUISE", {heading: 90, altitude: 3000}, {});
    if (result.mode !== "CRUISE") throw new Error("Wrong mode");
}});

// Test approach evaluates DESCENT
tests.push({ name: "RuleEngineApproach evaluates DESCENT", fn: () => {
    const approach = new RuleEngineApproach();
    const result = approach._evaluatePhase("DESCENT", {altitude: 5000}, {});
    if (result.mode !== "DESCENT") throw new Error("Wrong mode");
}});

// Test approach evaluates APPROACH
tests.push({ name: "RuleEngineApproach evaluates APPROACH", fn: () => {
    const approach = new RuleEngineApproach();
    const result = approach._evaluatePhase("APPROACH", {altitude: 1500, agl: 500}, {});
    if (result.mode !== "APPROACH") throw new Error("Wrong mode");
}});

// Test approach evaluates LANDING
tests.push({ name: "RuleEngineApproach evaluates LANDING", fn: () => {
    const approach = new RuleEngineApproach();
    const result = approach._evaluatePhase("LANDING", {altitude: 1100, agl: 100}, {});
    if (result.mode !== "LANDING") throw new Error("Wrong mode");
}});

module.exports = tests;
