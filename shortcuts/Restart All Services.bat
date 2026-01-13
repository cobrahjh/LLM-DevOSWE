@echo off
title SimWidget - Restart All Services
echo Restarting all SimWidget services...
net stop simwidgetremotesupport.exe
net stop simwidgetagent.exe
net stop simwidgetmainserver.exe
net stop simwidgetkeysender
timeout /t 2 /nobreak >nul
net start simwidgetkeysender
net start simwidgetmainserver.exe
net start simwidgetagent.exe
net start simwidgetremotesupport.exe
echo.
echo All services restarted!
timeout /t 3
