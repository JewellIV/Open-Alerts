# Test Alert Script
$apiKey = (Get-Content .env | Select-String "^API_KEY=" | ForEach-Object { $_.Line.Split('=',2)[1] }).Trim()

$body = @{
    call_type = "Structure Fire"
    address = "123 Test St, Aylett, VA"
    units = "Engine 2, Medic 21"
    narrative = "Test alert - checking system functionality"
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
    "X-API-Key" = $apiKey
}

try {
    $response = Invoke-WebRequest -Uri http://localhost:3000/api/alert -Method POST -Body $body -Headers $headers -UseBasicParsing
    Write-Host "✅ Alert sent successfully!"
    Write-Host "Response: $($response.Content)"
} catch {
    Write-Host "❌ Error sending alert:"
    Write-Host $_.Exception.Message
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message
    }
}
