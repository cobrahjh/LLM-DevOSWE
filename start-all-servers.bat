@echo off
title SimWidget Server Manager
echo ========================================
echo   SimWidget Engine - Server Manager
echo   See SERVICE-REGISTRY.md for details
echo ========================================
echo.

REM Health check function - waits for service to respond
REM Usage: call :healthcheck PORT SERVICE_NAME

REM Start Relay Service (MUST BE FIRST - other services depend on it)
echo Starting Relay Service (port 8600)...
start "Relay Service" /min cmd /c "cd /d C:\LLM-DevOSWE\Admin\relay && node relay-service.js"
call :healthcheck 8600 "Relay"

REM Start Oracle
echo Starting Oracle (port 3002)...
start "Oracle" /min cmd /c "cd /d C:\LLM-Oracle && node oracle.js"
call :healthcheck 3002 "Oracle"

REM Start Master Orchestrator
echo Starting Master Orchestrator (port 8500)...
start "Master O" /min cmd /c "cd /d C:\LLM-DevOSWE\Admin\orchestrator && node orchestrator.js"
call :healthcheck 8500 "Master O"

REM Start Agent (KittBox UI)
echo Starting Agent/KittBox (port 8585)...
start "Agent" /min cmd /c "cd /d C:\LLM-DevOSWE\Admin\agent && node agent-server.js"
call :healthcheck 8585 "KittBox"

REM Start Remote Support
echo Starting Remote Support (port 8590)...
start "Remote Support" /min cmd /c "cd /d C:\LLM-DevOSWE\Admin\remote-support && node service.js"
timeout /t 2 /nobreak >nul

REM Start SimWidget Main Server
echo Starting Main Server (port 8080)...
start "Main Server" /min cmd /c "cd /d C:\LLM-DevOSWE\simwidget-hybrid\backend && node server.js"
timeout /t 2 /nobreak >nul

REM Start Hive-Mind Monitor
echo Starting Hive-Mind (port 8701)...
start "Hive-Mind" /min cmd /c "cd /d C:\LLM-DevOSWE\Admin\hive-mind && node hive-mind-server.js"
call :healthcheck 8701 "Hive-Mind"

REM Start Terminal Hub
echo Starting Terminal Hub (port 8771)...
start "Terminal Hub" /min cmd /c "cd /d C:\LLM-DevOSWE\Admin\terminal-hub && node terminal-hub-server.js"
call :healthcheck 8771 "Terminal Hub"

REM Start Hive Brain Admin
echo Starting Hive Brain (port 8800)...
start "Hive Brain" /min cmd /c "cd /d C:\LLM-DevOSWE\Admin\hive-brain && node server.js"
call :healthcheck 8800 "Hive Brain"

REM Start Hive Oracle (Distributed LLM)
echo Starting Hive Oracle (port 8850)...
start "Hive Oracle" /min cmd /c "cd /d C:\LLM-DevOSWE\Admin\hive-oracle && node server.js"
call :healthcheck 8850 "Hive Oracle"

REM Start Auto-Responder (Ollama auto-reply for relay messages)
echo Starting Auto-Responder...
start "Auto-Responder" /min cmd /c "cd /d C:\LLM-DevOSWE\Admin\relay && node auto-responder.js"
timeout /t 1 /nobreak >nul

REM Start Message Notifier (Toast notifications for relay messages)
echo Starting Message Notifier...
start "Message Notifier" /min cmd /c "cd /d C:\LLM-DevOSWE\Admin\relay && node message-notifier.js"
timeout /t 1 /nobreak >nul

REM Start Browser Bridge (port 8620)
echo Starting Browser Bridge...
start "Browser Bridge" /min cmd /c "cd /d C:\LLM-DevOSWE\Admin\browser-extension && node bridge-server.js"
timeout /t 1 /nobreak >nul

echo.
echo ========================================
echo   Running final health checks...
echo ========================================
echo.

REM Final health check summary
call :finalcheck

echo.
pause
goto :eof

REM ========================================
REM Health check subroutine
REM ========================================
:healthcheck
set PORT=%1
set NAME=%~2
set RETRIES=0
:healthloop
timeout /t 1 /nobreak >nul
curl -s -o nul -w "%%{http_code}" http://localhost:%PORT%/api/health 2>nul | findstr "200" >nul
if %errorlevel%==0 (
    echo   [OK] %NAME% is healthy
    goto :eof
)
set /a RETRIES+=1
if %RETRIES% lss 10 goto healthloop
echo   [WARN] %NAME% may not be responding
goto :eof

REM ========================================
REM Final health check summary
REM ========================================
:finalcheck
echo Checking all services...
echo.
curl -s http://localhost:8600/api/health >nul 2>&1 && (echo   [OK] Relay       :8600) || (echo   [!!] Relay       :8600 OFFLINE)
curl -s http://localhost:3002/api/health >nul 2>&1 && (echo   [OK] Oracle      :3002) || (echo   [!!] Oracle      :3002 OFFLINE)
curl -s http://localhost:8500/api/health >nul 2>&1 && (echo   [OK] Master O    :8500) || (echo   [!!] Master O    :8500 OFFLINE)
curl -s http://localhost:8585/api/health >nul 2>&1 && (echo   [OK] KittBox     :8585) || (echo   [!!] KittBox     :8585 OFFLINE)
curl -s http://localhost:8701/api/health >nul 2>&1 && (echo   [OK] Hive-Mind   :8701) || (echo   [!!] Hive-Mind   :8701 OFFLINE)
curl -s http://localhost:8771/api/health >nul 2>&1 && (echo   [OK] Term Hub    :8771) || (echo   [!!] Term Hub    :8771 OFFLINE)
curl -s http://localhost:8800/api/health >nul 2>&1 && (echo   [OK] Hive Brain  :8800) || (echo   [!!] Hive Brain  :8800 OFFLINE)
curl -s http://localhost:8850/api/health >nul 2>&1 && (echo   [OK] Hive Oracle :8850) || (echo   [!!] Hive Oracle :8850 OFFLINE)
curl -s http://localhost:11434/api/tags >nul 2>&1 && (echo   [OK] Ollama      :11434) || (echo   [--] Ollama      :11434 not running)
curl -s http://localhost:1234/v1/models >nul 2>&1 && (echo   [OK] LM Studio   :1234) || (echo   [--] LM Studio   :1234 not running)
echo.
echo ========================================
echo   Startup complete!
echo ========================================
echo.
echo Web UIs:
echo   - KittBox:    http://localhost:8585
echo   - Hive-Mind:  http://localhost:8701
echo   - Term Hub:   http://localhost:8771
echo   - Hive Brain: http://localhost:8800
echo   - Hive Oracle:http://localhost:8850
echo   - Master O:   http://localhost:8500
echo.
goto :eof
