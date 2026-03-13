# V4: Query Generation Diagnosis + Provider Failure Visibility Fix

## Executive Summary

V4 addresses the remaining two critical issues from V3:
1. **Query count still only 1** instead of 3-5 expected queries
2. **Provider failures invisible** - both Mediastack and GDELT fail with no diagnostic visibility

## Root Cause Analysis

### Issue 1: Single Query Generation

**Symptom**: `queries_count = 1` in live API response

**Root Cause**: Claim decomposition is failing and falling back to single subclaim
- `ClaimDecomposer.decompose()` calls `decomposeClaimToSubclaims()` from NOVA client
- When NOVA call fails (timeout, error, etc.), fallback returns `{ subclaims: [{ text: claim }] }`
- `QueryGenerator` then generates queries from this single subclaim
- Even though `queryBuilder.generateQueries()` can produce 3-6 queries, it's only called once with the original claim

**Evidence**:
- `queryBuilder.ts` correctly generates 3-6 queries when called
- `QueryGenerator` logs show `query_variants_generated` and `orchestrator_queries_finalized`
- But if decomposition fails, only 1 subclaim exists, so only 1 set of queries generated

### Issue 2: Provider Failure Invisibility

**Symptom**: `providersFailed = ["mediastack","gdelt"]` with no failure reasons

**Root Cause**: Provider failure details are logged but not returned in API response
- `groundingService.ground()` logs detailed failure info (timeout, unauthorized, zero_results, etc.)
- But these logs are only in CloudWatch, not in the returned `GroundingBundle`
- The orchestration pipeline doesn't collect or surface these failure details
- The `_debug_fix_v3` response field doesn't include provider failure reasons

## V4 Changes

### 1. Enhanced Claim Decomposition Logging

**File**: `backend/src/orchestration/claimDecomposer.ts`

**Changes**:
- Added `claim_preview` to decomposition error logs (first 100 chars)
- Added `error_stack` to decomposition error logs (first 200 chars)
- Added `fallback_strategy: 'single_subclaim'` to error logs
- Added `subclaim_texts` preview to success logs (first 50 chars of each)

**Purpose**: Diagnose why decomposition is failing and falling back to single subclaim

### 2. Provider Failure Details in Type System

**File**: `backend/src/types/orchestration.ts`

**Changes**:
- Added `providerFailureDetails` array to `RetrievalStatus` interface
- Each failure detail includes:
  - `provider`: Provider name (mediastack, gdelt, bing)
  - `query`: Query that failed
  - `reason`: Failure reason code (timeout, unauthorized, zero_results, etc.)
  - `stage`: Failure stage (raw_result, normalized_result, filter_result, attempt_failed)
  - `rawCount`, `normalizedCount`, `acceptedCount`: Counts at each stage
  - `errorMessage`: Error message if exception occurred

**Purpose**: Provide structured failure data for debugging

### 3. V4 Diagnostic Markers in Lambda Handler

**File**: `backend/src/lambda.ts`

**Changes**:
- Updated startup marker: `LAMBDA_HANDLER_STARTUP_V4` with `build_fix_version: 'v4'`
- Updated path marker: `LAMBDA_FIX_PATH_ACTIVE_V4` with `fix_version: 'v4'`
- Updated result marker: `ORCHESTRATION_RESULT_RECEIVED_V4` with:
  - `queries_preview`: First 3 queries (first 50 chars each)
  - `subclaim_count`: Number of subclaims from decomposition
  - `subclaim_preview`: First 50 chars of each subclaim
  - `has_failure_details`: Whether failure details are present
  - `failure_details_count`: Number of provider failures
- Updated debug field: `_debug_fix_v4` with:
  - `subclaim_count`: Number of subclaims
  - `subclaims_preview`: Preview of subclaim texts
  - `providers_failed`: List of failed providers
  - `provider_failure_details`: Array of failure details

**Purpose**: Prove V4 is deployed and surface failure diagnostics in API response

## Deployment Verification

### 1. Build Artifact Markers

After `sam build`, search for these exact strings in `backend/.aws-sam/build/GroundingFunction/lambda.js`:

```
LAMBDA_HANDLER_STARTUP_V4
build_fix_version: 'v4'
LAMBDA_FIX_PATH_ACTIVE_V4
ORCHESTRATION_RESULT_RECEIVED_V4
_debug_fix_v4
subclaim_count
subclaims_preview
provider_failure_details
```

