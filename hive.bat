@echo off
setlocal enabledelayedexpansion
title Hive CLI
color 0A

:: ============================================
:: HIVE CLI - Unified command interface
:: Usage: hive [command] [options]
:: ============================================

set CMD=%1
set ARG=%2

if "%CMD%"=="" goto :help
if "%CMD%"=="help" goto :help
if "%CMD%"=="-h" goto :help
if "%CMD%"=="--help" goto :help

if "%CMD%"=="start" goto :start
if "%CMD%"=="stop" goto :stop
if "%CMD%"=="status" goto :status
if "%CMD%"=="restart" goto :restart
if "%CMD%"=="setup" goto :setup
if "%CMD%"=="open" goto :open
if "%CMD%"=="logs" goto :logs
if "%CMD%"=="sync" goto :sync
if "%CMD%"=="build" goto :build

echo  Unknown command: %CMD%
goto :help

:: ============================================
:: HELP
:: ============================================
:help
echo.
echo  =============================================
echo       HIVE CLI - Unified Command Interface
echo  =============================================
echo.
echo  Usage: hive [command] [service]
echo.
echo  Commands:
echo    start [svc]    Start all services (or specific service)
echo    stop  [svc]    Stop all services (or specific service)
echo    status         Check all service status
echo    restart [svc]  Restart service(s)
echo    setup          Install all dependencies
echo    open [ui]      Open web UI in browser
echo    logs [svc]     View service logs
echo    sync           Sync docs to Google Drive
echo    build [proj]   Build project (wasm, panel, overlay)
echo.
echo  Services: oracle, relay, agent, dashboard, simwidget,
echo            hivemind, mastermind, hiveoracle, mcpbridge, etc.
echo.
echo  Open targets: dashboard, kittbox, orchestrator, all
echo.
echo  Examples:
echo    hive start              Start all services
echo    hive stop               Stop all services
echo    hive restart oracle     Restart Oracle only
echo    hive open dashboard     Open Dashboard in browser
echo    hive open all           Open all main UIs
echo    hive status             Check service health
echo.
goto :eof

:: ============================================
:: START
:: ============================================
:start
if "%ARG%"=="" (
    echo  Starting Hive...
    call "%~dp0start-hive.bat"
) else (
    echo  Starting %ARG%...
    curl -s -X POST http://localhost:8500/api/services/%ARG%/start >nul 2>&1
    if %errorLevel%==0 (
        echo  [OK] %ARG% start requested
    ) else (
        echo  [!!] Failed - is Orchestrator running?
    )
)
goto :eof

:: ============================================
:: STOP
:: ============================================
:stop
if "%ARG%"=="" (
    echo  Stopping Hive...
    echo.
    :: Graceful shutdown via Orchestrator
    curl -s -X POST http://localhost:8500/api/stop-all >nul 2>&1
    timeout /t 2 /nobreak >nul
    :: Force kill all ports
    for %%p in (3002 8080 8500 8585 8590 8600 8601 8701 8750 8770 8771 8800 8810 8820 8850 8860 8875 8899) do (
        for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :%%p ^| findstr LISTENING') do (
            taskkill /F /PID %%a >nul 2>&1
        )
    )
    echo  [OK] Hive stopped
) else (
    echo  Stopping %ARG%...
    curl -s -X POST http://localhost:8500/api/services/%ARG%/stop >nul 2>&1
    echo  [OK] %ARG% stop requested
)
goto :eof

:: ============================================
:: STATUS
:: ============================================
:status
echo.
echo  =============================================
echo           HIVE STATUS
echo  =============================================
echo.
:: External
curl -s http://localhost:11434/api/tags >nul 2>&1 && (echo   [OK] Ollama        :11434) || (echo   [--] Ollama        :11434)
curl -s http://localhost:1234/v1/models >nul 2>&1 && (echo   [OK] LM Studio     :1234 ) || (echo   [--] LM Studio     :1234)
echo.
:: Core
curl -s http://localhost:8600/api/health >nul 2>&1 && (echo   [OK] Relay         :8600) || (echo   [!!] Relay         :8600)
curl -s http://localhost:3002/api/health >nul 2>&1 && (echo   [OK] Oracle        :3002) || (echo   [!!] Oracle        :3002)
curl -s http://localhost:8500/api/health >nul 2>&1 && (echo   [OK] Orchestrator  :8500) || (echo   [!!] Orchestrator  :8500)
echo.
:: Managed
curl -s http://localhost:8080/api/status >nul 2>&1 && (echo   [OK] SimWidget     :8080) || (echo   [--] SimWidget     :8080)
curl -s http://localhost:8585/api/health >nul 2>&1 && (echo   [OK] KittBox       :8585) || (echo   [!!] KittBox       :8585)
curl -s http://localhost:8701/api/health >nul 2>&1 && (echo   [OK] Hive-Mind     :8701) || (echo   [--] Hive-Mind     :8701)
curl -s http://localhost:8771/api/health >nul 2>&1 && (echo   [OK] Terminal Hub  :8771) || (echo   [--] Terminal Hub  :8771)
curl -s http://localhost:8820/api/health >nul 2>&1 && (echo   [OK] Master-Mind   :8820) || (echo   [--] Master-Mind   :8820)
curl -s http://localhost:8850/api/health >nul 2>&1 && (echo   [OK] Hive Oracle   :8850) || (echo   [--] Hive Oracle   :8850)
curl -s http://localhost:8860/api/health >nul 2>&1 && (echo   [OK] MCP Bridge    :8860) || (echo   [--] MCP Bridge    :8860)
curl -s http://localhost:8899/api/health >nul 2>&1 && (echo   [OK] Dashboard     :8899) || (echo   [--] Dashboard     :8899)
curl -s http://localhost:8875/api/health >nul 2>&1 && (echo   [OK] VoiceAccess   :8875) || (echo   [--] VoiceAccess   :8875)
echo.
goto :eof

