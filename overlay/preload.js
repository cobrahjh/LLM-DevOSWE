/**
 * SimWidget Overlay - Preload Script
 * Exposes safe APIs to renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('simWidget', {
    // Connection to server
    serverUrl: 'ws://localhost:8484',
    
    // Mouse events control
    setClickThrough: (ignore) => ipcRenderer.invoke('set-click-through', ignore),
    
    // Mini widgets
    createMiniWidget: (config) => ipcRenderer.invoke('create-mini-widget', config),
    closeMiniWidget: (id) => ipcRenderer.invoke('close-mini-widget', id),
    
    // Display info
    getDisplayInfo: () => ipcRenderer.invoke('get-display-info'),
    
    // Report widget bounds for click-through optimization
    reportBounds: (bounds) => ipcRenderer.send('widget-bounds', bounds),
    
    // Widget config (for mini widgets)
    onWidgetConfig: (callback) => {
        ipcRenderer.on('widget-config', (event, config) => callback(config));
    },
    
    // Filesystem access for widgets
    loadWidget: async (widgetPath) => {
        // Will be implemented to load widget code/html/css
        return null;
    }
});

console.log('[Preload] SimWidget API exposed');
