@echo off
REM SimWidget Engine - Start Script
REM v1.0.0 - Last updated: 2026-01-09
REM
REM This script starts the SimWidget server in the background
REM Used by: Manual start, MSFS EXE.xml addon, Windows Service

cd /d C:\LLM-DevOSWE\simwidget-hybrid\backend

REM Check if already running
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
    echo SimWidget already running on port 8080 (PID: %%a)
    exit /b 0
)

REM Start server
echo Starting SimWidget Engine...
start "SimWidget Engine" /min cmd /c "node server.js"

echo SimWidget Engine started on port 8080
