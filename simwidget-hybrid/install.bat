@echo off
setlocal enabledelayedexpansion

echo.
echo  ======================================================
echo     GTN750 GPS Navigator - MSFS Panel Installer
echo  ======================================================
echo.

:: Source directories
set "SCRIPT_DIR=%~dp0"
set "GTN_SRC=%SCRIPT_DIR%..\ui\gtn750"
set "SHARED_SRC=%SCRIPT_DIR%..\ui\shared"
set "PANEL_SRC=%SCRIPT_DIR%html_ui\InGamePanels\GTN750Panel"

:: MSFS Community paths
set "STEAM_PATH=%APPDATA%\Microsoft Flight Simulator\Packages\Community"
set "STORE_2020=%LOCALAPPDATA%\Packages\Microsoft.FlightSimulator_8wekyb3d8bbwe\LocalCache\Packages\Community"
set "STORE_2024=%LOCALAPPDATA%\Packages\Microsoft.Limitless_8wekyb3d8bbwe\LocalCache\Packages\Community"
set "FOUND_STEAM=0"
set "FOUND_2020=0"
set "FOUND_2024=0"
set "INSTALL_COUNT=0"

:: Check installations
if exist "%STEAM_PATH%" (
    set "FOUND_STEAM=1"
    echo  [+] Found Steam MSFS 2020: %STEAM_PATH%
)
if exist "%STORE_2020%" (
    set "FOUND_2020=1"
    echo  [+] Found MS Store MSFS 2020: %STORE_2020%
)
if exist "%STORE_2024%" (
    set "FOUND_2024=1"
    echo  [+] Found MS Store MSFS 2024: %STORE_2024%
)

set /a TOTAL_FOUND=%FOUND_STEAM%+%FOUND_2020%+%FOUND_2024%

if %TOTAL_FOUND%==0 (
    echo  [X] No MSFS installations found!
    echo.
    echo  Enter the full path to your Community folder:
    set /p CUSTOM_PATH="  Path: "
    if not exist "!CUSTOM_PATH!" (
        echo  ERROR: Path does not exist!
        pause
        exit /b 1
    )
    call :install_to "!CUSTOM_PATH!"
    goto :done
)

echo.
echo  Select installation target:
echo  ----------------------------------------
set "OPT=0"
if "%FOUND_STEAM%"=="1" ( set /a OPT+=1 & set "OPT!OPT!=STEAM" & echo    [!OPT!] Steam MSFS 2020 )
if "%FOUND_2020%"=="1" ( set /a OPT+=1 & set "OPT!OPT!=2020" & echo    [!OPT!] MS Store MSFS 2020 )
if "%FOUND_2024%"=="1" ( set /a OPT+=1 & set "OPT!OPT!=2024" & echo    [!OPT!] MS Store MSFS 2024 )
set /a OPT+=1
set "OPT!OPT!=ALL"
echo    [!OPT!] Install to ALL
set /a OPT+=1
echo    [!OPT!] Cancel
echo.
set /p CHOICE="  Select: "

if "%CHOICE%"=="%OPT%" goto :cancelled
set /a LAST_OPT=%OPT%-1
if "%CHOICE%"=="%LAST_OPT%" goto :install_all

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
echo  Cancelled.
pause
exit /b 0

:done
echo.
echo  ======================================================
echo   Installation Complete! (%INSTALL_COUNT% location(s))
echo  ======================================================
echo.
echo   1. Start Microsoft Flight Simulator
echo   2. Load into a flight
echo   3. Open toolbar, find "GTN750"
echo.
echo   NOTE: Restart MSFS if already running.
echo.
pause
exit /b 0

:: ============================================================
:install_to
set "DEST=%~1\SimGlass-gtn750"

echo.
echo  Installing to: %DEST%

:: Clean old install
if exist "%DEST%" ( rmdir /s /q "%DEST%" 2>nul )

:: Create structure
set "PANEL=%DEST%\html_ui\InGamePanels\GTN750Panel"
mkdir "%PANEL%\modules" 2>nul
mkdir "%PANEL%\overlays" 2>nul
mkdir "%PANEL%\pages" 2>nul
mkdir "%PANEL%\shared" 2>nul

:: Copy MSFS metadata
copy /Y "%SCRIPT_DIR%manifest.json" "%DEST%\" >nul 2>nul
copy /Y "%SCRIPT_DIR%layout.json" "%DEST%\" >nul 2>nul

:: Copy panel files
copy /Y "%PANEL_SRC%\GTN750Panel.html" "%PANEL%\" >nul 2>nul
copy /Y "%PANEL_SRC%\panel.json" "%PANEL%\" >nul 2>nul

:: Copy GTN750 source
copy /Y "%GTN_SRC%\widget.js" "%PANEL%\" >nul 2>nul
copy /Y "%GTN_SRC%\styles.css" "%PANEL%\" >nul 2>nul
xcopy /Y /S "%GTN_SRC%\modules\*.*" "%PANEL%\modules\" >nul 2>nul
xcopy /Y /S "%GTN_SRC%\overlays\*.*" "%PANEL%\overlays\" >nul 2>nul
xcopy /Y /S "%GTN_SRC%\pages\*.*" "%PANEL%\pages\" >nul 2>nul

:: Copy shared CSS
copy /Y "%SHARED_SRC%\widget-common.css" "%PANEL%\shared\" >nul 2>nul
copy /Y "%SHARED_SRC%\themes.css" "%PANEL%\shared\" >nul 2>nul

:: Verify
if exist "%DEST%\manifest.json" (
    echo  [OK] Installed successfully!
    set /a INSTALL_COUNT+=1
) else (
    echo  [ERROR] Installation failed!
)

exit /b 0
