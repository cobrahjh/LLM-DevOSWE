@echo off
:: Start code-server for remote VS Code access
:: Path: C:\LLM-DevOSWE\Admin\start-code-server.bat
:: Access from: http://192.168.1.42:8443

echo Starting code-server...
echo.
echo Access from any device: http://192.168.1.42:8443
echo.
code-server "C:\LLM-DevOSWE\simwidget-hybrid"
