@echo off
title Hive Shutdown
color 0C

echo.
echo  ========================================
echo        STOPPING THE HIVE
echo  ========================================
echo.

:: Kill processes on specific ports
echo  Stopping Oracle (3002)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

echo  Stopping Relay (8600)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8600 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

echo  Stopping KittBox (8585)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8585 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

echo  Stopping Kitt Live (8686)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8686 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

echo.
echo  ========================================
echo        HIVE IS OFFLINE
echo  ========================================
echo.
echo  Press any key to close...
pause >nul
