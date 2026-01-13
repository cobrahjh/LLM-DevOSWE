@echo off
echo ========================================
echo   SimWidget Engine - Server
echo ========================================
echo.
echo Starting SimConnect bridge server...
echo Make sure MSFS is running!
echo.
cd /d "%~dp0server"
call npm start
pause
