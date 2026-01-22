@echo off
net stop simwidgetrelay.exe
timeout /t 2 /nobreak
net start simwidgetrelay.exe
