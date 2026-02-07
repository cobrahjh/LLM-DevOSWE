/**
 * PWA Initialization Script
 * Registers service worker and handles install prompts
 */

(function() {
    'use strict';

    // Check for service worker support
    if (!('serviceWorker' in navigator)) {
        console.log('[PWA] Service workers not supported');
        return;
    }

    // Register service worker
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/ui/service-worker.js')
            .then((registration) => {
                console.log('[PWA] Service worker registered:', registration.scope);

                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New version available
                            showUpdateNotification();
                        }
                    });
                });
            })
            .catch((error) => {
                console.log('[PWA] Service worker registration failed:', error);
            });
    });

    // Handle install prompt
    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        showInstallButton();
    });

    // Show install button if available
    function showInstallButton() {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            return;
        }

        // Create install button if it doesn't exist
        let installBtn = document.getElementById('pwa-install-btn');
        if (!installBtn) {
            installBtn = document.createElement('button');
            installBtn.id = 'pwa-install-btn';
            installBtn.className = 'pwa-install-btn';
            installBtn.title = 'Install SimGlass as an app';

            const icon = document.createElement('span');
            icon.className = 'install-icon';
            icon.textContent = '📲';

            const text = document.createTextNode(' Install App');

            installBtn.appendChild(icon);
            installBtn.appendChild(text);
            document.body.appendChild(installBtn);

            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                .pwa-install-btn {
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    border: none;
                    padding: 12px 20px;
                    border-radius: 25px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: transform 0.2s, box-shadow 0.2s;
                    animation: slideIn 0.3s ease-out;
                }
                .pwa-install-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
                }
                .pwa-install-btn .install-icon {
                    font-size: 18px;
                }
                .pwa-install-btn.hidden {
                    display: none;
                }
                @keyframes slideIn {
                    from { transform: translateY(100px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @media (max-width: 480px) {
                    .pwa-install-btn {
                        bottom: 10px;
                        left: 10px;
                        right: 10px;
                        justify-content: center;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        installBtn.classList.remove('hidden');
        installBtn.addEventListener('click', installPWA);
    }

    // Install PWA
    async function installPWA() {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        console.log('[PWA] Install prompt outcome:', outcome);
        deferredPrompt = null;

        // Hide install button
        const btn = document.getElementById('pwa-install-btn');
        if (btn) btn.classList.add('hidden');
    }

    // Show update notification
    function showUpdateNotification() {
        const notification = document.createElement('div');
        notification.className = 'pwa-update-notification';

        const text = document.createElement('span');
        text.textContent = 'New version available!';

        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = 'Refresh';
        refreshBtn.addEventListener('click', () => location.reload());

        notification.appendChild(text);
        notification.appendChild(refreshBtn);
        document.body.appendChild(notification);

        const style = document.createElement('style');
        style.textContent = `
            .pwa-update-notification {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #1a1a2e;
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                gap: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                z-index: 10000;
                animation: slideDown 0.3s ease-out;
            }
            .pwa-update-notification button {
                background: #667eea;
                border: none;
                color: white;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
            }
            @keyframes slideDown {
                from { transform: translateX(-50%) translateY(-100px); }
                to { transform: translateX(-50%) translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }

    // Handle app installed event
    window.addEventListener('appinstalled', () => {
        console.log('[PWA] App installed successfully');
        deferredPrompt = null;
        const btn = document.getElementById('pwa-install-btn');
        if (btn) btn.classList.add('hidden');
    });

    // Expose install function globally
    window.installSimGlass = installPWA;
})();
