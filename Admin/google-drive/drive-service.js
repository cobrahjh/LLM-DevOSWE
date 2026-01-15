/**
 * Kitt Google Drive Service
 * Direct API access to Google Drive for document backup
 *
 * Setup:
 * 1. Go to https://console.cloud.google.com
 * 2. Create project "Kitt-Drive"
 * 3. Enable "Google Drive API" and "Google Docs API"
 * 4. Create OAuth credentials (Desktop app)
 * 5. Download credentials.json to this folder
 * 6. Run: node drive-service.js auth
 *
 * Port: 8621
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { google } = require('googleapis');

const PORT = 8621;
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/documents'
];

let authClient = null;

// Load or create OAuth client
async function getAuthClient() {
    if (authClient) return authClient;

    if (!fs.existsSync(CREDENTIALS_PATH)) {
        throw new Error('credentials.json not found. See setup instructions.');
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Check for existing token
    if (fs.existsSync(TOKEN_PATH)) {
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
        oAuth2Client.setCredentials(token);
        authClient = oAuth2Client;
        return authClient;
    }

    throw new Error('Not authenticated. Run: node drive-service.js auth');
}

// Interactive authentication
async function authenticate() {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
        console.log('\n=== Google Drive Setup ===\n');
        console.log('1. Go to: https://console.cloud.google.com');
        console.log('2. Create a new project (e.g., "Kitt-Drive")');
        console.log('3. Enable APIs: "Google Drive API" and "Google Docs API"');
        console.log('4. Go to Credentials → Create Credentials → OAuth client ID');
        console.log('5. Application type: Desktop app');
        console.log('6. Download the JSON and save as:');
        console.log(`   ${CREDENTIALS_PATH}`);
        console.log('\n7. Then run this command again.\n');
        return;
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:8621/oauth2callback');

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });

    console.log('\n=== Google Drive Authentication ===\n');
    console.log('Opening browser for authentication...');
    console.log('If browser does not open, visit this URL:\n');
    console.log(authUrl);
    console.log('\n');

    // Start temporary server to receive callback
    return new Promise((resolve) => {
        const server = http.createServer(async (req, res) => {
            if (req.url.startsWith('/oauth2callback')) {
                const url = new URL(req.url, `http://localhost:${PORT}`);
                const code = url.searchParams.get('code');

                if (code) {
                    try {
                        const { tokens } = await oAuth2Client.getToken(code);
                        oAuth2Client.setCredentials(tokens);
                        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end('<h1>Authentication Successful!</h1><p>You can close this window.</p><script>window.close()</script>');

                        console.log('Authentication successful! Token saved.');
                        server.close();
                        resolve(true);
                    } catch (err) {
                        res.writeHead(500);
                        res.end('Authentication failed: ' + err.message);
                        console.error('Auth error:', err);
                        server.close();
                        resolve(false);
                    }
                }
            }
        });

        server.listen(PORT, () => {
            // Open browser
            const { exec } = require('child_process');
            exec(`start "" "${authUrl}"`);
        });
    });
}

// Create a new Google Doc
async function createDocument(title, content = '') {
    const auth = await getAuthClient();
    const docs = google.docs({ version: 'v1', auth });
    const drive = google.drive({ version: 'v3', auth });

    // Create document
    const doc = await docs.documents.create({
        requestBody: { title }
    });

    const docId = doc.data.documentId;
    console.log(`Created document: ${title} (${docId})`);

    // Add content if provided
    if (content) {
        await docs.documents.batchUpdate({
            documentId: docId,
            requestBody: {
                requests: [{
                    insertText: {
                        location: { index: 1 },
                        text: content
                    }
                }]
            }
        });
    }

    return {
        id: docId,
        title,
        url: `https://docs.google.com/document/d/${docId}/edit`
    };
}

// Update document content
async function updateDocument(docId, content, replace = false) {
    const auth = await getAuthClient();
    const docs = google.docs({ version: 'v1', auth });

    // Get current document to find end index
    const doc = await docs.documents.get({ documentId: docId });
    const endIndex = doc.data.body.content
        .filter(c => c.paragraph)
        .reduce((max, c) => Math.max(max, c.endIndex || 0), 1);

    const requests = [];

    // Delete existing content if replacing
    if (replace && endIndex > 2) {
        requests.push({
            deleteContentRange: {
                range: { startIndex: 1, endIndex: endIndex - 1 }
            }
        });
    }

    // Insert new content
    requests.push({
        insertText: {
            location: { index: 1 },
            text: content
        }
    });

    await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: { requests }
    });

    return { success: true, docId };
}

// Read document content
async function readDocument(docId) {
    const auth = await getAuthClient();
    const docs = google.docs({ version: 'v1', auth });

    const doc = await docs.documents.get({ documentId: docId });

    // Extract text from document
    let text = '';
    for (const element of doc.data.body.content) {
        if (element.paragraph) {
            for (const el of element.paragraph.elements) {
                if (el.textRun) {
                    text += el.textRun.content;
                }
            }
        }
    }

    return {
        id: docId,
        title: doc.data.title,
        content: text
    };
}

// List recent documents
async function listDocuments(pageSize = 10) {
    const auth = await getAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    const res = await drive.files.list({
        pageSize,
        q: "mimeType='application/vnd.google-apps.document'",
        fields: 'files(id, name, webViewLink, modifiedTime)',
        orderBy: 'modifiedTime desc'
    });

    return res.data.files.map(f => ({
        id: f.id,
        title: f.name,
        url: f.webViewLink,
        modified: f.modifiedTime
    }));
}

// Upload file to Drive
async function uploadFile(filePath, folderId = null) {
    const auth = await getAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    const fileName = path.basename(filePath);
    const mimeType = getMimeType(filePath);

    const fileMetadata = { name: fileName };
    if (folderId) fileMetadata.parents = [folderId];

    const media = {
        mimeType,
        body: fs.createReadStream(filePath)
    };

    const file = await drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id, name, webViewLink'
    });

    return {
        id: file.data.id,
        name: file.data.name,
        url: file.data.webViewLink
    };
}

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.txt': 'text/plain',
        '.md': 'text/markdown',
        '.json': 'application/json',
        '.js': 'application/javascript',
        '.html': 'text/html',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.pdf': 'application/pdf'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

// HTTP API Server
function startServer() {
    const server = http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        let body = '';
        if (req.method === 'POST') {
            for await (const chunk of req) body += chunk;
        }
        const params = body ? JSON.parse(body) : {};

        try {
            let result;

            switch (req.url.split('?')[0]) {
                case '/status':
                    const hasCredentials = fs.existsSync(CREDENTIALS_PATH);
                    const hasToken = fs.existsSync(TOKEN_PATH);
                    result = {
                        authenticated: hasCredentials && hasToken,
                        credentialsPath: CREDENTIALS_PATH,
                        tokenPath: TOKEN_PATH
                    };
                    break;

                case '/create':
                    result = await createDocument(params.title, params.content);
                    break;

                case '/update':
                    result = await updateDocument(params.docId, params.content, params.replace);
                    break;

                case '/read':
                    result = await readDocument(params.docId);
                    break;

                case '/list':
                    result = await listDocuments(params.pageSize || 10);
                    break;

                case '/upload':
                    result = await uploadFile(params.filePath, params.folderId);
                    break;

                default:
                    res.writeHead(404);
                    res.end(JSON.stringify({ error: 'Not found' }));
                    return;
            }

            res.writeHead(200);
            res.end(JSON.stringify(result, null, 2));

        } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
        }
    });

    server.listen(PORT, () => {
        console.log('='.repeat(50));
        console.log('Kitt Google Drive Service v1.0.0');
        console.log(`HTTP API: http://localhost:${PORT}`);
        console.log('='.repeat(50));
        console.log('');
        console.log('API Endpoints:');
        console.log('  GET  /status  - Check authentication');
        console.log('  POST /create  - {title, content?}');
        console.log('  POST /update  - {docId, content, replace?}');
        console.log('  POST /read    - {docId}');
        console.log('  GET  /list    - List recent documents');
        console.log('  POST /upload  - {filePath, folderId?}');
    });
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
    case 'auth':
        authenticate();
        break;
    case 'server':
    case 'start':
        startServer();
        break;
    case 'create':
        getAuthClient().then(() => {
            createDocument(args[1] || 'Untitled', args[2] || '')
                .then(doc => console.log('Created:', doc.url))
                .catch(err => console.error('Error:', err.message));
        }).catch(err => console.error(err.message));
        break;
    case 'list':
        getAuthClient().then(() => {
            listDocuments()
                .then(docs => docs.forEach(d => console.log(`${d.title}: ${d.url}`)))
                .catch(err => console.error('Error:', err.message));
        }).catch(err => console.error(err.message));
        break;
    default:
        console.log('Kitt Google Drive Service');
        console.log('');
        console.log('Commands:');
        console.log('  node drive-service.js auth     - Authenticate with Google');
        console.log('  node drive-service.js server   - Start HTTP API server');
        console.log('  node drive-service.js create   - Create a document');
        console.log('  node drive-service.js list     - List recent documents');
}
