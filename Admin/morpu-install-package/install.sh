#!/bin/bash
# Morpu-PC Hive Node Installer
# Run this on morpu-pc after Ubuntu is installed

set -e

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║         MORPU-PC HIVE NODE INSTALLER                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MORPU_IP=$(hostname -I | awk '{print $1}')

echo "Detected IP: $MORPU_IP"
echo "Install from: $SCRIPT_DIR"
echo ""

# Step 1: Run system setup
echo "[1/5] Running system setup..."
if [ -f "$SCRIPT_DIR/setup-morpu-hive.sh" ]; then
    bash "$SCRIPT_DIR/setup-morpu-hive.sh"
else
    echo "ERROR: setup-morpu-hive.sh not found!"
    exit 1
fi

# Step 2: Copy services
echo ""
echo "[2/5] Copying Hive services..."
sudo mkdir -p /opt/hive
sudo chown -R $USER:$USER /opt/hive

if [ -d "$SCRIPT_DIR/services/relay" ]; then
    cp -r "$SCRIPT_DIR/services/relay" /opt/hive/
    echo "  ✓ Relay"
fi

if [ -d "$SCRIPT_DIR/services/agent" ]; then
    cp -r "$SCRIPT_DIR/services/agent" /opt/hive/
    echo "  ✓ Agent (KittBox)"
fi

if [ -d "$SCRIPT_DIR/services/hive-mind" ]; then
    cp -r "$SCRIPT_DIR/services/hive-mind" /opt/hive/
    echo "  ✓ Hive-Mind"
fi

if [ -d "$SCRIPT_DIR/services/oracle" ]; then
    cp -r "$SCRIPT_DIR/services/oracle" /opt/hive/
    echo "  ✓ Oracle"
fi

# Step 3: Copy security
echo ""
echo "[3/5] Setting up security..."
if [ -d "$SCRIPT_DIR/security" ]; then
    cp -r "$SCRIPT_DIR/security" /opt/hive/
    echo "  ✓ API keys"
fi

# Step 4: Install npm dependencies
echo ""
echo "[4/5] Installing npm dependencies..."
for dir in relay agent oracle hive-mind; do
    if [ -d "/opt/hive/$dir" ] && [ -f "/opt/hive/$dir/package.json" ]; then
        echo "  Installing $dir..."
        cd /opt/hive/$dir && npm install --production 2>/dev/null || npm install
    fi
done

# Step 5: Start services
echo ""
echo "[5/5] Starting Hive services..."
sudo systemctl daemon-reload
sudo systemctl enable hive-oracle hive-relay hive-kittbox hive-mind 2>/dev/null || true
sudo systemctl start hive-oracle hive-relay hive-kittbox hive-mind 2>/dev/null || true

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║         INSTALLATION COMPLETE!                           ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Access points:"
echo "  Cockpit:   https://$MORPU_IP:9090"
echo "  KittBox:   http://$MORPU_IP:8585"
echo "  Relay:     http://$MORPU_IP:8600"
echo "  Oracle:    http://$MORPU_IP:3002"
echo "  Hive-Mind: http://$MORPU_IP:8701"
echo ""
echo "Check service status:"
echo "  sudo systemctl status hive-*"
echo ""
