@echo off
REM SimWidget Server Restart with vJoy Camera Support
REM Harold-PC - C:\LLM-DevOSWE\restart-server.bat

echo Stopping existing server...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo Starting SimWidget server...
cd /d C:\LLM-DevOSWE\simwidget-hybrid
start "SimWidget Server" cmd /c "node backend\server.js"

echo.
echo Server started! Check the new window for vJoy status.
echo.
echo Test camera controls:
echo   curl -X POST http://localhost:8080/api/camera/cinematic
echo   curl -X POST http://localhost:8080/api/camera/next
echo.
pause
