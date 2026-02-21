@echo off
schtasks /delete /tn "StartSimWidget" /f >nul 2>&1
schtasks /create /tn "StartSimWidget" /tr "wscript.exe C:\LLM-DevOSWE\simwidget-hybrid\backend\start-hidden.vbs" /sc once /st 00:00 /sd 01/01/2000 /ru "%USERNAME%" /f
schtasks /run /tn "StartSimWidget"
echo Server starting (hidden)...
