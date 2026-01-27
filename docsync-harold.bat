@echo off
REM ============================================
REM  Harold DocSync - Syncs essential docs to Google Drive
REM  Target: G:\My Drive\__AI Development\Harold\
REM  Run manually or auto via git post-commit hook
REM ============================================

set SRC=C:\LLM-DevOSWE
set DST=G:\My Drive\__AI Development\Harold

echo [DocSync] Syncing to %DST% ...

REM Create directories
if not exist "%DST%\admin" mkdir "%DST%\admin"
if not exist "%DST%\reference" mkdir "%DST%\reference"
if not exist "%DST%\guides" mkdir "%DST%\guides"
if not exist "%DST%\screenshots" mkdir "%DST%\screenshots"

REM --- Admin docs ---
copy /Y "%SRC%\SERVICE-REGISTRY.md"   "%DST%\admin\" >nul
copy /Y "%SRC%\ARCHITECTURE.md"       "%DST%\admin\" >nul
copy /Y "%SRC%\STANDARDS.md"          "%DST%\admin\" >nul
copy /Y "%SRC%\IMPROVEMENT-REPORT.md" "%DST%\admin\" >nul

REM --- Reference docs ---
copy /Y "%SRC%\CLAUDE.md"              "%DST%\reference\" >nul
copy /Y "%SRC%\docs\HIVE-PROTOCOLS.md" "%DST%\reference\" >nul
copy /Y "%SRC%\docs\PERSONAS.md"       "%DST%\reference\" >nul
copy /Y "%SRC%\docs\INTEL-SOURCES.md"  "%DST%\reference\" >nul

REM --- Guides ---
copy /Y "%SRC%\docs\CAMERA-TROUBLESHOOTING.md" "%DST%\guides\" >nul

REM --- Screenshots (if exists) ---
if exist "C:\Users\Stone-PC\OneDrive\Pictures\screenshoots\hive-dashboard.png" (
    copy /Y "C:\Users\Stone-PC\OneDrive\Pictures\screenshoots\hive-dashboard.png" "%DST%\screenshots\" >nul
)

REM --- HTML index ---
copy /Y "%SRC%\Admin\harold-portal\index.html" "%DST%\index.html" >nul 2>nul

echo [DocSync] Done. %date% %time%
