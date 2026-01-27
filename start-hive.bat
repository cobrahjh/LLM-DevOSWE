@echo off
title Hive Launcher
color 0A

echo.
echo  =============================================
echo     THE HIVE - Unified Startup
echo  =============================================
echo.

:: Step 1: Ensure Ollama is running (LLM dependency)
echo  [1/4] Checking Ollama...
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I /N "ollama.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo        Already running
) else (
    echo        Starting Ollama...
    start "" "ollama" serve
    timeout /t 3 /nobreak >nul
)

:: Step 2: Start Relay first (message bus - other services depend on it)
echo  [2/4] Starting Relay (port 8600)...
curl -s http://localhost:8600/api/health >nul 2>&1
if "%ERRORLEVEL%"=="0" (
    echo        Already running
) else (
    start "Relay [8600]" /min cmd /c "cd /d C:\LLM-DevOSWE\Admin\relay && node relay-service.js"
    call :waitfor 8600 "Relay" /api/health
)

:: Step 3: Start Oracle (LLM backend + Intel)
echo  [3/4] Starting Oracle (port 3002)...
curl -s http://localhost:3002/api/health >nul 2>&1
if "%ERRORLEVEL%"=="0" (
    echo        Already running
) else (
    start "Oracle [3002]" /min cmd /c "cd /d C:\LLM-Oracle && node oracle.js"
    call :waitfor 3002 "Oracle" /api/health
)

:: Step 4: Start Orchestrator (watchdog - auto-starts all other services)
echo  [4/4] Starting Master Orchestrator (port 8500)...
curl -s http://localhost:8500/api/health >nul 2>&1
if "%ERRORLEVEL%"=="0" (
    echo        Already running
) else (
    start "Master-O [8500]" /min cmd /c "cd /d C:\LLM-DevOSWE\Admin\orchestrator && node orchestrator.js"
    call :waitfor 8500 "Master-O" /api/health
)

echo.
echo  Orchestrator is starting all remaining services...
echo  Waiting 30 seconds for full startup...
echo.

:: Show progress bar
for /L %%i in (1,1,30) do (
    <nul set /p =.
    timeout /t 1 /nobreak >nul
)
echo.

echo.
echo  =============================================
echo     HEALTH CHECK
echo  =============================================
echo.

:: Check all services
curl -s http://localhost:8600/api/health >nul 2>&1 && (echo   [OK] Relay         :8600) || (echo   [!!] Relay         :8600 OFFLINE)
curl -s http://localhost:3002/api/health >nul 2>&1 && (echo   [OK] Oracle        :3002) || (echo   [!!] Oracle        :3002 OFFLINE)
curl -s http://localhost:8500/api/health >nul 2>&1 && (echo   [OK] Master-O      :8500) || (echo   [!!] Master-O      :8500 OFFLINE)
curl -s http://localhost:8080/api/status >nul 2>&1 && (echo   [OK] SimWidget     :8080) || (echo   [--] SimWidget     :8080)
curl -s http://localhost:8585/api/health >nul 2>&1 && (echo   [OK] KittBox       :8585) || (echo   [!!] KittBox       :8585 OFFLINE)
curl -s http://localhost:8590/api/health >nul 2>&1 && (echo   [OK] Remote Supp   :8590) || (echo   [--] Remote Supp   :8590)
curl -s http://localhost:8601/api/health >nul 2>&1 && (echo   [OK] Claude Bridge :8601) || (echo   [--] Claude Bridge :8601)
curl -s http://localhost:8701/api/health >nul 2>&1 && (echo   [OK] Hive-Mind     :8701) || (echo   [!!] Hive-Mind     :8701 OFFLINE)
curl -s http://localhost:8750/health >nul 2>&1     && (echo   [OK] Hive-Mesh     :8750) || (echo   [--] Hive-Mesh     :8750)
curl -s http://localhost:8771/api/health >nul 2>&1 && (echo   [OK] Terminal Hub  :8771) || (echo   [!!] Terminal Hub  :8771 OFFLINE)
curl -s http://localhost:8800/api/health >nul 2>&1 && (echo   [OK] Hive Brain    :8800) || (echo   [!!] Hive Brain    :8800 OFFLINE)
curl -s http://localhost:8810/api/health >nul 2>&1 && (echo   [OK] Brain Disc    :8810) || (echo   [!!] Brain Disc    :8810 OFFLINE)
curl -s http://localhost:8820/api/health >nul 2>&1 && (echo   [OK] Master-Mind   :8820) || (echo   [!!] Master-Mind   :8820 OFFLINE)
curl -s http://localhost:8850/api/health >nul 2>&1 && (echo   [OK] Hive Oracle   :8850) || (echo   [!!] Hive Oracle   :8850 OFFLINE)
curl -s http://localhost:8860/api/health >nul 2>&1 && (echo   [OK] MCP Bridge    :8860) || (echo   [!!] MCP Bridge    :8860 OFFLINE)
curl -s http://localhost:8899/api/health >nul 2>&1 && (echo   [OK] Dashboard     :8899) || (echo   [!!] Dashboard     :8899 OFFLINE)
curl -s http://localhost:11434/api/tags >nul 2>&1  && (echo   [OK] Ollama        :11434) || (echo   [--] Ollama        :11434)
curl -s http://localhost:1234/v1/models >nul 2>&1  && (echo   [OK] LM Studio     :1234) || (echo   [--] LM Studio     :1234)

echo.
echo  =============================================
echo     HIVE IS ONLINE
echo  =============================================
echo.
echo  Dashboard:   http://localhost:8899
echo  KittBox:     http://localhost:8585
echo  Master-O:    http://localhost:8500
echo.
echo  Press any key to close this window...
pause >nul
goto :eof

:: =============================================
:: Wait for a service to become healthy
:: =============================================
:waitfor
set WF_PORT=%1
set WF_NAME=%~2
set WF_EP=%3
set WF_TRIES=0
:waitloop
timeout /t 1 /nobreak >nul
curl -s -o nul http://localhost:%WF_PORT%%WF_EP% 2>nul
if "%ERRORLEVEL%"=="0" (
    echo        %WF_NAME% is ready
    goto :eof
)
set /a WF_TRIES+=1
if %WF_TRIES% lss 15 goto waitloop
echo        %WF_NAME% may still be starting...
goto :eof
