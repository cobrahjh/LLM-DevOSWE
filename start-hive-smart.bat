@echo off
title Hive Smart Launcher
color 0A

echo.
echo  ========================================
echo     HIVE SMART LAUNCHER
echo  ========================================
echo.
echo  Detecting best deployment mode...
echo.

:: Check for Docker Desktop
docker info >nul 2>&1
if %errorLevel% equ 0 (
    echo  [DETECTED] Docker Desktop is available
    echo  [SELECTED] Docker mode (no reboots needed!)
    echo.
    cd /d %~dp0Admin\docker
    docker-compose up -d
    goto :success
)

:: Check for WSL Ubuntu with systemd services
wsl -d Ubuntu -- test -f /etc/systemd/system/hive-oracle.service >nul 2>&1
if %errorLevel% equ 0 (
    echo  [DETECTED] WSL Ubuntu with Hive services
    echo  [SELECTED] WSL mode (systemd services)
    echo.
    wsl -d Ubuntu -- sudo systemctl start hive-oracle hive-relay hive-kittbox hive-kittlive hive-mind hive-docsync
    goto :success
)

:: Check for NSSM services
sc query HiveOracle >nul 2>&1
if %errorLevel% equ 0 (
    echo  [DETECTED] Windows services installed
    echo  [SELECTED] Windows service mode
    echo.
    echo  Starting services...
    net start HiveOracle >nul 2>&1
    net start HiveRelay >nul 2>&1
    net start HiveKittBox >nul 2>&1
    net start HiveKittLive >nul 2>&1
    net start HiveMind >nul 2>&1
    goto :success
)

:: Fallback to batch script
echo  [DETECTED] No Docker or services found
echo  [SELECTED] Terminal mode (legacy)
echo.
call %~dp0start-hive.bat
goto :end

:success
echo.
echo  ========================================
echo     HIVE IS ONLINE
echo  ========================================
echo.
echo  Services:
echo    Oracle:    http://localhost:3002
echo    Relay:     http://localhost:8600
echo    KittBox:   http://localhost:8585
echo    Kitt Live: http://localhost:8686
echo    Hive-Mind: http://localhost:8701
echo.

:end
pause
