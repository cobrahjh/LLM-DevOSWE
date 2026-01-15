@echo off
title SimWidget - Uninstall Services
echo ========================================
echo   SimWidget Services Uninstaller
echo   Project: C:\LLM-DevOSWE
echo ========================================
echo.

:: Check for admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Must run as Administrator!
    echo Right-click this file and select "Run as administrator"
    pause
    exit /b 1
)

echo Running as Administrator - Good!
echo.

echo Stopping and removing all SimWidget services...
echo.

echo [1/7] SimWidget Master O
net stop "simwidgetmastero.exe" 2>nul
sc delete "simwidgetmastero.exe" 2>nul

echo [2/7] SimWidget Relay
net stop "simwidgetrelay.exe" 2>nul
sc delete "simwidgetrelay.exe" 2>nul

echo [3/7] SimWidget Agent
net stop "simwidgetagent.exe" 2>nul
sc delete "simwidgetagent.exe" 2>nul

echo [4/7] SimWidget Main Server
net stop "simwidgetmainserver.exe" 2>nul
sc delete "simwidgetmainserver.exe" 2>nul

echo [5/7] SimWidget Remote Support
net stop "simwidgetremotesupport.exe" 2>nul
sc delete "simwidgetremotesupport.exe" 2>nul

echo [6/7] SimWidget Claude Bridge
net stop "simwidgetclaudebridge.exe" 2>nul
sc delete "simwidgetclaudebridge.exe" 2>nul

echo [7/8] SimWidget KeySender
net stop "simwidgetkeysender" 2>nul
sc delete "simwidgetkeysender" 2>nul

echo [8/8] SimWidget Oracle
net stop "simwidgetoracle.exe" 2>nul
sc delete "simwidgetoracle.exe" 2>nul

echo.
echo ========================================
echo   Uninstall Complete!
echo ========================================
echo.
echo Now run INSTALL-SERVICES.bat to reinstall
echo.
pause
