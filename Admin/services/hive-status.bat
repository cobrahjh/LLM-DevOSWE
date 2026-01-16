@echo off
title Hive Services Status
color 0B

echo.
echo  ========================================
echo       HIVE SERVICES STATUS
echo  ========================================
echo.

echo  Checking services...
echo.

:: Function to check service status
call :checkService HiveOracle 3002
call :checkService HiveRelay 8600
call :checkService HiveKittBox 8585
call :checkService HiveKittLive 8686
call :checkService HiveMind 8701

echo.
echo  ========================================
echo.
echo  Commands:
echo    services.msc     - Windows service manager
echo    nssm start X     - Start a service
echo    nssm stop X      - Stop a service
echo    nssm restart X   - Restart a service
echo.
pause
goto :eof

:checkService
set svcName=%1
set port=%2

sc query %svcName% >nul 2>&1
if %errorLevel% neq 0 (
    echo  [NOT INSTALLED] %svcName% ^(port %port%^)
    goto :eof
)

for /f "tokens=3,4" %%a in ('sc query %svcName% ^| findstr STATE') do (
    if "%%a"=="4" (
        echo  [  RUNNING   ] %svcName% ^(port %port%^)
    ) else if "%%a"=="1" (
        echo  [  STOPPED   ] %svcName% ^(port %port%^)
    ) else (
        echo  [  %%a %%b  ] %svcName% ^(port %port%^)
    )
)
goto :eof
