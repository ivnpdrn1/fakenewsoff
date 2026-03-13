#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Verify V3 deployment markers

.DESCRIPTION
    Checks that V3 markers are present in compiled files and SAM build
#>

cd backend

Write-Host "`n=== V3 Deployment Verification ===" -ForegroundColor Cyan

# Check compiled files
Write-Host "`n[1/3] Checking compiled files..." -ForegroundColor Yellow
$m1 = Select-String -Path dist/lambda.js -Pattern "LAMBDA_HANDLER_STARTUP_V3" -Quiet
$m2 = Select-String -Path dist/lambda.js -Pattern "_debug_fix_v3" -Quiet
$m3 = Select-String -Path dist/orchestration/evidenceOrchestrator.js -Pattern "groundSingleQuery" -Quiet

Write-Host "  LAMBDA_HANDLER_STARTUP_V3: $(if($m1){'✅'}else{'❌'})" -ForegroundColor $(if($m1){'Green'}else{'Red'})
Write-Host "  _debug_fix_v3: $(if($m2){'✅'}else{'❌'})" -ForegroundColor $(if($m2){'Green'}else{'Red'})
Write-Host "  groundSingleQuery: $(if($m3){'✅'}else{'❌'})" -ForegroundColor $(if($m3){'Green'}else{'Red'})

# Check SAM build
Write-Host "`n[2/3] Checking SAM build..." -ForegroundColor Yellow
if (Test-Path .aws-sam/build/AnalyzeFunction/lambda.js) {
    $s1 = Select-String -Path .aws-sam/build/AnalyzeFunction/lambda.js -Pattern "LAMBDA_HANDLER_STARTUP_V3" -Quiet
    $s2 = Select-String -Path .aws-sam/build/AnalyzeFunction/orchestration/evidenceOrchestrator.js -Pattern "groundSingleQuery" -Quiet
    Write-Host "  LAMBDA_HANDLER_STARTUP_V3: $(if($s1){'✅'}else{'❌'})" -ForegroundColor $(if($s1){'Green'}else{'Red'})
    Write-Host "  groundSingleQuery: $(if($s2){'✅'}else{'❌'})" -ForegroundColor $(if($s2){'Green'}else{'Red'})
    
    if ($s1 -and $s2) {
        Write-Host "`n  ✅ SAM build ready for deployment" -ForegroundColor Green
    } else {
        Write-Host "`n  ❌ SAM build missing V3 markers" -ForegroundColor Red
        Write-Host "  Run: sam build --use-container" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⚠️  SAM build not found" -ForegroundColor Yellow
    Write-Host "  Run: sam build --use-container" -ForegroundColor Yellow
}

# Summary
Write-Host "`n[3/3] Summary:" -ForegroundColor Yellow
if ($m1 -and $m2 -and $m3) {
    Write-Host "  ✅ V3 markers present in compiled files" -ForegroundColor Green
    if (Test-Path .aws-sam/build/AnalyzeFunction/lambda.js) {
        if ($s1 -and $s2) {
            Write-Host "  ✅ Ready to deploy with: sam deploy" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Run: sam build --use-container" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ⚠️  Run: sam build --use-container" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ❌ V3 markers missing in compiled files" -ForegroundColor Red
    Write-Host "  Run: npm run build" -ForegroundColor Yellow
}

Write-Host ""
