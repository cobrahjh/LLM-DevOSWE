@echo off
echo Stopping Open WebUI...
docker stop open-webui
docker rm open-webui
echo Done.
