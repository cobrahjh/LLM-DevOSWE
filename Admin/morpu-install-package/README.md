# Morpu-PC Hive Node Install Package

## Step 1: Install Ubuntu Server

1. Download Ubuntu Server 24.04 LTS: https://ubuntu.com/download/server
2. Flash to USB with Rufus or Balena Etcher
3. Boot morpu-pc from USB
4. Install with these options:
   - Minimal server
   - Enable OpenSSH server ✅
   - Username: `hive` (or your preference)
   - Set static IP: 192.168.1.97 (or DHCP)

## Step 2: First Boot Setup

After Ubuntu installs, SSH from Harold-PC:
```bash
ssh hive@192.168.1.97
```

## Step 3: Run Install Script

From Harold-PC, run:
```cmd
install-to-morpu.bat
```

Or manually:
```bash
# Copy this package to morpu
scp -r /path/to/morpu-install-package hive@192.168.1.97:~/

# SSH to morpu and run setup
ssh hive@192.168.1.97
cd ~/morpu-install-package
chmod +x install.sh
./install.sh
```

## Step 4: Verify

After install completes:
- Cockpit: https://192.168.1.97:9090
- KittBox: http://192.168.1.97:8585
- Relay: http://192.168.1.97:8600
- Hive-Mind: http://192.168.1.97:8701

## Package Contents

```
morpu-install-package/
├── README.md           # This file
├── install.sh          # Main installer (run on morpu)
├── install-to-morpu.bat # Windows helper (run on Harold-PC)
├── setup-morpu-hive.sh # System setup script
├── services/           # Hive service files
│   ├── relay/
│   ├── agent/
│   ├── hive-mind/
│   └── oracle/
└── security/           # API keys
```
