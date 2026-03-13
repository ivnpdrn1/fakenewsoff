#!/usr/bin/env pwsh
# V4 Deployment Verification Script
# Verifies that V4 fix is deployed and active

param(
    [Parameter(Mandatory=$false)]
    [string]$ApiUrl = ""
)

Write-Host "=== V4 Deployment Verification ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify build artifacts
Write-Host "Step 1: Verifying build artifacts..." -ForegroundColor Yellow
$buildPath = "backend/.aws-sam/build/GroundingFunction/lambda.js"

if (-not (Test-Path $buildPath)) {
    Write-Host "ERROR: Build artifact not found at $buildPath" -ForegroundColor Red
    Write-Host "Run 'sam build' first" -ForegroundColor Red
    exit 1
}

$markers = @(
    "LAMBDA_HANDLER_STARTUP_V4",
    "build_fix_version: 'v4'",
    "LAMBDA_FIX_PATH_ACTIVE_V4",
    "ORCHESTRATION_RESULT_RECEIVED_V4",
    "_debug_fix_v4",
    "subclaim_count",
    "subclaims_preview",
    "provider_failure_details"
)

$allFound = $true
foreach ($marker in $markers) {
    $found = Select-String -Path $buildPath -Pattern [regex]::Escape($marker) -Quiet
    if ($found) {
        Write-Host "  ✓ Found: $marker" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Missing: $marker" -ForegroundColor Red
        $allFound = $false
    }
}

if (-not $allFound) {
    Write-Host ""
    Write-Host "ERROR: Some V4 markers are missing from build artifact" -ForegroundColor Red
    Write-Host "This means V4 code changes were not compiled correctly" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✓ All V4 markers found in build artifact" -ForegroundColor Green
Write-Host ""

# Step 2: Test API if URL provided
if ($ApiUrl) {
    Write-Host "Step 2: Testing live API..." -ForegroundColor Yellow
    
    $testClaim = "Russia Ukraine war latest news"
    $body = @{
        text = $testClaim
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$ApiUrl/analyze" -Method POST -Body $body -ContentType "application/json"
        
        # Check for V4 debug field
        if ($response._debug_fix_v4) {
            Write-Host "  ✓ Found _debug_fix_v4 field" -ForegroundColor Green
            
            $debug = $response._debug_fix_v4
            
            # Check fix version
            if ($debug.fix_version -eq "v4") {
                Write-Host "  ✓ fix_version = v4" -ForegroundColor Green
            } else {
                Write-Host "  ✗ fix_version = $($debug.fix_version) (expected v4)" -ForegroundColor Red
            }
            
            # Check queries count
            Write-Host "  ℹ queries_count = $($debug.queries_count)" -ForegroundColor Cyan
            
            # Check subclaim count
            Write-Host "  ℹ subclaim_count = $($debug.subclaim_count)" -ForegroundColor Cyan
            
            # Check subclaims preview
            if ($debug.subclaims_preview) {
                Write-Host "  ℹ subclaims_preview:" -ForegroundColor Cyan
                foreach ($subclaim in $debug.subclaims_preview) {
                    Write-Host "    - $subclaim" -ForegroundColor Gray
                }
            }
            
            # Check provider failures
            if ($debug.providers_failed -and $debug.providers_failed.Count -gt 0) {
                Write-Host "  ℹ providers_failed: $($debug.providers_failed -join ', ')" -ForegroundColor Cyan
                
                # Check provider failure details
                if ($debug.provider_failure_details -and $debug.provider_failure_details.Count -gt 0) {
                    Write-Host "  ✓ provider_failure_details present ($($debug.provider_failure_details.Count) failures)" -ForegroundColor Green
                    
                    foreach ($failure in $debug.provider_failure_details) {
                        Write-Host "    - $($failure.provider): $($failure.reason) at $($failure.stage)" -ForegroundColor Gray
                        if ($failure.errorMessage) {
                            Write-Host "      Error: $($failure.errorMessage)" -ForegroundColor Gray
                        }
                    }
                } else {
                    Write-Host "  ⚠ provider_failure_details missing or empty" -ForegroundColor Yellow
                }
            } else {
                Write-Host "  ℹ No provider failures (all succeeded)" -ForegroundColor Cyan
            }
            
            Write-Host ""
            Write-Host "✓ V4 is deployed and active" -ForegroundColor Green
            
        } else {
            Write-Host "  ✗ _debug_fix_v4 field not found in response" -ForegroundColor Red
            Write-Host "  This means V4 is NOT deployed yet" -ForegroundColor Red
            
            # Check for older versions
            if ($response._debug_fix_v3) {
                Write-Host "  ℹ Found _debug_fix_v3 (V3 is still active)" -ForegroundColor Yellow
            } elseif ($response._debug_fix_v2) {
                Write-Host "  ℹ Found _debug_fix_v2 (V2 is still active)" -ForegroundColor Yellow
            }
            
            exit 1
        }
        
    } catch {
        Write-Host "  ✗ API request failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
    
} else {
    Write-Host "Step 2: Skipped (no API URL provided)" -ForegroundColor Gray
    Write-Host "  To test live API, run: .\scripts\verify-v4.ps1 -ApiUrl 'https://your-api-url'" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Verification Complete ===" -ForegroundColor Cyan
