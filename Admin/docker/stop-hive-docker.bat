@echo off
title Hive Docker Stop
color 0C

echo.
echo  Stopping Hive Docker containers...
echo.

cd /d %~dp0
docker-compose down

echo.
echo  All Hive containers stopped.
echo.
pause
