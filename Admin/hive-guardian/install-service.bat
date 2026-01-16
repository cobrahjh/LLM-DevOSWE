@echo off
:: Hive Guardian Service Installer
:: Requires NSSM (https://nssm.cc) - download and place nssm.exe in this folder or PATH

title Hive Guardian Installer
color 0B

echo.
echo  ========================================
echo     HIVE GUARDIAN SERVICE INSTALLER
echo  ========================================
echo.

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  ERROR: Run this script as Administrator!
    echo.
    pause
    exit /b 1
)

:: Check if nssm exists
where nssm >nul 2>&1
if %errorLevel% neq 0 (
    if exist "%~dp0nssm.exe" (
        set NSSM=%~dp0nssm.exe
    ) else (
        echo  ERROR: NSSM not found!
        echo.
        echo  Download from: https://nssm.cc/download
        echo  Place nssm.exe in this folder or add to PATH
        echo.
        pause
        exit /b 1
    )
) else (
    set NSSM=nssm
)

:: Get Node path
for /f "delims=" %%i in ('where node') do set NODE_PATH=%%i

echo  Found Node: %NODE_PATH%
echo.

:: Remove existing service if present
echo  Removing existing service (if any)...
%NSSM% stop HiveGuardian >nul 2>&1
%NSSM% remove HiveGuardian confirm >nul 2>&1

:: Install service
echo  Installing Hive Guardian service...
%NSSM% install HiveGuardian "%NODE_PATH%" "%~dp0hive-guardian.js"

:: Configure service
%NSSM% set HiveGuardian AppDirectory "%~dp0"
%NSSM% set HiveGuardian DisplayName "Hive Guardian"
%NSSM% set HiveGuardian Description "Auto-healing monitor for LLM-DevOSWE services"
%NSSM% set HiveGuardian Start SERVICE_AUTO_START
%NSSM% set HiveGuardian AppStdout "%~dp0hive-guardian.log"
%NSSM% set HiveGuardian AppStderr "%~dp0hive-guardian.log"
%NSSM% set HiveGuardian AppRotateFiles 1
%NSSM% set HiveGuardian AppRotateBytes 1048576

:: Start service
echo  Starting service...
%NSSM% start HiveGuardian

echo.
echo  ========================================
echo     INSTALLATION COMPLETE
echo  ========================================
echo.
echo  Service: HiveGuardian
echo  Status:  Auto-start on boot
echo  Log:     %~dp0hive-guardian.log
echo.
echo  Commands:
echo    nssm start HiveGuardian   - Start service
echo    nssm stop HiveGuardian    - Stop service
echo    nssm status HiveGuardian  - Check status
echo    nssm remove HiveGuardian  - Uninstall
echo.
pause
