@echo off
title Hive Status
color 0A

echo.
echo  ========================================
echo           HIVE STATUS CHECK
echo  ========================================
echo.

:: Check Ollama
echo  [Ollama    :11434]
netstat -ano | findstr :11434 | findstr LISTENING >nul 2>&1
if %errorLevel%==0 ( echo                      ONLINE ) else ( echo                      OFFLINE )

:: Check Oracle
echo  [Oracle    :3002 ]
netstat -ano | findstr :3002 | findstr LISTENING >nul 2>&1
if %errorLevel%==0 ( echo                      ONLINE ) else ( echo                      OFFLINE )

:: Check Relay
echo  [Relay     :8600 ]
netstat -ano | findstr :8600 | findstr LISTENING >nul 2>&1
if %errorLevel%==0 ( echo                      ONLINE ) else ( echo                      OFFLINE )

:: Check KittBox
echo  [KittBox   :8585 ]
netstat -ano | findstr :8585 | findstr LISTENING >nul 2>&1
if %errorLevel%==0 ( echo                      ONLINE ) else ( echo                      OFFLINE )

:: Check Kitt Live
echo  [Kitt Live :8686 ]
netstat -ano | findstr :8686 | findstr LISTENING >nul 2>&1
if %errorLevel%==0 ( echo                      ONLINE ) else ( echo                      OFFLINE )

:: Check Guardian service
echo.
echo  [Guardian Service]
sc query HiveGuardian >nul 2>&1
if %errorLevel%==0 (
    sc query HiveGuardian | findstr RUNNING >nul 2>&1
    if %errorLevel%==0 ( echo                      RUNNING ) else ( echo                      STOPPED )
) else (
    echo                      NOT INSTALLED
)

echo.
echo  ========================================
echo.
pause
