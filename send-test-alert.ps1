# One-time test alert to 192.168.68.92
$apiKey = (Get-Content .env -Raw | Select-String -Pattern 'API_KEY=(.+)' | ForEach-Object { $_.Matches.Groups[1].Value.Trim() })
if (-not $apiKey) { Write-Error "API_KEY not found in .env"; exit 1 }

$body = @{
    call_type = "Structure Fire"
    address   = "123 Test St, Aylett, VA"
    units     = "Engine 2, Medic 21"
    narrative = "Test alert - system check"
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
    "X-API-Key"   = $apiKey
}

try {
    $response = Invoke-WebRequest -Uri "http://192.168.68.92:3000/api/alert" -Method POST -Body $body -Headers $headers -UseBasicParsing
    Write-Host "Alert sent successfully!"
    Write-Host $response.Content
} catch {
    Write-Host "Error:" $_.Exception.Message
    if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
}
