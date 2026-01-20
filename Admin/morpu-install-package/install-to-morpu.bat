@echo off
title Morpu-PC Hive Installer
color 0B

echo.
echo  ========================================
echo     MORPU-PC HIVE INSTALLER
echo  ========================================
echo.

set MORPU_IP=192.168.1.97
set MORPU_USER=hive

echo  Target: %MORPU_USER%@%MORPU_IP%
echo.

:: Check if morpu is reachable
echo  [1/4] Checking connectivity...
ping -n 1 -w 2000 %MORPU_IP% >nul 2>&1
if %errorLevel% neq 0 (
    echo  ERROR: Cannot reach %MORPU_IP%
    echo  Make sure morpu-pc is on and Ubuntu is installed.
    pause
    exit /b 1
)
echo        Connected!

:: Test SSH
echo.
echo  [2/4] Testing SSH...
ssh -o ConnectTimeout=5 -o BatchMode=yes %MORPU_USER%@%MORPU_IP% "echo SSH OK" 2>nul
if %errorLevel% neq 0 (
    echo  ERROR: SSH not available or key not set up.
    echo  Try: ssh-copy-id %MORPU_USER%@%MORPU_IP%
    echo  Or manually copy files with USB drive.
    pause
    exit /b 1
)

:: Copy package
echo.
echo  [3/4] Copying install package...
scp -r "%~dp0." %MORPU_USER%@%MORPU_IP%:~/morpu-install-package/

:: Run installer
echo.
echo  [4/4] Running installer on morpu...
ssh %MORPU_USER%@%MORPU_IP% "cd ~/morpu-install-package && chmod +x install.sh && ./install.sh"

echo.
echo  ========================================
echo     INSTALLATION COMPLETE!
echo  ========================================
echo.
echo  Access morpu-pc at:
echo    Cockpit:   https://%MORPU_IP%:9090
echo    KittBox:   http://%MORPU_IP%:8585
echo    Hive-Mind: http://%MORPU_IP%:8701
echo.
pause
