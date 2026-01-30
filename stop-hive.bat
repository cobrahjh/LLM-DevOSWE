@echo off
title Hive Shutdown
color 0C

echo.
echo  =============================================
echo       STOPPING THE HIVE
echo  =============================================
echo.

:: Try graceful shutdown via Orchestrator first
echo  [1/2] Requesting graceful shutdown...
curl -s -X POST http://localhost:8500/api/stop-all >nul 2>&1
timeout /t 3 /nobreak >nul

:: Force kill all service ports
echo  [2/2] Force stopping all services...

set PORTS=3002 8080 8500 8585 8590 8600 8601 8701 8750 8770 8771 8800 8810 8820 8850 8860 8875 8899

for %%p in (%PORTS%) do (
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :%%p ^| findstr LISTENING') do (
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo.
echo  =============================================
echo       HIVE IS OFFLINE
echo  =============================================
echo.
echo  Services stopped:
echo    Oracle (3002), SimWidget (8080), Orchestrator (8500)
echo    KittBox (8585), Remote (8590), Relay (8600)
echo    Claude Bridge (8601), Hive-Mind (8701), Hive-Mesh (8750)
echo    Personas (8770), Terminal Hub (8771), Hive Brain (8800)
echo    Brain Discovery (8810), Master-Mind (8820), Hive Oracle (8850)
echo    MCP-Bridge (8860), VoiceAccess (8875), Dashboard (8899)
echo.
echo  Press any key to close...
pause >nul
