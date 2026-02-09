# Voicebox Integration Guide

**Status**: ✅ Deployed - Server running on :8100
**Model**: Qwen3-TTS (downloading)
**Backend**: PyTorch (Windows)

---

## Quick Start

**Server is running**: http://localhost:8100

### Check Status
```bash
curl http://localhost:8100/health
```

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": false,
  "backend_type": "pytorch",
  "gpu_available": false
}
```

---

## Complete Setup (When Model Ready)

### 1. Verify Model Loaded
```bash
curl http://localhost:8100/health
# Should show: "model_loaded": true
```

### 2. Create Voice Profile
```bash
curl -X POST http://localhost:8100/profiles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Heather",
    "description": "Hive voice persona",
    "language": "en"
  }'

# Response: {"id": "profile-uuid", ...}
```

### 3. Add Voice Sample
```bash
# Record or upload Heather voice sample (3+ seconds)
curl -X POST http://localhost:8100/profiles/{profile-id}/samples \
  -F "file=@heather-sample.wav" \
  -F "reference_text=Hello, this is Heather from Hive."
```

### 4. Generate Speech
```bash
curl -X POST http://localhost:8100/generate \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": "heather-profile-uuid",
    "text": "Traffic alert: Aircraft at your twelve o clock, two miles.",
    "language": "en"
  }'

# Response: {"id": "gen-uuid", "audio_path": "/path/to/output.wav"}
```

### 5. Download Audio
```bash
curl http://localhost:8100/audio/{generation-id} -o output.wav
```

---

## Hive Integration

### Voice-Control Glass

**Add voicebox backend** (voice-control/glass.js):
```javascript
class VoiceControlGlass extends SimGlassBase {
    async speakWithVoicebox(text, voiceProfile = 'heather') {
        try {
            const response = await fetch('http://localhost:8100/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profile_id: voiceProfile,
                    text: text,
                    language: 'en',
                    seed: 42  // Consistent voice
                })
            });

            const { id } = await response.json();

            // Fetch audio
            const audioRes = await fetch(`http://localhost:8100/audio/${id}`);
            const audioBlob = await audioRes.blob();

            // Play audio
            const audio = new Audio(URL.createObjectURL(audioBlob));
            audio.play();

            return { success: true, generationId: id };
        } catch (error) {
            console.error('[VoiceControl] Voicebox generation failed:', error);
            // Fallback to Google TTS
            return this.speakWithGoogleTTS(text);
        }
    }
}
```

### Voice-Stress Glass

**Emotional tone control:**
```javascript
async generateEmotionalSpeech(text, emotion = 'calm') {
    const tShift = {
        calm: 0.9,
        alert: 1.0,
        urgent: 1.1,
        critical: 1.2
    }[emotion] || 0.9;

    // Note: Advanced params may require direct model access
    // For now, use different voice profiles per emotion
    const profileId = this.emotionProfiles[emotion];

    return await this.speakWithVoicebox(text, profileId);
}
```

---

## Service Setup

### Create NSSM Service

```powershell
# Create service
nssm install HiveVoicebox "python" "-m uvicorn backend.main:app --host 127.0.0.1 --port 8100"
nssm set HiveVoicebox AppDirectory "C:\voicebox-tts"
nssm set HiveVoicebox DisplayName "Hive Voicebox TTS"
nssm set HiveVoicebox Description "Qwen3-TTS voice synthesis API for Hive"
nssm set HiveVoicebox Start SERVICE_AUTO_START

# Start service
nssm start HiveVoicebox
```

### Add to Orchestrator

**Update orchestrator.js:**
```javascript
const services = [
    // ... existing services
    {
        id: 'voicebox',
        name: 'Voicebox TTS',
        type: 'optional',
        port: 8100,
        healthEndpoint: '/health',
        command: 'python -m uvicorn backend.main:app --host 127.0.0.1 --port 8100',
        workingDir: 'C:\\voicebox-tts',
        dependencies: []
    }
];
```

---

## API Reference

### Health Check
```
GET /health
```

### Voice Profiles
```
POST /profiles - Create profile
GET /profiles - List all profiles
GET /profiles/{id} - Get specific profile
PUT /profiles/{id} - Update profile
DELETE /profiles/{id} - Delete profile
POST /profiles/{id}/samples - Add voice sample
```

### Generation
```
POST /generate - Generate speech
GET /audio/{id} - Download audio file
GET /history - List generations
GET /history/stats - Generation statistics
```

### Model Management
```
POST /models/load?model_size=0.6B - Load model
POST /models/unload - Unload model
```

---

## Configuration

**Environment variables:**
```bash
VOICEBOX_PORT=8100
VOICEBOX_MODEL_SIZE=0.6B  # or 1.7B
VOICEBOX_GPU=false  # true if CUDA available
```

**Database**: SQLite at `C:\voicebox-tts\backend\voicebox.db`

---

## Performance

**Model sizes:**
- 0.6B: Lightweight, faster, good quality
- 1.7B: Higher quality, slower

**Generation speed:**
- GPU: 150x realtime (claimed)
- CPU: ~10-20x realtime (estimated)

**Latency:**
- Cold start: ~2-3 seconds (model load)
- Warm generation: <100ms for short phrases

**Memory:**
- 0.6B model: ~2GB RAM
- 1.7B model: ~6GB RAM

---

## Troubleshooting

### Server Not Starting
```bash
cd C:\voicebox-tts
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8100
# Check for import errors
```

### Model Not Loading
```bash
# Check model download
curl -X POST http://localhost:8100/models/load?model_size=0.6B

# Monitor download progress (check Hugging Face cache)
ls ~/.cache/huggingface/hub/
```

### Audio Quality Issues
- Use 1.7B model for better quality
- Ensure 3+ second reference audio
- Try multiple reference samples
- Adjust t_shift parameter

---

## Integration Checklist

- [ ] Voicebox server running (:8100)
- [ ] Qwen3-TTS model loaded (0.6B or 1.7B)
- [ ] Heather voice profile created
- [ ] Test generation working
- [ ] Voice-control glass integrated
- [ ] Voice-stress glass integrated
- [ ] NSSM service created
- [ ] Orchestrator monitoring added
- [ ] Fallback to Google TTS configured

---

**Status**: Server running, model downloading
**Next**: Test generation when model ready
**Location**: `C:\voicebox-tts`
**Port**: 8100
