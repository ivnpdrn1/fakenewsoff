# Test trace in demo mode API response
$apiUrl = "https://fnd9pknygc.execute-api.us-east-1.amazonaws.com"

Write-Host "Testing demo_mode=true..." -ForegroundColor Cyan

$body = @{
    text = "The Eiffel Tower is in Paris"
    demo_mode = $true
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$apiUrl/analyze" -Method Post -Body $body -ContentType "application/json"

Write-Host ""
if ($response.trace) {
    Write-Host "SUCCESS: Trace is present!" -ForegroundColor Green
    Write-Host "Mode: $($response.trace.mode)" -ForegroundColor Gray
    Write-Host "Steps: $($response.trace.steps.Count)" -ForegroundColor Gray
    Write-Host "Duration: $($response.trace.total_duration_ms)ms" -ForegroundColor Gray
} else {
    Write-Host "FAIL: Trace is missing" -ForegroundColor Red
    Write-Host "Response keys: $($response.PSObject.Properties.Name -join ', ')" -ForegroundColor Gray
}
