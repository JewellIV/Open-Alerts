# Allows inbound TCP 3000 so display Pis and CAD webhooks can reach this PC.
# Run PowerShell as Administrator.

$ErrorActionPreference = 'Stop'
$ruleName = 'OpenAlerts backend (TCP 3000)'

$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Firewall rule already exists: $ruleName"
    exit 0
}

New-NetFirewallRule -DisplayName $ruleName `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 3000 `
    -Action Allow `
    -Profile Any | Out-Null

Write-Host "Created firewall rule: $ruleName"
Write-Host "Display Pis can now open http://THIS_PC_IP:3000"
