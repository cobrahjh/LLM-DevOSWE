/**
 * SimGlass Theme System v1.0.0
 *
 * CSS variable-based theming with cross-widget synchronization.
 *
 * Usage:
 *   import { applyTheme, setTheme, getCurrentTheme, getThemes } from './themes.js';
 *
 *   // Apply a theme
 *   setTheme('midnight');
 *
 *   // Get current theme
 *   const current = getCurrentTheme();
 *
 *   // Get all available themes
 *   const themes = getThemes();
 */

// Theme definitions with CSS variables
const THEMES = {
    dark: {
        name: 'Dark',
        description: 'Default dark theme',
        variables: {
            '--widget-bg': '#1a1a2e',
            '--widget-bg-secondary': '#16213e',
            '--widget-accent': '#667eea',
            '--widget-text': '#fff',
            '--widget-text-muted': '#888',
            '--widget-border': 'rgba(255, 255, 255, 0.1)',
            '--widget-success': '#10b981',
            '--widget-warning': '#f59e0b',
            '--widget-error': '#ef4444'
        }
    },
    light: {
        name: 'Light',
        description: 'Clean light theme for daytime use',
        variables: {
            '--widget-bg': '#f5f5f5',
            '--widget-bg-secondary': '#ffffff',
            '--widget-accent': '#4f46e5',
            '--widget-text': '#1a1a2e',
            '--widget-text-muted': '#666',
            '--widget-border': 'rgba(0, 0, 0, 0.1)',
            '--widget-success': '#059669',
            '--widget-warning': '#d97706',
            '--widget-error': '#dc2626'
        }
    },
    midnight: {
        name: 'Midnight',
        description: 'GitHub-inspired dark theme',
        variables: {
            '--widget-bg': '#0d1117',
            '--widget-bg-secondary': '#161b22',
            '--widget-accent': '#58a6ff',
            '--widget-text': '#c9d1d9',
            '--widget-text-muted': '#8b949e',
            '--widget-border': 'rgba(48, 54, 61, 0.5)',
            '--widget-success': '#3fb950',
            '--widget-warning': '#d29922',
            '--widget-error': '#f85149'
        }
    },
    sunset: {
        name: 'Sunset',
        description: 'Warm orange accents for evening flying',
        variables: {
            '--widget-bg': '#1a1423',
            '--widget-bg-secondary': '#251a2f',
            '--widget-accent': '#f97316',
            '--widget-text': '#fef3c7',
            '--widget-text-muted': '#d4a574',
            '--widget-border': 'rgba(249, 115, 22, 0.2)',
            '--widget-success': '#84cc16',
            '--widget-warning': '#eab308',
            '--widget-error': '#f43f5e'
        }
    },
    cockpit: {
        name: 'Cockpit',
        description: 'Aviation-inspired green on dark',
        variables: {
            '--widget-bg': '#0a0f0a',
            '--widget-bg-secondary': '#121a12',
            '--widget-accent': '#22c55e',
            '--widget-text': '#a3e635',
            '--widget-text-muted': '#6b8e23',
            '--widget-border': 'rgba(34, 197, 94, 0.2)',
            '--widget-success': '#4ade80',
            '--widget-warning': '#facc15',
            '--widget-error': '#f87171'
        }
    },
    amoled: {
        name: 'AMOLED',
        description: 'True black for OLED displays',
        variables: {
            '--widget-bg': '#000000',
            '--widget-bg-secondary': '#0a0a0a',
            '--widget-accent': '#00ff88',
            '--widget-text': '#ffffff',
            '--widget-text-muted': '#555',
            '--widget-border': 'rgba(255, 255, 255, 0.05)',
            '--widget-success': '#00ff88',
            '--widget-warning': '#ffcc00',
            '--widget-error': '#ff4444'
        }
    },
    highContrast: {
        name: 'High Contrast',
        description: 'Accessibility-focused high contrast',
        variables: {
            '--widget-bg': '#000000',
            '--widget-bg-secondary': '#1a1a1a',
            '--widget-accent': '#ffff00',
            '--widget-text': '#ffffff',
            '--widget-text-muted': '#cccccc',
            '--widget-border': '#ffffff',
            '--widget-success': '#00ff00',
            '--widget-warning': '#ffff00',
            '--widget-error': '#ff0000'
        }
    }
};

