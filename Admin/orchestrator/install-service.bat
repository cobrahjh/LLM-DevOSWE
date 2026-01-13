@echo off
:: Master (O) Service Installation Script
:: Run this as Administrator to install Master (O) as a Windows Service
:: v1.0.0 - 2026-01-09

echo.
echo ========================================
echo   SimWidget Master (O) Service Setup
echo ========================================
echo.

:: Check for admin privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script requires Administrator privileges.
    echo.
    echo Please right-click and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo Installing Master (O) as Windows Service...
echo.

cd /d "%~dp0"
node service-install.js

echo.
pause
