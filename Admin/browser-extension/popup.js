// Check connection status
async function updateStatus() {
    const title = document.getElementById('title');
    const serverStatus = document.getElementById('server-status');
    const activeTab = document.getElementById('active-tab');

    // Check background connection
    chrome.runtime.sendMessage({ type: 'status' }, (response) => {
        if (response?.connected) {
            serverStatus.textContent = 'Connected';
            serverStatus.classList.remove('offline');
            title.classList.remove('disconnected');
        } else {
            serverStatus.textContent = 'Disconnected';
            serverStatus.classList.add('offline');
            title.classList.add('disconnected');
        }
    });

    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
        const url = new URL(tab.url);
        activeTab.textContent = url.hostname.substring(0, 20) || 'New Tab';
    }
}

// Reconnect button
document.getElementById('reconnect-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'reconnect' });
    setTimeout(updateStatus, 1000);
});

// Initial update
updateStatus();

// Refresh every 2 seconds
setInterval(updateStatus, 2000);