// Storage key for persisting theme
const STORAGE_KEY = 'simglass-current-theme';

// BroadcastChannel for cross-widget sync
const CHANNEL_NAME = 'simglass-theme';
let themeChannel = null;

/**
 * Initialize the BroadcastChannel for theme sync
 */
function initChannel() {
    if (themeChannel) return themeChannel;

    try {
        themeChannel = new BroadcastChannel(CHANNEL_NAME);
        themeChannel.onmessage = (event) => {
            if (event.data && event.data.type === 'theme-change' && event.data.theme) {
                // Apply without broadcasting to avoid loops
                applyTheme(event.data.theme, false);
            }
        };
    } catch (e) {
        console.warn('[Themes] BroadcastChannel not supported');
    }

    return themeChannel;
}

/**
 * Convert CSS variable theme format to legacy widget-customizer format
 * @param {Object} theme - Theme definition with CSS variables
 * @returns {Object} Legacy format with bg, bgSecondary, text, etc.
 */
function convertToLegacyFormat(theme) {
    const vars = theme.variables;
    return {
        name: theme.name,
        description: theme.description,
        bg: vars['--widget-bg'],
        bgSecondary: vars['--widget-bg-secondary'],
        text: vars['--widget-text'],
        textMuted: vars['--widget-text-muted'],
        accent: vars['--widget-accent'],
        border: vars['--widget-border'],
        success: vars['--widget-success'],
        warning: vars['--widget-warning'],
        error: vars['--widget-error']
    };
}

/**
 * Get all themes in legacy widget-customizer format
 * @returns {Object} Themes keyed by ID in legacy format
 */
function getThemesLegacy() {
    const legacy = {};
    Object.keys(THEMES).forEach(id => {
        legacy[id] = convertToLegacyFormat(THEMES[id]);
    });
    return legacy;
}

/**
 * Get all available theme definitions
 * @returns {Object} Theme definitions keyed by theme ID
 */
function getThemes() {
    return { ...THEMES };
}

/**
 * Get list of theme IDs
 * @returns {string[]} Array of theme IDs
 */
function getThemeIds() {
    return Object.keys(THEMES);
}

/**
 * Get a specific theme by ID
 * @param {string} themeId - The theme identifier
 * @returns {Object|null} Theme definition or null if not found
 */
function getTheme(themeId) {
    return THEMES[themeId] || null;
}

/**
 * Apply CSS variables to :root element
 * @param {string} themeName - Theme identifier
 * @param {boolean} broadcast - Whether to broadcast change to other widgets
 */
function applyTheme(themeName, broadcast = true) {
    const theme = THEMES[themeName];
    if (!theme) {
        console.warn(`[Themes] Unknown theme: ${themeName}`);
        return false;
    }

    const root = document.documentElement;

    // Apply all CSS variables
    Object.entries(theme.variables).forEach(([property, value]) => {
        root.style.setProperty(property, value);
    });

    // Also set body styles for consistency
    document.body.style.backgroundColor = theme.variables['--widget-bg'];
    document.body.style.color = theme.variables['--widget-text'];

    // Add theme class to body for additional CSS hooks
    document.body.dataset.theme = themeName;

    // Dispatch custom event for local listeners
    window.dispatchEvent(new CustomEvent('simglass-theme-changed', {
        detail: { theme: themeName, variables: theme.variables }
    }));

    // Broadcast to other widgets
    if (broadcast) {
        initChannel();
        try {
            if (themeChannel) {
                themeChannel.postMessage({ type: 'theme-change', theme: themeName });
            }
        } catch (e) {
            console.warn('[Themes] Failed to broadcast theme change');
        }
    }

    return true;
}

/**
 * Get current theme from localStorage
 * @returns {string} Current theme ID or 'dark' as default
 */
function getCurrentTheme() {
    try {
        return localStorage.getItem(STORAGE_KEY) || 'dark';
    } catch (e) {
        return 'dark';
    }
}

/**
 * Set and apply a theme, persisting to localStorage
 * @param {string} themeName - Theme identifier
 * @returns {boolean} Success status
 */
