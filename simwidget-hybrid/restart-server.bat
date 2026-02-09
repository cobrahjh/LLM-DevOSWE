@echo off
REM SimGlass Server Restart Script
REM Run as Administrator

echo Stopping SimGlass server...
taskkill /F /IM node.exe 2>nul

echo Waiting 2 seconds...
timeout /t 2 /nobreak >nul

echo Starting SimGlass server...
echo Remote SimConnect: harold-pc (192.168.1.42:500)
cd /d C:\LLM-DevOSWE\simwidget-hybrid\backend
start "SimGlass Server" node server.js

echo.
echo Server starting...
echo Check status: http://localhost:8080/api/status
echo Test page: http://localhost:8080/ui/test-remote-access.html
echo.
pause
