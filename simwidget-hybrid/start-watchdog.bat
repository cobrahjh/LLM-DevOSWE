@echo off
REM Start SimGlass Watchdog — serves diagnostic pages on port 8082
REM Keep this running independently of the main server

echo Starting SimGlass Watchdog on port 8082...
cd /d C:\LLM-DevOSWE\simwidget-hybrid\backend
start "SimGlass Watchdog" node watchdog.js

echo.
echo Watchdog running: http://localhost:8082/
echo Sally diagnostics available even when main server is offline.
echo.
