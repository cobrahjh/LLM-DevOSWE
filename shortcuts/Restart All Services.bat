@echo off
title Hive - Restart All Services
echo ========================================
echo   Restarting All Hive Services
echo ========================================
echo.

echo Requesting restart-all via Master-O...
curl -s -X POST http://localhost:8500/api/start-all >nul 2>&1
if "%ERRORLEVEL%"=="0" (
    echo   Master-O is restarting all services...
    echo   Wait 30 seconds then check Dashboard: http://localhost:8899
) else (
    echo   Master-O not responding. Falling back to start-hive.bat...
    call "%~dp0..\start-hive.bat"
)

echo.
pause
