#!/usr/bin/env pwsh
# Production Verification Script
# Checks if the latest deployment is live and accessible

$ProductionUrl = "https://d1bfsru3sckwq1.cloudfront.net"
$ApiUrl = "https://fnd9pknygc.execute-api.us-east-1.amazonaws.com"

Write-Host "=== FakeNewsOff Production Verification ===" -ForegroundColor Cyan
Write-Host ""

# Check 1: Frontend accessibility
Write-Host "1. Checking frontend accessibility..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $ProductionUrl -Method GET -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Frontend is accessible (HTTP 200)" -ForegroundColor Green
        
        # Check if the latest bundle is being served
        $content = $response.Content
        if ($content -match "index-DcrCbOtO\.js") {
            Write-Host "   ✅ Latest bundle detected (index-DcrCbOtO.js)" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Old bundle detected - CloudFront cache may not be propagated yet" -ForegroundColor Yellow
            Write-Host "   💡 Wait 5-10 more minutes or try hard refresh (Ctrl+Shift+R)" -ForegroundColor Cyan
            
            # Show which bundle is currently being served
            if ($content -match "index-([a-zA-Z0-9_-]+)\.js") {
                Write-Host "   Current bundle: index-$($matches[1]).js" -ForegroundColor Gray
            }
        }
    }
} catch {
    Write-Host "   ❌ Frontend not accessible: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Check 2: API health
Write-Host "2. Checking API health..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "$ApiUrl/health" -Method GET
    Write-Host "   ✅ API is healthy" -ForegroundColor Green
    Write-Host "   Status: $($healthResponse.status)" -ForegroundColor Gray
    if ($healthResponse.demo_mode -ne $null) {
        Write-Host "   Demo Mode: $($healthResponse.demo_mode)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ API health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Check 3: Test claim analysis (demo mode)
Write-Host "3. Testing claim analysis (demo mode)..." -ForegroundColor Yellow
try {
    $testClaim = @{
        text = "The Eiffel Tower is in Paris"
        demo_mode = $true
    } | ConvertTo-Json

    $analyzeResponse = Invoke-RestMethod -Uri "$ApiUrl/analyze" -Method POST -Body $testClaim -ContentType "application/json"
    
    Write-Host "   ✅ Analysis successful" -ForegroundColor Green
    Write-Host "   Request ID: $($analyzeResponse.request_id)" -ForegroundColor Gray
    Write-Host "   Status: $($analyzeResponse.status_label)" -ForegroundColor Gray
    Write-Host "   Confidence: $($analyzeResponse.confidence_score)%" -ForegroundColor Gray
    
    if ($analyzeResponse.orchestration) {
        Write-Host "   Orchestration: Enabled ($($analyzeResponse.orchestration.passes_executed) passes)" -ForegroundColor Gray
    }
    
    if ($analyzeResponse.text_grounding) {
        Write-Host "   Text Grounding: $($analyzeResponse.text_grounding.sources.Count) sources" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Analysis failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Error details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Verification Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. If CloudFront cache not propagated: Wait 5-10 minutes and try again" -ForegroundColor Gray
Write-Host "2. If frontend loads but shows errors: Open browser DevTools → Console for details" -ForegroundColor Gray
Write-Host "3. If API fails: Check CloudWatch logs in AWS Console" -ForegroundColor Gray
Write-Host "4. For browser cache issues: Hard refresh (Ctrl+Shift+R) or clear cache" -ForegroundColor Gray
Write-Host ""
