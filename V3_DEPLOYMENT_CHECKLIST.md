# V3 Deployment Checklist - Quick Reference

## ✅ V3 Markers Confirmed in Compiled Code

All V3 markers are present in `backend/dist/`:
- ✅ `LAMBDA_HANDLER_STARTUP_V3` in `dist/lambda.js` (line 24)
- ✅ `_debug_fix_v3` in `dist/lambda.js` (line 281)
- ✅ `groundSingleQuery` in `dist/orchestration/evidenceOrchestrator.js` (line 84)
- ✅ `groundSingleQuery` function in `dist/services/groundingService.js` (line 1125)

## Exact Deployment Commands

```powershell
cd backend

# 1. Clean previous build
Remove-Item -Recurse -Force .aws-sam -ErrorAction SilentlyContinue

# 2. Build SAM package
sam build --use-container

# 3. Verify SAM build has V3 markers
Select-String -Path .aws-sam/build/AnalyzeFunction/lambda.js -Pattern "LAMBDA_HANDLER_STARTUP_V3"

# 4. Deploy
sam deploy
```

## Exact Verification Steps

### 1. CloudWatch - Search for Startup Marker (FIRST CHECK)
```
filter @message like /LAMBDA_HANDLER_STARTUP_V3/
| fields @timestamp, @message
| sort @timestamp desc
| limit 1
```

**Expected:**
```json
{
  "event": "LAMBDA_HANDLER_STARTUP_V3",
  "build_fix_version": "v3",
  "orchestration_method": "groundSingleQuery"
}
```

**If NOT found:** V3 is NOT deployed. Lambda is still running V2.

### 2. API Response - Check Debug Field
```powershell
$response = Invoke-RestMethod -Uri "https://your-api.execute-api.region.amazonaws.com/Prod/analyze" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"text": "Russia Ukraine war latest news"}'

# Check for V3 debug field (NOT v2!)
$response._debug_fix_v3
```

**Expected:**
```json
{
  "fix_version": "v3",
  "queries_from_orchestration": ["query1", "query2", "query3", ...],
  "queries_count": 5,
  "orchestration_method_used": "groundSingleQuery",
  "ground_method_used": "service.ground",
  "providers_from_status": ["mediastack"],
  "fix_active": true
}
```

**If `_debug_fix_v2` instead:** V2 is still deployed.

### 3. CloudWatch - Check Orchestration Path
```
filter @message like /LAMBDA_FIX_PATH_ACTIVE_V3/
| fields @timestamp, @message
| sort @timestamp desc
| limit 1
```

**Expected:**
```json
{
  "event": "LAMBDA_FIX_PATH_ACTIVE_V3",
  "fix_version": "v3",
  "orchestration_method": "groundSingleQuery"
}
```

### 4. CloudWatch - Check Query Count
```
filter @message like /ORCHESTRATION_RESULT_RECEIVED_V3/
| fields @timestamp, @message
| sort @timestamp desc
| limit 1
```

**Expected:**
```json
{
  "event": "ORCHESTRATION_RESULT_RECEIVED_V3",
  "queries_count": 5,
  "fix_version": "v3"
}
```

**If `queries_count: 1`:** V3 is NOT working correctly.

## Exact Strings to Search For

### In CloudWatch Logs:
1. `LAMBDA_HANDLER_STARTUP_V3` - Proves V3 is deployed
2. `LAMBDA_FIX_PATH_ACTIVE_V3` - Proves orchestration path uses V3
3. `ORCHESTRATION_RESULT_RECEIVED_V3` - Shows query count
4. `ORCHESTRATOR_FIX_PATH_ACTIVE_V3` - Proves orchestrator uses groundSingleQuery

### In API Response:
1. `_debug_fix_v3` - V3 debug field (NOT `_debug_fix_v2`)
2. `fix_version: "v3"` - Version marker
3. `queries_count: 5` - Should be >= 3
4. `orchestration_method_used: "groundSingleQuery"` - Method marker

### In Build Artifacts:
1. `backend/dist/lambda.js` - Contains `LAMBDA_HANDLER_STARTUP_V3`
2. `backend/.aws-sam/build/AnalyzeFunction/lambda.js` - Contains `LAMBDA_HANDLER_STARTUP_V3`
3. `backend/.aws-sam/build/AnalyzeFunction/orchestration/evidenceOrchestrator.js` - Contains `groundSingleQuery`

## Exact Handler Configuration

- **Template File:** `backend/template.yaml`
- **Function Name:** `AnalyzeFunction` (NOT `FakeNewsOffFunction`)
- **Handler:** `dist/lambda.handler`
- **Handler Function:** `export async function handler()`

## Success Criteria

✅ CloudWatch shows `LAMBDA_HANDLER_STARTUP_V3`
✅ API response has `_debug_fix_v3` field (NOT `_debug_fix_v2`)
✅ `_debug_fix_v3.fix_version` = "v3"
✅ `_debug_fix_v3.queries_count` >= 3
✅ `_debug_fix_v3.orchestration_method_used` = "groundSingleQuery"

## Failure Signatures

### V2 Still Deployed
- ❌ CloudWatch shows `LAMBDA_FIX_PATH_ACTIVE_V2` (not V3)
- ❌ API response has `_debug_fix_v2` (not v3)
- ❌ No `LAMBDA_HANDLER_STARTUP_V3` in CloudWatch

**Fix:** Verify SAM build has V3 markers, then redeploy with `sam deploy --force-upload`

### Only 1 Query Generated
- ❌ `_debug_fix_v3.queries_count` = 1
- ❌ CloudWatch shows `queries_count: 1` in `ORCHESTRATION_RESULT_RECEIVED_V3`

**Cause:** V3 is deployed but orchestrator is not using `groundSingleQuery`

**Fix:** Verify `.aws-sam/build/AnalyzeFunction/orchestration/evidenceOrchestrator.js` contains `groundSingleQuery`

## Quick Verification Script

Save as `verify-v3.ps1`:

```powershell
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
```

Run with: `.\verify-v3.ps1`
