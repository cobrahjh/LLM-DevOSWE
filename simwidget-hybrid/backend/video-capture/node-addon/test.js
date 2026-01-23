// Test the native screen capture addon

const capture = require('./index');

console.log('Screen Capture Native Addon Test');
console.log('================================\n');

// Test initialization
console.log('Initializing...');
try {
    const success = capture.initialize();
    console.log('Initialized:', success);

    const info = capture.getInfo();
    console.log('Screen size:', info.width, 'x', info.height);
    console.log();

    // Benchmark
    console.log('Running benchmark (100 frames)...');
    const frames = 100;
    const startTime = Date.now();

    for (let i = 0; i < frames; i++) {
        const buffer = capture.captureFrame();
        if (buffer) {
            const frame = capture.parseFrame(buffer);
            if (i % 20 === 0) {
                console.log(`Frame ${i}: ${frame.width}x${frame.height}, ${buffer.length} bytes`);
            }
        }
    }

    const elapsed = Date.now() - startTime;
    const fps = Math.round(frames * 1000 / elapsed);
    console.log();
    console.log(`Captured ${frames} frames in ${elapsed}ms`);
    console.log(`Average: ${fps} FPS (${Math.round(elapsed / frames)}ms per frame)`);

    // Cleanup
    capture.cleanup();
    console.log('\nCleanup complete');

} catch (e) {
    console.error('Error:', e.message);
    console.log('\nMake sure to build the addon first:');
    console.log('  npm install');
    console.log('  npm run build');
}
