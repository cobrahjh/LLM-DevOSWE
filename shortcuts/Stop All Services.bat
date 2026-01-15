@echo off
title SimWidget - Stop All Services
echo ========================================
echo   Stopping All SimWidget Services
echo   Project: C:\LLM-DevOSWE
echo ========================================
echo.

echo Stopping Remote Support...
net stop simwidgetremotesupport.exe 2>nul

echo Stopping Agent (Kitt)...
net stop simwidgetagent.exe 2>nul

echo Stopping Main Server...
net stop simwidgetmainserver.exe 2>nul

echo Stopping Relay Service...
net stop simwidgetrelay.exe 2>nul

echo Stopping KeySender...
net stop simwidgetkeysender 2>nul

echo Stopping Claude Bridge...
net stop simwidgetclaudebridge.exe 2>nul

echo Stopping Master Orchestrator...
net stop simwidgetmastero.exe 2>nul

echo.
echo ========================================
echo   All services stopped!
echo ========================================
timeout /t 3