function setTheme(themeName) {
    if (!THEMES[themeName]) {
        console.warn(`[Themes] Unknown theme: ${themeName}`);
        return false;
    }

    // Save to localStorage
    try {
        localStorage.setItem(STORAGE_KEY, themeName);
    } catch (e) {
        console.warn('[Themes] Failed to save theme to localStorage');
    }

    // Apply the theme
    return applyTheme(themeName, true);
}

/**
 * Cycle to the next theme
 * @returns {string} The new theme ID
 */
function nextTheme() {
    const themeIds = getThemeIds();
    const currentIndex = themeIds.indexOf(getCurrentTheme());
    const nextIndex = (currentIndex + 1) % themeIds.length;
    const nextThemeId = themeIds[nextIndex];
    setTheme(nextThemeId);
    return nextThemeId;
}

/**
 * Initialize theme system - call on page load
 * Applies saved theme and sets up broadcast listener
 */
function initThemes() {
    // Initialize broadcast channel
    initChannel();

    // Apply saved theme
    const savedTheme = getCurrentTheme();
    applyTheme(savedTheme, false);

    console.log(`[Themes] Initialized with theme: ${savedTheme}`);
}

/**
 * Create a theme selector dropdown element
 * @param {Object} options - Configuration options
 * @param {string} options.id - Element ID
 * @param {string} options.className - Additional CSS classes
 * @returns {HTMLSelectElement} Theme selector element
 */
function createThemeSelector(options = {}) {
    const select = document.createElement('select');
    select.id = options.id || 'theme-selector';
    select.className = `theme-selector ${options.className || ''}`.trim();

    const currentTheme = getCurrentTheme();

    Object.entries(THEMES).forEach(([id, theme]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = theme.name;
        option.title = theme.description;
        if (id === currentTheme) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
        setTheme(e.target.value);
    });

    // Update selector when theme changes from another source
    window.addEventListener('simglass-theme-changed', (e) => {
        select.value = e.detail.theme;
    });

    return select;
}

/**
 * Create theme button group
 * @param {Object} options - Configuration options
 * @returns {HTMLDivElement} Container with theme buttons
 */
function createThemeButtons(options = {}) {
    const container = document.createElement('div');
    container.className = `theme-buttons ${options.className || ''}`.trim();

    const currentTheme = getCurrentTheme();

    Object.entries(THEMES).forEach(([id, theme]) => {
        const btn = document.createElement('button');
        btn.className = `theme-btn ${id === currentTheme ? 'active' : ''}`;
        btn.dataset.theme = id;
        btn.title = `${theme.name}: ${theme.description}`;

        // Create preview swatch using safe DOM methods
        const preview = document.createElement('span');
        preview.className = 'theme-preview';
        preview.style.background = theme.variables['--widget-bg'];
        preview.style.border = `2px solid ${theme.variables['--widget-accent']}`;

        // Create label
        const label = document.createElement('span');
        label.className = 'theme-label';
        label.textContent = theme.name;

        btn.appendChild(preview);
        btn.appendChild(label);

        btn.addEventListener('click', () => {
            setTheme(id);
            container.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });

        container.appendChild(btn);
    });

    // Update buttons when theme changes from another source
    window.addEventListener('simglass-theme-changed', (e) => {
        container.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === e.detail.theme);
        });
    });

    return container;
}

// Auto-apply saved theme on load
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initThemes);
    } else {
        initThemes();
    }
}

// Export functions
if (typeof window !== 'undefined') {
    window.SimGlassThemes = {
        getThemes,
        getThemesLegacy,
        convertToLegacyFormat,
        getThemeIds,
        getTheme,
        applyTheme,
        getCurrentTheme,
        setTheme,
        nextTheme,
        initThemes,
        createThemeSelector,
        createThemeButtons
    };
}

// ES module exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getThemes,
        getThemesLegacy,
        convertToLegacyFormat,
        getThemeIds,
        getTheme,
        applyTheme,
        getCurrentTheme,
        setTheme,
        nextTheme,
        initThemes,
        createThemeSelector,
        createThemeButtons
    };
}
