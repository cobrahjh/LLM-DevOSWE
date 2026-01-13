@echo off
:: Quick sync for development - copies changed files to Community folder

set "SOURCE=%~dp0"
set "DEST_STEAM=%APPDATA%\Microsoft Flight Simulator\Packages\Community\simwidget-panel"
set "DEST_2020=%LOCALAPPDATA%\Packages\Microsoft.FlightSimulator_8wekyb3d8bbwe\LocalCache\Packages\Community\simwidget-panel"
set "DEST_2024=%LOCALAPPDATA%\Packages\Microsoft.Limitless_8wekyb3d8bbwe\LocalCache\Packages\Community\simwidget-panel"

:: Check which exists
if exist "%DEST_2024%" (
    set "DEST=%DEST_2024%"
    echo Syncing to MSFS 2024...
) else if exist "%DEST_STEAM%" (
    set "DEST=%DEST_STEAM%"
    echo Syncing to Steam MSFS 2020...
) else if exist "%DEST_2020%" (
    set "DEST=%DEST_2020%"
    echo Syncing to MS Store MSFS 2020...
) else (
    echo No installation found! Run install.bat first.
    pause
    exit /b 1
)

:: Copy only the HTML/JS/CSS files (fast sync)
echo Copying files...
xcopy /Y /S "%SOURCE%html_ui\*.*" "%DEST%\html_ui\" >nul

echo.
echo ════════════════════════════════════════════════════════
echo  [OK] Files synced to: %DEST%
echo ════════════════════════════════════════════════════════
echo.
echo  Now in MSFS:
echo    1. Tools - Virtual File System - Actions - Rescan
echo    2. Close panel (X), reopen from toolbar
echo.
