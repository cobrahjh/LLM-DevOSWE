@echo off
title Hive Session Startup
echo ========================================
echo   Starting Hive Session
echo ========================================
echo.

:: Start Orchestrator (manages 16 services)
echo [1/4] Starting Orchestrator...
start /min cmd /c "cd /d C:\LLM-DevOSWE\Admin\orchestrator && node orchestrator.js"
timeout /t 3 /nobreak >nul

:: Start Relay
echo [2/4] Starting Relay...
start /min cmd /c "cd /d C:\LLM-DevOSWE\Admin\relay && node relay.js"
timeout /t 2 /nobreak >nul

:: Start Dictation Relay Dashboard
echo [3/4] Starting Rock-PC Dashboard (port 8765)...
start /min cmd /c "cd /d C:\DevClaude\Hivemind\voice\dictation-relay && node dashboard.js"
timeout /t 2 /nobreak >nul

:: Wait for services to initialize
echo [4/4] Waiting for services to initialize...
timeout /t 10 /nobreak >nul

:: Open dashboards
echo.
echo Opening dashboards...
start "" "http://localhost:8899"
start "" "http://localhost:8765"

echo.
echo ========================================
echo   Session Ready!
echo ========================================
echo.
echo   Hive Dashboard:  http://localhost:8899
echo   Rock-PC Dashboard: http://localhost:8765
echo   Orchestrator:    http://localhost:8500
echo.
pause
