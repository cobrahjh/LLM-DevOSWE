# Device Token Authentication - Relay Gateway

**Pattern**: OpenClaw gateway authentication
**Service**: Relay (:8600)
**Status**: ✅ Implemented, ready for testing

---

## Overview

Secure token-based authentication for remote device access to Hive services via Relay. Based on OpenClaw's gateway pattern with device pairing workflow.

### Features

- 🔐 Secure random tokens (32-byte hex = 64 characters)
- ⏰ Configurable expiry (default: 30 days)
- 🔄 Auto-tracking of last used time
- 🚫 Token revocation support
- 📱 Multi-device management
- 🛡️ Permission-based access control (future)

---

## Database Schema

**Table**: `device_tokens`

```sql
CREATE TABLE device_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,           -- 64-char hex token
    device_name TEXT,                     -- "Harold's iPhone", "ROCK-PC Remote"
    device_info TEXT,                     -- User agent, OS, app version
    created_at INTEGER NOT NULL,          -- Unix timestamp
    expires_at INTEGER NOT NULL,          -- Unix timestamp
    last_used_at INTEGER,                 -- Auto-updated on each request
    revoked INTEGER DEFAULT 0,            -- 0=active, 1=revoked
    permissions TEXT DEFAULT '[]'         -- JSON array of permissions
);
```

**Indexes:**
- `idx_device_tokens_token` - Fast token lookup
- `idx_device_tokens_expires` - Efficient expiry checks

---

## API Endpoints

### Pair New Device

**Create token for remote access:**

```bash
POST /api/auth/pair-device
Content-Type: application/json

{
  "deviceName": "Harold's iPhone",
  "deviceInfo": "iOS 17.2, Hive Mobile v1.0",
  "expiryDays": 30,
  "permissions": ["read", "write", "alerts"]
}
```

**Response:**
```json
{
  "success": true,
  "token": "a1b2c3d4e5f6...64-char-hex-token",
  "expiresIn": "30 days",
  "expiresAt": "2026-03-11T08:00:00Z",
  "deviceName": "Harold's iPhone",
  "usage": {
    "header": "X-Device-Token: a1b2c3d4...",
    "query": "?deviceToken=a1b2c3d4..."
  }
}
```

### List Devices

**View all paired devices:**

```bash
GET /api/auth/devices
```

**Response:**
```json
{
  "devices": [
    {
      "id": 1,
      "name": "Harold's iPhone",
      "info": "iOS 17.2, Hive Mobile v1.0",
      "createdAt": "2026-02-09T08:00:00Z",
      "expiresAt": "2026-03-11T08:00:00Z",
      "lastUsed": "2026-02-09T12:30:00Z",
      "isExpired": false,
      "isRevoked": false,
      "permissions": ["read", "write", "alerts"],
      "status": "active"
    }
  ],
  "total": 1,
  "active": 1
}
```

### Revoke Token

**Immediately invalidate a device:**

```bash
POST /api/auth/devices/:id/revoke
```

**Response:**
```json
{
  "success": true,
  "id": 1
}
```

### Cleanup Expired Tokens

**Remove expired/revoked tokens from database:**

```bash
POST /api/auth/cleanup
```

**Response:**
```json
{
  "success": true,
  "removed": 5
}
```

### Validate Token

**Test if token is valid:**

```bash
GET /api/auth/validate
X-Device-Token: your-token-here
```

**Response:**
```json
{
  "valid": true,
  "device": {
    "id": 1,
    "name": "Harold's iPhone",
    "permissions": ["read", "write", "alerts"],
    "expiresAt": "2026-03-11T08:00:00Z"
  }
}
```

---

## Usage

### Creating a Token

```bash
# Pair new device
curl -X POST http://localhost:8600/api/auth/pair-device \
  -H "Content-Type: application/json" \
  -d '{
    "deviceName": "Mobile App",
    "deviceInfo": "Hive Mobile v1.0",
    "expiryDays": 30
  }'

# Save the token from response
TOKEN="a1b2c3d4e5f6..."
```

### Using a Token

**Option 1: Header (Recommended)**
```bash
curl http://localhost:8600/api/queue/pending \
  -H "X-Device-Token: $TOKEN"
```

**Option 2: Query Parameter**
```bash
curl "http://localhost:8600/api/queue/pending?deviceToken=$TOKEN"
```

### Managing Tokens

```bash
# List all devices
curl http://localhost:8600/api/auth/devices

# Revoke a device
curl -X POST http://localhost:8600/api/auth/devices/1/revoke

# Clean up expired tokens
curl -X POST http://localhost:8600/api/auth/cleanup
```

---

## Integration Examples

### Mobile App Integration

```javascript
// Store token securely
const DEVICE_TOKEN = await SecureStore.getItemAsync('hive_device_token');

// Include in all API requests
const response = await fetch('http://hive.local/relay/api/queue/pending', {
  headers: {
    'X-Device-Token': DEVICE_TOKEN
  }
});
```

### Web Dashboard Integration

```javascript
// Pair device on first launch
async function pairDevice() {
  const response = await fetch('http://localhost:8600/api/auth/pair-device', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceName: navigator.userAgent,
      deviceInfo: `${navigator.platform} - ${navigator.vendor}`,
      expiryDays: 365
    })
  });

  const { token } = await response.json();
  localStorage.setItem('hive_device_token', token);
  return token;
}

// Use token for all requests
const token = localStorage.getItem('hive_device_token');
fetch(url, {
  headers: { 'X-Device-Token': token }
});
```

### Mobile Companion Glass

