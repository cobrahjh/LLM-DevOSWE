#!/bin/bash
# Morpu-PC Hive Node Setup Script
# Run on morpu-pc after fresh Ubuntu Server/Desktop install
#
# Prerequisites:
# 1. Ubuntu 22.04+ installed on morpu-pc
# 2. SSH access enabled
# 3. Network configured (static IP recommended)
#
# To run remotely from Harold-PC:
#   scp this-script.sh user@morpu-pc:~/
#   ssh user@morpu-pc 'bash ~/setup-morpu-hive.sh'

set -e

echo ""
echo "========================================"
echo "   MORPU-PC HIVE NODE SETUP"
echo "========================================"
echo ""

# Get the IP address for reference
MORPU_IP=$(hostname -I | awk '{print $1}')
echo "Detected IP: $MORPU_IP"
echo ""

# Update system
echo "[1/8] Updating system..."
sudo apt-get update -qq
sudo apt-get upgrade -y -qq

# Install Node.js 20
echo "[2/8] Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "       Node.js already installed: $(node --version)"
fi

# Install git
echo "[3/9] Installing git..."
sudo apt-get install -y git

# Install Cockpit (Web-based GUI management)
echo "[4/9] Installing Cockpit web dashboard..."
sudo apt-get install -y cockpit
sudo systemctl enable --now cockpit.socket
echo "       Cockpit installed - access at https://$MORPU_IP:9090"

# Create hive user and directories
echo "[5/9] Creating hive user and directories..."
if ! id "hive" &>/dev/null; then
    sudo useradd --system --create-home --shell /bin/bash hive
    echo "       Created user: hive"
fi

sudo mkdir -p /opt/hive
sudo mkdir -p /var/log/hive
sudo mkdir -p /opt/hive/data
sudo chown -R hive:hive /opt/hive /var/log/hive

# Clone/sync hive services from Harold-PC (or git repo)
echo "[6/9] Setting up hive services..."
cat > /tmp/hive-services-readme.txt << 'EOF'
Hive services need to be copied from Harold-PC.

Option A - SCP from Harold-PC:
  scp -r user@harold-pc:/mnt/c/LLM-DevOSWE/Admin/relay /opt/hive/
  scp -r user@harold-pc:/mnt/c/LLM-DevOSWE/Admin/agent /opt/hive/
  scp -r user@harold-pc:/mnt/c/LLM-DevOSWE/Admin/hive-mind /opt/hive/
  scp -r user@harold-pc:/mnt/c/LLM-Oracle /opt/hive/oracle

Option B - Git clone (if repo exists):
  git clone https://github.com/your-repo/hive-services /opt/hive

Option C - Rsync (best for ongoing sync):
  rsync -avz user@harold-pc:/path/to/services/ /opt/hive/
EOF
echo "       See /tmp/hive-services-readme.txt for sync options"

# Create systemd services
echo "[7/9] Creating systemd services..."

# Oracle service
sudo tee /etc/systemd/system/hive-oracle.service > /dev/null <<EOF
[Unit]
Description=Hive Oracle LLM Backend
After=network.target

[Service]
Type=simple
User=hive
Group=hive
WorkingDirectory=/opt/hive/oracle
ExecStart=/usr/bin/node oracle.js
Restart=always
RestartSec=5
StandardOutput=append:/var/log/hive/oracle.log
StandardError=append:/var/log/hive/oracle.error.log
Environment=NODE_ENV=production
Environment=HIVE_NODE=morpu-pc
# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/log/hive /opt/hive/data

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
User=hive
Group=hive
WorkingDirectory=/opt/hive/relay
ExecStart=/usr/bin/node relay-service.js
Restart=always
RestartSec=5
StandardOutput=append:/var/log/hive/relay.log
StandardError=append:/var/log/hive/relay.error.log
Environment=NODE_ENV=production
Environment=HIVE_NODE=morpu-pc
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/log/hive /opt/hive/relay

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
User=hive
Group=hive
WorkingDirectory=/opt/hive/agent
ExecStart=/usr/bin/node agent-server.js
Restart=always
RestartSec=5
StandardOutput=append:/var/log/hive/kittbox.log
StandardError=append:/var/log/hive/kittbox.error.log
Environment=NODE_ENV=production
Environment=HIVE_NODE=morpu-pc
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
User=hive
Group=hive
WorkingDirectory=/opt/hive/hive-mind
ExecStart=/usr/bin/node hive-mind-server.js
Restart=always
RestartSec=5
StandardOutput=append:/var/log/hive/hivemind.log
StandardError=append:/var/log/hive/hivemind.error.log
Environment=NODE_ENV=production
Environment=HIVE_NODE=morpu-pc
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/log/hive

