# Deployment Diagnosis Summary

## Problem

The live API still shows the old failure signature after redeployment:
```json
{
  "text_grounding": {
    "queries": [],
    "providerUsed": ["orchestrated"],
    "sourcesCount": 0
  },
  "retrieval_status": {
    "providersAttempted": ["gdelt"],
    "providersSucceeded": [],
    "providersFailed": ["gdelt"]
  }
}
```

## Root Cause

**The deployed Lambda function is NOT running the new code.**

This happens when:
1. Build artifacts (`dist/`) are stale or missing diagnostic markers
2. SAM build (`.aws-sam/build/`) packaged old code
3. Lambda deployment didn't update the function code

## Quick Diagnosis

Run the automated verification script:

```powershell
.\scripts\verify-orchestration-fix.ps1 -ApiUrl "https://your-api-url.com/Prod"
```

This will check:
- ✅ Build artifacts have diagnostic markers
- ✅ SAM package has diagnostic markers  
- ✅ TypeScript compiles without errors
- ✅ API response has `_debug_fix_v2` field
- ✅ Queries are generated
- ✅ Mediastack is in providers

## Manual Verification Steps

### 1. Check Build Artifacts

```powershell
cd backend

# Search for diagnostic markers in compiled code
Select-String -Path dist/lambda.js -Pattern "LAMBDA_FIX_PATH_ACTIVE_V2"
Select-String -Path dist/orchestration/evidenceOrchestrator.js -Pattern "ORCHESTRATOR_FIX_PATH_ACTIVE_V2"
```

**If markers NOT found:**
```powershell
# Clean and rebuild
Remove-Item -Recurse -Force dist
npm run build

# Verify markers are now present
Select-String -Path dist/lambda.js -Pattern "LAMBDA_FIX_PATH_ACTIVE_V2"
```

### 2. Check SAM Build

```powershell
# Search for markers in SAM build
Select-String -Path .aws-sam/build/FakeNewsOffFunction/lambda.js -Pattern "LAMBDA_FIX_PATH_ACTIVE_V2"
```

**If markers NOT found:**
```powershell
# Clean and rebuild SAM
Remove-Item -Recurse -Force .aws-sam
sam build --use-container

# Verify markers are now present
Select-String -Path .aws-sam/build/FakeNewsOffFunction/lambda.js -Pattern "LAMBDA_FIX_PATH_ACTIVE_V2"
```

### 3. Deploy and Verify

```powershell
# Deploy to Lambda
sam deploy

# Test the API
$response = Invoke-RestMethod -Uri "https://your-api-url.com/Prod/analyze" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"text": "Russia Ukraine war latest news"}'

# Check for debug field
$response._debug_fix_v2
```

**Expected output if fix is active:**
```json
{
  "queries_from_orchestration": [
    "Russia Ukraine war latest news",
    "Russia Ukraine latest news",
    "Russia Ukraine updates",
    "Russia Ukraine Reuters BBC AP",
    "what is Russia Ukraine war"
  ],
  "providers_from_status": ["mediastack"],
  "fix_active": true
}
```

### 4. Check CloudWatch Logs

Search for these markers in CloudWatch Logs Insights:

```
filter @message like /LAMBDA_FIX_PATH_ACTIVE_V2/
| fields @timestamp, @message
| sort @timestamp desc
| limit 20
```

```
filter @message like /ORCHESTRATOR_FIX_PATH_ACTIVE_V2/
| fields @timestamp, @message
| sort @timestamp desc
| limit 20
```

```
filter @message like /ORCHESTRATION_RESULT_RECEIVED/
| fields @timestamp, @message
| sort @timestamp desc
| limit 20
```

**If NO markers found in CloudWatch:**
- Lambda is still running old code
- Deployment didn't update the function
- Go back to Step 1 and verify build artifacts

**If markers found in CloudWatch:**
- Fix is active and running
- Check API response for `_debug_fix_v2` field
- If response still wrong, there's a different issue

## Diagnostic Markers Explained

### LAMBDA_FIX_PATH_ACTIVE_V2
- **Location:** `backend/src/lambda.ts` line 246
- **Purpose:** Proves Lambda handler entered orchestration path with new code
- **When emitted:** When `/analyze` request uses orchestration path

### ORCHESTRATOR_FIX_PATH_ACTIVE_V2
- **Location:** `backend/src/orchestration/evidenceOrchestrator.ts` line 110
- **Purpose:** Proves orchestrator is calling `groundTextOnly()` instead of `ground()`
- **When emitted:** When orchestrator executes a retrieval pass

### ORCHESTRATION_RESULT_RECEIVED
- **Location:** `backend/src/lambda.ts` line 259
- **Purpose:** Shows queries_count, providers_succeeded, providers_attempted
- **When emitted:** After orchestration completes, before response packaging

### _debug_fix_v2
- **Location:** `backend/src/lambda.ts` line 301
- **Purpose:** Temporary debug field in API response
- **Contains:**
  - `queries_from_orchestration`: Array of generated queries
  - `providers_from_status`: Array of successful providers
  - `fix_active`: Boolean flag (always true)

## Success Criteria

When the fix is working:

✅ **Build artifacts:**
- `dist/lambda.js` contains `LAMBDA_FIX_PATH_ACTIVE_V2`
- `dist/orchestration/evidenceOrchestrator.js` contains `ORCHESTRATOR_FIX_PATH_ACTIVE_V2`

✅ **SAM build:**
- `.aws-sam/build/FakeNewsOffFunction/lambda.js` contains `LAMBDA_FIX_PATH_ACTIVE_V2`

✅ **CloudWatch logs:**
- `LAMBDA_FIX_PATH_ACTIVE_V2` appears in logs
- `ORCHESTRATOR_FIX_PATH_ACTIVE_V2` appears in logs
- `ORCHESTRATION_RESULT_RECEIVED` shows `queries_count > 0`

✅ **API response:**
- `_debug_fix_v2` field is present
- `_debug_fix_v2.queries_from_orchestration` has 3+ queries
- `_debug_fix_v2.providers_from_status` includes "mediastack"
- `text_grounding.queries` has 3+ queries
- `retrieval_status.providersAttempted` includes "mediastack"

## Common Issues

### Issue: Markers in dist/ but not in .aws-sam/build/

**Cause:** SAM didn't pick up new dist/ files

**Solution:**
```powershell
Remove-Item -Recurse -Force .aws-sam
sam build --use-container
```

### Issue: Markers in .aws-sam/build/ but not in CloudWatch

**Cause:** Lambda deployment didn't update function code

**Solution:**
```powershell
sam deploy --force-upload
```

Or wait 5-10 minutes for Lambda execution environment to cycle.

### Issue: Markers in CloudWatch but _debug_fix_v2 not in response

**Cause:** Response packaging issue or API Gateway caching

**Solution:**
- Check Lambda response in CloudWatch (not just API Gateway response)
- Clear API Gateway cache
- Check for response overwriting after orchestration

## Next Steps

1. **Run verification script:** `.\scripts\verify-orchestration-fix.ps1 -ApiUrl "your-url"`
2. **If script fails:** Follow the recommended actions in the output
3. **If script passes but API still wrong:** Check CloudWatch logs for markers
4. **If markers present:** Issue is in response packaging, not deployment

## Full Documentation

For detailed troubleshooting, see:
- `ORCHESTRATION_DEPLOYMENT_VERIFICATION.md` - Complete verification guide
- `ORCHESTRATION_MEDIASTACK_FIX.md` - Technical details of the fix
- `END_TO_END_RETRIEVAL_RELIABILITY_FIX.md` - Query generation improvements
