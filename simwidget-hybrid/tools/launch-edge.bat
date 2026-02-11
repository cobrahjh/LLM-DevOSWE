@echo off
REM Launch Edge with anti-throttle flags for SimGlass
REM Prevents background tab freezing when MSFS is fullscreen
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --remote-debugging-port=9222 http://localhost:8080/ui/ai-autopilot/ http://192.168.1.42:8080/ui/gtn750/ http://192.168.1.42:8080/ui/cockpit-fx/
