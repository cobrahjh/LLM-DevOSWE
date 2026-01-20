@echo off
:: SimWidget Agent Launcher
:: Path: C:\LLM-DevOSWE\Admin\agent\start-agent.bat

cd /d "%~dp0"

echo.
echo Checking dependencies...

if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

if not exist ".env" (
    echo.
    echo ============================================
    echo  ERROR: .env file not found!
    echo.
    echo  1. Copy .env.example to .env
    echo  2. Add your Anthropic API key
    echo  3. Run this again
    echo ============================================
    echo.
    pause
    exit /b 1
)

echo Starting SimWidget Agent...
echo.
node agent-server.js
pause
