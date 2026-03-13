# Orchestration Mediastack Fix - Deployment Verification Guide

## Current Situation

You've redeployed the backend, but the live API still shows the old failure signature:
- `text_grounding.queries = []`
- `text_grounding.providerUsed = ["orchestrated"]`
- `retrieval_status.providersAttempted = ["gdelt"]`
- `retrieval_status.providersSucceeded = []`

This indicates the deployed Lambda is NOT running the new code.

## Root Cause Analysis

The most likely causes (in order of probability):

### 1. Build Artifact Not Updated (MOST LIKELY)
- `npm run build` may have failed silently
- TypeScript compilation errors were ignored
- `dist/` folder contains old code
- SAM packaged the old `dist/` folder

### 2. SAM Build Cache Issue
- `.aws-sam/build/` contains stale code
- SAM didn't detect file changes
- Need to force clean build

### 3. Lambda Deployment Issue
- CloudFormation stack update failed
- Lambda function code wasn't updated
- Need to verify deployment logs

## Step-by-Step Verification

### Step 1: Verify Local Build

```powershell
cd backend

# Clean all build artifacts
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .aws-sam -ErrorAction SilentlyContinue

# Rebuild from scratch
npm run build
```

**Expected output:**
```
> tsc

# Should complete with NO errors
```

**Verify the build:**
```powershell
# Check that dist/ was created
Test-Path dist/lambda.js
Test-Path dist/orchestration/evidenceOrchestrator.js
Test-Path dist/orchestration/iterativeOrchestrationPipeline.js

# Search for diagnostic markers in compiled code
Select-String -Path dist/lambda.js -Pattern "LAMBDA_FIX_PATH_ACTIVE_V2"
Select-String -Path dist/orchestration/evidenceOrchestrator.js -Pattern "ORCHESTRATOR_FIX_PATH_ACTIVE_V2"
```

**If markers NOT found in dist/:**
- TypeScript compilation failed or was skipped
- Check `tsconfig.json` settings
- Run `npx tsc --noEmit` to check for errors

### Step 2: Clean SAM Build

```powershell
# Still in backend/

# Clean SAM build cache
Remove-Item -Recurse -Force .aws-sam -ErrorAction SilentlyContinue

# Rebuild SAM package
sam build --use-container
```

**Expected output:**
```
Building codeuri: .
Running NodejsNpmBuilder:NpmPack
Running NodejsNpmBuilder:CopyNpmrc
Running NodejsNpmBuilder:CopySource
Running NodejsNpmBuilder:NpmInstall
Running NodejsNpmBuilder:CleanUpNpmrc

Build Succeeded
```

**Verify SAM build:**
```powershell
# Check SAM build artifact
Test-Path .aws-sam/build/FakeNewsOffFunction/lambda.js
Test-Path .aws-sam/build/FakeNewsOffFunction/orchestration/evidenceOrchestrator.js

# Search for diagnostic markers in SAM build
Select-String -Path .aws-sam/build/FakeNewsOffFunction/lambda.js -Pattern "LAMBDA_FIX_PATH_ACTIVE_V2"
Select-String -Path .aws-sam/build/FakeNewsOffFunction/orchestration/evidenceOrchestrator.js -Pattern "ORCHESTRATOR_FIX_PATH_ACTIVE_V2"
```

**If markers NOT found in .aws-sam/build/:**
- SAM packaged the wrong files
- Check `template.yaml` CodeUri setting
- Verify SAM is using the correct handler path

### Step 3: Deploy with Verification

```powershell
# Deploy to Lambda
sam deploy --no-confirm-changeset

# Wait for deployment to complete
# Look for: "Successfully created/updated stack"
```

**Verify deployment logs:**
- Check for any errors or warnings
- Confirm stack update completed
- Note the Lambda function ARN

### Step 4: Verify Lambda Code in AWS

**Option A: Check Lambda function directly (AWS Console)**
1. Go to AWS Lambda console
2. Find your function (e.g., `fakenewsoff-backend-FakeNewsOffFunction-...`)
3. Go to "Code" tab
4. Open `lambda.js` in the editor
5. Search for `LAMBDA_FIX_PATH_ACTIVE_V2`
6. Search for `_debug_fix_v2`

**Option B: Check via AWS CLI**
```powershell
# Get function code location
aws lambda get-function --function-name <your-function-name>

# Download the deployment package
aws lambda get-function --function-name <your-function-name> --query 'Code.Location' --output text
# Copy the URL and download it
# Unzip and search for markers
```

### Step 5: Test Live API with Diagnostic Markers

```powershell
# Test the live API
$response = Invoke-RestMethod -Uri "https://your-api.execute-api.region.amazonaws.com/Prod/analyze" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"text": "Russia Ukraine war latest news"}'

# Check for debug field
$response._debug_fix_v2

# Expected if fix is active:
# queries_from_orchestration: ["Russia Ukraine war latest news", ...]
# providers_from_status: ["mediastack"]
# fix_active: true
```

### Step 6: Check CloudWatch Logs

**Search for these EXACT markers in CloudWatch Logs:**

1. **LAMBDA_FIX_PATH_ACTIVE_V2** - Proves Lambda handler has new code
   ```
   filter @message like /LAMBDA_FIX_PATH_ACTIVE_V2/
   | fields @timestamp, @message
   | sort @timestamp desc
   | limit 20
   ```

