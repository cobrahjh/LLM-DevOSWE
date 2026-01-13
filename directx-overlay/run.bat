@echo off
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║       SimWidget DirectX Overlay - Launcher               ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

:: Check for admin rights
net session >nul 2>&1
if errorlevel 1 (
    echo [!] This needs to run as Administrator
    echo.
    echo Right-click and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

:: Check if build exists
if not exist "%~dp0SimWidgetInjector\bin\x64\Release\net48\SimWidgetInjector.exe" (
    echo [!] Build not found. Building now...
    call "%~dp0build.bat"
)

echo [*] Starting SimWidget DirectX Overlay...
echo.

:: Run the injector
"%~dp0SimWidgetInjector\bin\x64\Release\net48\SimWidgetInjector.exe"
