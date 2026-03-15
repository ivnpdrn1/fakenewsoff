#!/usr/bin/env pwsh
# Serper Integration Deployment Verification Script

Write-Host "=== Serper Integration Deployment Verification ===" -ForegroundColor Cyan
Write-Host ""

# Check if api-url.txt exists
if (-not (Test-Path "api-url.txt")) {
    Write-Host "❌ Error: api-url.txt not found. Please deploy the backend first." -ForegroundColor Red
    exit 1
}

# Read API URL
$apiUrl = Get-Content "api-url.txt" -Raw
$apiUrl = $apiUrl.Trim()

Write-Host "API URL: $apiUrl" -ForegroundColor Yellow
Write-Host ""

# Test claim
$testClaim = "Russia Ukraine war latest news"
Write-Host "Test Claim: $testClaim" -ForegroundColor Yellow
Write-Host ""

# Prepare request body
$body = @{
    claim = $testClaim
} | ConvertTo-Json

Write-Host "Sending request to /analyze endpoint..." -ForegroundColor Cyan

try {
    # Make API request
    $response = Invoke-RestMethod -Uri "$apiUrl/analyze" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
    
    Write-Host "✅ Request successful!" -ForegroundColor Green
    Write-Host ""
    
    # Extract key metrics
    $retrievalStatus = $response.retrieval_status
    $textGrounding = $response.text_grounding
    $debugInfo = $response._debug_fix_v4
    
    # Display results
    Write-Host "=== Retrieval Status ===" -ForegroundColor Cyan
    Write-Host "Mode: $($retrievalStatus.mode)" -ForegroundColor White
    Write-Host "Status: $($retrievalStatus.status)" -ForegroundColor White
    Write-Host "Providers Attempted: $($retrievalStatus.providersAttempted -join ', ')" -ForegroundColor White
    Write-Host "Providers Succeeded: $($retrievalStatus.providersSucceeded -join ', ')" -ForegroundColor White
    Write-Host "Providers Failed: $($retrievalStatus.providersFailed -join ', ')" -ForegroundColor White
    Write-Host ""
    
    # Check if Serper was attempted
    if ($retrievalStatus.providersAttempted -contains "serper") {
        Write-Host "✅ Serper provider was attempted" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Serper provider was NOT attempted (may not be configured)" -ForegroundColor Yellow
    }
    
    # Check if Serper succeeded
    if ($retrievalStatus.providersSucceeded -contains "serper") {
        Write-Host "✅ Serper provider succeeded!" -ForegroundColor Green
    } elseif ($retrievalStatus.providersAttempted -contains "serper") {
        Write-Host "⚠️  Serper provider attempted but failed" -ForegroundColor Yellow
    }
    Write-Host ""
    
    # Display text grounding results
    Write-Host "=== Text Grounding Results ===" -ForegroundColor Cyan
    Write-Host "Sources Count: $($textGrounding.sourcesCount)" -ForegroundColor White
    Write-Host "Providers Used: $($textGrounding.providerUsed -join ', ')" -ForegroundColor White
    Write-Host "Queries Count: $($textGrounding.queries.Count)" -ForegroundColor White
    Write-Host "Cache Hit: $($textGrounding.cacheHit)" -ForegroundColor White
    Write-Host "Latency: $($textGrounding.latencyMs)ms" -ForegroundColor White
    Write-Host ""
    
    # Check if sources were returned
    if ($textGrounding.sourcesCount -gt 0) {
        Write-Host "✅ Sources returned: $($textGrounding.sourcesCount)" -ForegroundColor Green
        
        # Display first source
        $firstSource = $textGrounding.sources[0]
        Write-Host ""
        Write-Host "=== Sample Source ===" -ForegroundColor Cyan
        Write-Host "Title: $($firstSource.title)" -ForegroundColor White
        Write-Host "URL: $($firstSource.url)" -ForegroundColor White
        Write-Host "Domain: $($firstSource.domain)" -ForegroundColor White
        Write-Host "Provider: $($firstSource.provider)" -ForegroundColor White
        Write-Host "Stance: $($firstSource.stance)" -ForegroundColor White
        Write-Host "Score: $($firstSource.score)" -ForegroundColor White
    } else {
        Write-Host "⚠️  No sources returned" -ForegroundColor Yellow
    }
    Write-Host ""
    
    # Display debug info
    if ($debugInfo) {
        Write-Host "=== Debug Info ===" -ForegroundColor Cyan
        Write-Host "Orchestration Method: $($debugInfo.orchestration_method_used)" -ForegroundColor White
        Write-Host "Ground Method: $($debugInfo.ground_method_used)" -ForegroundColor White
        Write-Host "Grounding Path: $($debugInfo.grounding_path)" -ForegroundColor White
        Write-Host "Queries Count: $($debugInfo.queries_count)" -ForegroundColor White
        Write-Host ""
    }
    
    # Check for provider failure details
    if ($retrievalStatus.providerFailureDetails) {
        Write-Host "=== Provider Failure Details ===" -ForegroundColor Cyan
        foreach ($failure in $retrievalStatus.providerFailureDetails) {
            Write-Host "Provider: $($failure.provider)" -ForegroundColor Yellow
            Write-Host "  Query: $($failure.query)" -ForegroundColor White
            Write-Host "  Reason: $($failure.reason)" -ForegroundColor White
            Write-Host "  Error: $($failure.errorMessage)" -ForegroundColor White
            if ($failure.httpStatus) {
                Write-Host "  HTTP Status: $($failure.httpStatus)" -ForegroundColor White
            }
            Write-Host ""
        }
    }
    
    # Validation summary
    Write-Host "=== Validation Summary ===" -ForegroundColor Cyan
    
    $checks = @()
    
    # Check 1: Multi-query orchestration
    if ($debugInfo.queries_count -gt 1) {
        Write-Host "✅ Multi-query orchestration active (queries: $($debugInfo.queries_count))" -ForegroundColor Green
        $checks += $true
    } else {
        Write-Host "❌ Multi-query orchestration NOT active" -ForegroundColor Red
        $checks += $false
    }
    
    # Check 2: Provider order includes serper
    if ($retrievalStatus.providersAttempted -contains "serper") {
        Write-Host "✅ Serper in provider chain" -ForegroundColor Green
        $checks += $true
    } else {
        Write-Host "⚠️  Serper NOT in provider chain (check SERPER_API_KEY)" -ForegroundColor Yellow
        $checks += $false
    }
    
    # Check 3: Sources returned or failure details present
    if ($textGrounding.sourcesCount -gt 0) {
        Write-Host "✅ Sources returned successfully" -ForegroundColor Green
        $checks += $true
    } elseif ($retrievalStatus.providerFailureDetails) {
        Write-Host "✅ Provider failure details present (expected when no sources)" -ForegroundColor Green
        $checks += $true
    } else {
        Write-Host "❌ No sources and no failure details" -ForegroundColor Red
        $checks += $false
    }
    
    # Check 4: Orchestration method
    if ($debugInfo.orchestration_method_used -eq "multiQuery") {
        Write-Host "✅ Orchestration method: multiQuery" -ForegroundColor Green
        $checks += $true
    } else {
        Write-Host "❌ Orchestration method NOT multiQuery" -ForegroundColor Red
        $checks += $false
    }
    
    Write-Host ""
    
    # Overall result
    $passedChecks = ($checks | Where-Object { $_ -eq $true }).Count
    $totalChecks = $checks.Count
    
    if ($passedChecks -eq $totalChecks) {
        Write-Host "🎉 All validation checks passed! ($passedChecks/$totalChecks)" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "⚠️  Some validation checks failed ($passedChecks/$totalChecks)" -ForegroundColor Yellow
        exit 1
    }
    
} catch {
    Write-Host "❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error Details:" -ForegroundColor Yellow
    Write-Host $_.Exception.ToString()
    exit 1
}
