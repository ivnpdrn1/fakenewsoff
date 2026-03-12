# Test script to verify trace is included in demo mode API responses

$apiUrl = "https://fnd9pknygc.execute-api.us-east-1.amazonaws.com"

Write-Host "Testing demo mode trace inclusion..." -ForegroundColor Cyan
Write-Host ""

# Test 1: demo_mode=true (explicit)
Write-Host "Test 1: demo_mode=true (explicit)" -ForegroundColor Yellow
$body1 = @{
    text = "The Eiffel Tower is in Paris"
    demo_mode = $true
} | ConvertTo-Json

$response1 = Invoke-RestMethod -Uri "$apiUrl/analyze" -Method Post -Body $body1 -ContentType "application/json"

if ($response1.trace) {
    Write-Host "✓ PASS: Trace is present" -ForegroundColor Green
    Write-Host "  - Mode: $($response1.trace.mode)" -ForegroundColor Gray
    Write-Host "  - Steps: $($response1.trace.steps.Count)" -ForegroundColor Gray
    Write-Host "  - Total duration: $($response1.trace.total_duration_ms)ms" -ForegroundColor Gray
} else {
    Write-Host "✗ FAIL: Trace is missing" -ForegroundColor Red
}

Write-Host ""

# Test 2: demo_mode=false (should use production mode, may not have trace if orchestration disabled)
Write-Host "Test 2: demo_mode=false (production mode)" -ForegroundColor Yellow
$body2 = @{
    text = "The Eiffel Tower is in Paris"
    demo_mode = $false
} | ConvertTo-Json

$response2 = Invoke-RestMethod -Uri "$apiUrl/analyze" -Method Post -Body $body2 -ContentType "application/json"

if ($response2.trace) {
    Write-Host "✓ Trace is present (orchestration enabled)" -ForegroundColor Green
    Write-Host "  - Mode: $($response2.trace.mode)" -ForegroundColor Gray
} else {
    Write-Host "ℹ Trace not present (expected if orchestration disabled)" -ForegroundColor Gray
}

Write-Host ""

# Test 3: demo_mode omitted (should default to demo mode based on env)
Write-Host "Test 3: demo_mode omitted (default behavior)" -ForegroundColor Yellow
$body3 = @{
    text = "The Eiffel Tower is in Paris"
} | ConvertTo-Json

$response3 = Invoke-RestMethod -Uri "$apiUrl/analyze" -Method Post -Body $body3 -ContentType "application/json"

if ($response3.trace) {
    Write-Host "✓ Trace is present" -ForegroundColor Green
    Write-Host "  - Mode: $($response3.trace.mode)" -ForegroundColor Gray
} else {
    Write-Host "ℹ Trace not present" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Test complete!" -ForegroundColor Cyan
