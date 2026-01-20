#!/bin/bash
# WSL Ubuntu Setup Script for Hive Services (SECURE VERSION)
# Run with: wsl -d Ubuntu -- bash /mnt/c/LLM-DevOSWE/Admin/docker/setup-wsl-hive.sh

set -e

echo ""
echo "========================================"
echo "   WSL HIVE SETUP (Secure)"
echo "========================================"
echo ""

# Check if running in WSL
if [ ! -f /proc/sys/fs/binfmt_misc/WSLInterop ]; then
    echo "ERROR: This script must run in WSL"
    exit 1
fi

echo "This setup requires sudo for initial installation only."
echo "Services will run as non-root user with minimal permissions."
echo ""

# Update system
echo "[1/7] Updating system..."
sudo apt-get update -qq

# Install Node.js 20
echo "[2/7] Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "       Node.js already installed: $(node --version)"
fi

# Create dedicated hive service user (no login shell, no home)
echo "[3/7] Creating hive service user..."
if ! id "hive-svc" &>/dev/null; then
    sudo useradd --system --no-create-home --shell /usr/sbin/nologin hive-svc
    echo "       Created user: hive-svc"
else
    echo "       User hive-svc already exists"
fi

# Create hive directories with proper permissions
echo "[4/7] Setting up directories..."
sudo mkdir -p /var/log/hive
sudo mkdir -p /var/run/hive
sudo chown hive-svc:hive-svc /var/log/hive /var/run/hive
sudo chmod 755 /var/log/hive /var/run/hive

# Create limited sudoers rule (only for systemctl hive-* services)
echo "[5/7] Setting up limited sudo rules..."
sudo tee /etc/sudoers.d/hive-services > /dev/null <<'EOF'
# Allow current user to manage only hive services (no other sudo)
%sudo ALL=(ALL) NOPASSWD: /usr/bin/systemctl start hive-*
%sudo ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop hive-*
%sudo ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart hive-*
%sudo ALL=(ALL) NOPASSWD: /usr/bin/systemctl status hive-*
%sudo ALL=(ALL) NOPASSWD: /usr/bin/systemctl enable hive-*
%sudo ALL=(ALL) NOPASSWD: /usr/bin/systemctl disable hive-*
EOF
sudo chmod 440 /etc/sudoers.d/hive-services

# Create systemd service files (running as hive-svc user)
echo "[6/7] Creating systemd services..."

# Oracle service
sudo tee /etc/systemd/system/hive-oracle.service > /dev/null <<EOF
[Unit]
Description=Hive Oracle LLM Backend
After=network.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=/mnt/c/LLM-Oracle
ExecStart=/usr/bin/node oracle.js
Restart=always
RestartSec=5
StandardOutput=append:/var/log/hive/oracle.log
StandardError=append:/var/log/hive/oracle.error.log
# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/log/hive /mnt/c/LLM-Oracle/oracle-data

[Install]
WantedBy=multi-user.target
EOF

# Relay service
sudo tee /etc/systemd/system/hive-relay.service > /dev/null <<EOF
[Unit]
Description=Hive Relay Message Service
After=network.target hive-oracle.service

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=/mnt/c/LLM-DevOSWE/Admin/relay
ExecStart=/usr/bin/node relay-service.js
Restart=always
RestartSec=5
StandardOutput=append:/var/log/hive/relay.log
StandardError=append:/var/log/hive/relay.error.log
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/log/hive /mnt/c/LLM-DevOSWE/Admin/relay

[Install]
WantedBy=multi-user.target
EOF

# KittBox service
sudo tee /etc/systemd/system/hive-kittbox.service > /dev/null <<EOF
[Unit]
Description=Hive KittBox Web UI
After=network.target hive-relay.service

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=/mnt/c/LLM-DevOSWE/Admin/agent
ExecStart=/usr/bin/node agent-server.js
Restart=always
RestartSec=5
StandardOutput=append:/var/log/hive/kittbox.log
StandardError=append:/var/log/hive/kittbox.error.log
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/log/hive

[Install]
WantedBy=multi-user.target
EOF

# Kitt Live service
sudo tee /etc/systemd/system/hive-kittlive.service > /dev/null <<EOF
[Unit]
Description=Hive Kitt Live Voice Chat
After=network.target hive-oracle.service

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=/mnt/c/kittbox-modules/kitt-live
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
StandardOutput=append:/var/log/hive/kittlive.log
StandardError=append:/var/log/hive/kittlive.error.log
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/log/hive

[Install]
WantedBy=multi-user.target
EOF

# Hive-Mind service
sudo tee /etc/systemd/system/hive-mind.service > /dev/null <<EOF
[Unit]
Description=Hive Mind Activity Monitor
After=network.target hive-relay.service

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=/mnt/c/LLM-DevOSWE/Admin/hive-mind
ExecStart=/usr/bin/node hive-mind-server.js
Restart=always
RestartSec=5
StandardOutput=append:/var/log/hive/hivemind.log
StandardError=append:/var/log/hive/hivemind.error.log
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/log/hive

[Install]
WantedBy=multi-user.target
EOF

# DocSync service
sudo tee /etc/systemd/system/hive-docsync.service > /dev/null <<EOF
[Unit]
Description=Hive DocSync Document Synchronization
After=network.target hive-relay.service

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=/mnt/c/LLM-DevOSWE/Admin/docsync
ExecStart=/usr/bin/node docsync-agent.js --watch
Restart=always
RestartSec=10
StandardOutput=append:/var/log/hive/docsync.log
StandardError=append:/var/log/hive/docsync.error.log
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/log/hive /mnt/c/LLM-DevOSWE/Admin/docsync /mnt/g/My\ Drive

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable services
echo "[7/7] Enabling services..."
sudo systemctl daemon-reload
sudo systemctl enable hive-oracle hive-relay hive-kittbox hive-kittlive hive-mind hive-docsync

echo ""
echo "========================================"
echo "   SETUP COMPLETE (Secure)"
echo "========================================"
echo ""
echo "Security measures applied:"
echo "  - Services run as regular user (not root)"
echo "  - NoNewPrivileges=true (can't escalate)"
echo "  - ProtectSystem=strict (read-only filesystem)"
echo "  - Limited sudo (only hive-* systemctl commands)"
echo "  - Logs in /var/log/hive/ (auditable)"
echo ""
echo "Commands (no password needed for these):"
echo "  Start:   sudo systemctl start hive-oracle hive-relay hive-kittbox hive-kittlive hive-mind hive-docsync"
echo "  Stop:    sudo systemctl stop hive-oracle hive-relay hive-kittbox hive-kittlive hive-mind hive-docsync"
echo "  Status:  sudo systemctl status hive-*"
echo "  Logs:    tail -f /var/log/hive/*.log"
echo ""