```javascript
// Add to mobile-companion glass
class MobileCompanionGlass extends SimGlassBase {
    async init() {
        // Get or create device token
        this.deviceToken = localStorage.getItem('hive_mobile_token');

        if (!this.deviceToken) {
            this.deviceToken = await this.pairDevice();
        }

        // Use token for all Relay API calls
        this.relayHeaders = {
            'X-Device-Token': this.deviceToken
        };
    }

    async pairDevice() {
        const response = await fetch('http://localhost:8600/api/auth/pair-device', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceName: 'Mobile Companion Glass',
                deviceInfo: navigator.userAgent,
                expiryDays: 90,
                permissions': ['read', 'write', 'alerts']
            })
        });

        const { token } = await response.json();
        localStorage.setItem('hive_mobile_token', token);
        return token;
    }

    async fetchRelayData(endpoint) {
        return fetch(`http://localhost:8600${endpoint}`, {
            headers: this.relayHeaders
        });
    }
}
```

---

## Security Considerations

### Token Storage

**DO:**
- ✅ Store in secure storage (iOS Keychain, Android KeyStore)
- ✅ Use HTTPS for token transmission
- ✅ Keep tokens secret (don't log, don't share)

**DON'T:**
- ❌ Store in plain text files
- ❌ Commit tokens to git
- ❌ Share tokens between devices

### Token Lifecycle

**Creation:**
- Tokens generated with crypto.randomBytes(32)
- 64-character hex string (256-bit entropy)
- Cryptographically secure

**Expiry:**
- Default: 30 days
- Configurable per device
- Auto-cleanup available

**Revocation:**
- Immediate invalidation
- Can't be reused after revocation
- Cleanup removes from database

---

## Administration

### View Active Devices

```bash
curl http://localhost:8600/api/auth/devices
```

### Monthly Cleanup

```bash
# Remove expired/revoked tokens
curl -X POST http://localhost:8600/api/auth/cleanup
```

### Emergency Revocation

```bash
# Revoke all tokens for a lost device
curl -X POST http://localhost:8600/api/auth/devices/{id}/revoke
```

---

## Backward Compatibility

**Existing auth still works:**
- API key authentication (HIVE_API_KEY)
- Localhost bypass (127.0.0.1, ::1)
- Local network bypass (192.168.1.x)

**New token auth:**
- Additive (doesn't break existing)
- Optional (can be enabled per device)
- Coexists with API key system

---

## Future Enhancements

### Permission System

**Granular access control:**
```json
{
  "permissions": [
    "tasks:read",
    "tasks:write",
    "alerts:read",
    "alerts:acknowledge",
    "queue:claim",
    "queue:respond"
  ]
}
```

**Middleware enforcement:**
```javascript
function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.devicePermissions.includes(permission)) {
            return res.status(403).json({
                error: 'Forbidden',
                required: permission
            });
        }
        next();
    };
}

// Usage
app.post('/api/queue', requireDeviceToken, requirePermission('tasks:write'), ...);
```

### Rate Limiting

```javascript
// Per-device rate limiting
const rateLimit = new Map();  // deviceId -> { count, resetAt }

function checkRateLimit(deviceId) {
    const limit = rateLimit.get(deviceId);
    if (!limit || Date.now() > limit.resetAt) {
        rateLimit.set(deviceId, { count: 1, resetAt: Date.now() + 60000 });
        return true;
    }

    if (limit.count >= 100) {  // 100 requests per minute
        return false;
    }

    limit.count++;
    return true;
}
```

### Token Rotation

```javascript
// Auto-rotate tokens before expiry
app.post('/api/auth/rotate', requireDeviceToken, (req, res) => {
    const newToken = generateDeviceToken();
    const newExpiry = Date.now() + (30 * 24 * 60 * 60 * 1000);

    db.prepare(`
        UPDATE device_tokens
        SET token = ?, expires_at = ?
        WHERE id = ?
    `).run(newToken, newExpiry, req.device.id);

    res.json({ token: newToken, expiresAt: new Date(newExpiry).toISOString() });
});
```

---

## Testing

### Test Suite

```bash
# 1. Pair device
TOKEN=$(curl -X POST http://localhost:8600/api/auth/pair-device \
  -H "Content-Type: application/json" \
  -d '{"deviceName":"Test"}' | jq -r '.token')

# 2. Validate token
curl http://localhost:8600/api/auth/validate \
  -H "X-Device-Token: $TOKEN"

# 3. Use token for API access
curl http://localhost:8600/api/queue/pending \
  -H "X-Device-Token: $TOKEN"

# 4. List devices
curl http://localhost:8600/api/auth/devices

# 5. Revoke token
curl -X POST http://localhost:8600/api/auth/devices/1/revoke

# 6. Verify revoked
curl http://localhost:8600/api/auth/validate \
  -H "X-Device-Token: $TOKEN"
# Should return 401 Unauthorized
```

---

## Deployment Checklist

- [x] Database table created
- [x] Endpoints implemented
- [x] Middleware created
- [x] Crypto token generation
- [ ] Relay service restarted
- [ ] Integration tested
- [ ] Mobile companion updated
- [ ] Documentation complete
- [ ] Committed to repository

---

## Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/pair-device` | POST | Create new device token |
| `/api/auth/devices` | GET | List all devices |
| `/api/auth/devices/:id/revoke` | POST | Revoke token |
| `/api/auth/cleanup` | POST | Remove expired tokens |
| `/api/auth/validate` | GET | Test token validity |

**Token Usage:**
- Header: `X-Device-Token: {token}`
- Query: `?deviceToken={token}`

**Token Format**: 64-character hexadecimal string

---

**Implementation**: ✅ Complete
**Testing**: ⏳ Requires Relay restart
**Integration**: Ready for mobile companion
**Documentation**: Complete

**Next**: Restart Relay and test token authentication flow.