[Install]
WantedBy=multi-user.target
EOF

# Hive Health Monitor (morpu-specific)
sudo tee /etc/systemd/system/hive-health.service > /dev/null <<EOF
[Unit]
Description=Hive Health Beacon
After=network.target

[Service]
Type=simple
User=hive
Group=hive
ExecStart=/opt/hive/scripts/health-beacon.sh
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF

# Create health beacon script
sudo mkdir -p /opt/hive/scripts
sudo tee /opt/hive/scripts/health-beacon.sh > /dev/null <<'EOF'
#!/bin/bash
# Health beacon - announces morpu-pc status to the network
while true; do
    # Check all services
    ORACLE=$(systemctl is-active hive-oracle 2>/dev/null || echo "inactive")
    RELAY=$(systemctl is-active hive-relay 2>/dev/null || echo "inactive")
    KITTBOX=$(systemctl is-active hive-kittbox 2>/dev/null || echo "inactive")
    HIVEMIND=$(systemctl is-active hive-mind 2>/dev/null || echo "inactive")

    # Log status
    echo "$(date -Iseconds) oracle=$ORACLE relay=$RELAY kittbox=$KITTBOX hivemind=$HIVEMIND" >> /var/log/hive/health.log

    # Could send to central collector here
    # curl -s http://harold-pc:8701/api/node-status -d "{\"node\":\"morpu-pc\",\"services\":{...}}"

    sleep 60
done
EOF
sudo chmod +x /opt/hive/scripts/health-beacon.sh
sudo chown -R hive:hive /opt/hive/scripts

# Setup limited sudo for hive service management
echo "[8/9] Configuring sudo rules..."
sudo tee /etc/sudoers.d/hive-services > /dev/null <<'EOF'
# Allow hive user to manage only hive services
hive ALL=(ALL) NOPASSWD: /usr/bin/systemctl start hive-*
hive ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop hive-*
hive ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart hive-*
hive ALL=(ALL) NOPASSWD: /usr/bin/systemctl status hive-*
EOF
sudo chmod 440 /etc/sudoers.d/hive-services

# Reload systemd
echo "[9/9] Enabling services..."
sudo systemctl daemon-reload

echo ""
echo "========================================"
echo "   MORPU-PC SETUP COMPLETE"
echo "========================================"
echo ""
echo "Node IP: $MORPU_IP"
echo ""
echo "Next steps:"
echo "  1. Copy service files from Harold-PC to /opt/hive/"
echo "     See: /tmp/hive-services-readme.txt"
echo ""
echo "  2. Install npm dependencies in each service folder:"
echo "     cd /opt/hive/relay && npm install"
echo "     cd /opt/hive/agent && npm install"
echo "     cd /opt/hive/oracle && npm install"
echo "     cd /opt/hive/hive-mind && npm install"
echo ""
echo "  3. Start services:"
echo "     sudo systemctl start hive-oracle hive-relay hive-kittbox hive-mind"
echo "     sudo systemctl enable hive-oracle hive-relay hive-kittbox hive-mind"
echo ""
echo "  4. Verify from Harold-PC:"
echo "     curl http://$MORPU_IP:3002/api/health"
echo "     curl http://$MORPU_IP:8600/api/status"
echo "     curl http://$MORPU_IP:8585/"
echo "     curl http://$MORPU_IP:8701/"
echo ""
echo "  5. Access Cockpit web dashboard:"
echo "     https://$MORPU_IP:9090"
echo "     (Login with your Linux user credentials)"
echo ""
echo "  6. Add to Harold-PC hosts file (optional):"
echo "     echo '$MORPU_IP morpu-pc' | sudo tee -a /etc/hosts"
echo ""
