@echo off
echo ========================================
echo   SimWidget Engine - Overlay
echo ========================================
echo.
echo Starting transparent overlay...
echo Press F12 to toggle debug panel
echo.
cd /d "%~dp0overlay"
call npm start
pause
