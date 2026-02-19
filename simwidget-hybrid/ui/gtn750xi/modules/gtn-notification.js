/**
 * GTN750 Notification System v1.0.0
 * Toast/banner notification system extracted from pane.js
 *
 * Handles:
 * - Toast notifications (info, success, warning)
 * - Waypoint sequence notifications
 * - ILS auto-tune notifications
 * - CDI source switch notifications
 * - Database warning banners
 * - Database status badges
 */

class GTNNotification {
    constructor() {
        this._sequenceNotifyTimer = null;
        this._ilsNotifyTimer = null;
        this._cdiSourceNotifyTimer = null;
        this._toastStyleInjected = false;
    }

    /**
     * Show a toast notification
     * @param {string} message
     * @param {'info'|'success'|'warning'} type
     */
    showNotification(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `gtn-toast gtn-toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10001;
            background: rgba(0, 0, 0, 0.9);
            border: 1px solid ${type === 'success' ? '#00ff00' : type === 'warning' ? '#ffff00' : '#00ffff'};
            border-radius: 4px;
            padding: 8px 16px;
            font-family: Consolas, monospace;
            font-size: 11px;
            color: ${type === 'success' ? '#00ff00' : type === 'warning' ? '#ffff00' : '#00ffff'};
            animation: slideIn 0.3s ease-out;
        `;
        toast.textContent = message;

        // Add animation (once)
        if (!this._toastStyleInjected && !document.getElementById('toast-style')) {
            const style = document.createElement('style');
            style.id = 'toast-style';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
                    to { transform: translateX(-50%) translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
            this._toastStyleInjected = true;
        }

        document.body.appendChild(toast);

        // Remove after 2 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    /**
     * Show waypoint sequence notification in CDI bar
     * @param {string} passedIdent - Waypoint just passed
     * @param {string} activeIdent - New active waypoint
     */
    showSequenceNotification(passedIdent, activeIdent) {
        const notify = document.getElementById('cdi-sequence-notify');
        if (!notify) return;

        notify.textContent = `${passedIdent} → ${activeIdent}`;
        notify.style.display = '';

        if (this._sequenceNotifyTimer) {
            clearTimeout(this._sequenceNotifyTimer);
        }

        this._sequenceNotifyTimer = setTimeout(() => {
            notify.style.display = 'none';
            this._sequenceNotifyTimer = null;
        }, 2000);
    }

    /**
     * Show ILS auto-tune notification
     * @param {Object} data - { frequency, runway, airport }
     */
    showIlsTunedNotification(data) {
        const notify = document.getElementById('cdi-ils-notify');
        if (!notify) return;

        const freq = data.frequency?.toFixed(2) || '---';
        const runway = data.runway || '';
        const airport = data.airport || '';

        notify.textContent = `ILS ${freq} tuned - ${airport} RWY ${runway}`;
        notify.style.display = '';

        if (this._ilsNotifyTimer) {
            clearTimeout(this._ilsNotifyTimer);
        }

        this._ilsNotifyTimer = setTimeout(() => {
            notify.style.display = 'none';
            this._ilsNotifyTimer = null;
        }, 3000);
    }

    /**
     * Show CDI source switch notification
     * @param {string} source - 'GPS'|'NAV1'|'NAV2'
     * @param {string} reason - Reason for switch
     */
    showCdiSourceNotification(source, reason) {
        const notify = document.getElementById('cdi-ils-notify'); // Reuse ILS notify element
        if (!notify) return;

        let message = `CDI: ${source}`;
        if (reason) message += ` - ${reason}`;

        notify.textContent = message;
        notify.style.display = '';

        if (this._cdiSourceNotifyTimer) {
            clearTimeout(this._cdiSourceNotifyTimer);
        }

        this._cdiSourceNotifyTimer = setTimeout(() => {
            notify.style.display = 'none';
            this._cdiSourceNotifyTimer = null;
        }, 2500);
    }

    /**
     * Show database warning banner (pulsing)
     */
    showDatabaseWarning(title, message, color) {
        let banner = document.getElementById('db-warning-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'db-warning-banner';
            banner.className = 'db-warning-banner';
            banner.style.cssText = `
                position: fixed;
                top: 60px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10000;
                background: rgba(0, 0, 0, 0.95);
                border: 2px solid ${color};
                border-radius: 4px;
                padding: 8px 16px;
                font-family: Consolas, monospace;
                font-size: 11px;
                color: ${color};
                box-shadow: 0 0 12px ${color}88;
                animation: pulse 2s infinite;
            `;
            document.body.appendChild(banner);

            // Add pulse animation
            if (!document.getElementById('db-pulse-style')) {
                const style = document.createElement('style');
                style.id = 'db-pulse-style';
                style.textContent = `
                    @keyframes pulse {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.6; }
                    }
                `;
                document.head.appendChild(style);
            }
        }

        banner.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 2px;">${title}</div>
            <div style="font-size: 9px; opacity: 0.8;">${message}</div>
        `;
        banner.style.borderColor = color;
        banner.style.color = color;
        banner.style.boxShadow = `0 0 12px ${color}88`;
    }

    /**
     * Show database status badge (non-intrusive)
     */
    showDatabaseBadge(title, message, color) {
        const badge = document.createElement('div');
        badge.id = 'db-status-badge';
        badge.className = 'db-status-badge';
        badge.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 9999;
            background: rgba(0, 0, 0, 0.85);
            border: 1px solid ${color};
            border-radius: 3px;
            padding: 4px 8px;
            font-family: Consolas, monospace;
            font-size: 8px;
            color: ${color};
            opacity: 0.7;
        `;
        badge.textContent = title;
        badge.title = message;

        const existing = document.getElementById('db-status-badge');
        if (existing) existing.remove();
        document.body.appendChild(badge);
    }

    destroy() {
        if (this._sequenceNotifyTimer) {
            clearTimeout(this._sequenceNotifyTimer);
            this._sequenceNotifyTimer = null;
        }
        if (this._ilsNotifyTimer) {
            clearTimeout(this._ilsNotifyTimer);
            this._ilsNotifyTimer = null;
        }
        if (this._cdiSourceNotifyTimer) {
            clearTimeout(this._cdiSourceNotifyTimer);
            this._cdiSourceNotifyTimer = null;
        }

        // Clean up DOM elements
        document.getElementById('db-warning-banner')?.remove();
        document.getElementById('db-status-badge')?.remove();
    }
}
