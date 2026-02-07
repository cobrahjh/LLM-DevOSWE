// Lazy data loader for copilot modules
// Part of code splitting optimization for Copilot Widget v3.0.0

const loadedModules = new Set();

/**
 * Lazy-load copilot data modules on-demand
 * @param {string} moduleName - Name of the module (e.g., 'checklists', 'emergency-procedures')
 * @returns {Promise<void>}
 */
async function loadCopilotData(moduleName) {
    if (loadedModules.has(moduleName)) return;
    const file = `data/${moduleName}.js`;
    await loadScript(file);
    loadedModules.add(moduleName);
}

/**
 * Load a script dynamically
 * @param {string} src - Path to the script file
 * @returns {Promise<void>}
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load: ${src}`));
        document.head.appendChild(script);
    });
}

// Export for module usage
if (typeof module !== 'undefined') module.exports = { loadCopilotData, loadScript };
