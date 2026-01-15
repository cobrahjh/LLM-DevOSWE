@echo off
title SimWidget - Install Services
echo ========================================
echo   SimWidget Services Installer
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

cd /d C:\LLM-DevOSWE\Admin
node install-all.js

echo.
echo ----------------------------------------
echo Installing KeySender (native .NET service)
echo ----------------------------------------
sc query simwidgetkeysender >nul 2>&1
if %errorlevel% equ 0 (
    echo KeySender already installed, skipping
) else (
    sc create simwidgetkeysender binPath= "C:\LLM-DevOSWE\KeySenderService\bin\Release\net8.0\simwidgetkeysender.exe" DisplayName= "SimWidget KeySender" start= auto
    if %errorlevel% equ 0 (
        echo KeySender installed successfully
        net start simwidgetkeysender
    ) else (
        echo Failed to install KeySender
    )
)

echo.
echo ========================================
echo   Installation Complete!
echo ========================================
pause
