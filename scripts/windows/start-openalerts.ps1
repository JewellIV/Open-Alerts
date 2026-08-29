# Starts the OpenAlerts backend on Windows.
# Used by the scheduled task and by start-openalerts.bat.

$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $Root

$logDir = Join-Path $Root 'logs'
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}
$logFile = Join-Path $logDir 'openalerts.log'

function Write-Log([string]$Message) {
    $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Add-Content -Path $logFile -Value $line
    Write-Host $line
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Log 'ERROR: Node.js is not installed or not on PATH. Install Node.js 22 LTS from https://nodejs.org/'
    exit 1
}

$dist = Join-Path $Root 'dist\index.js'
if (-not (Test-Path $dist)) {
    Write-Log 'dist\index.js missing — building backend...'
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Log 'ERROR: npm run build failed'
        exit 1
    }
}

Write-Log "Starting OpenAlerts from $Root"
Write-Log ("Node {0}" -f (node -v))

# dotenv loads .env from the working directory
& node $dist *>> $logFile
$exit = $LASTEXITCODE
Write-Log "OpenAlerts exited with code $exit"
exit $exit
