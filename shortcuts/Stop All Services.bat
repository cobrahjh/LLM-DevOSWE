@echo off
title SimWidget - Stop All Services
echo Stopping all SimWidget services...
net stop simwidgetremotesupport.exe
net stop simwidgetagent.exe
net stop simwidgetmainserver.exe
net stop simwidgetkeysender
echo.
echo All services stopped!
timeout /t 3
