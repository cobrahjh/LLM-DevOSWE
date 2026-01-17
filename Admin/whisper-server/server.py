"""
Local Whisper Speech-to-Text Server
Provides offline speech recognition for Kitt Live
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from faster_whisper import WhisperModel
import tempfile
import os
import base64
import wave
import io

app = Flask(__name__)
CORS(app)

# Load Whisper model (tiny for speed, can change to base/small/medium for accuracy)
print("[Whisper] Loading model (tiny.en)...")
model = WhisperModel("tiny.en", device="cpu", compute_type="int8")
print("[Whisper] Model loaded!")

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'service': 'whisper-server',
        'status': 'ok',
        'model': 'tiny.en'
    })

@app.route('/api/transcribe', methods=['POST'])
def transcribe():
    """
    Transcribe audio to text
    Accepts:
    - multipart/form-data with 'audio' file
    - JSON with 'audio' base64-encoded WAV data
    """
    try:
        audio_path = None

        # Handle file upload
        if 'audio' in request.files:
            audio_file = request.files['audio']
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
                audio_file.save(tmp.name)
                audio_path = tmp.name

        # Handle base64 JSON
        elif request.is_json:
            data = request.get_json()
            if 'audio' in data:
                audio_data = base64.b64decode(data['audio'])
                with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
                    tmp.write(audio_data)
                    audio_path = tmp.name

        if not audio_path:
            return jsonify({'error': 'No audio data provided'}), 400

        # Transcribe
        segments, info = model.transcribe(audio_path, beam_size=5)

        text = ""
        for segment in segments:
            text += segment.text

        # Cleanup
        if audio_path and os.path.exists(audio_path):
            os.unlink(audio_path)

        return jsonify({
            'text': text.strip(),
            'language': info.language,
            'duration': info.duration
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/transcribe-stream', methods=['POST'])
def transcribe_stream():
    """
    Transcribe streaming audio chunks
    Expects raw PCM audio data (16-bit, 16kHz, mono)
    """
    try:
        audio_data = request.data

        if not audio_data:
            return jsonify({'error': 'No audio data'}), 400

        # Convert raw PCM to WAV
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
            with wave.open(tmp.name, 'wb') as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)  # 16-bit
                wav.setframerate(16000)
                wav.writeframes(audio_data)

            # Transcribe
            segments, info = model.transcribe(tmp.name, beam_size=5)
            text = "".join([s.text for s in segments])

            os.unlink(tmp.name)

        return jsonify({
            'text': text.strip(),
            'partial': True
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("[Whisper] Starting server on port 8660...")
    app.run(host='127.0.0.1', port=8660, debug=False)
