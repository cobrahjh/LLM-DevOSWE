@echo off
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║    SimWidget DX12 Overlay - Build Script                 ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

where dotnet >nul 2>nul
if errorlevel 1 (
    echo [ERROR] .NET SDK not found!
    pause
    exit /b 1
)

echo [INFO] Building DX12 solution...
echo.

cd /d "%~dp0"
dotnet build -c Release

if errorlevel 1 (
    echo.
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║              Build Successful!                           ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo To use:
echo   1. Start MSFS 2024
echo   2. Run SimWidgetDX12Injector.exe as Administrator
echo.
pause
