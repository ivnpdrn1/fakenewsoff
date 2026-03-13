#!/usr/bin/env pwsh
# Mediastack Integration Deployment Verification Script

param(
    [string]$ApiUrl = "",
    [switch]$SkipLogs = $false
)

Write-Host "=== Mediastack Integration Deployment Verification ===" -ForegroundColor Cyan
Write-Host ""

# Get API URL
if (-not $ApiUrl) {
    if (Test-Path "api-url.txt") {
        $ApiUrl = Get-Content "api-url.txt" -Raw
        $ApiUrl = $ApiUrl.Trim()
        Write-Host "Using API URL from api-url.txt: $ApiUrl" -ForegroundColor Green
    } else {
        Write-Host "ERROR: API URL not provided and api-url.txt not found" -ForegroundColor Red
        Write-Host "Usage: ./verify-mediastack-deployment.ps1 -ApiUrl https://your-api-url.com"
        exit 1
    }
}

$results = @{
    HealthCheck = $false
    MediastackConfigured = $false
    ProviderOrder = $false
    RonaldReaganTest = $false
    EiffelTowerTest = $false
    NoFakeUrls = $true
    Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}

# Test 1: Health Check
Write-Host "Test 1: Health Check" -ForegroundColor Yellow
Write-Host "Checking /health/grounding endpoint..."
try {
    $healthResponse = Invoke-RestMethod -Uri "$ApiUrl/health/grounding" -Method Get -ErrorAction Stop
    Write-Host "✓ Health endpoint accessible" -ForegroundColor Green
    $results.HealthCheck = $true
    
    # Check mediastack_configured
    if ($healthResponse.mediastack_configured -eq $true) {
        Write-Host "✓ Mediastack configured: true" -ForegroundColor Green
        $results.MediastackConfigured = $true
    } else {
        Write-Host "✗ Mediastack configured: false" -ForegroundColor Red
        Write-Host "  ACTION REQUIRED: Set MEDIASTACK_API_KEY in Lambda environment" -ForegroundColor Yellow
    }
    
    # Check provider order
    if ($healthResponse.provider_order -contains "mediastack") {
        Write-Host "✓ Provider order includes 'mediastack'" -ForegroundColor Green
        Write-Host "  Provider order: $($healthResponse.provider_order -join ', ')" -ForegroundColor Gray
        $results.ProviderOrder = $true
    } else {
        Write-Host "✗ Provider order missing 'mediastack'" -ForegroundColor Red
        Write-Host "  Current order: $($healthResponse.provider_order -join ', ')" -ForegroundColor Gray
        Write-Host "  ACTION REQUIRED: Set GROUNDING_PROVIDER_ORDER=mediastack,gdelt" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Full health response:" -ForegroundColor Gray
    $healthResponse | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host "✗ Health check failed: $_" -ForegroundColor Red
    $results.HealthCheck = $false
}

Write-Host ""
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host ""

# Test 2: Ronald Reagan Claim
Write-Host "Test 2: Ronald Reagan Claim" -ForegroundColor Yellow
Write-Host "Testing: 'Ronald Reagan is dead'"
try {
    $body = @{
        text = "Ronald Reagan is dead"
        demo_mode = $false
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$ApiUrl/analyze" -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
    
    $sourcesCount = $response.sources.Count
    Write-Host "✓ Request successful" -ForegroundColor Green
    Write-Host "  Sources returned: $sourcesCount" -ForegroundColor Gray
    
    if ($sourcesCount -gt 0) {
        Write-Host "✓ Sources found" -ForegroundColor Green
        $results.RonaldReaganTest = $true
        
        # Check provider used
        $providers = @()
        if ($response.grounding_metadata.providerUsed) {
            $providers += $response.grounding_metadata.providerUsed
        }
        if ($response.grounding_metadata.attemptedProviders) {
            $providers += $response.grounding_metadata.attemptedProviders
        }
        
        if ($providers -contains "mediastack") {
            Write-Host "✓ Mediastack was used/attempted" -ForegroundColor Green
        } else {
            Write-Host "⚠ Mediastack not in providers: $($providers -join ', ')" -ForegroundColor Yellow
        }
        
        # Check for fake URLs
        $fakePatterns = @("nytimes.com/fake", "washingtonpost.com/fake", "reuters.com/fake", "example.com", "placeholder")
        foreach ($source in $response.sources) {
            foreach ($pattern in $fakePatterns) {
                if ($source.url -like "*$pattern*") {
                    Write-Host "✗ FAKE URL DETECTED: $($source.url)" -ForegroundColor Red
                    $results.NoFakeUrls = $false
                }
            }
        }
        
        if ($results.NoFakeUrls) {
            Write-Host "✓ No fake URLs detected" -ForegroundColor Green
        }
        
        # Show first source
        Write-Host ""
        Write-Host "First source:" -ForegroundColor Gray
        Write-Host "  Title: $($response.sources[0].title)" -ForegroundColor Gray
        Write-Host "  URL: $($response.sources[0].url)" -ForegroundColor Gray
        Write-Host "  Domain: $($response.sources[0].domain)" -ForegroundColor Gray
        if ($response.sources[0].provider) {
            Write-Host "  Provider: $($response.sources[0].provider)" -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠ No sources returned (may indicate provider issues)" -ForegroundColor Yellow
        $results.RonaldReaganTest = $false
    }
    
    Write-Host ""
    Write-Host "Verdict: $($response.verdict)" -ForegroundColor Gray
    Write-Host "Confidence: $($response.confidence)" -ForegroundColor Gray
    
} catch {
    Write-Host "✗ Test failed: $_" -ForegroundColor Red
    $results.RonaldReaganTest = $false
}

Write-Host ""
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host ""

# Test 3: Eiffel Tower Claim
Write-Host "Test 3: Eiffel Tower Claim" -ForegroundColor Yellow
Write-Host "Testing: 'The Eiffel Tower is located in Paris'"
try {
    $body = @{
        text = "The Eiffel Tower is located in Paris"
        demo_mode = $false
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$ApiUrl/analyze" -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
    
    $sourcesCount = $response.sources.Count
    Write-Host "✓ Request successful" -ForegroundColor Green
    Write-Host "  Sources returned: $sourcesCount" -ForegroundColor Gray
    
    if ($sourcesCount -gt 0) {
        Write-Host "✓ Sources found" -ForegroundColor Green
        $results.EiffelTowerTest = $true
    } else {
        Write-Host "⚠ No sources returned" -ForegroundColor Yellow
        $results.EiffelTowerTest = $false
    }
    
    Write-Host "  Verdict: $($response.verdict)" -ForegroundColor Gray
    
} catch {
    Write-Host "✗ Test failed: $_" -ForegroundColor Red
    $results.EiffelTowerTest = $false
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Gray
Write-Host ""

# Summary
Write-Host "=== VERIFICATION SUMMARY ===" -ForegroundColor Cyan
Write-Host ""

$passCount = 0
$totalTests = 6

if ($results.HealthCheck) { 
    Write-Host "✓ Health Check: PASS" -ForegroundColor Green
    $passCount++
} else { 
    Write-Host "✗ Health Check: FAIL" -ForegroundColor Red
}

if ($results.MediastackConfigured) { 
    Write-Host "✓ Mediastack Configured: PASS" -ForegroundColor Green
    $passCount++
} else { 
    Write-Host "✗ Mediastack Configured: FAIL" -ForegroundColor Red
}

if ($results.ProviderOrder) { 
    Write-Host "✓ Provider Order: PASS" -ForegroundColor Green
    $passCount++
} else { 
    Write-Host "✗ Provider Order: FAIL" -ForegroundColor Red
}

if ($results.RonaldReaganTest) { 
    Write-Host "✓ Ronald Reagan Test: PASS" -ForegroundColor Green
    $passCount++
} else { 
    Write-Host "✗ Ronald Reagan Test: FAIL" -ForegroundColor Red
}

if ($results.EiffelTowerTest) { 
    Write-Host "✓ Eiffel Tower Test: PASS" -ForegroundColor Green
    $passCount++
} else { 
    Write-Host "✗ Eiffel Tower Test: FAIL" -ForegroundColor Red
}

if ($results.NoFakeUrls) { 
    Write-Host "✓ No Fake URLs: PASS" -ForegroundColor Green
    $passCount++
} else { 
    Write-Host "✗ No Fake URLs: FAIL" -ForegroundColor Red
}

Write-Host ""
Write-Host "Score: $passCount/$totalTests tests passed" -ForegroundColor $(if ($passCount -eq $totalTests) { "Green" } elseif ($passCount -ge 4) { "Yellow" } else { "Red" })
Write-Host ""

# Save results
$resultsFile = "mediastack-verification-results.json"
$results | ConvertTo-Json -Depth 5 | Out-File $resultsFile
Write-Host "Results saved to: $resultsFile" -ForegroundColor Gray

# CloudWatch Logs Instructions
if (-not $SkipLogs) {
    Write-Host ""
    Write-Host "=== CLOUDWATCH LOGS VERIFICATION ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To check CloudWatch logs, run:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  # Get function name" -ForegroundColor Gray
    Write-Host '  $FUNCTION_NAME = aws lambda list-functions --query "Functions[?contains(FunctionName, ''AnalyzeFunction'')].FunctionName" --output text' -ForegroundColor Gray
    Write-Host ""
    Write-Host "  # Get log group" -ForegroundColor Gray
    Write-Host '  $LOG_GROUP = "/aws/lambda/$FUNCTION_NAME"' -ForegroundColor Gray
    Write-Host ""
    Write-Host "  # Tail logs" -ForegroundColor Gray
    Write-Host '  aws logs tail $LOG_GROUP --follow' -ForegroundColor Gray
    Write-Host ""
    Write-Host "Look for:" -ForegroundColor Yellow
    Write-Host '  - "provider": "mediastack"' -ForegroundColor Gray
    Write-Host '  - "event": "provider_success"' -ForegroundColor Gray
    Write-Host '  - "provider_order": ["mediastack", "gdelt"]' -ForegroundColor Gray
}

Write-Host ""
Write-Host "Verification complete!" -ForegroundColor Cyan

# Exit code
if ($passCount -eq $totalTests) {
    exit 0
} else {
    exit 1
}
