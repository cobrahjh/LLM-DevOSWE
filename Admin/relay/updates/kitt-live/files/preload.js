/**
 * Kitt Live - Secure Preload Bridge
 * Uses contextBridge for secure IPC between main and renderer
 */

const { contextBridge, ipcRenderer } = require('electron');

// Whitelist of allowed channels for security
const validSendChannels = [
    'close-window',
    'minimize-window',
    'open-settings',
    'close-settings',
    'send-message',
    'start-listening',
    'stop-listening',
    'cancel-speech'
];

const validInvokeChannels = [
    'get-config',
    'set-config',
    'get-voices',
    'send-to-llm',
    'execute-environment-command'
];

const validReceiveChannels = [
    'config-changed',
    'push-to-talk',
    'llm-response',
    'llm-stream',
    'speech-started',
    'speech-ended',
    'environment-result',
    'error',
    'update-available',
    'update-progress',
    'notification'
];

// Expose secure API to renderer
contextBridge.exposeInMainWorld('kitt', {
    // Window controls
    closeWindow: () => ipcRenderer.send('close-window'),
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    openSettings: () => ipcRenderer.send('open-settings'),
    closeSettings: () => ipcRenderer.send('close-settings'),

    // Config
    getConfig: () => ipcRenderer.invoke('get-config'),
    setConfig: (key, value) => ipcRenderer.invoke('set-config', key, value),
    getVoices: () => ipcRenderer.invoke('get-voices'),

    // LLM Communication
    sendMessage: (message) => ipcRenderer.send('send-message', message),
    sendToLLM: (message, options) => ipcRenderer.invoke('send-to-llm', message, options),

    // Voice
    startListening: () => ipcRenderer.send('start-listening'),
    stopListening: () => ipcRenderer.send('stop-listening'),
    cancelSpeech: () => ipcRenderer.send('cancel-speech'),

    // Environment Access (secured)
    executeCommand: (command, options) => ipcRenderer.invoke('execute-environment-command', command, options),

    // Updates
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    getVersion: () => ipcRenderer.invoke('get-version'),

    // Event listeners with validation
    on: (channel, callback) => {
        if (validReceiveChannels.includes(channel)) {
            const subscription = (event, ...args) => callback(...args);
            ipcRenderer.on(channel, subscription);
            return () => ipcRenderer.removeListener(channel, subscription);
        }
        console.warn(`Invalid channel: ${channel}`);
        return () => {};
    },

    // One-time event listener
    once: (channel, callback) => {
        if (validReceiveChannels.includes(channel)) {
            ipcRenderer.once(channel, (event, ...args) => callback(...args));
        } else {
            console.warn(`Invalid channel: ${channel}`);
        }
    }
});

// Expose platform info
contextBridge.exposeInMainWorld('platform', {
    isWindows: process.platform === 'win32',
    isMac: process.platform === 'darwin',
    isLinux: process.platform === 'linux'
});
