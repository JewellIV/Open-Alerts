# Removes the OpenAlerts scheduled task.
# Run PowerShell as Administrator:
#   powershell -ExecutionPolicy Bypass -File scripts\windows\uninstall-service.ps1

$ErrorActionPreference = 'Stop'
$TaskName = 'OpenAlerts'

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
    Write-Host "No scheduled task named $TaskName is installed."
    exit 0
}

Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "Removed scheduled task: $TaskName"
