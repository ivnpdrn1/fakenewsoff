# V3 Deployment Verification Guide

## V3 Unmistakable Markers

### 1. Startup Marker (Logged on EVERY Lambda cold start)
```json
{
  "event": "LAMBDA_HANDLER_STARTUP_V3",
  "build_fix_version": "v3",
  "handler_file": "lambda.ts",
  "orchestration_method": "groundSingleQuery",
  "fix_description": "Multi-query generation fix with groundSingleQuery"
}
```

### 2. Orchestration Path Marker
```json
{
  "event": "LAMBDA_FIX_PATH_ACTIVE_V3",
  "fix_version": "v3",
  "orchestration_method": "groundSingleQuery"
}
```

### 3. Orchestration Result Marker
```json
{
  "event": "ORCHESTRATION_RESULT_RECEIVED_V3",
  "queries_count": 5,
  "fix_version": "v3"
}
```

### 4. Orchestrator Execution Marker
```json
{
  "event": "ORCHESTRATOR_FIX_PATH_ACTIVE_V3",
  "method": "groundSingleQuery",
  "fix_version": "mediastack_integration_v3"
}
```

### 5. API Response Debug Field
```json
{
  "_debug_fix_v3": {
    "fix_version": "v3",
    "queries_from_orchestration": ["query1", "query2", "query3", "query4", "query5"],
    "queries_count": 5,
    "orchestration_method_used": "groundSingleQuery",
    "ground_method_used": "service.ground",
    "providers_from_status": ["mediastack"],
    "fix_active": true
  }
}
```

## Exact Strings to Search For

### In Source Files (backend/src/)
```
LAMBDA_HANDLER_STARTUP_V3
LAMBDA_FIX_PATH_ACTIVE_V3
ORCHESTRATION_RESULT_RECEIVED_V3
ORCHESTRATOR_FIX_PATH_ACTIVE_V3
_debug_fix_v3
groundSingleQuery
fix_version: 'v3'
```

### In Compiled Files (backend/dist/)
```
LAMBDA_HANDLER_STARTUP_V3
LAMBDA_FIX_PATH_ACTIVE_V3
ORCHESTRATION_RESULT_RECEIVED_V3
ORCHESTRATOR_FIX_PATH_ACTIVE_V3
_debug_fix_v3
groundSingleQuery
```

## Exact File Paths to Verify

### 1. TypeScript Source Files
```
backend/src/lambda.ts
backend/src/orchestration/evidenceOrchestrator.ts
backend/src/services/groundingService.ts
```

### 2. Compiled JavaScript Files
```
backend/dist/lambda.js
backend/dist/orchestration/evidenceOrchestrator.js
backend/dist/services/groundingService.js
```

### 3. SAM Build Output
```
backend/.aws-sam/build/AnalyzeFunction/lambda.js
backend/.aws-sam/build/AnalyzeFunction/orchestration/evidenceOrchestrator.js
backend/.aws-sam/build/AnalyzeFunction/services/groundingService.js
```

**IMPORTANT:** The function name in template.yaml is `AnalyzeFunction`, not `FakeNewsOffFunction`!

### 4. Handler Configuration
- **Template:** `backend/template.yaml`
- **Handler:** `dist/lambda.handler`
- **Function Name:** `AnalyzeFunction`

## Verification Commands

### Step 1: Verify Source Files
```powershell
cd backend

# Check lambda.ts has V3 markers
Select-String -Path src/lambda.ts -Pattern "LAMBDA_HANDLER_STARTUP_V3"
Select-String -Path src/lambda.ts -Pattern "LAMBDA_FIX_PATH_ACTIVE_V3"
Select-String -Path src/lambda.ts -Pattern "_debug_fix_v3"

# Check orchestrator uses groundSingleQuery
Select-String -Path src/orchestration/evidenceOrchestrator.ts -Pattern "groundSingleQuery"
Select-String -Path src/orchestration/evidenceOrchestrator.ts -Pattern "ORCHESTRATOR_FIX_PATH_ACTIVE_V3"

# Check groundSingleQuery function exists
Select-String -Path src/services/groundingService.ts -Pattern "export async function groundSingleQuery"
```

### Step 2: Verify Compiled Files
```powershell
# Check dist/lambda.js has V3 markers
Select-String -Path dist/lambda.js -Pattern "LAMBDA_HANDLER_STARTUP_V3"
Select-String -Path dist/lambda.js -Pattern "LAMBDA_FIX_PATH_ACTIVE_V3"
Select-String -Path dist/lambda.js -Pattern "_debug_fix_v3"

# Check dist/orchestration/evidenceOrchestrator.js uses groundSingleQuery
Select-String -Path dist/orchestration/evidenceOrchestrator.js -Pattern "groundSingleQuery"
Select-String -Path dist/orchestration/evidenceOrchestrator.js -Pattern "ORCHESTRATOR_FIX_PATH_ACTIVE_V3"

# Check dist/services/groundingService.js has groundSingleQuery
Select-String -Path dist/services/groundingService.js -Pattern "groundSingleQuery"
```

