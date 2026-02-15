# Say Intentions Voice ATC Integration

**Status**: ✅ INTEGRATED
**Version**: v1.0.0
**Date**: February 15, 2026

## Overview

Say Intentions provides AI-powered voice ATC communications for MSFS. This integration adds **real voice ATC responses** on top of the existing text-based ATC system.

**Key Features:**
- **AI Voice ATC** - Real voice responses from ground, tower, approach, departure controllers
- **Natural Communication** - Context-aware responses based on flight phase
- **Seamless Integration** - Works with existing taxi routing and autopilot
- **Fallback Support** - Gracefully falls back to TTS if Say Intentions unavailable

---

## Configuration

### Enable Say Intentions

Edit `config.json`:
```json
{
  "sayIntentions": {
    "enabled": true,
    "apiKey": "your-say-intentions-api-key-here",
    "useSynthetic": false,
    "fallbackToTTS": true
  }
}
```

**Config Options:**
- `enabled` - Enable/disable Say Intentions (default: false)
- `apiKey` - Your Say Intentions API key (required when enabled)
- `useSynthetic` - Use synthetic voice generation instead of real voice (default: true)
- `fallbackToTTS` - Fall back to browser TTS if Say Intentions fails (default: true)

### Get API Key

1. Visit https://sayintentions.ai/
2. Create an account
3. Subscribe to a plan (free tier available)
4. Copy your API key from dashboard
5. Add to config.json

---

## API Endpoints

### GET /api/ai-pilot/atc/voice/status

Check Say Intentions availability.

**Response:**
```json
{
  "enabled": true,
  "available": true
}
```

---

### POST /api/ai-pilot/atc/voice/ground

Request ground clearance with voice response.

**Request:**
```json
{
  "airport": "KDEN",
  "runway": "16R",
  "position": "Gate B5",
  "callsign": "N12345",
  "route": ["B", "A"]
}
```

**Response:**
```json
{
  "success": true,
  "voiceUrl": "https://sayintentions.ai/audio/abc123.mp3",
  "text": "November one two three four five, Denver Ground, taxi via Bravo, Alpha, hold short runway one six right",
  "duration": 8.5
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Say Intentions not configured"
}
```

**Usage:**
```bash
curl -X POST http://localhost:8080/api/ai-pilot/atc/voice/ground \
  -H "Content-Type: application/json" \
  -d '{
    "airport": "KDEN",
    "runway": "16R",
    "position": "Gate B5",
    "callsign": "N12345",
    "route": ["B", "A"]
  }'
```

---

### POST /api/ai-pilot/atc/voice/takeoff

Request takeoff clearance with voice response.

**Request:**
```json
{
  "airport": "KDEN",
  "runway": "16R",
  "callsign": "N12345"
}
```

**Response:**
```json
{
  "success": true,
  "voiceUrl": "https://sayintentions.ai/audio/xyz789.mp3",
  "text": "November one two three four five, Denver Tower, runway one six right, cleared for takeoff",
  "duration": 5.2
}
```

---

### POST /api/ai-pilot/atc/voice/pilot

Send pilot transmission and get ATC response.

**Request:**
```json
{
  "airport": "KDEN",
  "callsign": "N12345",
  "message": "request taxi to runway one six right",
  "context": "ground"
}
```

**Context Types:**
- `ground` - Ground control (taxi, pushback)
- `tower` - Tower (takeoff, landing)
- `approach` - Approach control (IFR arrivals)
- `departure` - Departure control (IFR departures)

**Response:**
```json
{
  "success": true,
  "voiceUrl": "https://sayintentions.ai/audio/def456.mp3",
  "text": "November one two three four five, taxi via Bravo, Alpha, hold short runway one six right",
  "response": {
    "type": "clearance",
    "runway": "16R",
    "route": ["B", "A"]
  }
}
```

---

### GET /api/ai-pilot/atc/voice/frequency/:airport/:type

Get ATC frequency for airport.

**Request:** GET /api/ai-pilot/atc/voice/frequency/KDEN/ground

**Types:**
- `ground` - Ground control
- `tower` - Tower
- `approach` - Approach control
- `departure` - Departure control

**Response:**
```json
{
  "success": true,
  "frequency": "121.8",
  "name": "Denver Ground"
}
```

---

## Integration with Existing ATC

Say Intentions **enhances** the existing ATC system, not replaces it. Here's how they work together:

### Ground Operations

**Existing System:** Calculates taxi route, generates text instruction
**Say Intentions:** Converts text to AI voice, plays audio

**Flow:**
1. User requests taxi (voice: "request taxi")
2. ATC server calculates route (A* pathfinding)
3. Generate text: "Taxi via Bravo, Alpha, hold short runway one six right"
4. **NEW:** Send to Say Intentions API for voice generation
5. **NEW:** Play AI voice response
6. Display text in UI (fallback)
7. Continue with existing taxi logic

### Takeoff Clearance

**Existing System:** Issues clearance, transitions flight phase
**Say Intentions:** Adds voice confirmation

**Flow:**
1. User requests takeoff (voice: "ready for departure")
2. ATC server checks phase (must be HOLD_SHORT)
3. Generate text: "Cleared for takeoff runway one six right"
4. **NEW:** Get voice from Say Intentions
5. **NEW:** Play AI voice clearance
6. Transition to CLEARED_TAKEOFF phase
7. AI autopilot begins takeoff

