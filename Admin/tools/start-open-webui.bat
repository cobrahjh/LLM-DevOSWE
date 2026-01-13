@echo off
echo Starting Open WebUI...
docker run -d -p 3000:8080 --add-host=host.docker.internal:host-gateway -v open-webui:/app/backend/data --name open-webui ghcr.io/open-webui/open-webui:main
echo.
echo Open WebUI starting at http://localhost:3000
echo (First run will download ~2GB image)
start http://localhost:3000
