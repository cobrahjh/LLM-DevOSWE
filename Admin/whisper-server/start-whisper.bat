@echo off
title Whisper Speech Server
echo ========================================
echo   Whisper Local Speech-to-Text Server
echo   Port: 8660
echo ========================================
echo.
cd /d "%~dp0"
python server.py
pause
