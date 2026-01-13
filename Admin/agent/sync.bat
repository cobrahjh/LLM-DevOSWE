@echo off
:: SimWidget Git Sync - One-click commit and push
:: Path: C:\LLM-DevOSWE\simwidget-hybrid\tools\sync.bat
:: Last Updated: 2025-01-08

cd /d "C:\LLM-DevOSWE\simwidget-hybrid"

echo.
echo ========================================
echo   SimWidget Git Sync
echo ========================================
echo.

:: Show status
git status --short

:: Check if there are changes
git diff --quiet --exit-code
if %errorlevel%==0 (
    git diff --cached --quiet --exit-code
    if %errorlevel%==0 (
        echo.
        echo No changes to commit.
        pause
        exit /b
    )
)

echo.
set /p msg="Commit message (or Enter for default): "

if "%msg%"=="" set msg=Update %date% %time:~0,5%

echo.
echo Committing: %msg%
echo.

git add .
git commit -m "%msg%"
git push

echo.
echo ========================================
if %errorlevel%==0 (
    echo   Sync complete!
) else (
    echo   Sync failed - check errors above
)
echo ========================================
echo.
pause
