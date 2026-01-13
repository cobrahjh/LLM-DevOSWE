@echo off
echo ========================================
echo   SimWidget Engine - Installation
echo ========================================
echo.
echo Installing dependencies...
echo.

echo [1/2] Installing server dependencies...
cd /d "%~dp0server"
call npm install

echo.
echo [2/2] Installing overlay dependencies...
cd /d "%~dp0overlay"
call npm install

echo.
echo ========================================
echo   Installation Complete!
echo ========================================
echo.
echo Next steps:
echo   1. Start MSFS 2020/2024
echo   2. Run start-server.bat
echo   3. Run start-overlay.bat
echo.
pause
