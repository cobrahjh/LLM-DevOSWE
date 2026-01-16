@echo off
title Hive Launcher
color 0A

echo.
echo  ========================================
echo        STARTING THE HIVE
echo  ========================================
echo.

:: Check if Ollama is running
echo  [1/5] Checking Ollama...
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I /N "ollama.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo        Ollama is running
) else (
    echo        Starting Ollama...
    start "" "ollama" serve
    timeout /t 2 /nobreak >nul
)

:: Start Oracle
echo  [2/5] Starting Oracle (port 3002)...
start "Oracle [3002]" cmd /k "cd /d C:\LLM-Oracle && color 0D && node oracle.js"
timeout /t 1 /nobreak >nul

:: Start Relay
echo  [3/5] Starting Relay (port 8600)...
start "Relay [8600]" cmd /k "cd /d C:\LLM-DevOSWE\Admin\relay && color 0E && node relay-service.js"
timeout /t 1 /nobreak >nul

:: Start KittBox UI
echo  [4/5] Starting KittBox UI (port 8585)...
start "KittBox [8585]" cmd /k "cd /d C:\LLM-DevOSWE\Admin\agent\agent-ui && color 0B && node agent-server.js"
timeout /t 1 /nobreak >nul

:: Start Kitt Live
echo  [5/6] Starting Kitt Live (port 8686)...
start "Kitt Live [8686]" cmd /k "cd /d C:\kittbox-modules\kitt-live && color 0C && node server.js"
timeout /t 1 /nobreak >nul

:: Start Hive-Mind Monitor
echo  [6/6] Starting Hive-Mind (port 8701)...
start "Hive-Mind [8701]" cmd /k "cd /d C:\LLM-DevOSWE\Admin\hive-mind && color 0D && node hive-mind-server.js"

echo.
echo  ========================================
echo        HIVE IS ONLINE
echo  ========================================
echo.
echo  Services:
echo    Oracle:    http://localhost:3002
echo    Relay:     http://localhost:8600
echo    KittBox:   http://localhost:8585
echo    Kitt Live: http://localhost:8686
echo    Hive-Mind: http://localhost:8701
echo.
echo  Press any key to close this window...
pause >nul
