@echo off
echo Starting Caddy SSL Reverse Proxy...
echo.
echo Make sure hive.local is in your hosts file:
echo   192.168.1.192 hive.local
echo.
echo Access services via:
echo   https://hive.local/oracle
echo   https://hive.local/relay
echo   https://hive.local/kitt
echo   https://hive.local/simwidget
echo   https://hive.local/widgets
echo.

cd /d "%~dp0"
caddy run --config Caddyfile
