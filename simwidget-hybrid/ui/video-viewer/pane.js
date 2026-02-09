/**
 * Video Viewer pane - SimGlass v2.0.0
 * MSFS screen capture with HTTP polling or WebSocket streaming
 */

class VideoViewer extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'video-viewer',
            widgetVersion: '2.0.0',
            autoConnect: false  // Manual WS connection for video streaming
        });

        this.streaming = false;
        this.recording = false;
        this.recordedFrames = [];
        this.source = 'http';
        this.fps = 10;
        this.quality = 60;
        this.scale = 0.5;

        this.frameCount = 0;
        this.lastFpsUpdate = Date.now();
        this.frameInterval = null;
        this.videoWs = null;  // Separate WS for video streaming on port 9997
        this.pendingHeader = null;

        this.apiUrl = 'http://' + window.location.host;
        this.videoWsUrl = 'ws://localhost:9997';

        this.initElements();
        this.initControls();
        this.checkStatus();
    }

    initElements() {
        this.videoFeed = document.getElementById('video-feed');
        this.placeholder = document.getElementById('placeholder');
        this.statusDot = document.getElementById('status-dot');
        this.statusText = document.getElementById('status-text');
        this.fpsStat = document.getElementById('fps-stat');
        this.resStat = document.getElementById('res-stat');
        this.startBtn = document.getElementById('btn-start');
        this.startIcon = document.getElementById('start-icon');
        this.startText = document.getElementById('start-text');
        this.recordBar = document.getElementById('record-bar');
        this.recordCount = document.getElementById('record-count');
    }

    initControls() {
        // Source selection
        document.getElementById('source-select').addEventListener('change', (e) => {
            this.source = e.target.value;
            if (this.streaming) {
                this.stop();
            }
        });

        // Start/Stop
        this.startBtn.addEventListener('click', () => this.toggleStream());

        // Settings
        document.getElementById('fps-select').addEventListener('change', (e) => {
            this.fps = parseInt(e.target.value);
            if (this.streaming && this.source === 'http') {
                clearInterval(this.frameInterval);
                this.frameInterval = setInterval(() => this.fetchFrame(), 1000 / this.fps);
            }
        });

        document.getElementById('quality-select').addEventListener('change', (e) => {
            this.quality = parseInt(e.target.value);
        });

        document.getElementById('scale-select').addEventListener('change', (e) => {
            this.scale = parseFloat(e.target.value);
        });

        // Snapshot
        document.getElementById('btn-snapshot').addEventListener('click', () => this.takeSnapshot());

        // Recording
        document.getElementById('btn-record').addEventListener('click', () => this.toggleRecording());
        document.getElementById('btn-save-recording').addEventListener('click', () => this.saveRecording());
        document.getElementById('btn-stop-recording').addEventListener('click', () => this.stopRecording());

        // Picture-in-Picture
        document.getElementById('btn-pip').addEventListener('click', () => this.togglePiP());

        // Fullscreen
        document.getElementById('btn-fullscreen').addEventListener('click', () => this.toggleFullscreen());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
            if (e.key === ' ') { e.preventDefault(); this.toggleStream(); }
            if (e.key === 'f') this.toggleFullscreen();
            if (e.key === 's') this.takeSnapshot();
            if (e.key === 'r') this.toggleRecording();
        });
    }

    async checkStatus() {
        try {
            const response = await fetch(this.apiUrl + '/api/video/status');
            const data = await response.json();
            this.statusText.textContent = data.ready ? 'Ready' : 'MSFS not found';
            this.statusDot.classList.toggle('error', !data.ready);
        } catch (e) {
            this.statusText.textContent = 'Server offline';
            this.statusDot.classList.add('error');
        }
    }

    toggleStream() {
        if (this.streaming) {
            this.stop();
        } else {
            this.start();
        }
    }

    start() {
        this.streaming = true;
        this.startIcon.textContent = '⏹';
        this.startText.textContent = 'Stop';
        this.startBtn.classList.add('active');
        this.statusDot.classList.add('connecting');
        this.statusText.textContent = 'Connecting...';

        if (this.source === 'http') {
            this.startHttpPolling();
        } else {
            this.startWebSocket();
        }
    }

    stop() {
        this.streaming = false;
        this.startIcon.textContent = '▶';
        this.startText.textContent = 'Start';
        this.startBtn.classList.remove('active');
        this.statusDot.classList.remove('live', 'connecting');
        this.statusText.textContent = 'Stopped';
        this.fpsStat.textContent = '-- FPS';

        if (this.frameInterval) {
            clearInterval(this.frameInterval);
            this.frameInterval = null;
        }

        if (this.videoWs) {
            this.videoWs.send(JSON.stringify({ type: 'stop' }));
        }
    }

    // HTTP Polling Mode
    startHttpPolling() {
        this.frameInterval = setInterval(() => this.fetchFrame(), 1000 / this.fps);
        this.fetchFrame();
    }

    async fetchFrame() {
        if (!this.streaming) return;

        try {
            const timestamp = Date.now();
            const url = `${this.apiUrl}/api/video/frame?quality=${this.quality}&scale=${this.scale}&t=${timestamp}`;
            const response = await fetch(url);

            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);

                this.videoFeed.onload = () => URL.revokeObjectURL(url);
                this.videoFeed.src = url;
                this.videoFeed.classList.add('active');
                this.placeholder.classList.add('hidden');

                this.frameCount++;
                this.updateFpsDisplay();

                this.statusDot.classList.remove('connecting');
                this.statusDot.classList.add('live');
                this.statusText.textContent = 'Live';

                // Record frame if recording
                if (this.recording) {
                    this.recordFrame(blob);
                }
            }
        } catch (e) {
            console.error('Frame fetch error:', e);
            this.statusDot.classList.remove('live');
            this.statusDot.classList.add('error');
            this.statusText.textContent = 'Error';
        }
    }

    // WebSocket Mode (separate video stream on port 9997)
    startWebSocket() {
        this.videoWs = new WebSocket(this.videoWsUrl);
        this.videoWs.binaryType = 'arraybuffer';

        this.videoWs.onopen = () => {
            this.videoWs.send(JSON.stringify({ type: 'start' }));
            this.statusDot.classList.remove('connecting');
            this.statusDot.classList.add('live');
            this.statusText.textContent = 'Live (WS)';
        };

        this.videoWs.onmessage = (e) => {
            if (typeof e.data === 'string') {
                try {
                    const msg = JSON.parse(e.data);
                    if (msg.type === 'disconnected') {
                        this.statusText.textContent = 'Capture disconnected';
                        this.statusDot.classList.remove('live');
                        this.statusDot.classList.add('error');
                    }
                } catch (err) {
                    if (window.telemetry) {
                        telemetry.captureError(err, {
                            operation: 'videoWsMessage',
                            glass: 'video-viewer'
                        });
                    }
                }
            } else {
                this.handleWsFrame(e.data);
            }
        };

        this.videoWs.onclose = () => {
            if (this.streaming && !this._destroyed) {
                this.statusText.textContent = 'Reconnecting...';
                this.statusDot.classList.remove('live');
                this.statusDot.classList.add('connecting');
                setTimeout(() => {
                    if (this.streaming && !this._destroyed) this.startWebSocket();
                }, 2000);
            }
        };

        this.videoWs.onerror = () => {
            this.statusText.textContent = 'WebSocket error';
            this.statusDot.classList.add('error');
        };
    }

    handleWsFrame(data) {
        if (!this.pendingHeader) {
            // Header: size(4) + width(2) + height(2)
            const view = new DataView(data);
            this.pendingHeader = {
                size: view.getUint32(0, true),
                width: view.getUint16(4, true),
                height: view.getUint16(6, true)
            };
        } else {
            // JPEG data
            const blob = new Blob([data], { type: 'image/jpeg' });
            const url = URL.createObjectURL(blob);

            this.videoFeed.onload = () => URL.revokeObjectURL(url);
            this.videoFeed.src = url;
            this.videoFeed.classList.add('active');
            this.placeholder.classList.add('hidden');

            this.resStat.textContent = `${this.pendingHeader.width}x${this.pendingHeader.height}`;
            this.frameCount++;
            this.updateFpsDisplay();

            if (this.recording) {
                this.recordFrame(blob);
            }

            this.pendingHeader = null;
        }
    }

    updateFpsDisplay() {
        const now = Date.now();
        const elapsed = now - this.lastFpsUpdate;

        if (elapsed >= 1000) {
            const fps = Math.round(this.frameCount * 1000 / elapsed);
            this.fpsStat.textContent = fps + ' FPS';
            this.frameCount = 0;
            this.lastFpsUpdate = now;
        }
    }

    // Snapshot
    takeSnapshot() {
        if (!this.videoFeed.src) return;

        const canvas = document.createElement('canvas');
        canvas.width = this.videoFeed.naturalWidth;
        canvas.height = this.videoFeed.naturalHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.videoFeed, 0, 0);

        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'msfs-snapshot-' + new Date().toISOString().replace(/[:.]/g, '-') + '.jpg';
            a.click();
            URL.revokeObjectURL(url);
        }, 'image/jpeg', 0.95);
    }

    // Recording
    toggleRecording() {
        if (this.recording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    startRecording() {
        this.recording = true;
        this.recordedFrames = [];
        this.recordBar.classList.remove('hidden');
        document.getElementById('btn-record').classList.add('recording');
        this.updateRecordCount();
    }

    stopRecording() {
        this.recording = false;
        document.getElementById('btn-record').classList.remove('recording');
    }

    recordFrame(blob) {
        this.recordedFrames.push({
            blob: blob,
            timestamp: Date.now()
        });
        this.updateRecordCount();
    }

    updateRecordCount() {
        this.recordCount.textContent = this.recordedFrames.length;
    }

    async saveRecording() {
        if (this.recordedFrames.length === 0) return;

        this.stopRecording();

        // Create ZIP file with frames
        const filename = 'msfs-recording-' + new Date().toISOString().replace(/[:.]/g, '-');

        // Simple approach: download as individual files or create animated GIF
        // For now, download first frame as sample
        if (this.recordedFrames.length > 0) {
            const url = URL.createObjectURL(this.recordedFrames[0].blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename + '-frame1.jpg';
            a.click();
            URL.revokeObjectURL(url);

            alert(`Recorded ${this.recordedFrames.length} frames. First frame saved.\n\nFull recording export coming soon.`);
        }

        this.recordedFrames = [];
        this.recordBar.classList.add('hidden');
        this.updateRecordCount();
    }

    // Picture-in-Picture
    async togglePiP() {
        // Create video element for PiP (img doesn't support PiP directly)
        const canvas = document.createElement('canvas');
        const video = document.createElement('video');

        canvas.width = this.videoFeed.naturalWidth || 640;
        canvas.height = this.videoFeed.naturalHeight || 480;

        const ctx = canvas.getContext('2d');
        const stream = canvas.captureStream(this.fps);
        video.srcObject = stream;

        // Update canvas with current frame
        const updateCanvas = () => {
            if (this.videoFeed.complete && this.videoFeed.naturalWidth > 0) {
                ctx.drawImage(this.videoFeed, 0, 0, canvas.width, canvas.height);
            }
            if (document.pictureInPictureElement === video) {
                requestAnimationFrame(updateCanvas);
            }
        };

        try {
            await video.play();
            await video.requestPictureInPicture();
            document.body.classList.add('pip-active');
            updateCanvas();

            video.addEventListener('leavepictureinpicture', () => {
                document.body.classList.remove('pip-active');
                stream.getTracks().forEach(t => t.stop());
            });
        } catch (e) {
            console.error('PiP error:', e);
            alert('Picture-in-Picture not supported or denied');
        }
    }

    // Fullscreen
    toggleFullscreen() {
        const container = document.querySelector('.video-viewer');
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            container.requestFullscreen();
        }
    }

    destroy() {
        if (this.frameInterval) {
            clearInterval(this.frameInterval);
            this.frameInterval = null;
        }

        if (this.videoWs) {
            this.videoWs.onclose = null;
            this.videoWs.close();
            this.videoWs = null;
        }

        this.streaming = false;

        // Call parent destroy for main WebSocket cleanup
        super.destroy();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.videoViewer = new VideoViewer();
    window.addEventListener('beforeunload', () => window.videoViewer?.destroy());
});
