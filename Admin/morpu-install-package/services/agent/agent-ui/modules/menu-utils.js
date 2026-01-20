/**
 * Menu Utilities v1.1.0
 *
 * Standardized menu components following STANDARDS.md patterns
 * Provides context menus, dropdown menus, and submenus
 *
 * Path: C:\LLM-DevOSWE\Admin\agent\agent-ui\modules\menu-utils.js
 *
 * Changelog:
 * v1.1.0 - Added invisible backdrop to capture stray clicks
 *        - Improved event propagation prevention
 *        - Changed position to fixed, z-index to 99999
 *        - Added isolation: isolate for better containment
 *
 * Usage:
 *   MenuUtils.createContextMenu(items, { x, y })
 *   MenuUtils.createDropdown(items, anchorElement)
 *   MenuUtils.closeAll()
 */

const MenuUtils = (function() {
    'use strict';

    let activeMenu = null;
    let stylesInjected = false;

    // Inject menu styles once
    function injectStyles() {
        if (stylesInjected) return;
        stylesInjected = true;

        const style = document.createElement('style');
        style.id = 'menu-utils-styles';
        style.textContent = `
            /* Menu Base - from STANDARDS.md */
            .mu-menu {
                position: fixed;
                background: var(--bg-card, #2a2a3e);
                border: 1px solid var(--border-color, #333);
                border-radius: 8px;
                padding: 4px;
                z-index: 99999;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                min-width: 140px;
                max-width: 280px;
                animation: menuFadeIn 0.15s ease;
                pointer-events: auto;
                isolation: isolate;
            }

            @keyframes menuFadeIn {
                from { opacity: 0; transform: translateY(-4px); }
                to { opacity: 1; transform: translateY(0); }
            }

            /* Menu Item */
            .mu-menu-item {
                padding: 8px 12px;
                cursor: pointer;
                border-radius: 4px;
                font-size: 12px;
                color: var(--text-muted, #ccc);
                display: flex;
                align-items: center;
                gap: 8px;
                transition: background 0.15s ease, color 0.15s ease;
                white-space: nowrap;
                user-select: none;
            }

            .mu-menu-item:hover {
                background: var(--bg-hover, #3a3a4e);
                color: var(--text-primary, #fff);
            }

            .mu-menu-item.danger:hover {
                background: var(--accent-error, #ef4444);
                color: #fff;
            }

            .mu-menu-item.disabled {
                color: var(--text-disabled, #555);
                cursor: default;
                pointer-events: none;
            }

            .mu-menu-item.disabled:hover {
                background: transparent;
            }

            /* Section Header */
            .mu-menu-item.header {
                color: var(--text-muted, #666);
                font-weight: 600;
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                padding: 6px 12px 4px;
                cursor: default;
                pointer-events: none;
            }

            .mu-menu-item.header:hover {
                background: transparent;
                color: var(--text-muted, #666);
            }

            /* Menu Divider */
            .mu-menu-divider {
                height: 1px;
                background: var(--border-color, #444);
                margin: 4px 8px;
            }

            /* Submenu Container */
            .mu-menu-item.has-submenu {
                position: relative;
            }

            .mu-menu-item.has-submenu::after {
                content: '▸';
                margin-left: auto;
                font-size: 10px;
                opacity: 0.6;
            }

            .mu-submenu {
                position: absolute;
                left: 100%;
                top: 0;
                margin-left: 4px;
                background: var(--bg-card, #2a2a3e);
                border: 1px solid var(--border-color, #444);
                border-radius: 6px;
                padding: 4px;
                min-width: 160px;
                display: none;
                z-index: 10001;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }

            .mu-menu-item.has-submenu:hover .mu-submenu {
                display: block;
            }

            /* Submenu positioning - flip if near edge */
            .mu-submenu.flip-left {
                left: auto;
                right: 100%;
                margin-left: 0;
                margin-right: 4px;
            }

            .mu-submenu.flip-up {
                top: auto;
                bottom: 0;
            }

            /* Icon styling */
            .mu-menu-icon {
                width: 16px;
                text-align: center;
                flex-shrink: 0;
            }

            /* Shortcut hint */
            .mu-menu-shortcut {
                margin-left: auto;
                font-size: 10px;
                color: var(--text-disabled, #666);
                opacity: 0.7;
            }

            /* Checkbox/Toggle items */
            .mu-menu-item.checked::before {
                content: '✓';
                width: 16px;
                text-align: center;
                color: var(--accent-success, #22c55e);
            }

            .mu-menu-item.unchecked::before {
                content: '';
                width: 16px;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Create a context menu at specified position
     * @param {Array} items - Menu items configuration
     * @param {Object} options - { x, y, onClose }
     * @returns {HTMLElement} Menu element
     */
    function createContextMenu(items, options = {}) {
        injectStyles();
        closeAll();

        // Create invisible backdrop to capture clicks outside menu
        const backdrop = document.createElement('div');
        backdrop.className = 'mu-backdrop';
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 99998;
            background: transparent;
        `;
        document.body.appendChild(backdrop);

        const menu = document.createElement('div');
        menu.className = 'mu-menu mu-context-menu';

        // Prevent all events from bubbling out of menu
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
        }, true);
        menu.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        }, true);
        menu.addEventListener('mouseup', (e) => {
            e.stopPropagation();
        }, true);

        renderItems(menu, items);

        // Position menu
        document.body.appendChild(menu);
        positionMenu(menu, options.x, options.y);

        activeMenu = menu;
        menu._backdrop = backdrop;

        // Close on backdrop click
        backdrop.addEventListener('click', (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
            closeAll();
            if (options.onClose) options.onClose();
        });
        backdrop.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeAll();
        });

        // Close handlers
        const closeHandler = (e) => {
            if (!menu.contains(e.target)) {
                closeAll();
                if (options.onClose) options.onClose();
            }
        };

        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeAll();
                if (options.onClose) options.onClose();
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closeHandler);
            document.addEventListener('keydown', escHandler);
        }, 0);

        menu._cleanup = () => {
            document.removeEventListener('click', closeHandler);
            document.removeEventListener('keydown', escHandler);
        };

        return menu;
    }

    /**
     * Create a dropdown menu anchored to an element
     * @param {Array} items - Menu items configuration
     * @param {HTMLElement} anchor - Element to anchor to
     * @param {Object} options - { align: 'left'|'right', direction: 'down'|'up' }
     */
    function createDropdown(items, anchor, options = {}) {
        injectStyles();
        closeAll();

        const menu = document.createElement('div');
        menu.className = 'mu-menu mu-dropdown';

        // Prevent all events from bubbling out of menu
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
        }, true);
        menu.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        }, true);
        menu.addEventListener('mouseup', (e) => {
            e.stopPropagation();
        }, true);

        renderItems(menu, items);

        document.body.appendChild(menu);

        // Position relative to anchor
        const rect = anchor.getBoundingClientRect();
        const align = options.align || 'left';
        const direction = options.direction || 'down';

        let x = align === 'left' ? rect.left : rect.right - menu.offsetWidth;
        let y = direction === 'down' ? rect.bottom + 4 : rect.top - menu.offsetHeight - 4;

        positionMenu(menu, x, y);

        activeMenu = menu;

        // Close handlers
        const closeHandler = (e) => {
            if (!menu.contains(e.target) && !anchor.contains(e.target)) {
                closeAll();
            }
        };

        const escHandler = (e) => {
            if (e.key === 'Escape') closeAll();
        };

        setTimeout(() => {
            document.addEventListener('click', closeHandler);
            document.addEventListener('keydown', escHandler);
        }, 0);

        menu._cleanup = () => {
            document.removeEventListener('click', closeHandler);
            document.removeEventListener('keydown', escHandler);
        };

        return menu;
    }

    /**
     * Render menu items
     */
    function renderItems(container, items) {
        items.forEach(item => {
            if (item.divider) {
                const div = document.createElement('div');
                div.className = 'mu-menu-divider';
                container.appendChild(div);
                return;
            }

            if (item.header) {
                const header = document.createElement('div');
                header.className = 'mu-menu-item header';
                header.textContent = item.header;
                container.appendChild(header);
                return;
            }

            const menuItem = document.createElement('div');
            menuItem.className = 'mu-menu-item';

            if (item.danger) menuItem.classList.add('danger');
            if (item.disabled) menuItem.classList.add('disabled');
            if (item.checked !== undefined) {
                menuItem.classList.add(item.checked ? 'checked' : 'unchecked');
            }

            // Icon
            if (item.icon) {
                const icon = document.createElement('span');
                icon.className = 'mu-menu-icon';
                icon.textContent = item.icon;
                menuItem.appendChild(icon);
            }

            // Label
            const label = document.createElement('span');
            label.textContent = item.label;
            menuItem.appendChild(label);

            // Shortcut hint
            if (item.shortcut) {
                const shortcut = document.createElement('span');
                shortcut.className = 'mu-menu-shortcut';
                shortcut.textContent = item.shortcut;
                menuItem.appendChild(shortcut);
            }

            // Submenu
            if (item.submenu && item.submenu.length > 0) {
                menuItem.classList.add('has-submenu');
                const submenu = document.createElement('div');
                submenu.className = 'mu-submenu';
                renderItems(submenu, item.submenu);
                menuItem.appendChild(submenu);
            } else if (item.action && !item.disabled) {
                menuItem.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    closeAll();
                    item.action(item);
                };
            }

            // Prevent any click from bubbling even without action
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
            }, true);

            container.appendChild(menuItem);
        });
    }

    /**
     * Position menu within viewport
     */
    function positionMenu(menu, x, y) {
        const rect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Adjust if menu goes off screen
        if (x + rect.width > viewportWidth - 10) {
            x = viewportWidth - rect.width - 10;
        }
        if (x < 10) x = 10;

        if (y + rect.height > viewportHeight - 10) {
            y = viewportHeight - rect.height - 10;
        }
        if (y < 10) y = 10;

        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        // Check submenus and flip if needed
        menu.querySelectorAll('.mu-submenu').forEach(submenu => {
            const parent = submenu.parentElement;
            const parentRect = parent.getBoundingClientRect();

            if (parentRect.right + 160 > viewportWidth) {
                submenu.classList.add('flip-left');
            }
        });
    }

    /**
     * Close all open menus
     */
    function closeAll() {
        if (activeMenu) {
            if (activeMenu._cleanup) activeMenu._cleanup();
            if (activeMenu._backdrop) activeMenu._backdrop.remove();
            activeMenu.remove();
            activeMenu = null;
        }

        // Also close any orphaned menus and backdrops
        document.querySelectorAll('.mu-menu').forEach(menu => {
            if (menu._cleanup) menu._cleanup();
            if (menu._backdrop) menu._backdrop.remove();
            menu.remove();
        });
        document.querySelectorAll('.mu-backdrop').forEach(b => b.remove());
    }

    /**
     * Create a confirmation dialog
     */
    function confirm(message, options = {}) {
        return new Promise((resolve) => {
            const items = [
                { header: options.title || 'Confirm' },
                { divider: true },
                {
                    icon: '✓',
                    label: options.confirmText || 'Confirm',
                    action: () => resolve(true)
                },
                {
                    icon: '✕',
                    label: options.cancelText || 'Cancel',
                    action: () => resolve(false)
                }
            ];

            if (options.danger) {
                items[2].danger = true;
            }

            createContextMenu(items, {
                x: options.x || window.innerWidth / 2 - 70,
                y: options.y || window.innerHeight / 2 - 50,
                onClose: () => resolve(false)
            });
        });
    }

    /**
     * Quick action menu builder
     */
    function quickActions(actions, position) {
        const items = actions.map(action => {
            if (action === '---') return { divider: true };
            return {
                icon: action.icon,
                label: action.label,
                shortcut: action.shortcut,
                danger: action.danger,
                disabled: action.disabled,
                action: action.action,
                submenu: action.submenu
            };
        });

        return createContextMenu(items, position);
    }

    // Initialize
    injectStyles();

    return {
        createContextMenu,
        createDropdown,
        closeAll,
        confirm,
        quickActions,
        // Expose for custom styling
        injectStyles
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MenuUtils;
}