---

## Code Integration

### Server-Side (atc-server.js)

Modify `requestTaxiClearance()` to request voice:

```javascript
async requestTaxiClearance(icao, runway) {
    // ... existing route calculation ...

    const instruction = `${this._callsign}, ${icao} Ground, taxi to runway ${runway}${taxiStr}`;

    // NEW: Request voice from Say Intentions
    if (this._sayIntentions?.isEnabled()) {
        const voice = await this._sayIntentions.requestGroundClearance({
            airport: icao,
            runway,
            position: this._position,
            callsign: this._callsign,
            route: route.taxiways || []
        });

        if (voice.success) {
            // Broadcast voice URL to clients
            this._emit(instruction, 'taxi_clearance', { voiceUrl: voice.voiceUrl });
            return;
        }
    }

    // Fallback to text (existing behavior)
    this._emit(instruction, 'taxi_clearance');
}
```

### Client-Side (pane.js)

Play voice audio when received:

```javascript
_onATCInstruction(instruction, level, data) {
    // Display text
    this.elements.atcInstruction.textContent = instruction;

    // NEW: Play voice if available
    if (data?.voiceUrl) {
        const audio = new Audio(data.voiceUrl);
        audio.play().catch(e => {
            console.warn('[ATC] Voice playback failed:', e);
            // Fallback to TTS
            this._voiceAnnouncer.speak(instruction);
        });
    } else {
        // TTS fallback
        this._voiceAnnouncer.speak(instruction);
    }
}
```

---

## Testing

### Test Status Endpoint

```bash
curl http://localhost:8080/api/ai-pilot/atc/voice/status
# Expected: {"enabled":false,"available":true}
```

### Test Ground Clearance

```bash
curl -X POST http://localhost:8080/api/ai-pilot/atc/voice/ground \
  -H "Content-Type: application/json" \
  -d '{
    "airport": "KDEN",
    "runway": "16R",
    "position": "Gate B5",
    "callsign": "N12345",
    "route": ["B", "A"]
  }'
```

**With Say Intentions Enabled:**
```json
{
  "success": true,
  "voiceUrl": "https://sayintentions.ai/audio/abc123.mp3",
  "text": "November one two three four five, Denver Ground, taxi via Bravo, Alpha, hold short runway one six right",
  "duration": 8.5
}
```

**With Say Intentions Disabled:**
```json
{
  "success": false,
  "error": "Say Intentions not configured"
}
```

---

## Troubleshooting

### "Say Intentions not configured"

**Cause:** API key not set or enabled=false in config.json

**Solution:**
1. Check config.json has `sayIntentions.enabled = true`
2. Verify `sayIntentions.apiKey` is set
3. Restart server to reload config

---

### Voice audio doesn't play

**Cause:** CORS policy blocking audio URL, network error, browser autoplay policy

**Solution:**
1. Check browser console for CORS errors
2. Verify audio URL is accessible (open in new tab)
3. Enable autoplay in browser settings
4. Check browser's media autoplay policy
5. Fallback to TTS should work automatically

---

### "API error: 401 Unauthorized"

**Cause:** Invalid or expired API key

**Solution:**
1. Verify API key in config.json is correct
2. Log in to Say Intentions dashboard
3. Check subscription status (expired or cancelled?)
4. Generate new API key if needed
5. Update config.json and restart server

---

### "API error: 429 Too Many Requests"

**Cause:** Rate limit exceeded (too many requests per minute)

**Solution:**
1. Reduce request frequency
2. Upgrade to higher tier plan
3. Enable `fallbackToTTS` to use local TTS when rate-limited
4. Cache voice responses (not yet implemented)

---

## Performance

**Latency:**
- Say Intentions API: ~500-1500ms (voice generation)
- Browser TTS (fallback): ~100-300ms

**Bandwidth:**
- Voice audio: ~50-150KB per clearance (MP3)
- API request/response: ~1-2KB

**Caching:**
- Not yet implemented
- Future: Cache common clearances locally

**Recommendation:**
Use Say Intentions for ground and tower communications (infrequent). Fall back to TTS for high-frequency updates (altitude changes, heading changes).

---

## Limitations

1. **Network Required** - Say Intentions requires internet connection
2. **Latency** - 500-1500ms delay for voice generation (vs instant TTS)
3. **API Costs** - Paid service after free tier
4. **No Offline Mode** - Must fall back to TTS when offline
5. **Rate Limits** - Free tier has request limits

---

## Future Enhancements

- **Voice Caching** - Cache common clearances locally
- **Background Pre-generation** - Pre-generate likely clearances
- **Voice Recognition** - Send voice input directly to Say Intentions
- **Multi-language** - Support ICAO language variants
- **Custom Voices** - Select different controller voices
- **Progressive Taxi** - Support multi-step clearances

---

## Credits

- **Say Intentions** - AI voice ATC service (https://sayintentions.ai/)
- **SimGlass Team** - Integration and testing

---

## See Also

- [ATC-GUIDE.md](guides/ATC-GUIDE.md) - Complete ATC system documentation
- [README.md](README.md) - Main AI Autopilot documentation
