@echo off
REM Opens GTN750 and AI Autopilot pages for manual testing

echo.
echo ============================================================
echo   FLIGHT PLAN NAVIGATION - MANUAL TEST SETUP
echo ============================================================
echo.
echo Opening test pages in default browser...
echo.
echo   1. GTN750 (nav state broadcaster)
echo   2. AI Autopilot (nav state consumer)
echo.
echo Press F12 in each window to open DevTools console
echo.

start http://localhost:8080/ui/gtn750/
timeout /t 2 /nobreak > nul
start http://localhost:8080/ui/ai-autopilot/

echo.
echo ============================================================
echo   Pages opened! Follow TEST-NAV-PLAN.md for test scenarios
echo ============================================================
echo.
pause
