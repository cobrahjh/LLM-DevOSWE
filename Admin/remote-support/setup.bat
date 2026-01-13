@echo off
echo ========================================
echo  SimWidget Remote Support - Setup
echo ========================================
echo.

cd /d "%~dp0"

echo Installing dependencies...
call npm install

echo.
echo Dependencies installed!
echo.
echo To run manually: npm start
echo To install as Windows service: npm run install-service
echo.
pause
