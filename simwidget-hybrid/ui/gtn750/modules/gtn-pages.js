/**
 * GTN Page Manager - Handles page navigation and history
 */

class GTNPageManager {
    constructor(options = {}) {
        this.pages = new Map();
        this.currentPage = null;
        this.pageHistory = [];
        this.maxHistory = 10;
        this.container = options.container || document.getElementById('gtn-pages');
        this.onPageChange = options.onPageChange || (() => {});

        this.init();
    }

    init() {
        // Register default pages
        this.defaultPages = ['map', 'fpl', 'wpt', 'nrst', 'proc', 'terrain', 'traffic', 'wx', 'charts', 'aux', 'system'];
    }

    /**
     * Register a page with its render function
     */
    registerPage(pageId, pageInstance) {
        this.pages.set(pageId, pageInstance);
    }

    /**
     * Switch to a page
     */
    switchPage(pageId, addToHistory = true) {
        if (!this.pages.has(pageId)) {
            console.warn(`[GTN] Page not found: ${pageId}`);
            return false;
        }

        // Deactivate current page
        if (this.currentPage) {
            const currentInstance = this.pages.get(this.currentPage);
            if (currentInstance?.onDeactivate) {
                currentInstance.onDeactivate();
            }
            this.hidePageElement(this.currentPage);
        }

        // Add to history
        if (addToHistory && this.currentPage && this.currentPage !== pageId) {
            this.pageHistory.push(this.currentPage);
            if (this.pageHistory.length > this.maxHistory) {
                this.pageHistory.shift();
            }
        }

        // Activate new page
        this.currentPage = pageId;
        this.showPageElement(pageId);

        const newInstance = this.pages.get(pageId);
        if (newInstance?.onActivate) {
            newInstance.onActivate();
        }

        // Notify listeners
        this.onPageChange(pageId, newInstance);
        this.dispatchEvent('pagechange', { pageId, page: newInstance });

        return true;
    }

    /**
     * Go back to previous page
     */
    goBack() {
        if (this.pageHistory.length > 0) {
            const prevPage = this.pageHistory.pop();
            this.switchPage(prevPage, false);
            return true;
        }
        return false;
    }

    /**
     * Go to home (MAP) page
     */
    goHome() {
        this.pageHistory = [];
        this.switchPage('map', false);
    }

    /**
     * Show page element
     */
    showPageElement(pageId) {
        const el = document.getElementById(`page-${pageId}`);
        if (el) {
            el.classList.add('active');
            el.style.display = 'flex';
        }
    }

    /**
     * Hide page element
     */
    hidePageElement(pageId) {
        const el = document.getElementById(`page-${pageId}`);
        if (el) {
            el.classList.remove('active');
            el.style.display = 'none';
        }
    }

    /**
     * Get current page instance
     */
    getCurrentPage() {
        return this.pages.get(this.currentPage);
    }

    /**
     * Get current page ID
     */
    getCurrentPageId() {
        return this.currentPage;
    }

    /**
     * Check if can go back
     */
    canGoBack() {
        return this.pageHistory.length > 0;
    }

    /**
     * Dispatch custom event
     */
    dispatchEvent(type, detail) {
        window.dispatchEvent(new CustomEvent(`gtn:${type}`, { detail }));
    }

    /**
     * Update all pages with new data
     */
    updateData(data) {
        this.pages.forEach((page, pageId) => {
            if (page?.updateData) {
                page.updateData(data);
            }
        });
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GTNPageManager;
}
