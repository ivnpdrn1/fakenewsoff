# Direct Lambda invocation test for stance classifier debugging

$payload = @{
    body = @{
        text = "Russia invaded Ukraine in February 2022"
    } | ConvertTo-Json
    httpMethod = "POST"
    path = "/analyze"
    headers = @{
        "Content-Type" = "application/json"
    }
} | ConvertTo-Json -Depth 10

Write-Host "Invoking Lambda directly..." -ForegroundColor Cyan
Write-Host "Function: fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe" -ForegroundColor Gray
Write-Host "Region: us-east-1" -ForegroundColor Gray
Write-Host ""

# Invoke Lambda and save response
$response = aws lambda invoke `
    --function-name fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe `
    --region us-east-1 `
    --payload $payload `
    --cli-binary-format raw-in-base64-out `
    lambda-response.json 2>&1

Write-Host "Lambda invocation response:" -ForegroundColor Yellow
$response | Out-String

# Read and parse the response
if (Test-Path lambda-response.json) {
    $lambdaOutput = Get-Content lambda-response.json -Raw | ConvertFrom-Json
    
    if ($lambdaOutput.body) {
        $body = $lambdaOutput.body | ConvertFrom-Json
        
        Write-Host "`n=== LAMBDA DIRECT RESPONSE ===" -ForegroundColor Cyan
        Write-Host "Status Code: $($lambdaOutput.statusCode)" -ForegroundColor White
        Write-Host "Classification: $($body.status_label)" -ForegroundColor Yellow
        Write-Host "Confidence: $($body.confidence_score)%" -ForegroundColor Yellow
        
        if ($body.text_grounding -and $body.text_grounding.sources) {
            $supporting = $body.text_grounding.sources | Where-Object { $_.stance -eq 'supports' }
            $contextual = $body.text_grounding.sources | Where-Object { $_.stance -eq 'mentions' }
            
            Write-Host "`nSupporting: $($supporting.Count)" -ForegroundColor Green
            Write-Host "Contextual: $($contextual.Count)" -ForegroundColor Yellow
            
            Write-Host "`n=== FIRST 3 SOURCES ===" -ForegroundColor Cyan
            $body.text_grounding.sources | Select-Object -First 3 | ForEach-Object {
                Write-Host "`nDomain: $($_.domain)" -ForegroundColor White
                Write-Host "Title: $($_.title)" -ForegroundColor Gray
                Write-Host "Snippet: $($_.snippet.Substring(0, [Math]::Min(100, $_.snippet.Length)))..." -ForegroundColor Gray
                Write-Host "Stance: $($_.stance)" -ForegroundColor $(if ($_.stance -eq 'supports') { 'Green' } else { 'Yellow' })
                Write-Host "Credibility Tier: $($_.credibilityTier)" -ForegroundColor Gray
            }
        }
        
        # Save full response for inspection
        $body | ConvertTo-Json -Depth 10 | Out-File -FilePath lambda-response-parsed.json
        Write-Host "`nFull response saved to lambda-response-parsed.json" -ForegroundColor Gray
    }
}
