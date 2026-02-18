@echo off
REM SimGlass Server Restart Script
REM Kills only the port-8080 process — watchdog on 8082 stays running

echo Stopping SimGlass server (port 8080)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080 " ^| findstr LISTENING') do (
    taskkill /F /PID %%a 2>nul
)

echo Waiting 2 seconds...
timeout /t 2 /nobreak >nul

echo Starting SimGlass server...
cd /d C:\LLM-DevOSWE\simwidget-hybrid\backend
start "SimGlass Server" node server.js

echo.
echo Server starting...
echo Main server:      http://localhost:8080/api/status
echo Watchdog (always available): http://localhost:8082/
echo.
pause
