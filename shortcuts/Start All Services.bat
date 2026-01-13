@echo off
title SimWidget - Start All Services
echo Starting all SimWidget services...
net start simwidgetkeysender
net start simwidgetmainserver.exe
net start simwidgetagent.exe
net start simwidgetremotesupport.exe
echo.
echo All services started!
timeout /t 3
