#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Verify Orchestration Mediastack Fix Deployment

.DESCRIPTION
    Automated verification script to check if the orchestration fix is properly deployed.
    Checks build artifacts, SAM package, and deployed Lambda code for diagnostic markers.

.PARAMETER ApiUrl
    The API Gateway URL to test (optional, will skip API test if not provided)

.EXAMPLE
    .\verify-orchestration-fix.ps1
    .\verify-orchestration-fix.ps1 -ApiUrl "https://abc123.execute-api.us-east-1.amazonaws.com/Prod"
#>

param(
    [string]$ApiUrl = ""
)

$ErrorActionPreference = "Continue"
$script:FailureCount = 0
$script:SuccessCount = 0

function Write-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Message = ""
    )
    
    if ($Passed) {
        Write-Host "✅ PASS: $TestName" -ForegroundColor Green
        if ($Message) {
            Write-Host "   $Message" -ForegroundColor Gray
        }
        $script:SuccessCount++
    } else {
        Write-Host "❌ FAIL: $TestName" -ForegroundColor Red
        if ($Message) {
            Write-Host "   $Message" -ForegroundColor Yellow
        }
        $script:FailureCount++
    }
}

function Test-FileContainsMarker {
    param(
        [string]$FilePath,
        [string]$Marker
    )
    
    if (-not (Test-Path $FilePath)) {
        return $false
    }
    
    $content = Get-Content $FilePath -Raw -ErrorAction SilentlyContinue
    return $content -match [regex]::Escape($Marker)
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Orchestration Fix Deployment Verification" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Change to backend directory
Push-Location backend

try {
    # Test 1: Check if dist/ exists
    Write-Host "`n[1/8] Checking build artifacts..." -ForegroundColor Cyan
    $distExists = Test-Path "dist/lambda.js"
    Write-TestResult "dist/lambda.js exists" $distExists

    # Test 2: Check for markers in dist/lambda.js
    if ($distExists) {
        Write-Host "`n[2/8] Checking diagnostic markers in dist/lambda.js..." -ForegroundColor Cyan
        $hasLambdaMarker = Test-FileContainsMarker "dist/lambda.js" "LAMBDA_FIX_PATH_ACTIVE_V2"
        Write-TestResult "LAMBDA_FIX_PATH_ACTIVE_V2 in dist/lambda.js" $hasLambdaMarker
        
        $hasDebugField = Test-FileContainsMarker "dist/lambda.js" "_debug_fix_v2"
        Write-TestResult "_debug_fix_v2 in dist/lambda.js" $hasDebugField
    } else {
        Write-TestResult "Skipping marker check (dist/ not found)" $false "Run 'npm run build' first"
    }

    # Test 3: Check for markers in dist/orchestration/evidenceOrchestrator.js
    Write-Host "`n[3/8] Checking diagnostic markers in evidenceOrchestrator..." -ForegroundColor Cyan
    $orchestratorExists = Test-Path "dist/orchestration/evidenceOrchestrator.js"
    if ($orchestratorExists) {
        $hasOrchestratorMarker = Test-FileContainsMarker "dist/orchestration/evidenceOrchestrator.js" "ORCHESTRATOR_FIX_PATH_ACTIVE_V2"
        Write-TestResult "ORCHESTRATOR_FIX_PATH_ACTIVE_V2 in evidenceOrchestrator.js" $hasOrchestratorMarker
        
        $hasGroundTextOnly = Test-FileContainsMarker "dist/orchestration/evidenceOrchestrator.js" "groundTextOnly"
        Write-TestResult "groundTextOnly call in evidenceOrchestrator.js" $hasGroundTextOnly
    } else {
        Write-TestResult "evidenceOrchestrator.js exists" $false "Run 'npm run build' first"
    }

    # Test 4: Check SAM build artifacts
    Write-Host "`n[4/8] Checking SAM build artifacts..." -ForegroundColor Cyan
    $samBuildExists = Test-Path ".aws-sam/build/FakeNewsOffFunction/lambda.js"
    Write-TestResult "SAM build artifact exists" $samBuildExists
    
    if ($samBuildExists) {
        $samHasMarker = Test-FileContainsMarker ".aws-sam/build/FakeNewsOffFunction/lambda.js" "LAMBDA_FIX_PATH_ACTIVE_V2"
        Write-TestResult "LAMBDA_FIX_PATH_ACTIVE_V2 in SAM build" $samHasMarker
    } else {
        Write-TestResult "Skipping SAM marker check" $false "Run 'sam build' first"
    }

    # Test 5: Check orchestration pipeline includes queries
    Write-Host "`n[5/8] Checking orchestration pipeline..." -ForegroundColor Cyan
    $pipelineExists = Test-Path "dist/orchestration/iterativeOrchestrationPipeline.js"
    if ($pipelineExists) {
        $hasQueriesField = Test-FileContainsMarker "dist/orchestration/iterativeOrchestrationPipeline.js" "queries:"
        Write-TestResult "queries field in OrchestrationResult" $hasQueriesField
    } else {
        Write-TestResult "iterativeOrchestrationPipeline.js exists" $false
    }

    # Test 6: Check TypeScript source files
    Write-Host "`n[6/8] Checking TypeScript source files..." -ForegroundColor Cyan
    $srcLambdaHasMarker = Test-FileContainsMarker "src/lambda.ts" "LAMBDA_FIX_PATH_ACTIVE_V2"
    Write-TestResult "LAMBDA_FIX_PATH_ACTIVE_V2 in src/lambda.ts" $srcLambdaHasMarker
    
    $srcOrchestratorHasMarker = Test-FileContainsMarker "src/orchestration/evidenceOrchestrator.ts" "ORCHESTRATOR_FIX_PATH_ACTIVE_V2"
    Write-TestResult "ORCHESTRATOR_FIX_PATH_ACTIVE_V2 in src/orchestration/evidenceOrchestrator.ts" $srcOrchestratorHasMarker

    # Test 7: Verify TypeScript compilation
    Write-Host "`n[7/8] Verifying TypeScript compilation..." -ForegroundColor Cyan
    $tscOutput = npx tsc --noEmit 2>&1
    $tscSuccess = $LASTEXITCODE -eq 0
    Write-TestResult "TypeScript compilation (no errors)" $tscSuccess
    if (-not $tscSuccess) {
        Write-Host "   TypeScript errors:" -ForegroundColor Yellow
        Write-Host $tscOutput -ForegroundColor Gray
    }

    # Test 8: Test API if URL provided
    if ($ApiUrl) {
        Write-Host "`n[8/8] Testing live API..." -ForegroundColor Cyan
        try {
            $body = @{
                text = "Russia Ukraine war latest news"
            } | ConvertTo-Json

            $response = Invoke-RestMethod -Uri "$ApiUrl/analyze" `
                -Method POST `
                -ContentType "application/json" `
                -Body $body `
                -ErrorAction Stop

            # Check for debug field
            $hasDebugField = $null -ne $response._debug_fix_v2
            Write-TestResult "API response has _debug_fix_v2 field" $hasDebugField
            
            if ($hasDebugField) {
                $queriesCount = $response._debug_fix_v2.queries_from_orchestration.Count
                $hasQueries = $queriesCount -gt 0
                Write-TestResult "Queries generated (count: $queriesCount)" $hasQueries
                
                $providers = $response._debug_fix_v2.providers_from_status
                $hasMediastack = $providers -contains "mediastack"
                Write-TestResult "Mediastack in providers" $hasMediastack "Providers: $($providers -join ', ')"
                
                $fixActive = $response._debug_fix_v2.fix_active
                Write-TestResult "Fix active flag" $fixActive
            }
            
            # Check text_grounding
            $textGroundingQueries = $response.text_grounding.queries.Count
            $hasTextQueries = $textGroundingQueries -gt 0
            Write-TestResult "text_grounding.queries populated (count: $textGroundingQueries)" $hasTextQueries
            
        } catch {
            Write-TestResult "API request" $false "Error: $($_.Exception.Message)"
        }
    } else {
        Write-Host "`n[8/8] Skipping API test (no URL provided)" -ForegroundColor Yellow
        Write-Host "   Use -ApiUrl parameter to test live API" -ForegroundColor Gray
    }

} finally {
    Pop-Location
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Verification Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Passed: $script:SuccessCount" -ForegroundColor Green
Write-Host "❌ Failed: $script:FailureCount" -ForegroundColor Red

if ($script:FailureCount -eq 0) {
    Write-Host "`n🎉 All checks passed! Fix is properly deployed." -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n⚠️  Some checks failed. Review the output above." -ForegroundColor Yellow
    Write-Host "`nRecommended actions:" -ForegroundColor Cyan
    
    if (-not $distExists) {
        Write-Host "  1. Run: cd backend && npm run build" -ForegroundColor White
    }
    if ($distExists -and -not $hasLambdaMarker) {
        Write-Host "  1. Verify source files have markers" -ForegroundColor White
        Write-Host "  2. Clean and rebuild: Remove-Item -Recurse dist; npm run build" -ForegroundColor White
    }
    if (-not $samBuildExists -or ($samBuildExists -and -not $samHasMarker)) {
        Write-Host "  3. Run: sam build --use-container" -ForegroundColor White
        Write-Host "  4. Run: sam deploy" -ForegroundColor White
    }
    
    Write-Host "`nFor detailed troubleshooting, see: ORCHESTRATION_DEPLOYMENT_VERIFICATION.md" -ForegroundColor Gray
    exit 1
}
