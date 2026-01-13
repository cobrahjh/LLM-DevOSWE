@echo off
REM SimWidget Engine - Stop Script
REM v1.0.0 - Last updated: 2026-01-09

echo Stopping SimWidget Engine...

REM Find and kill process on port 8080
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
    echo Stopping PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)

echo SimWidget Engine stopped.
