@echo off
title Hive Services Uninstaller
color 0C

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  ERROR: Run as Administrator!
    echo  Right-click and select "Run as administrator"
    pause
    exit /b 1
)

echo.
echo  ========================================
echo     HIVE SERVICES UNINSTALLER
echo  ========================================
echo.
echo  This will stop and remove all Hive services.
echo.
set /p confirm="Are you sure? (y/n): "
if /i not "%confirm%"=="y" (
    echo  Cancelled.
    pause
    exit /b 0
)

echo.
echo  Stopping and removing services...
echo.

echo  [1/5] Removing HiveOracle...
nssm stop HiveOracle >nul 2>&1
nssm remove HiveOracle confirm >nul 2>&1
echo        Done.

echo  [2/5] Removing HiveRelay...
nssm stop HiveRelay >nul 2>&1
nssm remove HiveRelay confirm >nul 2>&1
echo        Done.

echo  [3/5] Removing HiveKittBox...
nssm stop HiveKittBox >nul 2>&1
nssm remove HiveKittBox confirm >nul 2>&1
echo        Done.

echo  [4/5] Removing HiveKittLive...
nssm stop HiveKittLive >nul 2>&1
nssm remove HiveKittLive confirm >nul 2>&1
echo        Done.

echo  [5/5] Removing HiveMind...
nssm stop HiveMind >nul 2>&1
nssm remove HiveMind confirm >nul 2>&1
echo        Done.

echo.
echo  ========================================
echo     ALL SERVICES REMOVED
echo  ========================================
echo.
echo  Note: Log files remain at:
echo  C:\LLM-DevOSWE\Admin\services\logs\
echo.
pause
