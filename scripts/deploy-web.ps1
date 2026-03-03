#!/usr/bin/env pwsh
# Deploy FakeNewsOff Web UI to S3 + CloudFront

$ErrorActionPreference = "Stop"

Write-Host "=== FakeNewsOff Web UI Deployment ===" -ForegroundColor Cyan
Write-Host ""

$STACK_NAME = "fakenewsoff-web"
$REGION = "us-east-1"

# Step 1: Build web app
Write-Host "[1/4] Building web app..." -ForegroundColor Yellow
Push-Location frontend/web
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }
    Write-Host "Success: Build complete" -ForegroundColor Green
} finally {
    Pop-Location
}
Write-Host ""

# Step 2: Deploy CloudFormation stack
Write-Host "[2/3] Deploying CloudFormation stack..." -ForegroundColor Yellow
aws cloudformation deploy `
    --template-file web-stack.yaml `
    --stack-name $STACK_NAME `
    --region $REGION `
    --no-fail-on-empty-changeset

if ($LASTEXITCODE -ne 0) {
    throw "CloudFormation deployment failed"
}
Write-Host "Success: Stack deployed" -ForegroundColor Green
Write-Host ""

# Step 3: Get outputs and upload files
Write-Host "[3/3] Uploading files to S3..." -ForegroundColor Yellow

$bucketName = aws cloudformation describe-stacks `
    --stack-name $STACK_NAME `
    --region $REGION `
    --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" `
    --output text

$webUrl = aws cloudformation describe-stacks `
    --stack-name $STACK_NAME `
    --region $REGION `
    --query "Stacks[0].Outputs[?OutputKey=='WebUrl'].OutputValue" `
    --output text

$distributionId = aws cloudformation describe-stacks `
    --stack-name $STACK_NAME `
    --region $REGION `
    --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" `
    --output text

# Upload files
aws s3 sync frontend/web/dist s3://$bucketName/ --delete --region $REGION

if ($LASTEXITCODE -ne 0) {
    throw "S3 upload failed"
}

# Invalidate CloudFront cache
Write-Host "Invalidating CloudFront cache..." -ForegroundColor Gray
aws cloudfront create-invalidation `
    --distribution-id $distributionId `
    --paths "/*" `
    --region $REGION | Out-Null

Write-Host "Success: Files uploaded" -ForegroundColor Green
Write-Host ""

# Save URL
$webUrl | Out-File -FilePath "web-url.txt" -Encoding utf8 -NoNewline

Write-Host "=== WEB DEPLOYMENT COMPLETE ===" -ForegroundColor Green
Write-Host ""
Write-Host "WEB_URL=$webUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "Bucket: $bucketName" -ForegroundColor Gray
Write-Host "Distribution: $distributionId" -ForegroundColor Gray
Write-Host ""
