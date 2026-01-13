@echo off
title SimWidget Backend Server
cd /d "C:\LLM-DevOSWE\simwidget-hybrid\backend"
set "PATH=%PATH%;C:\Program Files\nodejs"

echo Starting SimWidget Backend Server...
echo.

call npm install --silent
call node server.js

pause
