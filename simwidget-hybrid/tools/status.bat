@echo off
:: SimWidget Server Status
:: Double-click to check server status
:: Path: C:\LLM-DevOSWE\simwidget-hybrid\tools\status.bat

cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "deploy.ps1" -Status
pause
