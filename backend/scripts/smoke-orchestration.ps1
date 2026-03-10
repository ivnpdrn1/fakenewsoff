#!/usr/bin/env pwsh
# Smoke Test Script for Iterative Evidence Orchestration
# Tests all critical paths after feature flag enablement

$ErrorActionPreference = "Stop"

Write-Host "=== Orchestration Pipeline Smoke Tests ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$API_URL = "https://fnd9pknygc.execute-api.us-east-1.amazonaws.com"
$TESTS_PASSED = 0
$TESTS_FAILED = 0

# Helper function to test endpoint
function Test-Endpoint {
    param(
        [string]$TestName,
        [string]$Payload,
        [scriptblock]$Validator
    )
    
    Write-Host "[$TestName]" -ForegroundColor Yellow -NoNewline
    
    try {
        $response = Invoke-RestMethod -Uri "$API_URL/analyze" `
            -Method POST `
            -ContentType "application/json" `
            -Body $Payload `
            -ErrorAction Stop
        
        $result = & $Validator $response
        
        if ($result) {
            Write-Host " ✓ PASS" -ForegroundColor Green
            $script:TESTS_PASSED++
            return $true
        } else {
            Write-Host " ✗ FAIL" -ForegroundColor Red
            $script:TESTS_FAILED++
            return $false
        }
    } catch {
        Write-Host " ✗ ERROR: $($_.Exception.Message)" -ForegroundColor Red
        $script:TESTS_FAILED++
        return $false
    }
}

Write-Host "Testing API: $API_URL" -ForegroundColor Gray
Write-Host ""

# Test 1: Health Check
Write-Host "[Test 1: Health Check]" -ForegroundColor Yellow -NoNewline
try {
    $health = Invoke-RestMethod -Uri "$API_URL/health" -Method GET
    if ($health.status -eq "healthy") {
        Write-Host " ✓ PASS" -ForegroundColor Green
        $TESTS_PASSED++
    } else {
        Write-Host " ✗ FAIL" -ForegroundColor Red
        $TESTS_FAILED++
    }
} catch {
    Write-Host " ✗ ERROR" -ForegroundColor Red
    $TESTS_FAILED++
}

# Test 2: Text-Only Claim (Orchestration Active)
Test-Endpoint -TestName "Test 2: Text-Only Claim (Orchestration)" `
    -Payload '{"text": "The Eiffel Tower is in Paris"}' `
    -Validator {
        param($response)
        return ($response.orchestration.enabled -eq $true) -and
               ($response.status_label -ne $null) -and
               ($response.confidence_score -ne $null)
    }

# Test 3: Simple Factual Claim
Test-Endpoint -TestName "Test 3: Simple Factual Claim" `
    -Payload '{"text": "Water boils at 100 degrees Celsius at sea level"}' `
    -Validator {
        param($response)
        return ($response.orchestration.enabled -eq $true) -and
               ($response.text_grounding.sources.Count -gt 0)
    }

# Test 4: Claim with URL (Legacy Pipeline)
Test-Endpoint -TestName "Test 4: Claim with URL (Legacy)" `
    -Payload '{"text": "This is fake", "url": "https://example.com"}' `
    -Validator {
        param($response)
        return ($response.orchestration -eq $null) -and
               ($response.status_label -ne $null)
    }

# Test 5: Response Schema Validation
Test-Endpoint -TestName "Test 5: Response Schema Validation" `
    -Payload '{"text": "The sky is blue"}' `
    -Validator {
        param($response)
        $hasLegacyFields = ($response.status_label -ne $null) -and
                          ($response.confidence_score -ne $null) -and
                          ($response.rationale -ne $null)
        
        $hasOrchestration = ($response.orchestration.enabled -eq $true) -and
                           ($response.orchestration.passes_executed -ge 1)
        
        return $hasLegacyFields -and $hasOrchestration
    }

# Test 6: Source Quality Check
Test-Endpoint -TestName "Test 6: Source Quality Check" `
    -Payload '{"text": "Climate change is affecting global temperatures"}' `
    -Validator {
        param($response)
        if ($response.text_grounding.sources.Count -eq 0) {
            return $false
        }
        
        # Check that sources have required fields
        $firstSource = $response.text_grounding.sources[0]
        return ($firstSource.url -ne $null) -and
               ($firstSource.title -ne $null) -and
               ($firstSource.domain -ne $null)
    }

# Summary
Write-Host ""
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $TESTS_PASSED" -ForegroundColor Green
Write-Host "Failed: $TESTS_FAILED" -ForegroundColor Red
Write-Host ""

if ($TESTS_FAILED -eq 0) {
    Write-Host "✓ All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "✗ Some tests failed" -ForegroundColor Red
    exit 1
}
