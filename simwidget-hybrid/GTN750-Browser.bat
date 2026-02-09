@echo off
REM GTN750 Glass v2.3.0 - Browser Mode Launcher
REM Opens GTN750 in default browser with performance optimizations

echo ========================================
echo  GTN750 Glass v2.3.0 - Browser Mode
echo ========================================
echo.
echo  Performance: 60 FPS, 10MB memory
echo  Version: v2.3.0 (optimized)
echo.
echo  Opening in browser...
echo.

start http://localhost:8080/ui/gtn750/

echo  GTN750 opened in browser!
echo.
echo  Features:
echo   - Moving map with 7 zoom levels
echo   - Flight planning and Direct-To
echo   - CDI navigation (GPS/NAV1/NAV2)
echo   - Terrain/Traffic/Weather overlays
echo   - 11 pages, 12 data fields
echo.
echo  Press any key to close this window...
pause >nul