### Step 3: Build SAM Package
```powershell
# Clean previous build
Remove-Item -Recurse -Force .aws-sam -ErrorAction SilentlyContinue

# Build SAM package
sam build --use-container
```

### Step 4: Verify SAM Build Output
```powershell
# Check SAM build has V3 markers
Select-String -Path .aws-sam/build/AnalyzeFunction/lambda.js -Pattern "LAMBDA_HANDLER_STARTUP_V3"
Select-String -Path .aws-sam/build/AnalyzeFunction/lambda.js -Pattern "LAMBDA_FIX_PATH_ACTIVE_V3"
Select-String -Path .aws-sam/build/AnalyzeFunction/lambda.js -Pattern "_debug_fix_v3"

# Check SAM build has groundSingleQuery
Select-String -Path .aws-sam/build/AnalyzeFunction/orchestration/evidenceOrchestrator.js -Pattern "groundSingleQuery"
Select-String -Path .aws-sam/build/AnalyzeFunction/services/groundingService.js -Pattern "groundSingleQuery"
```

### Step 5: Deploy
```powershell
sam deploy
```

### Step 6: Verify Deployment in CloudWatch

**CRITICAL:** Search for the startup marker FIRST. This proves V3 is deployed.

```
filter @message like /LAMBDA_HANDLER_STARTUP_V3/
| fields @timestamp, @message
| sort @timestamp desc
| limit 20
```

**Expected output:**
```json
{
  "event": "LAMBDA_HANDLER_STARTUP_V3",
  "build_fix_version": "v3",
  "orchestration_method": "groundSingleQuery"
}
```

**If NOT found:** Lambda is still running V2 code. Deployment failed.

### Step 7: Test Live API
```powershell
$response = Invoke-RestMethod -Uri "https://your-api.execute-api.region.amazonaws.com/Prod/analyze" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"text": "Russia Ukraine war latest news"}'

# Check for V3 debug field
$response._debug_fix_v3

# Expected output:
# fix_version: v3
# queries_count: >= 3
# orchestration_method_used: groundSingleQuery
```

## Success Criteria

✅ **Source files contain V3 markers:**
- `LAMBDA_HANDLER_STARTUP_V3` in `src/lambda.ts`
- `LAMBDA_FIX_PATH_ACTIVE_V3` in `src/lambda.ts`
- `_debug_fix_v3` in `src/lambda.ts`
- `groundSingleQuery` in `src/orchestration/evidenceOrchestrator.ts`
- `groundSingleQuery` function in `src/services/groundingService.ts`

✅ **Compiled files contain V3 markers:**
- `LAMBDA_HANDLER_STARTUP_V3` in `dist/lambda.js`
- `groundSingleQuery` in `dist/orchestration/evidenceOrchestrator.js`
- `groundSingleQuery` in `dist/services/groundingService.js`

✅ **SAM build contains V3 markers:**
- `LAMBDA_HANDLER_STARTUP_V3` in `.aws-sam/build/AnalyzeFunction/lambda.js`
- `groundSingleQuery` in `.aws-sam/build/AnalyzeFunction/orchestration/evidenceOrchestrator.js`

✅ **CloudWatch shows V3 startup marker:**
- `LAMBDA_HANDLER_STARTUP_V3` appears in logs
- `build_fix_version: "v3"` in startup log

✅ **API response has V3 debug field:**
- `_debug_fix_v3` field present (not `_debug_fix_v2`)
- `fix_version: "v3"`
- `queries_count >= 3`
- `orchestration_method_used: "groundSingleQuery"`

## Failure Signatures

### V2 Still Deployed
**Symptoms:**
- CloudWatch shows `LAMBDA_FIX_PATH_ACTIVE_V2` (not V3)
- API response has `_debug_fix_v2` (not v3)
- No `LAMBDA_HANDLER_STARTUP_V3` in CloudWatch

**Cause:** Deployment didn't update Lambda code

**Fix:**
1. Verify `dist/lambda.js` has V3 markers
2. Verify `.aws-sam/build/AnalyzeFunction/lambda.js` has V3 markers
3. Run `sam deploy --force-upload`
4. Wait 5 minutes for Lambda to cycle execution environments

### Build Didn't Include V3 Code
**Symptoms:**
- `dist/lambda.js` doesn't have `LAMBDA_HANDLER_STARTUP_V3`
- `dist/orchestration/evidenceOrchestrator.js` doesn't have `groundSingleQuery`

**Cause:** TypeScript compilation failed or used stale files

