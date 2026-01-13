@echo off
:: SimWidget Server Stop
:: Double-click to stop the server
:: Path: C:\LLM-DevOSWE\simwidget-hybrid\tools\stop.bat

cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "deploy.ps1" -Stop
pause
