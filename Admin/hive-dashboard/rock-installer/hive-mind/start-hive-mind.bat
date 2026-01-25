@echo off
title Hive-Mind Monitor
color 0D
cd /d %~dp0

echo.
echo  Starting Hive-Mind Monitor...
echo.

:: Check if already running
netstat -ano | findstr :8700 | findstr LISTENING >nul 2>&1
if %errorLevel%==0 (
    echo  Already running on port 8700
    start http://localhost:8700
    timeout /t 2 /nobreak >nul
    exit /b
)

:: Start server and open browser
start /B node hive-mind-server.js
timeout /t 2 /nobreak >nul
start http://localhost:8700

echo  Hive-Mind running at http://localhost:8700
pause