### 2. CloudWatch Log Markers

After deployment, search CloudWatch logs for:

```
LAMBDA_HANDLER_STARTUP_V4
build_fix_version: "v4"
```

This log appears on EVERY Lambda cold start, proving V4 is active.

### 3. API Response Markers

Live API response should show:

```json
{
  "_debug_fix_v4": {
    "fix_version": "v4",
    "queries_count": 3,
    "subclaim_count": 1,
    "subclaims_preview": ["Russia Ukraine war latest news"],
    "providers_failed": ["mediastack", "gdelt"],
    "provider_failure_details": [
      {
        "provider": "mediastack",
        "query": "Russia Ukraine war latest news",
        "reason": "timeout",
        "stage": "attempt_failed",
        "rawCount": 0,
        "normalizedCount": 0,
        "acceptedCount": 0
      }
    ]
  }
}
```

## Expected Outcomes

### Scenario 1: Decomposition Succeeds

If NOVA decomposition works:
- `subclaim_count` should be 2-5
- `queries_count` should be 3-6 per subclaim
- Total queries should be 6-30

### Scenario 2: Decomposition Fails (Current State)

If NOVA decomposition fails:
- `subclaim_count` will be 1
- `subclaims_preview` will show original claim
- CloudWatch logs will show `decomposition_error` with error details
- `queries_count` will still be 3-6 (from queryBuilder on single subclaim)

### Scenario 3: Provider Failures Visible

Regardless of decomposition:
- `provider_failure_details` will show exact failure reasons
- Each provider attempt will have:
  - Failure reason (timeout, unauthorized, zero_results, etc.)
  - Stage where failure occurred
  - Counts at each stage (raw, normalized, accepted)
  - Error message if exception

## Next Steps After V4 Deployment

### If `subclaim_count = 1` and decomposition error logs appear:

**Root cause**: NOVA client is failing to decompose claims

**Possible reasons**:
1. NOVA API timeout (15 seconds)
2. NOVA API credentials issue
3. NOVA API rate limiting
4. NOVA response parsing failure

**Fix**: Investigate NOVA client logs and increase timeout or fix credentials

### If `provider_failure_details` shows specific failures:

**Mediastack timeout**:
- Increase Mediastack client timeout
- Check Mediastack API status
- Verify Mediastack API key is valid

**Mediastack zero_results**:
- Review Mediastack query parameters (keywords, language, date filters)
- Check if query is too constrained
- Verify Mediastack API is returning data for test queries

**GDELT timeout**:
- Increase GDELT client timeout
- Check GDELT API status
- Verify GDELT throttling is not too aggressive

**GDELT zero_results**:
- Review GDELT query parameters
- Check if query is too constrained
- Verify GDELT API is returning data for test queries

## Files Changed

1. `backend/src/orchestration/claimDecomposer.ts` - Enhanced decomposition logging
2. `backend/src/types/orchestration.ts` - Added providerFailureDetails to RetrievalStatus
3. `backend/src/lambda.ts` - V4 markers and debug field with failure details

## Deployment Commands

```powershell
# Build
cd backend
sam build

# Verify V4 markers in build artifact
Select-String -Path .aws-sam/build/GroundingFunction/lambda.js -Pattern "LAMBDA_HANDLER_STARTUP_V4"
Select-String -Path .aws-sam/build/GroundingFunction/lambda.js -Pattern "build_fix_version: 'v4'"
Select-String -Path .aws-sam/build/GroundingFunction/lambda.js -Pattern "_debug_fix_v4"

# Deploy
sam deploy --no-confirm-changeset

# Test
$response = Invoke-RestMethod -Uri "https://your-api-url/analyze" -Method POST -Body '{"text":"Russia Ukraine war latest news"}' -ContentType "application/json"
$response._debug_fix_v4
```

## Success Criteria

- [ ] Build artifact contains `LAMBDA_HANDLER_STARTUP_V4` marker
- [ ] CloudWatch logs show `LAMBDA_HANDLER_STARTUP_V4` on cold start
- [ ] API response contains `_debug_fix_v4` field
- [ ] `_debug_fix_v4.fix_version` equals "v4"
- [ ] `_debug_fix_v4.subclaim_count` is present
- [ ] `_debug_fix_v4.provider_failure_details` is present (if providers fail)
- [ ] Provider failure reasons are visible in response
