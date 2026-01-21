# Setup OpenSSH Server on Windows
# Run this script as Administrator on the target machine (ai-pc)

Write-Host "Setting up OpenSSH Server..." -ForegroundColor Cyan

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Run this script as Administrator!" -ForegroundColor Red
    exit 1
}

# Install OpenSSH Server (Windows 10 1809+ / Windows 11)
Write-Host "Installing OpenSSH Server..." -ForegroundColor Yellow
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0

# Start and enable the SSH service
Write-Host "Starting SSH service..." -ForegroundColor Yellow
Start-Service sshd
Set-Service -Name sshd -StartupType 'Automatic'

# Configure firewall rule
Write-Host "Configuring firewall..." -ForegroundColor Yellow
$firewallRule = Get-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -ErrorAction SilentlyContinue
if (-not $firewallRule) {
    New-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -DisplayName "OpenSSH Server (sshd)" -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22
}

# Verify
Write-Host "`nVerifying installation..." -ForegroundColor Cyan
$service = Get-Service sshd
Write-Host "SSH Service Status: $($service.Status)" -ForegroundColor Green
Write-Host "SSH Service Startup: $($service.StartType)" -ForegroundColor Green

# Get IP address
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^169' } | Select-Object -First 1).IPAddress
Write-Host "`nSSH is ready! Connect with:" -ForegroundColor Green
Write-Host "  ssh $env:USERNAME@$ip" -ForegroundColor White

Write-Host "`nDone!" -ForegroundColor Cyan
