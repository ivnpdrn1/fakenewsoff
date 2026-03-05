#!/usr/bin/env pwsh
# Grounding Smoke Test Script (PowerShell)
# Tests grounding health and self-test endpoints

param(
    [string]$ApiUrl = "https://fnd9pknygc.execute-api.us-east-1.amazonaws.com",
    [string]$Token = $env:INTERNAL_DIAGNOSTICS_TOKEN
)

$ErrorActionPreference = "Stop"

Write-Host "=== Grounding Smoke Test ===" -ForegroundColor Cyan
Write-Host "API URL: $ApiUrl" -ForegroundColor Gray
Write-Host ""

# Test 1: Basic health check
Write-Host "[1/3] Testing /health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$ApiUrl/health" -Method Get
    Write-Host "✓ Health check passed" -ForegroundColor Green
    Write-Host "  Status: $($response.status)" -ForegroundColor Gray
    Write-Host "  Demo Mode: $($response.demo_mode)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "✗ Health check failed: $_" -ForegroundColor Red
    exit 1
}

# Test 2: Grounding health check
Write-Host "[2/3] Testing /health/grounding endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$ApiUrl/health/grounding" -Method Get
    Write-Host "✓ Grounding health check passed" -ForegroundColor Green
    Write-Host "  OK: $($response.ok)" -ForegroundColor Gray
    Write-Host "  Bing Configured: $($response.bing_configured)" -ForegroundColor Gray
    Write-Host "  GDELT Configured: $($response.gdelt_configured)" -ForegroundColor Gray
    Write-Host "  Timeout (ms): $($response.timeout_ms)" -ForegroundColor Gray
    Write-Host "  Cache TTL (s): $($response.cache_ttl_seconds)" -ForegroundColor Gray
    Write-Host "  Provider Enabled: $($response.provider_enabled)" -ForegroundColor Gray
    Write-Host "  Provider Order: $($response.provider_order -join ', ')" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "✗ Grounding health check failed: $_" -ForegroundColor Red
    exit 1
}

# Test 3: Self-test (requires token)
Write-Host "[3/3] Testing /internal/grounding-selftest endpoint..." -ForegroundColor Yellow
if (-not $Token) {
    Write-Host "⚠ Skipping self-test (no INTERNAL_DIAGNOSTICS_TOKEN provided)" -ForegroundColor Yellow
    Write-Host "  Set token via: `$env:INTERNAL_DIAGNOSTICS_TOKEN='your_token'" -ForegroundColor Gray
    Write-Host ""
} else {
    try {
        $headers = @{
            "Authorization" = "Bearer $Token"
            "Content-Type" = "application/json"
        }
        $body = @{ query = "breaking news" } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$ApiUrl/internal/grounding-selftest" -Method Post -Headers $headers -Body $body
        Write-Host "✓ Self-test passed" -ForegroundColor Green
        Write-Host "  Provider Used: $($response.providerUsed)" -ForegroundColor Gray
        Write-Host "  Results (Raw): $($response.resultsCountRaw)" -ForegroundColor Gray
        Write-Host "  Results (Filtered): $($response.resultsCountAfterFilter)" -ForegroundColor Gray
        Write-Host "  Top Domains: $($response.topDomains -join ', ')" -ForegroundColor Gray
        Write-Host "  Latency (ms): $($response.latencyMs)" -ForegroundColor Gray
        Write-Host "  Attempted Providers: $($response.attemptedProviders -join ', ')" -ForegroundColor Gray
        if ($response.errors -and $response.errors.Count -gt 0) {
            Write-Host "  Errors: $($response.errors -join ', ')" -ForegroundColor Yellow
        }
        Write-Host ""
    } catch {
        Write-Host "✗ Self-test failed: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host "=== All Tests Passed ===" -ForegroundColor Green
