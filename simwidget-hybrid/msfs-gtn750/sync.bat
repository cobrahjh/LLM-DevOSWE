@echo off
:: Quick sync for GTN750 development - copies changed files to Community folder

set "SCRIPT_DIR=%~dp0"
set "GTN_SRC=%SCRIPT_DIR%..\ui\gtn750"
set "SHARED_SRC=%SCRIPT_DIR%..\ui\shared"

set "DEST_STEAM=%APPDATA%\Microsoft Flight Simulator\Packages\Community\simwidget-gtn750"
set "DEST_2020=%LOCALAPPDATA%\Packages\Microsoft.FlightSimulator_8wekyb3d8bbwe\LocalCache\Packages\Community\simwidget-gtn750"
set "DEST_2024=%LOCALAPPDATA%\Packages\Microsoft.Limitless_8wekyb3d8bbwe\LocalCache\Packages\Community\simwidget-gtn750"

:: Find active installation
if exist "%DEST_2024%" (
    set "DEST=%DEST_2024%"
    echo Syncing GTN750 to MSFS 2024...
) else if exist "%DEST_STEAM%" (
    set "DEST=%DEST_STEAM%"
    echo Syncing GTN750 to Steam MSFS 2020...
) else if exist "%DEST_2020%" (
    set "DEST=%DEST_2020%"
    echo Syncing GTN750 to MS Store MSFS 2020...
) else (
    echo No GTN750 installation found! Run install.bat first.
    pause
    exit /b 1
)

set "PANEL=%DEST%\html_ui\InGamePanels\GTN750Panel"

echo Copying files...

:: Sync GTN750 source
copy /Y "%GTN_SRC%\widget.js" "%PANEL%\" >nul
copy /Y "%GTN_SRC%\styles.css" "%PANEL%\" >nul
xcopy /Y /S "%GTN_SRC%\modules\*.*" "%PANEL%\modules\" >nul
xcopy /Y /S "%GTN_SRC%\overlays\*.*" "%PANEL%\overlays\" >nul
xcopy /Y /S "%GTN_SRC%\pages\*.*" "%PANEL%\pages\" >nul

:: Sync shared CSS
copy /Y "%SHARED_SRC%\widget-common.css" "%PANEL%\shared\" >nul
copy /Y "%SHARED_SRC%\themes.css" "%PANEL%\shared\" >nul

:: Sync panel HTML
copy /Y "%SCRIPT_DIR%html_ui\InGamePanels\GTN750Panel\GTN750Panel.html" "%PANEL%\" >nul

echo.
echo ========================================================
echo  [OK] GTN750 synced to: %DEST%
echo ========================================================
echo.
echo  Now in MSFS:
echo    1. Tools - Virtual File System - Actions - Rescan
echo    2. Close GTN750 panel (X), reopen from toolbar
echo.