**Fix:**
```powershell
Remove-Item -Recurse -Force dist
npm run build
Select-String -Path dist/lambda.js -Pattern "LAMBDA_HANDLER_STARTUP_V3"
```

### SAM Build Didn't Include V3 Code
**Symptoms:**
- `dist/lambda.js` has V3 markers
- `.aws-sam/build/AnalyzeFunction/lambda.js` doesn't have V3 markers

**Cause:** SAM packaged wrong files

**Fix:**
```powershell
Remove-Item -Recurse -Force .aws-sam
sam build --use-container
Select-String -Path .aws-sam/build/AnalyzeFunction/lambda.js -Pattern "LAMBDA_HANDLER_STARTUP_V3"
```

## Quick Verification Script

```powershell
# Run this to verify V3 is ready for deployment
cd backend

Write-Host "`n=== V3 Verification ===" -ForegroundColor Cyan

# 1. Source files
Write-Host "`n[1/5] Checking source files..." -ForegroundColor Yellow
$src1 = Select-String -Path src/lambda.ts -Pattern "LAMBDA_HANDLER_STARTUP_V3" -Quiet
$src2 = Select-String -Path src/lambda.ts -Pattern "_debug_fix_v3" -Quiet
$src3 = Select-String -Path src/orchestration/evidenceOrchestrator.ts -Pattern "groundSingleQuery" -Quiet
Write-Host "  LAMBDA_HANDLER_STARTUP_V3: $src1"
Write-Host "  _debug_fix_v3: $src2"
Write-Host "  groundSingleQuery: $src3"

# 2. Compiled files
Write-Host "`n[2/5] Checking compiled files..." -ForegroundColor Yellow
$dist1 = Select-String -Path dist/lambda.js -Pattern "LAMBDA_HANDLER_STARTUP_V3" -Quiet
$dist2 = Select-String -Path dist/lambda.js -Pattern "_debug_fix_v3" -Quiet
$dist3 = Select-String -Path dist/orchestration/evidenceOrchestrator.js -Pattern "groundSingleQuery" -Quiet
Write-Host "  LAMBDA_HANDLER_STARTUP_V3: $dist1"
Write-Host "  _debug_fix_v3: $dist2"
Write-Host "  groundSingleQuery: $dist3"

# 3. SAM build (if exists)
Write-Host "`n[3/5] Checking SAM build..." -ForegroundColor Yellow
if (Test-Path .aws-sam/build/AnalyzeFunction/lambda.js) {
    $sam1 = Select-String -Path .aws-sam/build/AnalyzeFunction/lambda.js -Pattern "LAMBDA_HANDLER_STARTUP_V3" -Quiet
    $sam2 = Select-String -Path .aws-sam/build/AnalyzeFunction/orchestration/evidenceOrchestrator.js -Pattern "groundSingleQuery" -Quiet
    Write-Host "  LAMBDA_HANDLER_STARTUP_V3: $sam1"
    Write-Host "  groundSingleQuery: $sam2"
} else {
    Write-Host "  SAM build not found (run 'sam build' first)" -ForegroundColor Gray
}

# 4. Summary
Write-Host "`n[4/5] Summary:" -ForegroundColor Yellow
$allGood = $src1 -and $src2 -and $src3 -and $dist1 -and $dist2 -and $dist3
if ($allGood) {
    Write-Host "  ✅ V3 markers present in source and compiled files" -ForegroundColor Green
    Write-Host "  ✅ Ready for SAM build and deployment" -ForegroundColor Green
} else {
    Write-Host "  ❌ V3 markers missing" -ForegroundColor Red
    Write-Host "  Run: npm run build" -ForegroundColor Yellow
}

# 5. Next steps
Write-Host "`n[5/5] Next steps:" -ForegroundColor Yellow
if ($allGood) {
    Write-Host "  1. sam build --use-container" -ForegroundColor White
    Write-Host "  2. sam deploy" -ForegroundColor White
    Write-Host "  3. Search CloudWatch for: LAMBDA_HANDLER_STARTUP_V3" -ForegroundColor White
} else {
    Write-Host "  1. npm run build" -ForegroundColor White
    Write-Host "  2. Re-run this script" -ForegroundColor White
}

Write-Host ""
```

## Post-Deployment Verification

After deployment, the FIRST thing to check:

```
filter @message like /LAMBDA_HANDLER_STARTUP_V3/
| fields @timestamp, @message
| sort @timestamp desc
| limit 1
```

**If found:** V3 is deployed ✅
**If NOT found:** V2 is still running ❌

Then check API response:
```powershell
$response = Invoke-RestMethod -Uri "https://your-api.com/Prod/analyze" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"text": "test"}'

$response._debug_fix_v3.fix_version
# Expected: "v3"
```
