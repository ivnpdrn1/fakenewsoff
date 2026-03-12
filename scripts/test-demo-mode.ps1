#!/usr/bin/env pwsh
# Test Demo Mode for Example Claims
# Tests all three example claims to verify deterministic evidence

$API_URL = "https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/analyze"

Write-Host "Testing Demo Mode for Example Claims" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Supported Claim
Write-Host "Test 1: Supported Claim" -ForegroundColor Yellow
Write-Host "Claim: The Eiffel Tower is located in Paris, France" -ForegroundColor Gray

$body1 = @{
    text = "The Eiffel Tower is located in Paris, France"
    demo_mode = $true
} | ConvertTo-Json

try {
    $response1 = Invoke-RestMethod -Uri $API_URL -Method Post -Body $body1 -ContentType "application/json" -TimeoutSec 30
    Write-Host "✓ Status: $($response1.status_label)" -ForegroundColor Green
    Write-Host "✓ Confidence: $($response1.confidence_score)%" -ForegroundColor Green
    Write-Host "✓ Sources: $($response1.text_grounding.sources.Count)" -ForegroundColor Green
    Write-Host "✓ Trace Mode: $($response1.trace.mode)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "✗ Failed: $_" -ForegroundColor Red
    Write-Host ""
}

# Test 2: Disputed Claim
Write-Host "Test 2: Disputed Claim" -ForegroundColor Yellow
Write-Host "Claim: The moon landing was faked in 1969" -ForegroundColor Gray

$body2 = @{
    text = "The moon landing was faked in 1969"
    demo_mode = $true
} | ConvertTo-Json

try {
    $response2 = Invoke-RestMethod -Uri $API_URL -Method Post -Body $body2 -ContentType "application/json" -TimeoutSec 30
    Write-Host "✓ Status: $($response2.status_label)" -ForegroundColor Green
    Write-Host "✓ Confidence: $($response2.confidence_score)%" -ForegroundColor Green
    Write-Host "✓ Sources: $($response2.text_grounding.sources.Count)" -ForegroundColor Green
    Write-Host "✓ Trace Mode: $($response2.trace.mode)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "✗ Failed: $_" -ForegroundColor Red
    Write-Host ""
}

# Test 3: Unverified Claim
Write-Host "Test 3: Unverified Claim" -ForegroundColor Yellow
Write-Host "Claim: A new species was discovered yesterday" -ForegroundColor Gray

$body3 = @{
    text = "A new species was discovered yesterday"
    demo_mode = $true
} | ConvertTo-Json

try {
    $response3 = Invoke-RestMethod -Uri $API_URL -Method Post -Body $body3 -ContentType "application/json" -TimeoutSec 30
    Write-Host "✓ Status: $($response3.status_label)" -ForegroundColor Green
    Write-Host "✓ Confidence: $($response3.confidence_score)%" -ForegroundColor Green
    Write-Host "✓ Sources: $($response3.text_grounding.sources.Count)" -ForegroundColor Green
    Write-Host "✓ Trace Mode: $($response3.trace.mode)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "✗ Failed: $_" -ForegroundColor Red
    Write-Host ""
}

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Demo Mode Testing Complete" -ForegroundColor Cyan
