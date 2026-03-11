#!/usr/bin/env pwsh
# Test Example Claims
# Tests all three example claims to see which ones work

$ErrorActionPreference = "Stop"
$ApiUrl = "https://fnd9pknygc.execute-api.us-east-1.amazonaws.com"

Write-Host "=== Testing Example Claims ===" -ForegroundColor Cyan
Write-Host ""

$exampleClaims = @(
    @{
        name = "Supported (Eiffel Tower)"
        text = "The Eiffel Tower is located in Paris, France"
        demo_mode = $false
    },
    @{
        name = "Disputed (Moon Landing)"
        text = "The moon landing was faked in 1969"
        demo_mode = $false
    },
    @{
        name = "Unverified (New Species)"
        text = "A new species was discovered yesterday"
        demo_mode = $false
    }
)

foreach ($claim in $exampleClaims) {
    Write-Host "Testing: $($claim.name)" -ForegroundColor Yellow
    Write-Host "Claim: $($claim.text)" -ForegroundColor Gray
    
    try {
        $body = @{
            text = $claim.text
            demo_mode = $claim.demo_mode
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$ApiUrl/analyze" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 60
        
        Write-Host "✅ Success" -ForegroundColor Green
        Write-Host "   Status: $($response.status_label)" -ForegroundColor Gray
        Write-Host "   Confidence: $($response.confidence_score)%" -ForegroundColor Gray
        
        if ($response.text_grounding) {
            Write-Host "   Sources: $($response.text_grounding.sources.Count)" -ForegroundColor Gray
            Write-Host "   Queries: $($response.text_grounding.queries.Count)" -ForegroundColor Gray
        }
        
        if ($response.orchestration) {
            Write-Host "   Orchestration: $($response.orchestration.passes_executed) passes" -ForegroundColor Gray
        }
        
    } catch {
        Write-Host "❌ Failed" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
        
        if ($_.ErrorDetails.Message) {
            $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "   Details: $($errorDetails.error)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
}

Write-Host "=== Testing with Demo Mode ===" -ForegroundColor Cyan
Write-Host ""

foreach ($claim in $exampleClaims) {
    Write-Host "Testing: $($claim.name) (Demo Mode)" -ForegroundColor Yellow
    
    try {
        $body = @{
            text = $claim.text
            demo_mode = $true
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$ApiUrl/analyze" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
        
        Write-Host "✅ Success" -ForegroundColor Green
        Write-Host "   Status: $($response.status_label)" -ForegroundColor Gray
        Write-Host "   Confidence: $($response.confidence_score)%" -ForegroundColor Gray
        
    } catch {
        Write-Host "❌ Failed" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
}

Write-Host "=== Test Complete ===" -ForegroundColor Cyan
