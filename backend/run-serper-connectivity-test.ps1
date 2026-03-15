#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Run Serper Connectivity Test

.DESCRIPTION
    Tests basic connectivity to Serper API to diagnose network issues.

.EXAMPLE
    .\run-serper-connectivity-test.ps1
#>

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "Serper Connectivity Test Runner" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# Check for SERPER_API_KEY
if ([string]::IsNullOrWhiteSpace($env:SERPER_API_KEY)) {
    Write-Host "Missing SERPER_API_KEY environment variable" -ForegroundColor Red
    Write-Host ""
    Write-Host "Would you like to enter it now? (y/n): " -NoNewline -ForegroundColor Yellow
    $response = Read-Host
    
    if ($response -eq "y" -or $response -eq "Y") {
        Write-Host "Enter SERPER_API_KEY: " -NoNewline -ForegroundColor Yellow
        $secureValue = Read-Host -AsSecureString
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
        $value = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        $env:SERPER_API_KEY = $value
        Write-Host ""
        Write-Host "API key set for this session." -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "Exiting. Please set SERPER_API_KEY and try again." -ForegroundColor Red
        exit 1
    }
}

# Set timeout if not already set
if ([string]::IsNullOrWhiteSpace($env:SERPER_TIMEOUT_MS)) {
    $env:SERPER_TIMEOUT_MS = "10000"
}

Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  SERPER_API_KEY: Present ($($env:SERPER_API_KEY.Length) chars)" -ForegroundColor Gray
Write-Host "  SERPER_TIMEOUT_MS: $env:SERPER_TIMEOUT_MS ms" -ForegroundColor Gray
Write-Host ""

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "Running Connectivity Test..." -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# Run the test
try {
    npx tsx test-serper-connectivity.ts
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "================================================================================" -ForegroundColor Green
        Write-Host "CONNECTIVITY TEST PASSED" -ForegroundColor Green
        Write-Host "================================================================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Serper API is accessible from this environment." -ForegroundColor Green
        Write-Host "You can now run the full production path test." -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "================================================================================" -ForegroundColor Red
        Write-Host "CONNECTIVITY TEST FAILED" -ForegroundColor Red
        Write-Host "================================================================================" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please review the error details above and follow the debugging steps." -ForegroundColor Red
    }
    
    exit $exitCode
} catch {
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Red
    Write-Host "ERROR RUNNING TEST" -ForegroundColor Red
    Write-Host "================================================================================" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
