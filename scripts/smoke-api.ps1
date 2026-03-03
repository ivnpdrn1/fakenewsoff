#!/usr/bin/env pwsh
# Smoke test for deployed FakeNewsOff API

$ErrorActionPreference = "Stop"

Write-Host "=== API Smoke Test ===" -ForegroundColor Cyan
Write-Host ""

# Read API URL
if (-not (Test-Path "api-url.txt")) {
    Write-Host "ERROR: api-url.txt not found. Run deploy-backend.ps1 first." -ForegroundColor Red
    exit 1
}

$apiUrl = Get-Content "api-url.txt" -Raw
$apiUrl = $apiUrl.Trim()

Write-Host "Testing API: $apiUrl" -ForegroundColor Gray
Write-Host ""

# Test 1: Health check
Write-Host "[1/2] Testing /health endpoint..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "$apiUrl/health" -Method GET -ContentType "application/json"
    
    if ($healthResponse.status -eq "ok") {
        Write-Host "Success: Health check passed" -ForegroundColor Green
        Write-Host "  Demo mode: $($healthResponse.demo_mode)" -ForegroundColor Gray
    } else {
        throw "Health check returned unexpected status: $($healthResponse.status)"
    }
} catch {
    Write-Host "Failed: Health check failed: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 2: Analyze endpoint
Write-Host "[2/2] Testing /analyze endpoint..." -ForegroundColor Yellow
try {
    $testPayload = @{
        text = "Climate change is a hoax"
        demo_mode = $true
    } | ConvertTo-Json
    
    $analyzeResponse = Invoke-RestMethod -Uri "$apiUrl/analyze" -Method POST -Body $testPayload -ContentType "application/json"
    
    # Validate response structure
    if (-not $analyzeResponse.status_label) {
        throw "Response missing status_label field"
    }
    
    if ($null -eq $analyzeResponse.confidence_score) {
        throw "Response missing confidence_score field"
    }
    
    if (-not $analyzeResponse.recommendation) {
        throw "Response missing recommendation field"
    }
    
    Write-Host "Success: Analyze endpoint passed" -ForegroundColor Green
    Write-Host "  Status: $($analyzeResponse.status_label)" -ForegroundColor Gray
    Write-Host "  Confidence: $($analyzeResponse.confidence_score)%" -ForegroundColor Gray
    
} catch {
    Write-Host "Failed: Analyze endpoint failed: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "=== ALL SMOKE TESTS PASSED ===" -ForegroundColor Green
Write-Host ""
