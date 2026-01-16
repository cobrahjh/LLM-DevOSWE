#!/bin/bash
# Start Hive in Docker
# Run from WSL2: ./start-hive.sh

echo ""
echo "========================================"
echo "     STARTING HIVE (Docker Mode)"
echo "========================================"
echo ""

cd "$(dirname "$0")"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running!"
    echo "Start Docker Desktop or run: sudo service docker start"
    exit 1
fi

# Start all services
docker-compose up -d

echo ""
echo "========================================"
echo "     HIVE IS ONLINE"
echo "========================================"
echo ""
echo "Services:"
echo "  Oracle:    http://localhost:3002"
echo "  Relay:     http://localhost:8600"
echo "  KittBox:   http://localhost:8585"
echo "  Kitt Live: http://localhost:8686"
echo "  Hive-Mind: http://localhost:8701"
echo "  Ollama:    http://localhost:11434"
echo ""
echo "Commands:"
echo "  docker-compose logs -f    # View logs"
echo "  docker-compose restart    # Restart all"
echo "  docker-compose down       # Stop all"
echo ""
