@echo off
title Hive WSL Stop
color 0C

echo.
echo  Stopping Hive services in WSL...
wsl -d Ubuntu -- sudo systemctl stop hive-oracle hive-relay hive-kittbox hive-kittlive hive-mind hive-docsync

echo.
echo  All Hive services stopped.
echo.
pause
