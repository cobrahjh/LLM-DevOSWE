@echo off
title AI-PC Hive Node Setup
color 0D

echo.
echo  ========================================
echo     AI-PC HIVE NODE SETUP
echo  ========================================
echo.
echo  This script configures ai-pc as a Hive node
echo  Role: AI Backup + Vision Processing
echo.

:: Check if running on ai-pc
hostname | findstr /i "ai-pc" >nul
if %errorLevel% neq 0 (
    echo  WARNING: This doesn't appear to be ai-pc
    echo  Hostname: %COMPUTERNAME%
    echo.
    set /p CONTINUE="Continue anyway? (y/n): "
    if /i not "%CONTINUE%"=="y" exit /b 1
)

echo  [1/5] Checking Node.js...
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo  ERROR: Node.js not found. Please install Node.js 20+
    echo  https://nodejs.org/
    pause
    exit /b 1
)
echo        Node.js:
node --version

echo.
echo  [2/5] Checking LM Studio...
curl -s http://localhost:1234/v1/models >nul 2>&1
if %errorLevel% equ 0 (
    echo        LM Studio: RUNNING
) else (
    echo        LM Studio: NOT RUNNING
    echo        Please start LM Studio with a model loaded
)

echo.
echo  [3/5] Creating Hive directories...
mkdir C:\Hive 2>nul
mkdir C:\Hive\services 2>nul
mkdir C:\Hive\logs 2>nul
mkdir C:\Hive\data 2>nul
echo        Created C:\Hive\

echo.
echo  [4/5] Creating Hive Bridge service...

:: Create a simple bridge that exposes LM Studio to the Hive
(
echo const http = require('http'^);
echo const https = require('https'^);
echo.
echo const PORT = 3003;
echo const LM_STUDIO_URL = 'http://localhost:1234';
echo.
echo const server = http.createServer^(async ^(req, res^) =^> {
echo     // CORS headers
echo     res.setHeader^('Access-Control-Allow-Origin', '*'^);
echo     res.setHeader^('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'^);
echo     res.setHeader^('Access-Control-Allow-Headers', 'Content-Type'^);
echo.
echo     if ^(req.method === 'OPTIONS'^) {
echo         res.writeHead^(204^);
echo         res.end^(^);
echo         return;
echo     }
echo.
echo     // Health check
echo     if ^(req.url === '/api/health'^) {
echo         res.writeHead^(200, { 'Content-Type': 'application/json' }^);
echo         res.end^(JSON.stringify^({ status: 'ok', node: 'ai-pc', role: 'vision-ai' }^)^);
echo         return;
echo     }
echo.
echo     // Proxy to LM Studio
echo     if ^(req.url.startsWith^('/v1/'^)^) {
echo         let body = '';
echo         req.on^('data', chunk =^> body += chunk^);
echo         req.on^('end', ^(^) =^> {
echo             const options = {
echo                 hostname: 'localhost',
echo                 port: 1234,
echo                 path: req.url,
echo                 method: req.method,
echo                 headers: { 'Content-Type': 'application/json' }
echo             };
echo             const proxyReq = http.request^(options, proxyRes =^> {
echo                 res.writeHead^(proxyRes.statusCode, proxyRes.headers^);
echo                 proxyRes.pipe^(res^);
echo             }^);
echo             proxyReq.on^('error', ^(^) =^> {
echo                 res.writeHead^(502^);
echo                 res.end^('LM Studio unavailable'^);
echo             }^);
echo             if ^(body^) proxyReq.write^(body^);
echo             proxyReq.end^(^);
echo         }^);
echo         return;
echo     }
echo.
echo     res.writeHead^(404^);
echo     res.end^('Not Found'^);
echo }^);
echo.
echo server.listen^(PORT, '0.0.0.0', ^(^) =^> {
echo     console.log^(`AI-PC Hive Bridge running on port ${PORT}`^);
echo     console.log^('Proxying to LM Studio at localhost:1234'^);
echo }^);
) > C:\Hive\services\hive-bridge.js

echo        Created hive-bridge.js

echo.
echo  [5/5] Creating startup script...
(
echo @echo off
echo title AI-PC Hive Bridge
echo echo Starting AI-PC Hive Bridge...
echo node C:\Hive\services\hive-bridge.js
echo pause
) > C:\Hive\start-hive-bridge.bat

echo        Created start-hive-bridge.bat

echo.
echo  ========================================
echo     AI-PC SETUP COMPLETE
echo  ========================================
echo.
echo  Services:
echo    LM Studio:    http://localhost:1234 (manual start)
echo    Hive Bridge:  http://localhost:3003 (run start-hive-bridge.bat)
echo.
echo  To start:
echo    1. Start LM Studio and load qwen3-vl-4b
echo    2. Run C:\Hive\start-hive-bridge.bat
echo.
echo  To verify from Harold-PC:
echo    curl http://192.168.1.162:3003/api/health
echo    curl http://192.168.1.162:1234/v1/models
echo.
pause
