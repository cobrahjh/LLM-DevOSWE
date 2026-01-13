@echo off
title SimWidget - Server Manager
setlocal enabledelayedexpansion

echo ========================================
echo   SimWidget Engine - Server Manager
echo ========================================
echo.

:: Check if Master (O) is running (port 8500)
set "ORCH_RUNNING=0"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8500.*LISTENING" 2^>nul') do (
    set "ORCH_PID=%%a"
    set "ORCH_RUNNING=1"
)

if %ORCH_RUNNING%==1 (
    echo   Master (O) is running on port 8500
    echo   Opening dashboard...
    start http://localhost:8500
    echo.
    echo   Use the web dashboard to manage services.
    echo   Or use these quick commands:
    echo.
    echo   curl -X POST http://localhost:8500/api/start-all
    echo   curl -X POST http://localhost:8500/api/stop-all
    echo.
    goto :END
)

:: Orchestrator not running - check for other services
echo Checking for running services...
echo.

set "MAIN_RUNNING=0"
set "AGENT_RUNNING=0"
set "REMOTE_RUNNING=0"

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080.*LISTENING" 2^>nul') do (
    set "MAIN_PID=%%a"
    set "MAIN_RUNNING=1"
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8585.*LISTENING" 2^>nul') do (
    set "AGENT_PID=%%a"
    set "AGENT_RUNNING=1"
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8590.*LISTENING" 2^>nul') do (
    set "REMOTE_PID=%%a"
    set "REMOTE_RUNNING=1"
)

echo   [8500] Master (O):      NOT RUNNING
echo   [8080] Main Server:    %MAIN_RUNNING% (PID: %MAIN_PID%)
echo   [8585] Agent (Kitt):   %AGENT_RUNNING% (PID: %AGENT_PID%)
echo   [8590] Remote Support: %REMOTE_RUNNING% (PID: %REMOTE_PID%)
echo.

set /a "TOTAL_RUNNING=%MAIN_RUNNING%+%AGENT_RUNNING%+%REMOTE_RUNNING%"

if %TOTAL_RUNNING% GTR 0 (
    echo ----------------------------------------
    echo   %TOTAL_RUNNING% service(s) running without Master!
    echo ----------------------------------------
    echo.
    echo   [O] Start Master (O) only (will manage existing services)
    echo   [K] Kill all and start fresh with Master (O)
    echo   [G] Graceful shutdown all, then start Master (O)
    echo   [L] Legacy mode - start services without Master
    echo   [Q] Quit - do nothing
    echo.
    set /p "CHOICE=Choose action [O/K/G/L/Q]: "
    
    if /i "!CHOICE!"=="O" (
        echo.
        echo Starting Master (O) only...
        goto :START_ORCH
    )
    
    if /i "!CHOICE!"=="K" (
        echo.
        echo Killing all services...
        if %MAIN_RUNNING%==1 taskkill /F /PID %MAIN_PID% >nul 2>&1
        if %AGENT_RUNNING%==1 taskkill /F /PID %AGENT_PID% >nul 2>&1
        if %REMOTE_RUNNING%==1 taskkill /F /PID %REMOTE_PID% >nul 2>&1
        timeout /t 2 /nobreak >nul
        goto :START_ORCH_AND_SERVICES
    )
    
    if /i "!CHOICE!"=="G" (
        echo.
        echo Graceful shutdown via API...
        if %MAIN_RUNNING%==1 curl -s -X POST http://localhost:8080/api/shutdown >nul 2>&1
        if %AGENT_RUNNING%==1 curl -s -X POST http://localhost:8585/api/shutdown >nul 2>&1
        if %REMOTE_RUNNING%==1 curl -s -X POST http://localhost:8590/api/shutdown >nul 2>&1
        echo   Waiting for graceful shutdown...
        timeout /t 3 /nobreak >nul
        goto :START_ORCH_AND_SERVICES
    )
    
    if /i "!CHOICE!"=="L" (
        echo.
        echo Starting in legacy mode (no Master)...
        goto :LEGACY_START
    )
    
    if /i "!CHOICE!"=="Q" (
        goto :END
    )
    
    echo Invalid choice.
    goto :END
)

:: Nothing running - start Master (O) which will start services
:START_ORCH_AND_SERVICES
echo.
echo Starting Master (O) (will manage all services)...

:START_ORCH
echo [1/1] Starting Master (O) (port 8500)...
cd /d C:\LLM-DevOSWE\Admin\orchestrator
if not exist node_modules (
    echo   Installing dependencies...
    npm install >nul 2>&1
)
start "SimWidget Master" cmd /k "node orchestrator.js"
timeout /t 3 /nobreak >nul

echo.
echo [2/2] Starting Relay Auto-Poller...
start "Relay Auto-Poller" /min cmd /c "cd /d C:\LLM-DevOSWE\Admin\relay && node auto-poller.js"

echo.
echo ========================================
echo   Master (O) starting...
echo   Dashboard: http://localhost:8500
echo.
echo   Use dashboard to start/stop services
echo   or run: curl -X POST http://localhost:8500/api/start-all
echo   Auto-poller: Running (polls relay every 5s)
echo ========================================
start http://localhost:8500
goto :END

:LEGACY_START
:: Legacy mode - direct service start without orchestrator
echo.
if %MAIN_RUNNING%==0 (
    echo [1/3] Starting Main Server (port 8080)...
    start "SimWidget Main Server" cmd /k "cd /d C:\LLM-DevOSWE\simwidget-hybrid && npx nodemon backend/server.js"
    timeout /t 2 /nobreak >nul
) else (
    echo [1/3] Main Server already running - skipped
)

if %AGENT_RUNNING%==0 (
    echo [2/3] Starting Agent Server (port 8585)...
    start "SimWidget Agent" cmd /k "cd /d C:\LLM-DevOSWE\Admin\agent && node agent-server.js"
    timeout /t 1 /nobreak >nul
) else (
    echo [2/3] Agent already running - skipped
)

if %REMOTE_RUNNING%==0 (
    echo [3/3] Starting Remote Support (port 8590)...
    start "SimWidget Remote Support" cmd /k "cd /d C:\LLM-DevOSWE\Admin\remote-support && node service.js"
) else (
    echo [3/3] Remote Support already running - skipped
)

echo [4/4] Starting Relay Auto-Poller...
start "Relay Auto-Poller" /min cmd /c "cd /d C:\LLM-DevOSWE\Admin\relay && node auto-poller.js"

echo.
echo ========================================
echo   Legacy Mode (no Master)
echo   Main Server:    http://localhost:8080
echo   Agent:          http://localhost:8585
echo   Remote Support: http://localhost:8590
echo   Auto-poller:    Running (polls every 5s)
echo ========================================

:END
echo.
pause
