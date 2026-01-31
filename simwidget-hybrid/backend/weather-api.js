/**
 * Weather Control API for MSFS via SimConnect
 * Uses METAR injection and weather mode control
 */

const weatherMetarPresets = {
    cavok: 'CAVOK',
    clear: '00000KT 9999 SKC',
    fewclouds: '27010KT 9999 FEW030',
    scattered: '27012KT 9999 SCT040',
    broken: '27015KT 9999 BKN025',
    overcast: '27010KT 9999 OVC015',
    lightrain: '27012KT 6000 -RA OVC020',
    rain: '27015KT 4000 RA OVC015',
    heavyrain: '27020G30KT 2000 +RA OVC010',
    storm: '27025G40KT 1500 +TSRA CB OVC008',
    snow: '27010KT 3000 SN OVC012 M02/M05',
    fog: '00000KT 0400 FG VV002',
    mist: '27005KT 3000 BR OVC010',
    haze: '27008KT 5000 HZ SKC'
};

function setupWeatherRoutes(app, getSimConnect) {
    // Set weather via METAR string
    app.post('/api/weather/metar', (req, res) => {
        const { metar, duration = 60 } = req.body;
        console.log(`[Weather] Set METAR: ${metar}`);

        const simConn = getSimConnect();
        if (!simConn) {
            return res.json({ success: false, error: 'SimConnect not connected' });
        }
        if (!metar) {
            return res.json({ success: false, error: 'METAR string required' });
        }

        try {
            simConn.weatherSetModeCustom();
            simConn.weatherSetObservation(duration, metar);
            console.log(`[Weather] METAR applied: ${metar}`);
            res.json({ success: true, metar, duration });
        } catch (e) {
            console.error('[Weather] METAR error:', e.message);
            res.json({ success: false, error: e.message });
        }
    });

    // Set weather from preset
    app.post('/api/weather/preset', (req, res) => {
        const { preset, icao = 'GLOB', duration = 60 } = req.body;
        console.log(`[Weather] Set preset: ${preset} at ${icao}`);

        const simConn = getSimConnect();
        if (!simConn) {
            return res.json({ success: false, error: 'SimConnect not connected' });
        }

        const metarBase = weatherMetarPresets[preset];
        if (!metarBase) {
            return res.json({
                success: false,
                error: 'Unknown preset',
                available: Object.keys(weatherMetarPresets)
            });
        }

        try {
            const now = new Date();
            const day = now.getUTCDate().toString().padStart(2, '0');
            const hour = now.getUTCHours().toString().padStart(2, '0');
            const min = now.getUTCMinutes().toString().padStart(2, '0');
            const metar = `${icao} ${day}${hour}${min}Z ${metarBase}`;

            simConn.weatherSetModeCustom();
            simConn.weatherSetObservation(duration, metar);

            console.log(`[Weather] Preset applied: ${metar}`);
            res.json({ success: true, preset, metar, icao });
        } catch (e) {
            console.error('[Weather] Preset error:', e.message);
            res.json({ success: false, error: e.message });
        }
    });

    // Set weather mode (live/custom/theme)
    app.post('/api/weather/mode', (req, res) => {
        const { mode, theme } = req.body;
        console.log(`[Weather] Set mode: ${mode}${theme ? ` (${theme})` : ''}`);

        const simConn = getSimConnect();
        if (!simConn) {
            return res.json({ success: false, error: 'SimConnect not connected' });
        }

        try {
            switch (mode) {
                case 'custom':
                    simConn.weatherSetModeCustom();
                    break;
                case 'global':
                case 'live':
                    simConn.weatherSetModeGlobal();
                    break;
                case 'theme':
                    if (!theme) {
                        return res.json({ success: false, error: 'Theme name required' });
                    }
                    simConn.weatherSetModeTheme(theme);
                    break;
                default:
                    return res.json({ success: false, error: 'Use: custom, live, theme' });
            }
            res.json({ success: true, mode, theme });
        } catch (e) {
            console.error('[Weather] Mode error:', e.message);
            res.json({ success: false, error: e.message });
        }
    });

    // Get available weather presets
    app.get('/api/weather/presets', (req, res) => {
        const presets = Object.entries(weatherMetarPresets).map(([key, metar]) => ({
            id: key,
            name: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
            metar
        }));
        res.json({ presets });
    });

    // Set wind only
    app.post('/api/weather/wind', (req, res) => {
        const { direction = 0, speed = 0, gust = 0 } = req.body;
        console.log(`[Weather] Set wind: ${direction}/${speed}${gust ? `G${gust}` : ''}kt`);

        const simConn = getSimConnect();
        if (!simConn) {
            return res.json({ success: false, error: 'SimConnect not connected' });
        }

        try {
            const dir = Math.round(direction).toString().padStart(3, '0');
            const spd = Math.round(speed).toString().padStart(2, '0');
            const gustStr = gust > speed ? `G${Math.round(gust).toString().padStart(2, '0')}` : '';
            const windMetar = `${dir}${spd}${gustStr}KT 9999 SKC`;

            const now = new Date();
            const time = `${now.getUTCDate().toString().padStart(2, '0')}${now.getUTCHours().toString().padStart(2, '0')}${now.getUTCMinutes().toString().padStart(2, '0')}Z`;
            const metar = `GLOB ${time} ${windMetar}`;

            simConn.weatherSetModeCustom();
            simConn.weatherSetObservation(60, metar);

            res.json({ success: true, direction, speed, gust, metar });
        } catch (e) {
            console.error('[Weather] Wind error:', e.message);
            res.json({ success: false, error: e.message });
        }
    });

    // Set visibility
    app.post('/api/weather/visibility', (req, res) => {
        const { meters = 9999 } = req.body;
        console.log(`[Weather] Set visibility: ${meters}m`);

        const simConn = getSimConnect();
        if (!simConn) {
            return res.json({ success: false, error: 'SimConnect not connected' });
        }

        try {
            const vis = meters >= 9999 ? '9999' : meters.toString().padStart(4, '0');
            const now = new Date();
            const time = `${now.getUTCDate().toString().padStart(2, '0')}${now.getUTCHours().toString().padStart(2, '0')}${now.getUTCMinutes().toString().padStart(2, '0')}Z`;
            const metar = `GLOB ${time} 00000KT ${vis} SKC`;

            simConn.weatherSetModeCustom();
            simConn.weatherSetObservation(60, metar);

            res.json({ success: true, meters, metar });
        } catch (e) {
            console.error('[Weather] Visibility error:', e.message);
            res.json({ success: false, error: e.message });
        }
    });

    console.log('[Weather API] Routes registered');
}

module.exports = { setupWeatherRoutes, weatherMetarPresets };
