@echo off
title Hive Docker Launcher
color 0A

echo.
echo  ========================================
echo     HIVE DOCKER LAUNCHER
echo  ========================================
echo.

:: Check for Docker Desktop
docker info >nul 2>&1
if %errorLevel% neq 0 (
    echo  ERROR: Docker is not running!
    echo.
    echo  Options:
    echo    1. Start Docker Desktop
    echo    2. Use WSL2: wsl -d Ubuntu
    echo    3. Use Windows services instead:
    echo       Admin\services\install-all-services.bat
    echo.
    pause
    exit /b 1
)

echo  Docker detected. Starting Hive...
echo.

cd /d %~dp0
docker-compose up -d

echo.
echo  ========================================
echo     HIVE IS ONLINE (Docker Mode)
echo  ========================================
echo.
echo  Services:
echo    Oracle:    http://localhost:3002
echo    Relay:     http://localhost:8600
echo    KittBox:   http://localhost:8585
echo    Kitt Live: http://localhost:8686
echo    Hive-Mind: http://localhost:8701
echo    Ollama:    http://localhost:11434
echo.
echo  Commands:
echo    docker-compose logs -f    View logs
echo    docker-compose restart    Restart all
echo    docker-compose down       Stop all
echo.
pause
