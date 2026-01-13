@echo off
title SimWidget Engine - Production Mode
cd /d "%~dp0"

echo ========================================
echo    SimWidget Engine - Production Mode
echo ========================================
echo.
echo 🚀 Production mode (no hot reload)
echo 🌐 Server: http://localhost:8080
echo.
echo Press Ctrl+C to stop
echo ========================================
echo.

set "PATH=%PATH%;C:\Program Files\nodejs"
set "NODE_ENV=production"

call npm install --silent
node backend/server.js

pause