#!/usr/bin/env pwsh
# Deploy FakeNewsOff Backend to AWS Lambda + API Gateway

$ErrorActionPreference = "Stop"

Write-Host "=== FakeNewsOff Backend Deployment ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Run backend tests
Write-Host "[1/4] Running backend tests..." -ForegroundColor Yellow
Push-Location backend
try {
    npm test -- --runInBand
    if ($LASTEXITCODE -ne 0) {
        throw "Backend tests failed"
    }
    Write-Host "✓ Tests passed" -ForegroundColor Green
} finally {
    Pop-Location
}
Write-Host ""

# Step 2: Build with SAM
Write-Host "[2/4] Building with SAM..." -ForegroundColor Yellow
Push-Location backend
try {
    sam build
    if ($LASTEXITCODE -ne 0) {
        throw "SAM build failed"
    }
    Write-Host "✓ Build complete" -ForegroundColor Green
} finally {
    Pop-Location
}
Write-Host ""

# Step 3: Deploy with SAM
Write-Host "[3/4] Deploying to AWS..." -ForegroundColor Yellow
Push-Location backend
try {
    # Check if samconfig.toml exists
    if (Test-Path "samconfig.toml") {
        Write-Host "Using existing SAM configuration..." -ForegroundColor Gray
        sam deploy
    } else {
        Write-Host "First-time deployment - using guided mode..." -ForegroundColor Gray
        sam deploy --guided --stack-name fakenewsoff-backend --region us-east-1 --capabilities CAPABILITY_IAM --resolve-s3
    }
    
    if ($LASTEXITCODE -ne 0) {
        throw "SAM deploy failed"
    }
    Write-Host "✓ Deployment complete" -ForegroundColor Green
} finally {
    Pop-Location
}
Write-Host ""

# Step 4: Get outputs
Write-Host "[4/4] Retrieving API URL..." -ForegroundColor Yellow
Push-Location backend
try {
    $outputs = sam list stack-outputs --stack-name fakenewsoff-backend --region us-east-1 --output json | ConvertFrom-Json
    
    $apiUrl = ($outputs | Where-Object { $_.OutputKey -eq "ApiUrl" }).OutputValue
    
    if (-not $apiUrl) {
        throw "Could not retrieve API URL from stack outputs"
    }
    
    # Save to file
    $apiUrl | Out-File -FilePath "../api-url.txt" -Encoding utf8 -NoNewline
    
    Write-Host "✓ API URL retrieved" -ForegroundColor Green
    Write-Host ""
    Write-Host "=== DEPLOYMENT COMPLETE ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "API_BASE_URL=$apiUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Stack: fakenewsoff-backend" -ForegroundColor Gray
    Write-Host "Region: us-east-1" -ForegroundColor Gray
    Write-Host ""
    
} finally {
    Pop-Location
}
