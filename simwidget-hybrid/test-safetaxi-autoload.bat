@echo off
REM SafeTaxi Auto-Load Test - Run this on harold-pc with MSFS running
SETLOCAL ENABLEDELAYEDEXPANSION

echo.
echo ========================================
echo  SafeTaxi Auto-Load Test
echo  Testing with Live MSFS Data
echo ========================================
echo.

REM Check if server is running
curl -s http://localhost:8080/api/status > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] SimWidget server not running on port 8080
    echo Please start the server first: start-all-servers.bat
    echo.
    pause
    exit /b 1
)

echo [OK] SimWidget server running
echo.

REM Pull latest changes from git
echo Updating to latest version...
cd /d C:\LLM-DevOSWE\simwidget-hybrid
git pull
echo.

REM Test 1: Check current flight conditions
echo ========================================
echo Test 1: Current Flight Conditions
echo ========================================
node -e "const test = async () => { try { const r = await fetch('http://localhost:8080/api/status'); const d = await r.json(); if (d.flightData) { console.log('Position:', d.flightData.latitude.toFixed(4), d.flightData.longitude.toFixed(4)); console.log('AGL:', d.flightData.agl, 'ft'); console.log('Ground Speed:', d.flightData.groundSpeed, 'kts'); console.log(''); if (d.flightData.agl < 50 && d.flightData.groundSpeed < 5) { console.log('✅ AUTO-LOAD CONDITIONS MET!'); } else { console.log('⚠️  Auto-load conditions NOT met'); console.log('   Need: AGL<50ft and GS<5kts'); } } else { console.log('⚠️  No flight data available - is MSFS running?'); } } catch(e) { console.log('❌ Error:', e.message); } }; test();"
echo.
timeout /t 2 /nobreak >nul

REM Test 2: Check nearby airports
echo ========================================
echo Test 2: Nearby Airports
echo ========================================
node -e "const test = async () => { try { const status = await fetch('http://localhost:8080/api/status'); const data = await status.json(); if (data.flightData) { const lat = data.flightData.latitude; const lon = data.flightData.longitude; const r = await fetch(`http://localhost:8080/api/navdb/nearby/airports?lat=${lat}&lon=${lon}&range=10&limit=3`); const airports = await r.json(); const items = airports.items || airports; if (items.length > 0) { console.log('Found', items.length, 'nearby airports:'); items.forEach((a,i) => console.log(`  ${i+1}. ${a.icao} - ${a.name} (${a.distance?.toFixed(1)}nm)`)); } else { console.log('⚠️  No airports found within 10nm'); } } } catch(e) { console.log('❌ Error:', e.message); } }; test();"
echo.
timeout /t 2 /nobreak >nul

REM Test 3: Open test pages
echo ========================================
echo Test 3: Opening Test Pages
echo ========================================
echo.
echo Opening in browser:
echo  - GTN750 Widget
echo  - Auto-Load Test Dashboard
echo.

start http://localhost:8080/ui/gtn750/
timeout /t 1 /nobreak >nul
start http://localhost:8080/ui/gtn750/test-autoload.html

echo.
echo ========================================
echo Test Instructions
echo ========================================
echo.
echo IN THE GTN750 WINDOW:
echo  1. Press F12 to open console
echo  2. Paste: localStorage.setItem('gtn750-debug', 'true'); location.reload();
echo  3. Stay on MAP or FPL page (NOT TAXI)
echo  4. Land the aircraft or ensure on ground (AGL^<50, GS^<5)
echo  5. Watch console for: [SafeTaxi] Auto-loading nearest airport
echo  6. Switch to TAXI page - diagram should be loaded!
echo.
echo IN THE TEST DASHBOARD WINDOW:
echo  1. Click "Run All Tests" button
echo  2. Review test results
echo  3. Click "Test Live Auto-Load" for step-by-step instructions
echo.
echo ========================================
echo.
pause
