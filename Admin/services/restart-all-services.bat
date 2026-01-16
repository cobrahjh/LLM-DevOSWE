@echo off
title Hive Services Restart
color 0E

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  ERROR: Run as Administrator!
    pause
    exit /b 1
)

echo.
echo  ========================================
echo     RESTARTING ALL HIVE SERVICES
echo  ========================================
echo.

echo  [1/5] Restarting HiveOracle...
nssm restart HiveOracle
timeout /t 2 /nobreak >nul

echo  [2/5] Restarting HiveRelay...
nssm restart HiveRelay
timeout /t 1 /nobreak >nul

echo  [3/5] Restarting HiveKittBox...
nssm restart HiveKittBox
timeout /t 1 /nobreak >nul

echo  [4/5] Restarting HiveKittLive...
nssm restart HiveKittLive
timeout /t 1 /nobreak >nul

echo  [5/5] Restarting HiveMind...
nssm restart HiveMind

echo.
echo  ========================================
echo     ALL SERVICES RESTARTED
echo  ========================================
echo.
pause
