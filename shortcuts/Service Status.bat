@echo off
title SimWidget - Service Status
echo.
echo ========================================
echo   SimWidget Services Status
echo ========================================
echo.
powershell -Command "Get-Service | Where-Object { $_.DisplayName -like '*SimWidget*' } | Format-Table Name, DisplayName, Status -AutoSize"
echo.
echo ========================================
echo   Listening Ports
echo ========================================
echo.
netstat -ano | findstr ":8080 :8585 :8590 :9999"
echo.
pause