:: ============================================
:: RESTART
:: ============================================
:restart
if "%ARG%"=="" (
    echo  Restarting Hive...
    call :stop
    timeout /t 2 /nobreak >nul
    call "%~dp0start-hive.bat"
) else (
    echo  Restarting %ARG%...
    curl -s -X POST http://localhost:8500/api/services/%ARG%/restart >nul 2>&1
    echo  [OK] %ARG% restart requested
)
goto :eof

:: ============================================
:: SETUP
:: ============================================
:setup
echo.
echo  Installing dependencies for all services...
echo.
set ROOT=%~dp0
for %%d in (
    "C:\LLM-Oracle"
    "%ROOT%Admin\relay"
    "%ROOT%Admin\orchestrator"
    "%ROOT%simwidget-hybrid\backend"
    "%ROOT%Admin\agent"
    "%ROOT%Admin\remote-support"
    "%ROOT%Admin\claude-bridge"
    "%ROOT%Admin\hive-mind"
    "%ROOT%Admin\terminal-hub"
    "%ROOT%Admin\hive-brain"
    "%ROOT%Admin\master-mind"
    "%ROOT%Admin\hive-oracle"
    "%ROOT%Admin\mcp-bridge"
    "%ROOT%Admin\hive-dashboard"
    "%ROOT%Admin\voiceaccess"
    "%ROOT%Admin\intel-pollers"
) do (
    if exist %%d (
        echo   %%~nxd...
        cd /d %%d && call npm install --production >nul 2>&1 && echo     OK || echo     FAILED
    )
)
cd /d "%ROOT%"
echo.
echo  [OK] Setup complete
goto :eof

:: ============================================
:: OPEN
:: ============================================
:open
if "%ARG%"=="" set ARG=dashboard
if "%ARG%"=="dashboard" start http://localhost:8899
if "%ARG%"=="kittbox" start http://localhost:8585
if "%ARG%"=="kitt" start http://localhost:8585
if "%ARG%"=="orchestrator" start http://localhost:8500
if "%ARG%"=="master" start http://localhost:8500
if "%ARG%"=="hivemind" start http://localhost:8701
if "%ARG%"=="terminal" start http://localhost:8771
if "%ARG%"=="mastermind" start http://localhost:8820
if "%ARG%"=="all" (
    start http://localhost:8899
    start http://localhost:8585
    start http://localhost:8500
)
echo  [OK] Opened %ARG%
goto :eof

:: ============================================
:: LOGS
:: ============================================
:logs
if "%ARG%"=="" set ARG=orchestrator
set LOGFILE=%~dp0Admin\orchestrator\logs\orchestrator.log
if exist "%LOGFILE%" (
    echo  Last 50 lines of %ARG% logs:
    echo  ----------------------------------------
    powershell -Command "Get-Content '%LOGFILE%' -Tail 50"
) else (
    echo  Log file not found: %LOGFILE%
)
goto :eof

:: ============================================
:: SYNC (DocSync to Google Drive)
:: ============================================
:sync
set SRC=%~dp0
set DST=G:\My Drive\__AI Development\Harold
echo  Syncing docs to Google Drive...
if not exist "%DST%\admin" mkdir "%DST%\admin" 2>nul
if not exist "%DST%\reference" mkdir "%DST%\reference" 2>nul
copy /Y "%SRC%SERVICE-REGISTRY.md" "%DST%\admin\" >nul 2>&1
copy /Y "%SRC%ARCHITECTURE.md" "%DST%\admin\" >nul 2>&1
copy /Y "%SRC%STANDARDS.md" "%DST%\admin\" >nul 2>&1
copy /Y "%SRC%HIVE-SERVICE-AUDIT.md" "%DST%\admin\" >nul 2>&1
copy /Y "%SRC%CLAUDE.md" "%DST%\reference\" >nul 2>&1
copy /Y "%SRC%docs\HIVE-PROTOCOLS.md" "%DST%\reference\" >nul 2>&1
echo  [OK] Docs synced to %DST%
goto :eof

:: ============================================
:: BUILD (Project builds)
:: ============================================
:build
if "%ARG%"=="" (
    echo  Usage: hive build [project]
    echo  Projects: wasm, panel, overlay
    goto :eof
)
if "%ARG%"=="wasm" (
    echo  Building WASM camera module...
    cd /d "%~dp0wasm-camera" && call build.bat
)
if "%ARG%"=="panel" (
    echo  Building MSFS panel...
    cd /d "%~dp0msfs-panel" && call install.bat
)
if "%ARG%"=="overlay" (
    echo  Building DirectX overlay...
    cd /d "%~dp0directx-overlay" && call build.bat
)
cd /d "%~dp0"
goto :eof
