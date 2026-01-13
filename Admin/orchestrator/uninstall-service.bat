@echo off
:: Master (O) Service Removal Script
:: Run this as Administrator to remove Master (O) Windows Service
:: v1.0.0 - 2026-01-09

echo.
echo ========================================
echo   SimWidget Master (O) Service Removal
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

echo Removing Master (O) Windows Service...
echo.

cd /d "%~dp0"
node service-uninstall.js

echo.
pause
