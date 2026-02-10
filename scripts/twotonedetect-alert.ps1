# TwoToneDetect Alert Script for MVFD Phoenix
# Use with alert_command or post_email_command in TwoToneDetect tones.cfg
#
# Usage:
#   Admin page:    alert_command = C:\path\to\scripts\twotonedetect-alert.ps1 admin
#   Dispatch:      alert_command = C:\path\to\scripts\twotonedetect-alert.ps1
#   Custom type:   alert_command = C:\path\to\scripts\twotonedetect-alert.ps1 "EMS Rescue"

# ============ CONFIGURATION - Edit these for your setup ============
$serverUrl = "http://localhost:3000"   # Your OpenAlerts server (e.g. http://192.168.1.100:3000)
$apiKey = ""                           # Leave empty if API_KEY not set in .env
# Optional: Load API key from .env file (if script runs from MVFD Phoenix project root)
# $envPath = "D:\MVFD Pheonix\.env"
# if (Test-Path $envPath) {
#     $apiKey = (Get-Content $envPath | Select-String "^API_KEY=" | ForEach-Object { $_.Line.Split('=',2)[1] }).Trim()
# }
# ===================================================================

param(
    [string]$pageType = "dispatch"
)

# Build alert payload based on page type
$alertConfig = switch ($pageType.ToLower()) {
    "admin" {
        @{
            call_type = "Admin Page"
            address   = "Admin Dispatch"
            units     = "Admin"
            narrative = "Admin message received from TwoToneDetect"
            source    = "twotonedetect_admin"
        }
    }
    "dispatch" {
        @{
            call_type = "Dispatch"
            address   = "See narrative"
            units     = "See narrative"
            narrative = "Two-tone page detected"
            source    = "twotonedetect"
        }
    }
    default {
        # Custom call type (e.g. "EMS Rescue", "Structure Fire")
        @{
            call_type = $pageType
            address   = "See narrative"
            units     = "See narrative"
            narrative = "Two-tone page detected"
            source    = "twotonedetect"
        }
    }
}

$body = $alertConfig | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
}
if ($apiKey) {
    $headers["X-API-Key"] = $apiKey
}

$uri = "$serverUrl/api/alert"

try {
    $params = @{
        Uri         = $uri
        Method      = "POST"
        Body        = $body
        Headers     = $headers
        UseBasicParsing = $true
    }
    $response = Invoke-WebRequest @params
    Write-Host "[TTD] Alert sent to OpenAlerts: $pageType - $($response.StatusCode)"
} catch {
    Write-Host "[TTD] Error sending alert:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message
    }
    exit 1
}
