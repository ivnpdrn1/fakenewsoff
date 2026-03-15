#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Run Full Production Path Integration Test

.DESCRIPTION
    Interactive helper script to run the full production path integration test.
    Checks for required environment variables and runs the test with proper error handling.

.EXAMPLE
    .\run-full-production-path-test.ps1
#>

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "Full Production Path Integration Test Runner" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# Check for required environment variables
$requiredVars = @(
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "BEDROCK_MODEL_ID",
    "SERPER_API_KEY"
)

$missingVars = @()
foreach ($var in $requiredVars) {
    $value = [Environment]::GetEnvironmentVariable($var)
    if ([string]::IsNullOrWhiteSpace($value)) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host "Missing required environment variables:" -ForegroundColor Red
    foreach ($var in $missingVars) {
        Write-Host "  - $var" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Would you like to enter them now? (y/n): " -NoNewline -ForegroundColor Yellow
    $response = Read-Host
    
    if ($response -eq "y" -or $response -eq "Y") {
        foreach ($var in $missingVars) {
            Write-Host "Enter $var" -NoNewline -ForegroundColor Yellow
            Write-Host ": " -NoNewline
            
            if ($var -like "*KEY*" -or $var -like "*SECRET*") {
                # Secure input for sensitive values
                $secureValue = Read-Host -AsSecureString
                $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
                $value = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
                [Environment]::SetEnvironmentVariable($var, $value, "Process")
            } else {
                # Regular input for non-sensitive values
                $value = Read-Host
                [Environment]::SetEnvironmentVariable($var, $value, "Process")
            }
        }
        Write-Host ""
        Write-Host "Environment variables set for this session." -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "Exiting. Please set the required environment variables and try again." -ForegroundColor Red
        exit 1
    }
}

# Display current configuration
Write-Host "Current Configuration:" -ForegroundColor Cyan
Write-Host "  AWS Region: $env:AWS_REGION" -ForegroundColor Gray
Write-Host "  Bedrock Model: $env:BEDROCK_MODEL_ID" -ForegroundColor Gray
Write-Host "  AWS Credentials: Present" -ForegroundColor Gray
Write-Host "  Serper API Key: Present" -ForegroundColor Gray
Write-Host ""

# Confirm before running
Write-Host "This test will:" -ForegroundColor Yellow
Write-Host "  1. Make LIVE calls to Serper API (uses API quota)" -ForegroundColor Yellow
Write-Host "  2. Make REAL calls to AWS Bedrock (incurs costs)" -ForegroundColor Yellow
Write-Host "  3. Execute the complete production verification pipeline" -ForegroundColor Yellow
Write-Host ""
Write-Host "Do you want to proceed? (y/n): " -NoNewline -ForegroundColor Yellow
$confirm = Read-Host

if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host ""
    Write-Host "Test cancelled." -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "Running Full Production Path Test..." -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# Run the test
try {
    npx tsx test-full-production-path.ts
    $exitCode = $LASTEXITCODE
    
    Write-Host ""
    if ($exitCode -eq 0) {
        Write-Host "================================================================================" -ForegroundColor Green
        Write-Host "TEST PASSED" -ForegroundColor Green
        Write-Host "================================================================================" -ForegroundColor Green
    } else {
        Write-Host "================================================================================" -ForegroundColor Red
        Write-Host "TEST FAILED" -ForegroundColor Red
        Write-Host "================================================================================" -ForegroundColor Red
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
