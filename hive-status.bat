@echo off
title Hive Status
color 0B

echo.
echo  =============================================
echo           HIVE STATUS CHECK
echo  =============================================
echo.

:: Check if Orchestrator is running - if so, use its API
curl -s http://localhost:8500/api/health >nul 2>&1
if %errorLevel%==0 (
    echo  [Orchestrator online - fetching live status...]
    echo.
    curl -s http://localhost:8500/api/status 2>nul | findstr /C:"healthy" >nul
    if %errorLevel%==0 (
        echo  Fetching from Orchestrator API...
        echo.
    )
)

:: External services
echo  EXTERNAL SERVICES
echo  -----------------
curl -s http://localhost:11434/api/tags >nul 2>&1 && (echo   [OK] Ollama        :11434) || (echo   [--] Ollama        :11434)
curl -s http://localhost:1234/v1/models >nul 2>&1 && (echo   [OK] LM Studio     :1234 ) || (echo   [--] LM Studio     :1234)
echo.

:: Core services (must be running)
echo  CORE SERVICES
echo  -------------
curl -s http://localhost:8600/api/health >nul 2>&1 && (echo   [OK] Relay         :8600) || (echo   [!!] Relay         :8600 OFFLINE)
curl -s http://localhost:3002/api/health >nul 2>&1 && (echo   [OK] Oracle        :3002) || (echo   [!!] Oracle        :3002 OFFLINE)
curl -s http://localhost:8500/api/health >nul 2>&1 && (echo   [OK] Orchestrator  :8500) || (echo   [!!] Orchestrator  :8500 OFFLINE)
echo.

:: Orchestrator-managed services
echo  MANAGED SERVICES
echo  ----------------
curl -s http://localhost:8080/api/status >nul 2>&1 && (echo   [OK] SimWidget     :8080) || (echo   [--] SimWidget     :8080)
curl -s http://localhost:8585/api/health >nul 2>&1 && (echo   [OK] KittBox       :8585) || (echo   [!!] KittBox       :8585 OFFLINE)
curl -s http://localhost:8590/api/health >nul 2>&1 && (echo   [OK] Remote Supp   :8590) || (echo   [--] Remote Supp   :8590)
curl -s http://localhost:8601/api/health >nul 2>&1 && (echo   [OK] Claude Bridge :8601) || (echo   [--] Claude Bridge :8601)
curl -s http://localhost:8701/api/health >nul 2>&1 && (echo   [OK] Hive-Mind     :8701) || (echo   [!!] Hive-Mind     :8701 OFFLINE)
curl -s http://localhost:8750/health >nul 2>&1     && (echo   [OK] Hive-Mesh     :8750) || (echo   [--] Hive-Mesh     :8750)
curl -s http://localhost:8770/health >nul 2>&1     && (echo   [OK] Personas      :8770) || (echo   [--] Personas      :8770)
curl -s http://localhost:8771/api/health >nul 2>&1 && (echo   [OK] Terminal Hub  :8771) || (echo   [!!] Terminal Hub  :8771 OFFLINE)
curl -s http://localhost:8800/api/health >nul 2>&1 && (echo   [OK] Hive Brain    :8800) || (echo   [!!] Hive Brain    :8800 OFFLINE)
curl -s http://localhost:8810/api/health >nul 2>&1 && (echo   [OK] Brain Disc    :8810) || (echo   [!!] Brain Disc    :8810 OFFLINE)
curl -s http://localhost:8820/api/health >nul 2>&1 && (echo   [OK] Master-Mind   :8820) || (echo   [!!] Master-Mind   :8820 OFFLINE)
curl -s http://localhost:8850/api/health >nul 2>&1 && (echo   [OK] Hive Oracle   :8850) || (echo   [!!] Hive Oracle   :8850 OFFLINE)
curl -s http://localhost:8860/api/health >nul 2>&1 && (echo   [OK] MCP Bridge    :8860) || (echo   [!!] MCP Bridge    :8860 OFFLINE)
curl -s http://localhost:8875/api/health >nul 2>&1 && (echo   [OK] VoiceAccess   :8875) || (echo   [!!] VoiceAccess   :8875 OFFLINE)
curl -s http://localhost:8899/api/health >nul 2>&1 && (echo   [OK] Dashboard     :8899) || (echo   [!!] Dashboard     :8899 OFFLINE)
echo.

echo  =============================================
echo   Legend: [OK]=Running [!!]=Core offline [--]=Optional
echo  =============================================
echo.
echo  Quick Actions:
echo    start-hive.bat    - Start all services
echo    stop-hive.bat     - Stop all services
echo.
pause
