@echo off
title SimWidget Engine - Hot Reload
cd /d "%~dp0"

echo Starting SimWidget Server with hot reload...
echo 🔥 Hot updates enabled for development

set "NODE_ENV=development"
set "HOT_RELOAD=true"

npx nodemon backend/server.js