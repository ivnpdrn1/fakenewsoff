#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Run Bedrock integration test with AWS credentials

.DESCRIPTION
    This script helps set up the environment and run the end-to-end Bedrock integration test.
    It will prompt for AWS credentials if they are not already set in the environment.

.EXAMPLE
    .\run-bedrock-integration-test.ps1
    
.EXAMPLE
    .\run-bedrock-integration-test.ps1 -SkipPrompt
#>

param(
    [switch]$SkipPrompt
)

Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host "Bedrock Integration Test Setup" -ForegroundColor Cyan
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host ""

# Check if credentials are already set
$hasRegion = [bool]$env:AWS_REGION
$hasAccessKey = [bool]$env:AWS_ACCESS_KEY_ID
$hasSecretKey = [bool]$env:AWS_SECRET_ACCESS_KEY

Write-Host "Current environment status:" -ForegroundColor Yellow
Write-Host "  AWS_REGION: $(if($hasRegion){"[SET] $env:AWS_REGION"}else{"[NOT SET]"})"
Write-Host "  AWS_ACCESS_KEY_ID: $(if($hasAccessKey){"[SET]"}else{"[NOT SET]"})"
Write-Host "  AWS_SECRET_ACCESS_KEY: $(if($hasSecretKey){"[SET]"}else{"[NOT SET]"})"
Write-Host "  BEDROCK_MODEL_ID: $(if($env:BEDROCK_MODEL_ID){$env:BEDROCK_MODEL_ID}else{"[NOT SET - will use default]"})"
Write-Host ""

# If credentials are not set, prompt for them
if (-not $hasRegion -or -not $hasAccessKey -or -not $hasSecretKey) {
    if ($SkipPrompt) {
        Write-Host "❌ ERROR: AWS credentials not set and -SkipPrompt specified" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please set the following environment variables:" -ForegroundColor Yellow
        Write-Host '  $env:AWS_REGION="us-east-1"'
        Write-Host '  $env:AWS_ACCESS_KEY_ID="your_access_key"'
        Write-Host '  $env:AWS_SECRET_ACCESS_KEY="your_secret_key"'
        Write-Host ""
        exit 1
    }
    
    Write-Host "AWS credentials are not fully configured." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Cyan
    Write-Host "  1. Enter credentials now (temporary for this session)"
    Write-Host "  2. Set credentials in environment and re-run"
    Write-Host "  3. Cancel"
    Write-Host ""
    
    $choice = Read-Host "Choose option (1-3)"
    
    switch ($choice) {
        "1" {
            Write-Host ""
            Write-Host "Enter AWS credentials:" -ForegroundColor Cyan
            
            if (-not $hasRegion) {
                $region = Read-Host "AWS Region (e.g., us-east-1)"
                if ($region) {
                    $env:AWS_REGION = $region
                }
            }
            
            if (-not $hasAccessKey) {
                $accessKey = Read-Host "AWS Access Key ID"
                if ($accessKey) {
                    $env:AWS_ACCESS_KEY_ID = $accessKey
                }
            }
            
            if (-not $hasSecretKey) {
                $secretKey = Read-Host "AWS Secret Access Key" -AsSecureString
                $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretKey)
                $env:AWS_SECRET_ACCESS_KEY = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
                [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
            }
            
            Write-Host ""
            Write-Host "✅ Credentials set for this session" -ForegroundColor Green
            Write-Host ""
        }
        "2" {
            Write-Host ""
            Write-Host "Please set the following environment variables:" -ForegroundColor Yellow
            Write-Host '  $env:AWS_REGION="us-east-1"'
            Write-Host '  $env:AWS_ACCESS_KEY_ID="your_access_key"'
            Write-Host '  $env:AWS_SECRET_ACCESS_KEY="your_secret_key"'
            Write-Host ""
            Write-Host "Then re-run this script." -ForegroundColor Yellow
            Write-Host ""
            exit 0
        }
        default {
            Write-Host ""
            Write-Host "Cancelled." -ForegroundColor Yellow
            Write-Host ""
            exit 0
        }
    }
}

# Set default model ID if not set
if (-not $env:BEDROCK_MODEL_ID) {
    $env:BEDROCK_MODEL_ID = "amazon.nova-lite-v1:0"
    Write-Host "Using default BEDROCK_MODEL_ID: $env:BEDROCK_MODEL_ID" -ForegroundColor Yellow
    Write-Host ""
}

# Confirm before running
Write-Host "Ready to run Bedrock integration test with:" -ForegroundColor Cyan
Write-Host "  Region: $env:AWS_REGION"
Write-Host "  Model: $env:BEDROCK_MODEL_ID"
Write-Host ""

if (-not $SkipPrompt) {
    $confirm = Read-Host "Proceed? (y/n)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host ""
        Write-Host "Cancelled." -ForegroundColor Yellow
        Write-Host ""
        exit 0
    }
}

Write-Host ""
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host "Running Integration Test" -ForegroundColor Cyan
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host ""

# Run the test
try {
    npx ts-node test-bedrock-integration.ts
    $exitCode = $LASTEXITCODE
    
    Write-Host ""
    if ($exitCode -eq 0) {
        Write-Host "✅ Test completed successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Test failed with exit code: $exitCode" -ForegroundColor Red
    }
    Write-Host ""
    
    exit $exitCode
} catch {
    Write-Host ""
    Write-Host "❌ Error running test: $_" -ForegroundColor Red
    Write-Host ""
    exit 1
}
