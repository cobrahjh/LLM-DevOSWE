@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo SimWidget Camera WASM Module Installer
echo ==========================================
echo.

set "SOURCE=%~dp0package\simwidget-camera"

:: Check if package exists
if not exist "%SOURCE%\modules\simwidget_camera.wasm" (
    echo ERROR: WASM module not found at %SOURCE%
    echo Please build the module first using build_v4.bat
    pause
    exit /b 1
)

echo Source: %SOURCE%
echo.

:: Try common MSFS locations
set "FOUND="

:: Steam MSFS 2020
set "STEAM=%APPDATA%\Microsoft Flight Simulator\Packages\Community"
if exist "%STEAM%" (
    echo Found: Steam MSFS 2020 location
    set "DEST=%STEAM%"
    set "FOUND=1"
)

:: MS Store MSFS 2020
set "STORE=%LOCALAPPDATA%\Packages\Microsoft.FlightSimulator_8wekyb3d8bbwe\LocalCache\Packages\Community"
if exist "%STORE%" (
    echo Found: MS Store MSFS 2020 location
    set "DEST=%STORE%"
    set "FOUND=1"
)

:: Xbox/MS Store MSFS 2024
set "XBOX2024=%LOCALAPPDATA%\Packages\Microsoft.Limitless_8wekyb3d8bbwe\LocalCache\Packages\Community"
if exist "%XBOX2024%" (
    echo Found: MS Store MSFS 2024 location
    set "DEST=%XBOX2024%"
    set "FOUND=1"
)

:: Steam MSFS 2024
set "STEAM2024=%APPDATA%\Microsoft Flight Simulator 2024\Packages\Community"
if exist "%STEAM2024%" (
    echo Found: Steam MSFS 2024 location
    set "DEST=%STEAM2024%"
    set "FOUND=1"
)

:: If not found, ask user
if not defined FOUND (
    echo.
    echo MSFS Community folder not found in standard locations.
    echo Please enter the full path to your Community folder:
    echo.
    set /p "DEST=Path: "

    if not exist "!DEST!" (
        echo ERROR: Path does not exist: !DEST!
        pause
        exit /b 1
    )
)

echo.
echo Installing to: %DEST%
echo.

:: Remove old version if exists
if exist "%DEST%\simwidget-camera" (
    echo Removing old version...
    rmdir /s /q "%DEST%\simwidget-camera"
)

:: Copy package
echo Copying files...
xcopy /E /I /Y "%SOURCE%" "%DEST%\simwidget-camera"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ==========================================
    echo SUCCESS! SimWidget Camera installed.
    echo ==========================================
    echo.
    echo Restart MSFS to load the module.
    echo The module will set L:SIMWIDGET_CAM_READY = 1 when loaded.
    echo.
) else (
    echo.
    echo ERROR: Installation failed with code %ERRORLEVEL%
    echo.
)

pause
