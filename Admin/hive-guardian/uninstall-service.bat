@echo off
:: Hive Guardian Service Uninstaller

title Hive Guardian Uninstaller
color 0C

echo.
echo  ========================================
echo    HIVE GUARDIAN SERVICE UNINSTALLER
echo  ========================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  ERROR: Run this script as Administrator!
    pause
    exit /b 1
)

where nssm >nul 2>&1
if %errorLevel% neq 0 (
    if exist "%~dp0nssm.exe" ( set NSSM=%~dp0nssm.exe ) else ( set NSSM=nssm )
) else (
    set NSSM=nssm
)

echo  Stopping service...
%NSSM% stop HiveGuardian >nul 2>&1

echo  Removing service...
%NSSM% remove HiveGuardian confirm >nul 2>&1

echo.
echo  Hive Guardian service removed.
echo.
pause