2. **ORCHESTRATOR_FIX_PATH_ACTIVE_V2** - Proves orchestrator calls groundTextOnly()
   ```
   filter @message like /ORCHESTRATOR_FIX_PATH_ACTIVE_V2/
   | fields @timestamp, @message
   | sort @timestamp desc
   | limit 20
   ```

3. **ORCHESTRATION_RESULT_RECEIVED** - Shows queries_count should be > 0
   ```
   filter @message like /ORCHESTRATION_RESULT_RECEIVED/
   | fields @timestamp, @message
   | sort @timestamp desc
   | limit 20
   ```

4. **query_generation_complete** - From groundTextOnly, shows actual queries
   ```
   filter @message like /query_generation_complete/
   | fields @timestamp, @message
   | sort @timestamp desc
   | limit 20
   ```

**If NO markers found:**
- Deployment didn't include new code
- Lambda is still running old version
- Go back to Step 1 and verify build artifacts

**If markers found but response still wrong:**
- Fix is active but there's a different issue
- Check for response overwriting after orchestration
- Investigate provider configuration

## Diagnostic Decision Tree

```
Did deployment succeed?
├─ NO → Check deployment logs, retry deployment
└─ YES → Are diagnostic markers in CloudWatch?
    ├─ NO → Lambda code not updated
    │   └─ Verify build artifacts (Step 1-2)
    └─ YES → Is _debug_fix_v2 in API response?
        ├─ NO → Response packaging issue
        │   └─ Check lambda.ts response construction
        └─ YES → Check _debug_fix_v2 content
            ├─ queries_from_orchestration empty → Orchestration not generating queries
            ├─ providers_from_status wrong → Provider tracking issue
            └─ fix_active: false → Fix not being applied

```

## Expected Success Signature

When the fix is working correctly:

### CloudWatch Logs:
```json
{
  "event": "LAMBDA_FIX_PATH_ACTIVE_V2",
  "handler": "analyze_orchestration",
  "fix_version": "mediastack_integration_v2"
}

{
  "event": "ORCHESTRATOR_FIX_PATH_ACTIVE_V2",
  "service": "evidenceOrchestrator",
  "method": "groundTextOnly",
  "query_count": 5
}

{
  "event": "ORCHESTRATION_RESULT_RECEIVED",
  "queries_count": 5,
  "providers_succeeded": ["mediastack"],
  "providers_attempted": ["mediastack"]
}

{
  "event": "query_generation_complete",
  "queries_generated": 5,
  "queries": ["Russia Ukraine war latest news", "Russia Ukraine latest news", ...]
}
```

### API Response:
```json
{
  "text_grounding": {
    "queries": [
      "Russia Ukraine war latest news",
      "Russia Ukraine latest news",
      "Russia Ukraine updates",
      "Russia Ukraine Reuters BBC AP",
      "what is Russia Ukraine war"
    ],
    "providerUsed": ["mediastack"],
    "sourcesCount": 3
  },
  "retrieval_status": {
    "providersAttempted": ["mediastack"],
    "providersSucceeded": ["mediastack"],
    "providersFailed": []
  },
  "_debug_fix_v2": {
    "queries_from_orchestration": ["Russia Ukraine war latest news", ...],
    "providers_from_status": ["mediastack"],
    "fix_active": true
  }
}
```

## Common Issues and Solutions

### Issue 1: TypeScript Compilation Errors
**Symptom:** `npm run build` fails or produces no output
**Solution:**
```powershell
npx tsc --noEmit  # Check for errors
npm run build     # Fix errors and rebuild
```

### Issue 2: SAM Using Wrong Files
**Symptom:** Markers in `dist/` but not in `.aws-sam/build/`
**Solution:**
- Check `template.yaml` CodeUri points to correct location
- Ensure `dist/` is not in `.gitignore` or `.samignore`
- Use `sam build --use-container` for clean build

### Issue 3: Lambda Not Updating
**Symptom:** Deployment succeeds but code doesn't change
**Solution:**
```powershell
# Force update Lambda code
sam deploy --force-upload

# Or update function code directly
aws lambda update-function-code \
  --function-name <your-function-name> \
  --zip-file fileb://.aws-sam/build/FakeNewsOffFunction.zip
```

### Issue 4: Cached Lambda Execution Environment
**Symptom:** Markers appear intermittently
**Solution:**
- Wait 5-10 minutes for Lambda to cycle execution environments
- Or force new environment by updating environment variable:
```powershell
aws lambda update-function-configuration \
  --function-name <your-function-name> \
  --environment Variables={FORCE_REFRESH=true}
```

## Next Steps

1. **Start with Step 1** - Verify local build has diagnostic markers
2. **If Step 1 fails** - Fix TypeScript compilation issues
3. **If Step 1 passes** - Continue to Step 2 (SAM build)
4. **After deployment** - Check CloudWatch for markers (Step 6)
5. **If no markers** - Lambda code not updated, repeat Steps 1-3
6. **If markers present** - Check API response for `_debug_fix_v2`

## Contact Points for Debugging

If you're still seeing issues after following this guide, provide:
1. Output of `npm run build`
2. Output of `sam build`
3. Output of `sam deploy`
4. CloudWatch log search results for `LAMBDA_FIX_PATH_ACTIVE_V2`
5. API response showing `_debug_fix_v2` field (or absence of it)
