@echo off
title Hive WSL Launcher
color 0A

echo.
echo  ========================================
echo     HIVE WSL LAUNCHER
echo  ========================================
echo.

:: Check if WSL Ubuntu is available
wsl -l -q | findstr /i "Ubuntu" >nul
if %errorLevel% neq 0 (
    echo  ERROR: Ubuntu WSL not found!
    echo  Install with: wsl --install -d Ubuntu
    pause
    exit /b 1
)

:: Check if setup has been run
wsl -d Ubuntu -- test -f /etc/systemd/system/hive-oracle.service
if %errorLevel% neq 0 (
    echo  First time setup required...
    echo  Running setup script...
    wsl -d Ubuntu -- bash /mnt/c/LLM-DevOSWE/Admin/docker/setup-wsl-hive.sh
)

echo  Starting Hive services in WSL...
wsl -d Ubuntu -- sudo systemctl start hive-oracle hive-relay hive-kittbox hive-kittlive hive-mind

echo.
echo  ========================================
echo     HIVE IS ONLINE (WSL Mode)
echo  ========================================
echo.
echo  Services running in WSL Ubuntu:
echo    Oracle:    http://localhost:3002
echo    Relay:     http://localhost:8600
echo    KittBox:   http://localhost:8585
echo    Kitt Live: http://localhost:8686
echo    Hive-Mind: http://localhost:8701
echo.
echo  Commands:
echo    Status:  wsl -d Ubuntu -- systemctl status hive-*
echo    Logs:    wsl -d Ubuntu -- journalctl -u hive-oracle -f
echo    Stop:    wsl -d Ubuntu -- sudo systemctl stop hive-*
echo.
pause
