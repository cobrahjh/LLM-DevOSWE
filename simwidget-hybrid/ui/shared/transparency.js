/**
 * Widget Transparency Module v1.0.0
 * Last Updated: 2025-01-07
 * 
 * Shared transparency toggle for all SimGlass widgets.
 * Include this script and call initTransparency() after DOM load.
 * 
 * Usage:
 *   <button class="btn-icon" id="btnTransparency" title="Toggle Transparency">👁</button>
 *   <script src="/ui/shared/transparency.js"></script>
 *   <script>document.addEventListener('DOMContentLoaded', initTransparency);</script>
 */

function initTransparency() {
    const btn = document.getElementById('btnTransparency');
    if (!btn) return;
    
    // Load saved preference
    const saved = localStorage.getItem('widgetTransparency');
    if (saved === 'true') {
        document.body.classList.add('transparent');
        btn.classList.add('active');
    }
    
    // Toggle on click
    btn.addEventListener('click', () => {
        document.body.classList.toggle('transparent');
        btn.classList.toggle('active');
        localStorage.setItem('widgetTransparency', document.body.classList.contains('transparent'));
    });
}
