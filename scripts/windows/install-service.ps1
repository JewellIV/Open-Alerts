# Installs a Windows scheduled task so OpenAlerts starts at boot and after login.
# Run PowerShell as Administrator from the project folder:
#   powershell -ExecutionPolicy Bypass -File scripts\windows\install-service.ps1

$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$StartScript = Join-Path $Root 'scripts\windows\start-openalerts.ps1'
$TaskName = 'OpenAlerts'

if (-not (Test-Path $StartScript)) {
    throw "Missing start script: $StartScript"
}

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
$action = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$StartScript`"" `
    -WorkingDirectory $Root
$triggerStartup = New-ScheduledTaskTrigger -AtStartup
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 5 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TaskName `
    -Action $action `
    -Trigger @($triggerStartup, $triggerLogon) `
    -Principal $principal `
    -Settings $settings `
    -Description 'OpenAlerts fire station backend (port 3000)' | Out-Null

Write-Host "Installed scheduled task: $TaskName"
Write-Host "It starts at Windows logon/startup and restarts if it crashes."
Write-Host ""
Write-Host "Start it now with:"
Write-Host "  Start-ScheduledTask -TaskName $TaskName"
Write-Host "Or double-click start-openalerts.bat in the project folder."
Write-Host ""
Write-Host "Logs: $Root\logs\openalerts.log"
