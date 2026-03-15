#!/usr/bin/env pwsh
# Serper Initialization Fix Verification Script
# Verifies that Serper client initializes correctly in production

param(
    [string]$ApiUrl = "",
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

Write-Host "=== Serper Initialization Fix Verification ===" -ForegroundColor Cyan
Write-Host ""

# Load API URL if not provided
if (-not $ApiUrl) {
    if (Test-Path "api-url.txt") {
        $ApiUrl = Get-Content "api-url.txt" -Raw
        $ApiUrl = $ApiUrl.Trim()
        Write-Host "✓ Loaded API URL from api-url.txt" -ForegroundColor Green
    } else {
        Write-Host "✗ No API URL provided and api-url.txt not found" -ForegroundColor Red
        Write-Host "Usage: .\verify-serper-initialization.ps1 -ApiUrl <url>" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "API URL: $ApiUrl" -ForegroundColor Gray
Write-Host ""

# Test 1: Verify Lambda Environment Variable
Write-Host "Test 1: Checking Lambda environment variables..." -ForegroundColor Cyan
try {
    $envCheck = aws lambda get-function-configuration --function-name FakeNewsOffFunction --query 'Environment.Variables.SERPER_API_KEY' 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $envCheck -ne "null" -and $envCheck -ne '""') {
        Write-Host "✓ SERPER_API_KEY is configured in Lambda" -ForegroundColor Green
    } else {
        Write-Host "✗ SERPER_API_KEY not found in Lambda environment" -ForegroundColor Red
        Write-Host "  Please configure: aws lambda update-function-configuration --function-name FakeNewsOffFunction --environment Variables={SERPER_API_KEY=your-key}" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "⚠ Could not check Lambda environment (AWS CLI may not be configured)" -ForegroundColor Yellow
    Write-Host "  Continuing with API tests..." -ForegroundColor Gray
}
Write-Host ""

# Test 2: Basic Grounding Request
Write-Host "Test 2: Testing basic grounding request..." -ForegroundColor Cyan
$testClaim = "Breaking news today"
$body = @{
    claim = $testClaim
    groundTextOnly = $false
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $ApiUrl -Method POST -Body $body -ContentType "application/json" -TimeoutSec 30
    
    if ($Verbose) {
        Write-Host "Response:" -ForegroundColor Gray
        $response | ConvertTo-Json -Depth 5 | Write-Host -ForegroundColor Gray
        Write-Host ""
    }
    
    # Check if Serper was attempted
    if ($response.attemptedProviders -contains "serper") {
        Write-Host "✓ Serper provider was attempted" -ForegroundColor Green
    } else {
        Write-Host "✗ Serper provider was NOT attempted" -ForegroundColor Red
        Write-Host "  Attempted providers: $($response.attemptedProviders -join ', ')" -ForegroundColor Yellow
    }
    
    # Check if Serper was used successfully
    if ($response.providerUsed -eq "serper") {
        Write-Host "✓ Serper provider was used successfully" -ForegroundColor Green
        Write-Host "  Sources returned: $($response.sources.Count)" -ForegroundColor Gray
    } elseif ($response.providerUsed -eq "mediastack") {
        Write-Host "⚠ Mediastack was used instead of Serper" -ForegroundColor Yellow
        Write-Host "  This is OK if Mediastack succeeded first" -ForegroundColor Gray
    } elseif ($response.providerUsed -eq "gdelt") {
        Write-Host "⚠ GDELT was used (fallback)" -ForegroundColor Yellow
        Write-Host "  Check if Serper failed or was skipped" -ForegroundColor Gray
    } else {
        Write-Host "⚠ Unexpected provider used: $($response.providerUsed)" -ForegroundColor Yellow
    }
    
    # Check for provider failure details
    if ($response.providerFailureDetails) {
        $failure = $response.providerFailureDetails
        if ($failure.provider -eq "serper") {
            Write-Host "✗ Serper provider failed:" -ForegroundColor Red
            Write-Host "  Reason: $($failure.reason)" -ForegroundColor Red
            Write-Host "  Error: $($failure.error_message)" -ForegroundColor Red
            
            if ($failure.reason -eq "client_not_initialized") {
                Write-Host "" -ForegroundColor Red
                Write-Host "  ❌ BUG STILL PRESENT: Serper client not initialized!" -ForegroundColor Red
                Write-Host "  This means the fix did not work correctly." -ForegroundColor Red
                exit 1
            }
        }
    }
    
    # Check sources
    if ($response.sources.Count -gt 0) {
        Write-Host "✓ Sources returned: $($response.sources.Count)" -ForegroundColor Green
        
        if ($Verbose) {
            Write-Host "  Sample source:" -ForegroundColor Gray
            $sample = $response.sources[0]
            Write-Host "    Title: $($sample.title)" -ForegroundColor Gray
            Write-Host "    Domain: $($sample.domain)" -ForegroundColor Gray
            Write-Host "    URL: $($sample.url)" -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠ No sources returned" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "✗ API request failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 3: Check CloudWatch Logs for Initialization
Write-Host "Test 3: Checking CloudWatch logs for initialization events..." -ForegroundColor Cyan
try {
    $logGroup = "/aws/lambda/FakeNewsOffFunction"
    $startTime = [DateTimeOffset]::UtcNow.AddMinutes(-10).ToUnixTimeMilliseconds()
    
    # Check for SERPER_ENV_PRESENT
    $envPresentLogs = aws logs filter-log-events `
        --log-group-name $logGroup `
        --start-time $startTime `
        --filter-pattern "SERPER_ENV_PRESENT" `
        --query 'events[0].message' `
        --output text 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $envPresentLogs -ne "None" -and $envPresentLogs -ne "") {
        Write-Host "✓ Found SERPER_ENV_PRESENT log" -ForegroundColor Green
        if ($Verbose) {
            Write-Host "  $envPresentLogs" -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠ SERPER_ENV_PRESENT log not found (may be older than 10 minutes)" -ForegroundColor Yellow
    }
    
    # Check for SERPER_CLIENT_INITIALIZED
    $clientInitLogs = aws logs filter-log-events `
        --log-group-name $logGroup `
        --start-time $startTime `
        --filter-pattern "SERPER_CLIENT_INITIALIZED" `
        --query 'events[0].message' `
        --output text 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $clientInitLogs -ne "None" -and $clientInitLogs -ne "") {
        Write-Host "✓ Found SERPER_CLIENT_INITIALIZED log" -ForegroundColor Green
        if ($Verbose) {
            Write-Host "  $clientInitLogs" -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠ SERPER_CLIENT_INITIALIZED log not found" -ForegroundColor Yellow
    }
    
    # Check for SERPER_CLIENT_NOT_INITIALIZED (should NOT exist after fix)
    $clientNotInitLogs = aws logs filter-log-events `
        --log-group-name $logGroup `
        --start-time $startTime `
        --filter-pattern "SERPER_CLIENT_NOT_INITIALIZED" `
        --query 'events[0].message' `
        --output text 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $clientNotInitLogs -ne "None" -and $clientNotInitLogs -ne "") {
        Write-Host "✗ Found SERPER_CLIENT_NOT_INITIALIZED log (BUG PRESENT!)" -ForegroundColor Red
        if ($Verbose) {
            Write-Host "  $clientNotInitLogs" -ForegroundColor Red
        }
        Write-Host "" -ForegroundColor Red
        Write-Host "  ❌ Serper client failed to initialize!" -ForegroundColor Red
        Write-Host "  Check the error message in CloudWatch logs." -ForegroundColor Red
        exit 1
    } else {
        Write-Host "✓ No SERPER_CLIENT_NOT_INITIALIZED logs (good!)" -ForegroundColor Green
    }
    
    # Check for PROVIDER_CLIENT_STATUS
    $providerStatusLogs = aws logs filter-log-events `
        --log-group-name $logGroup `
        --start-time $startTime `
        --filter-pattern "PROVIDER_CLIENT_STATUS" `
        --query 'events[0].message' `
        --output text 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $providerStatusLogs -ne "None" -and $providerStatusLogs -ne "") {
        Write-Host "✓ Found PROVIDER_CLIENT_STATUS log" -ForegroundColor Green
        if ($Verbose) {
            Write-Host "  $providerStatusLogs" -ForegroundColor Gray
        }
        
        # Parse and check serper_initialized
        if ($providerStatusLogs -match "serper_initialized.*true") {
            Write-Host "✓ Serper client is initialized (serper_initialized: true)" -ForegroundColor Green
        } elseif ($providerStatusLogs -match "serper_initialized.*false") {
            Write-Host "✗ Serper client is NOT initialized (serper_initialized: false)" -ForegroundColor Red
            Write-Host "  ❌ BUG STILL PRESENT!" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "⚠ PROVIDER_CLIENT_STATUS log not found (may be older than 10 minutes)" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "⚠ Could not check CloudWatch logs (AWS CLI may not be configured)" -ForegroundColor Yellow
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Gray
}
Write-Host ""

# Test 4: Test with Multiple Claims
Write-Host "Test 4: Testing with multiple claims..." -ForegroundColor Cyan
$testClaims = @(
    "Tesla stock price today",
    "Weather forecast this week",
    "Latest technology news"
)

$serperSuccessCount = 0
$totalTests = $testClaims.Count

foreach ($claim in $testClaims) {
    Write-Host "  Testing: $claim" -ForegroundColor Gray
    
    $body = @{
        claim = $claim
        groundTextOnly = $false
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri $ApiUrl -Method POST -Body $body -ContentType "application/json" -TimeoutSec 30
        
        if ($response.providerUsed -eq "serper") {
            $serperSuccessCount++
            Write-Host "    ✓ Serper used ($($response.sources.Count) sources)" -ForegroundColor Green
        } elseif ($response.attemptedProviders -contains "serper") {
            Write-Host "    ⚠ Serper attempted but not used (used: $($response.providerUsed))" -ForegroundColor Yellow
        } else {
            Write-Host "    ⚠ Serper not attempted (used: $($response.providerUsed))" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "    ✗ Request failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "Serper success rate: $serperSuccessCount / $totalTests" -ForegroundColor $(if ($serperSuccessCount -gt 0) { "Green" } else { "Yellow" })
Write-Host ""

# Summary
Write-Host "=== Verification Summary ===" -ForegroundColor Cyan
Write-Host ""

$allPassed = $true

if ($response.attemptedProviders -contains "serper") {
    Write-Host "✓ Serper provider is being attempted" -ForegroundColor Green
} else {
    Write-Host "✗ Serper provider is NOT being attempted" -ForegroundColor Red
    $allPassed = $false
}

if ($serperSuccessCount -gt 0) {
    Write-Host "✓ Serper provider successfully returned results" -ForegroundColor Green
} else {
    Write-Host "⚠ Serper provider did not return results (may be fallback behavior)" -ForegroundColor Yellow
}

if ($response.providerFailureDetails -and $response.providerFailureDetails.provider -eq "serper" -and $response.providerFailureDetails.reason -eq "client_not_initialized") {
    Write-Host "✗ BUG STILL PRESENT: Serper client not initialized" -ForegroundColor Red
    $allPassed = $false
} else {
    Write-Host "✓ No 'client_not_initialized' errors for Serper" -ForegroundColor Green
}

Write-Host ""

if ($allPassed) {
    Write-Host "🎉 All critical checks passed! Serper initialization fix is working." -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ Some checks failed. Please review the output above." -ForegroundColor Red
    exit 1
}
