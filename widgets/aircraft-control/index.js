/**
 * Aircraft Control Widget Loader
 * Loads and registers the widget with SimWidget Engine
 */

async function loadAircraftControlWidget(engine) {
    console.log('[ACW Loader] Loading Aircraft Control Widget...');
    
    // Paths relative to renderer/index.html
    const basePath = '../../widgets/aircraft-control';
    
    // Load HTML
    const htmlResponse = await fetch(`${basePath}/widget.html`);
    const html = await htmlResponse.text();
    
    // Load CSS
    const cssResponse = await fetch(`${basePath}/widget.css`);
    const css = await cssResponse.text();
    
    // Create container
    const container = document.createElement('div');
    container.className = 'widget-container';
    container.id = 'aircraft-control-widget';
    container.innerHTML = html;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    
    // Add to overlay
    document.getElementById('overlay-container').appendChild(container);
    
    // Create API
    const $api = engine.createWidgetAPI({ id: 'aircraft-control' });
    
    // Load widget script and initialize
    const script = document.createElement('script');
    script.src = `${basePath}/widget.js`;
    script.onload = () => {
        if (window.AircraftControlWidget) {
            new window.AircraftControlWidget(container, $api, engine);
            console.log('[ACW Loader] Widget initialized!');
        }
    };
    document.body.appendChild(script);
}

// Export loader
window.loadAircraftControlWidget = loadAircraftControlWidget;
