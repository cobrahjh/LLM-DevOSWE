/**
 * SimWidget Component Library Index
 * Version: v1.0.0
 * Last Updated: 2025-01-05
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\packages\components\index.js
 * 
 * Central registry for all SimWidget components.
 */

// Component Registry
const SWComponents = {
    // Input Components
    AxisPad: typeof SWAxisPad !== 'undefined' ? SWAxisPad : null,
    // LinearSlider: null,  // TODO: Implement
    // RotaryKnob: null,    // TODO: Implement
    // PushButton: null,    // TODO: Implement
    // ToggleSwitch: null,  // TODO: Implement
    // RockerSwitch: null,  // TODO: Implement
    
    // Display Components
    // DataField: null,     // TODO: Implement
    // StatusLamp: null,    // TODO: Implement
    // ProgressBar: null,   // TODO: Implement
    // TextLabel: null,     // TODO: Implement
    
    // Layout Components
    // Spacer: null,        // TODO: Implement
    // Panel: null,         // TODO: Implement
    // Divider: null        // TODO: Implement
};

// Presets for quick component creation
const SWPresets = {
    // Flight Controls
    yoke: {
        type: 'AxisPad',
        label: 'Yoke',
        width: 180,
        height: 180,
        style: 'round',
        xAxis: { simvar: 'A:YOKE X POSITION', command: 'AXIS_AILERONS_SET' },
        yAxis: { simvar: 'A:YOKE Y POSITION', command: 'AXIS_ELEVATOR_SET' },
        returnToCenter: true,
        springStrength: 0.12
    },
    
    sidestick: {
        type: 'AxisPad',
        label: 'Sidestick',
        width: 120,
        height: 120,
        style: 'round',
        xAxis: { simvar: 'A:AILERON POSITION', command: 'AXIS_AILERONS_SET' },
        yAxis: { simvar: 'A:ELEVATOR POSITION', command: 'AXIS_ELEVATOR_SET' },
        returnToCenter: true,
        springStrength: 0.15
    },
    
    helicopterCyclic: {
        type: 'AxisPad',
        label: 'Cyclic',
        width: 150,
        height: 150,
        style: 'round',
        xAxis: { simvar: 'A:AILERON POSITION', command: 'AXIS_AILERONS_SET' },
        yAxis: { simvar: 'A:ELEVATOR POSITION', command: 'AXIS_ELEVATOR_SET' },
        returnToCenter: false,
        showGrid: true
    }
};

// Naming convention mapping (old → new)
const COMPONENT_NAME_MAP = {
    'display': 'DataField',
    'button': 'PushButton',
    'indicator': 'StatusLamp',
    'gauge': 'ProgressBar',
    'label': 'TextLabel',
    'spacer': 'Spacer',
    'knob': 'RotaryKnob',
    'slider': 'LinearSlider',
    'joystick': 'AxisPad',
    'toggle': 'ToggleSwitch',
    'rocker': 'RockerSwitch'
};

// Factory function
function createComponent(type, container, config) {
    // Support both old and new names
    const normalizedType = COMPONENT_NAME_MAP[type] || type;
    const ComponentClass = SWComponents[normalizedType];
    
    if (!ComponentClass) {
        console.error(`Unknown component type: ${type}`);
        return null;
    }
    
    return new ComponentClass(container, config);
}

// Create from preset
function createFromPreset(presetName, container, overrides = {}) {
    const preset = SWPresets[presetName];
    if (!preset) {
        console.error(`Unknown preset: ${presetName}`);
        return null;
    }
    
    const config = { ...preset, ...overrides };
    return createComponent(config.type, container, config);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        SWComponents, 
        SWPresets, 
        COMPONENT_NAME_MAP,
        createComponent, 
        createFromPreset 
    };
}
if (typeof window !== 'undefined') {
    window.SWComponents = SWComponents;
    window.SWPresets = SWPresets;
    window.createComponent = createComponent;
    window.createFromPreset = createFromPreset;
}
