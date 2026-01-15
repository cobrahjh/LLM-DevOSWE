@echo off
title SimWidget - Service Status
echo.
echo ========================================
echo   SimWidget Services Status
echo   Project: C:\LLM-DevOSWE
echo ========================================
echo.
powershell -Command "Get-Service | Where-Object { $_.Name -like 'simwidget*' } | Format-Table Name, DisplayName, Status -AutoSize"
echo.
echo ========================================
echo   Listening Ports
echo ========================================
echo.
echo   8500 - Master Orchestrator
echo   8585 - Agent (Kitt)
echo   8600 - Relay Service
echo   8080 - Main Server
echo   8590 - Remote Support
echo   8601 - Claude Bridge
echo.
netstat -ano | findstr "LISTENING" | findstr ":8500 :8585 :8600 :8080 :8590 :8601"
echo.
echo ========================================
echo   Health Checks
echo ========================================
echo.
echo Master:
curl -s http://localhost:8500/api/health 2>nul || echo   OFFLINE
echo.
echo Agent:
curl -s http://localhost:8585/api/health 2>nul || echo   OFFLINE
echo.
echo Relay:
curl -s http://localhost:8600/api/health 2>nul || echo   OFFLINE
echo.
pause
