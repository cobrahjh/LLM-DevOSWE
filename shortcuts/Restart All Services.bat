@echo off
title SimWidget - Restart All Services
echo ========================================
echo   Restarting All SimWidget Services
echo   Project: C:\LLM-DevOSWE
echo ========================================
echo.

echo [1/2] Stopping services...
net stop simwidgetoracle.exe 2>nul
net stop simwidgetremotesupport.exe 2>nul
net stop simwidgetagent.exe 2>nul
net stop simwidgetmainserver.exe 2>nul
net stop simwidgetrelay.exe 2>nul
net stop simwidgetkeysender 2>nul
net stop simwidgetclaudebridge.exe 2>nul
net stop simwidgetmastero.exe 2>nul

echo.
echo Waiting for services to stop...
timeout /t 3 /nobreak >nul

echo.
echo [2/2] Starting services...
net start simwidgetmastero.exe
net start simwidgetrelay.exe
net start simwidgetagent.exe
net start simwidgetmainserver.exe
net start simwidgetremotesupport.exe
net start simwidgetkeysender
net start simwidgetoracle.exe

echo.
echo ========================================
echo   All services restarted!
echo ========================================
echo.
echo   Master:  http://localhost:8500
echo   Agent:   http://localhost:8585
echo   Relay:   http://localhost:8600
echo   Main:    http://localhost:8080
echo   Remote:  http://localhost:8590
echo   Oracle:  http://localhost:3002
echo.
timeout /t 5
