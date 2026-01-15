# Kitt Google Drive Service

Direct API access to Google Drive for document backup and management.

## Quick Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project: **Kitt-Drive**
3. Enable APIs:
   - Google Drive API
   - Google Docs API

### 2. Create OAuth Credentials

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Desktop app**
4. Name: **Kitt Desktop**
5. Click **Create**
6. Download JSON and save as:
   ```
   C:\LLM-DevOSWE\Admin\google-drive\credentials.json
   ```

### 3. Authenticate

```bash
cd C:\LLM-DevOSWE\Admin\google-drive
node drive-service.js auth
```

Browser opens → Sign in with Google → Authorize → Done!

### 4. Start Service

```bash
node drive-service.js server
```

## API Reference (Port 8621)

### GET /status
Check authentication status.
```bash
curl http://localhost:8621/status
```

### POST /create
Create a new Google Doc.
```bash
curl -X POST http://localhost:8621/create \
  -H "Content-Type: application/json" \
  -d '{"title": "My Document", "content": "Hello World"}'
```

### POST /update
Update document content.
```bash
curl -X POST http://localhost:8621/update \
  -H "Content-Type: application/json" \
  -d '{"docId": "abc123", "content": "New content", "replace": true}'
```

### POST /read
Read document content.
```bash
curl -X POST http://localhost:8621/read \
  -H "Content-Type: application/json" \
  -d '{"docId": "abc123"}'
```

### GET /list
List recent documents.
```bash
curl http://localhost:8621/list
```

### POST /upload
Upload file to Drive.
```bash
curl -X POST http://localhost:8621/upload \
  -H "Content-Type: application/json" \
  -d '{"filePath": "C:/path/to/file.txt"}'
```

## CLI Commands

```bash
# Authenticate with Google
node drive-service.js auth

# Start HTTP API server
node drive-service.js server

# Create a document
node drive-service.js create "Title" "Content"

# List recent documents
node drive-service.js list
```

## Integration with Kitt

The service runs on port 8621 and can be called from any part of the Kitt system:

```javascript
// Create document
await fetch('http://localhost:8621/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Backup', content: 'Data...' })
});

// Update existing document
await fetch('http://localhost:8621/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ docId: 'xyz', content: 'Updated', replace: true })
});
```

## Security Notes

- OAuth tokens stored locally in `token.json`
- Only accesses files created by this app (drive.file scope)
- No access to your entire Drive
- Credentials never leave your machine
