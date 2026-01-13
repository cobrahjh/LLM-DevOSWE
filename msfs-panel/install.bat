@echo off
setlocal enabledelayedexpansion

echo.
echo  ╔════════════════════════════════════════════════════════╗
echo  ║         SimWidget Panel Installer for MSFS             ║
echo  ╚════════════════════════════════════════════════════════╝
echo.

:: Initialize paths
set "STEAM_PATH=%APPDATA%\Microsoft Flight Simulator\Packages\Community"
set "STORE_2020=%LOCALAPPDATA%\Packages\Microsoft.FlightSimulator_8wekyb3d8bbwe\LocalCache\Packages\Community"
set "STORE_2024=%LOCALAPPDATA%\Packages\Microsoft.Limitless_8wekyb3d8bbwe\LocalCache\Packages\Community"
set "FOUND_STEAM=0"
set "FOUND_2020=0"
set "FOUND_2024=0"
set "INSTALL_COUNT=0"

:: Check for Steam version (MSFS 2020)
if exist "%STEAM_PATH%" (
    set "FOUND_STEAM=1"
    echo  [√] Found Steam MSFS 2020
    echo      %STEAM_PATH%
    echo.
)

:: Check for MS Store 2020
if exist "%STORE_2020%" (
    set "FOUND_2020=1"
    echo  [√] Found MS Store MSFS 2020
    echo      %STORE_2020%
    echo.
)

:: Check for MS Store 2024
if exist "%STORE_2024%" (
    set "FOUND_2024=1"
    echo  [√] Found MS Store MSFS 2024
    echo      %STORE_2024%
    echo.
)

:: Count found installations
set /a TOTAL_FOUND=%FOUND_STEAM%+%FOUND_2020%+%FOUND_2024%

:: No installations found
if %TOTAL_FOUND%==0 (
    echo  [X] No MSFS installations found!
    echo.
    echo  Please enter the full path to your Community folder:
    set /p CUSTOM_PATH="  Path: "
    
    if not exist "!CUSTOM_PATH!" (
        echo.
        echo  ERROR: Path does not exist!
        pause
        exit /b 1
    )
    
    call :install_to "!CUSTOM_PATH!"
    goto :done
)

:: Show menu
echo  ──────────────────────────────────────────────────────────
echo  Select installation target:
echo  ──────────────────────────────────────────────────────────
echo.

set "OPT=0"
if "%FOUND_STEAM%"=="1" (
    set /a OPT+=1
    set "OPT!OPT!=STEAM"
    echo    [!OPT!] Steam MSFS 2020
)
if "%FOUND_2020%"=="1" (
    set /a OPT+=1
    set "OPT!OPT!=2020"
    echo    [!OPT!] MS Store MSFS 2020
)
if "%FOUND_2024%"=="1" (
    set /a OPT+=1
    set "OPT!OPT!=2024"
    echo    [!OPT!] MS Store MSFS 2024
)
set /a OPT+=1
set "OPT!OPT!=ALL"
echo    [!OPT!] Install to ALL found locations
set /a OPT+=1
echo    [!OPT!] Cancel
echo.

set /p CHOICE="  Select option: "

:: Handle choice
if "%CHOICE%"=="%OPT%" goto :cancelled
set /a LAST_OPT=%OPT%-1
if "%CHOICE%"=="%LAST_OPT%" goto :install_all

:: Single install
set "TARGET=!OPT%CHOICE%!"
if "%TARGET%"=="STEAM" call :install_to "%STEAM_PATH%"
if "%TARGET%"=="2020" call :install_to "%STORE_2020%"
if "%TARGET%"=="2024" call :install_to "%STORE_2024%"
goto :done

:install_all
if "%FOUND_STEAM%"=="1" call :install_to "%STEAM_PATH%"
if "%FOUND_2020%"=="1" call :install_to "%STORE_2020%"
if "%FOUND_2024%"=="1" call :install_to "%STORE_2024%"
goto :done

:cancelled
echo.
echo  Installation cancelled.
pause
exit /b 0

:done
echo.
echo  ══════════════════════════════════════════════════════════
echo   Installation Complete! (%INSTALL_COUNT% location(s))
echo  ══════════════════════════════════════════════════════════
echo.
echo   To use SimWidget Panel:
echo.
echo     1. Start Microsoft Flight Simulator
echo     2. Load into a flight
echo     3. Click the toolbar at the top of the screen
echo     4. Find and click "SimWidget"
echo.
echo   NOTE: Restart MSFS if it was already running.
echo.
pause
exit /b 0

:: ============================================================
:: Install function
:: ============================================================
:install_to
set "TARGET=%~1\simwidget-panel"

echo.
echo  Installing to: %TARGET%

:: Remove old installation
if exist "%TARGET%" (
    echo  - Removing old version...
    rmdir /s /q "%TARGET%" 2>nul
)

:: Create directory and copy
echo  - Copying files...
mkdir "%TARGET%" 2>nul
xcopy /E /I /Y "%~dp0manifest.json" "%TARGET%\" >nul 2>nul
xcopy /E /I /Y "%~dp0layout.json" "%TARGET%\" >nul 2>nul
xcopy /E /I /Y "%~dp0html_ui" "%TARGET%\html_ui\" >nul 2>nul

:: Verify
if exist "%TARGET%\manifest.json" (
    echo  - [OK] Installed successfully!
    set /a INSTALL_COUNT+=1
) else (
    echo  - [ERROR] Installation failed!
)

exit /b 0
