# SimGlass Test Framework v1.0.0

Automated testing for SimGlass Engine components.

## Usage

### NPM Scripts
```bash
npm test              # Run all tests
npm run test:api      # API tests only
npm run test:ws       # WebSocket tests only
npm run test:widgets  # Widget accessibility tests
```

### Direct
```bash
node tests/test-runner.js [api|websocket|widgets]
```

### Batch File
Double-click `run-tests.bat`

## Test Suites

### API Tests
- GET /api/status
- GET /api/keymaps
- POST /api/command
- POST /api/sendkey
- GET /api/camsys/status
- GET /api/debug/keysender
- POST /api/recorder/slew
- POST /api/recorder/position

### WebSocket Tests
- Connection establishment
- JSON message format
- flightData message structure
- Required fields (altitude, speed, heading, lat, lon)

### Widget Tests
- All widget directories accessible via HTTP
- Shared resources directory

## Requirements
- Server must be running on port 8080
- ws package (already in dependencies)

## Adding Tests
Edit `test-runner.js` and add assertions using:
```javascript
assert(condition, 'Test description');
```
