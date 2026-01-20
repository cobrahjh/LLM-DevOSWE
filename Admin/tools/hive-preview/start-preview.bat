@echo off
title Hive Device Preview
color 0D
echo.
echo  Starting Hive Device Preview...
echo.
start http://localhost:8800
node "%~dp0server.js"
