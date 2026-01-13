@echo off
title SimWidget Engine - Hot Reload Mode
cd /d "%~dp0"

echo ========================================
echo    SimWidget Engine - Development Mode
echo ========================================
echo.
echo 🔥 Hot reload enabled
echo 📂 Watching: backend/, ui/, config/, shared-ui/
echo 🌐 Server: http://localhost:8080
echo.
echo Press Ctrl+C to stop
echo ========================================
echo.

set "PATH=%PATH%;C:\Program Files\nodejs"
set "NODE_ENV=development"
set "HOT_RELOAD=true"

npx nodemon backend/server.js