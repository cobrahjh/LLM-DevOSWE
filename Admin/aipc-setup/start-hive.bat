@echo off
title AI-PC Hive Bridge
color 0B

echo.
echo  ================================
echo    AI-PC HIVE BRIDGE
echo  ================================
echo.
echo  Starting Hive Bridge on port 3003...
echo  Proxying to LM Studio on port 1234
echo.

cd /d C:\Hive\services
node hive-bridge.js

pause
