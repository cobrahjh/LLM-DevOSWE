@echo off
title SimWidget - Start All Services
echo ========================================
echo   Starting All SimWidget Services
echo   Project: C:\LLM-DevOSWE
echo ========================================
echo.

echo Starting Master Orchestrator...
net start simwidgetmastero.exe

echo Starting Relay Service...
net start simwidgetrelay.exe

echo Starting Agent (Kitt)...
net start simwidgetagent.exe

echo Starting Main Server...
net start simwidgetmainserver.exe

echo Starting Remote Support...
net start simwidgetremotesupport.exe

echo Starting KeySender...
net start simwidgetkeysender

echo Starting Oracle...
net start simwidgetoracle.exe

echo.
echo ========================================
echo   All services started!
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
