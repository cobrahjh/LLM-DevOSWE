@echo off
title Project Launcher - All Projects
setlocal enabledelayedexpansion

echo ========================================
echo   Project Launcher - All Projects
echo ========================================
echo.
echo   [1] Start LLM-DevOSWE services only
echo   [2] Start Claude sessions only (both projects)
echo   [3] Start everything (services + Claude sessions)
echo   [4] Status check
echo   [Q] Quit
echo.
set /p "CHOICE=Choose action [1/2/3/4/Q]: "

if /i "%CHOICE%"=="1" goto :SERVICES
if /i "%CHOICE%"=="2" goto :CLAUDE
if /i "%CHOICE%"=="3" goto :ALL
if /i "%CHOICE%"=="4" goto :STATUS
if /i "%CHOICE%"=="Q" goto :END

echo Invalid choice.
goto :END

:SERVICES
echo.
echo Starting LLM-DevOSWE services...
call C:\LLM-DevOSWE\start-all-servers.bat
goto :END

:CLAUDE
echo.
echo Launching Claude sessions...
echo.
echo   [B] Both projects
echo   [L] LLM-DevOSWE only (Blue)
echo   [K] kittbox-web only (Red)
echo.
set /p "PROJECT=Choose [B/L/K]: "

if /i "%PROJECT%"=="B" (
    echo Starting both Claude sessions...
    start "" wt.exe -p "{11111111-1111-1111-1111-111111111111}"
    timeout /t 2 /nobreak >nul
    start "" wt.exe -p "{22222222-2222-2222-2222-222222222222}"
    goto :END
)
if /i "%PROJECT%"=="L" (
    start "" wt.exe -p "{11111111-1111-1111-1111-111111111111}"
    goto :END
)
if /i "%PROJECT%"=="K" (
    start "" wt.exe -p "{22222222-2222-2222-2222-222222222222}"
    goto :END
)
goto :END

:ALL
echo.
echo Starting LLM-DevOSWE services...
start "" cmd /c "C:\LLM-DevOSWE\start-all-servers.bat"
timeout /t 3 /nobreak >nul
echo.
echo Launching Claude sessions...
start "" wt.exe -p "{11111111-1111-1111-1111-111111111111}"
timeout /t 2 /nobreak >nul
start "" wt.exe -p "{22222222-2222-2222-2222-222222222222}"
echo.
echo All started!
goto :END

:STATUS
echo.
echo === Service Status ===
echo.
echo Checking ports...
for %%p in (8080 8500 8585 8590 8600) do (
    set "FOUND=0"
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%p.*LISTENING" 2^>nul') do (
        set "FOUND=1"
        echo   [%%p] RUNNING (PID: %%a)
    )
    if !FOUND!==0 echo   [%%p] NOT RUNNING
)
echo.
echo === Project Terminals ===
echo   LLM-DevOSWE: wt -p {11111111-1111-1111-1111-111111111111}
echo   kittbox-web: wt -p {22222222-2222-2222-2222-222222222222}
echo.
goto :END

:END
echo.
pause
