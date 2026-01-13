@echo off
:: SimWidget Quick Restart
:: Double-click to restart the server
:: Path: C:\LLM-DevOSWE\simwidget-hybrid\tools\restart.bat

cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "deploy.ps1"
pause
