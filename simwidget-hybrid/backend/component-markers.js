/**
 * Component Processing Markers Module v1.0.0
 * 
 * Standard for marking components with indicators based on processing requirements:
 * - 💰 Cost/Processing intensive operations
 * - ⚡ Real-time/High-frequency operations
 * - 🔌 External API calls
 * - 🎯 Manual/User input required
 * - 📊 Data analysis/computation heavy
 * - 🔄 Background processing
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\backend\component-markers.js
 * Created: 2025-01-08
 */

class ComponentMarkers {
    constructor() {
        this.markers = {
            // Processing intensity markers
            COST_INTENSIVE: {
                icon: '💰',
                class: 'cost-intensive',
                tooltip: 'Resource intensive - may incur costs',
                color: '#f59e0b',
                threshold: 'high'
            },
            REALTIME: {
                icon: '⚡',
                class: 'realtime',
                tooltip: 'Real-time processing - high frequency updates',
                color: '#10b981',
                threshold: 'medium'
            },
            API_CALL: {
                icon: '🔌',
                class: 'api-call',
                tooltip: 'External API calls - network dependent',
                color: '#3b82f6',
                threshold: 'low'
            },
            USER_INPUT: {
                icon: '🎯',
                class: 'user-input',
                tooltip: 'Requires manual user interaction',
                color: '#8b5cf6',
                threshold: 'none'
            },
            COMPUTE_HEAVY: {
                icon: '📊',
                class: 'compute-heavy',
                tooltip: 'CPU intensive data processing',
                color: '#ef4444',
                threshold: 'high'
            },
            BACKGROUND: {
                icon: '🔄',
                class: 'background',
                tooltip: 'Background processing - runs continuously',
                color: '#6b7280',
                threshold: 'medium'
            },
            // Specific operation types
            SIMCONNECT: {
                icon: '✈️',
                class: 'simconnect',
                tooltip: 'SimConnect operations - MSFS dependent',
                color: '#06b6d4',
                threshold: 'low'
            },
            CAMERA_CONTROL: {
                icon: '📷',
                class: 'camera-control',
                tooltip: 'Camera system control - VJoy/external deps',
                color: '#f97316',
                threshold: 'medium'
            },
            VOICE_PROCESSING: {
                icon: '🎤',
                class: 'voice-processing',
                tooltip: 'Voice recognition processing',
                color: '#ec4899',
                threshold: 'high'
            },
            FILE_IO: {
                icon: '📁',
                class: 'file-io',
                tooltip: 'File system operations - disk dependent',
                color: '#84cc16',
                threshold: 'low'
            }
        };\n        \n        // Component registry with their processing requirements\n        this.componentRegistry = {\n            'aircraft-control': [this.markers.SIMCONNECT, this.markers.REALTIME, this.markers.API_CALL],\n            'camera-widget': [this.markers.CAMERA_CONTROL, this.markers.USER_INPUT, this.markers.COST_INTENSIVE],\n            'flight-data-widget': [this.markers.SIMCONNECT, this.markers.REALTIME],\n            'flight-recorder': [this.markers.FILE_IO, this.markers.COMPUTE_HEAVY, this.markers.BACKGROUND],\n            'fuel-widget': [this.markers.SIMCONNECT, this.markers.REALTIME, this.markers.USER_INPUT],\n            'voice-control': [this.markers.VOICE_PROCESSING, this.markers.API_CALL, this.markers.COST_INTENSIVE],\n            'services-panel': [this.markers.API_CALL, this.markers.BACKGROUND, this.markers.USER_INPUT],\n            'keymap-editor': [this.markers.FILE_IO, this.markers.USER_INPUT],\n            'wasm-camera': [this.markers.API_CALL, this.markers.CAMERA_CONTROL, this.markers.COST_INTENSIVE]\n        };\n    }\n    \n    /**\n     * Get processing markers for a component\n     * @param {string} componentName - Name of the component\n     * @returns {Array} Array of marker objects\n     */\n    getComponentMarkers(componentName) {\n        return this.componentRegistry[componentName] || [];\n    }\n    \n    /**\n     * Add markers to a component\n     * @param {string} componentName - Component name\n     * @param {Array} markers - Array of marker keys or objects\n     */\n    addComponentMarkers(componentName, markers) {\n        if (!this.componentRegistry[componentName]) {\n            this.componentRegistry[componentName] = [];\n        }\n        \n        markers.forEach(marker => {\n            if (typeof marker === 'string') {\n                const markerObj = Object.values(this.markers).find(m => m.class === marker);\n                if (markerObj) {\n                    this.componentRegistry[componentName].push(markerObj);\n                }\n            } else {\n                this.componentRegistry[componentName].push(marker);\n            }\n        });\n    }\n    \n    /**\n     * Generate HTML for component markers\n     * @param {string} componentName - Component name\n     * @param {Object} options - Display options\n     * @returns {string} HTML string for markers\n     */\n    generateMarkersHTML(componentName, options = {}) {\n        const markers = this.getComponentMarkers(componentName);\n        const { showTooltips = true, showIcons = true, showClasses = true } = options;\n        \n        if (markers.length === 0) {\n            return '';\n        }\n        \n        let html = '<div class=\"component-markers\">';\n        \n        markers.forEach(marker => {\n            const tooltip = showTooltips ? `title=\"${marker.tooltip}\"` : '';\n            const classes = showClasses ? `class=\"marker ${marker.class}\"` : 'class=\"marker\"';\n            const style = `style=\"color: ${marker.color};\"`;\n            \n            html += `<span ${classes} ${style} ${tooltip}>`;\n            if (showIcons) {\n                html += marker.icon;\n            }\n            html += '</span>';\n        });\n        \n        html += '</div>';\n        return html;\n    }\n    \n    /**\n     * Generate CSS for markers\n     * @returns {string} CSS string\n     */\n    generateMarkersCSS() {\n        return `\n/* Component Processing Markers */\n.component-markers {\n    display: flex;\n    align-items: center;\n    gap: 4px;\n    margin-left: 8px;\n}\n\n.marker {\n    font-size: 12px;\n    opacity: 0.8;\n    cursor: help;\n    transition: opacity 0.2s ease, transform 0.2s ease;\n    display: inline-block;\n}\n\n.marker:hover {\n    opacity: 1;\n    transform: scale(1.2);\n}\n\n/* Specific marker styles */\n.marker.cost-intensive {\n    animation: pulse-cost 2s infinite;\n}\n\n.marker.realtime {\n    animation: pulse-realtime 1s infinite;\n}\n\n.marker.api-call {\n    animation: pulse-api 3s infinite;\n}\n\n.marker.background {\n    animation: rotate-background 4s linear infinite;\n}\n\n@keyframes pulse-cost {\n    0%, 100% { opacity: 0.8; }\n    50% { opacity: 1; transform: scale(1.1); }\n}\n\n@keyframes pulse-realtime {\n    0%, 100% { opacity: 0.6; }\n    50% { opacity: 1; }\n}\n\n@keyframes pulse-api {\n    0%, 100% { opacity: 0.8; }\n    33% { opacity: 1; }\n    66% { opacity: 0.6; }\n}\n\n@keyframes rotate-background {\n    from { transform: rotate(0deg); }\n    to { transform: rotate(360deg); }\n}\n\n/* Threshold indicators */\n.marker[data-threshold=\"high\"] {\n    filter: drop-shadow(0 0 4px currentColor);\n}\n\n.marker[data-threshold=\"medium\"] {\n    filter: drop-shadow(0 0 2px currentColor);\n}\n\n.marker[data-threshold=\"low\"] {\n    opacity: 0.6;\n}\n        `;\n    }\n    \n    /**\n     * Get processing cost estimate for component\n     * @param {string} componentName - Component name\n     * @returns {Object} Cost estimate object\n     */\n    getComponentCostEstimate(componentName) {\n        const markers = this.getComponentMarkers(componentName);\n        let totalCost = 0;\n        let riskLevel = 'low';\n        const factors = [];\n        \n        markers.forEach(marker => {\n            switch (marker.threshold) {\n                case 'high':\n                    totalCost += 0.10; // $0.10/hour\n                    riskLevel = 'high';\n                    factors.push(`${marker.icon} High cost: ${marker.tooltip}`);\n                    break;\n                case 'medium':\n                    totalCost += 0.05; // $0.05/hour\n                    if (riskLevel !== 'high') riskLevel = 'medium';\n                    factors.push(`${marker.icon} Medium cost: ${marker.tooltip}`);\n                    break;\n                case 'low':\n                    totalCost += 0.01; // $0.01/hour\n                    factors.push(`${marker.icon} Low cost: ${marker.tooltip}`);\n                    break;\n                default:\n                    factors.push(`${marker.icon} No cost: ${marker.tooltip}`);\n            }\n        });\n        \n        return {\n            componentName,\n            estimatedHourlyCost: totalCost,\n            riskLevel,\n            factors,\n            markers: markers.length\n        };\n    }\n    \n    /**\n     * Check if component requires external API calls\n     * @param {string} componentName - Component name\n     * @returns {boolean} True if component makes API calls\n     */\n    requiresAPIAccess(componentName) {\n        const markers = this.getComponentMarkers(componentName);\n        return markers.some(marker => marker.class === 'api-call');\n    }\n    \n    /**\n     * Check if component requires user interaction\n     * @param {string} componentName - Component name\n     * @returns {boolean} True if component requires user input\n     */\n    requiresUserInput(componentName) {\n        const markers = this.getComponentMarkers(componentName);\n        return markers.some(marker => marker.class === 'user-input');\n    }\n    \n    /**\n     * Get all registered components\n     * @returns {Array} Array of component names with their markers\n     */\n    getAllComponents() {\n        return Object.keys(this.componentRegistry).map(name => ({\n            name,\n            markers: this.getComponentMarkers(name),\n            costEstimate: this.getComponentCostEstimate(name)\n        }));\n    }\n    \n    /**\n     * Register a new component with markers\n     * @param {string} componentName - Component name\n     * @param {Array} markerKeys - Array of marker keys\n     */\n    registerComponent(componentName, markerKeys = []) {\n        const markers = markerKeys.map(key => {\n            const markerKey = key.toUpperCase();\n            return this.markers[markerKey] || null;\n        }).filter(Boolean);\n        \n        this.componentRegistry[componentName] = markers;\n        console.log(`[ComponentMarkers] Registered '${componentName}' with ${markers.length} markers`);\n    }\n}\n\nmodule.exports = ComponentMarkers;\n"