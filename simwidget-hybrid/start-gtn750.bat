@echo off
title SimWidget GTN750 Server
cd /d C:\LLM-DevOSWE\simwidget-hybrid\backend

echo Starting SimWidget GTN750 Server...
echo.
echo Once started, open: http://localhost:8080/ui/gtn750/
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

node server.js

pause
