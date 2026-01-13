@echo off
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║    SimWidget DirectX Overlay - Build Script              ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

:: Check for dotnet
where dotnet >nul 2>nul
if errorlevel 1 (
    echo [ERROR] .NET SDK not found!
    echo Please install .NET 7.0 SDK from: https://dotnet.microsoft.com/download
    pause
    exit /b 1
)

echo [INFO] Building solution...
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
echo Output: SimWidgetInjector\bin\Release\net7.0-windows\
echo.
echo To use:
echo   1. Start MSFS
echo   2. Run SimWidgetInjector.exe (as Administrator)
echo   3. Overlay appears in game!
echo.
pause
