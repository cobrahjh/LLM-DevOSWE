@echo off
title SimWidget Server Manager
echo ========================================
echo   SimWidget Engine - Server Manager
echo   See SERVICE-REGISTRY.md for details
echo ========================================
echo.

REM Start Relay Service
echo Starting Relay Service (port 8600)...
start "Relay Service" cmd /c "cd /d C:\LLM-DevOSWE\Admin\relay && node relay-service.js"
timeout /t 2 /nobreak >nul

REM Start Oracle
echo Starting Oracle (port 3002)...
start "Oracle" cmd /c "cd /d C:\LLM-Oracle && node oracle.js"
timeout /t 2 /nobreak >nul

REM Start Master Orchestrator
echo Starting Master Orchestrator (port 8500)...
start "Master O" cmd /c "cd /d C:\LLM-DevOSWE\Admin\orchestrator && node orchestrator.js"
timeout /t 2 /nobreak >nul

REM Start Agent (KittBox UI)
echo Starting Agent/KittBox (port 8585)...
start "Agent" cmd /c "cd /d C:\LLM-DevOSWE\Admin\agent && node agent-server.js"
timeout /t 2 /nobreak >nul

REM Start Remote Support
echo Starting Remote Support (port 8590)...
start "Remote Support" cmd /c "cd /d C:\LLM-DevOSWE\Admin\remote-support && node service.js"
timeout /t 2 /nobreak >nul

REM Start SimWidget Main Server
echo Starting Main Server (port 8080)...
start "Main Server" cmd /c "cd /d C:\LLM-DevOSWE\simwidget-hybrid\backend && node server.js"
timeout /t 2 /nobreak >nul

REM Start Hive-Mind Monitor
echo Starting Hive-Mind (port 8701)...
start "Hive-Mind" cmd /c "cd /d C:\LLM-DevOSWE\Admin\hive-mind && node hive-mind-server.js"
timeout /t 2 /nobreak >nul

REM Start Hive Brain Admin
echo Starting Hive Brain (port 8800)...
start "Hive Brain" cmd /c "cd /d C:\LLM-DevOSWE\Admin\hive-brain && node server.js"
timeout /t 2 /nobreak >nul

REM Start Hive Oracle (Distributed LLM)
echo Starting Hive Oracle (port 8850)...
start "Hive Oracle" cmd /c "cd /d C:\LLM-DevOSWE\Admin\hive-oracle && node server.js"
timeout /t 2 /nobreak >nul

REM Start Kitt Live Desktop App
echo Starting Kitt Live...
start "Kitt Live" cmd /c "cd /d C:\kittbox-modules\kitt-live && npm start"

echo.
echo ========================================
echo   All services started!
echo ========================================
echo.
echo Services:
echo   - Relay:       http://localhost:8600
echo   - Oracle:      http://localhost:3002
echo   - Master:      http://localhost:8500
echo   - Agent:       http://localhost:8585
echo   - Remote:      http://localhost:8590
echo   - Main:        http://localhost:8080
echo   - Hive-Mind:   http://localhost:8701
echo   - Hive Brain:  http://localhost:8800
echo   - Hive Oracle: http://localhost:8850
echo   - Ollama:      http://localhost:11434 (run separately)
echo   - Kitt:        Alt+K to toggle
echo.
pause
