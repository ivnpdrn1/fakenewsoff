# V4 Deployment Summary

## What V4 Fixes

V4 addresses the two remaining issues from V3:

1. **Query Generation Diagnosis**: Enhanced logging to diagnose why only 1 query is generated instead of 3-5
2. **Provider Failure Visibility**: Surface provider failure reasons in API response for debugging

## Changes Made

### 1. Enhanced Claim Decomposition Logging
- **File**: `backend/src/orchestration/claimDecomposer.ts`
- **Purpose**: Diagnose why decomposition might be failing and falling back to single subclaim
- **Changes**:
  - Added claim preview to error logs
  - Added error stack to error logs
  - Added fallback strategy indicator
  - Added subclaim text previews to success logs

### 2. Provider Failure Details Type
- **File**: `backend/src/types/orchestration.ts`
- **Purpose**: Define structure for provider failure details
- **Changes**:
  - Added `providerFailureDetails` array to `RetrievalStatus` interface
  - Each failure includes: provider, query, reason, stage, counts, error message

### 3. V4 Diagnostic Markers
- **File**: `backend/src/lambda.ts`
- **Purpose**: Prove V4 is deployed and surface diagnostics in API response
- **Changes**:
  - Updated all markers from V3 to V4
  - Added subclaim count and preview to logs
  - Added provider failure details to `_debug_fix_v4` response field

## Deployment Steps

```powershell
# 1. Build
cd backend
sam build

# 2. Verify V4 markers in build
.\scripts\verify-v4.ps1

# 3. Deploy
sam deploy --no-confirm-changeset

# 4. Verify deployment
.\scripts\verify-v4.ps1 -ApiUrl "https://your-api-url"
```

## Verification Checklist

- [ ] Build artifact contains `LAMBDA_HANDLER_STARTUP_V4`
- [ ] Build artifact contains `_debug_fix_v4`
- [ ] Build artifact contains `subclaim_count`
- [ ] Build artifact contains `provider_failure_details`
- [ ] CloudWatch shows `LAMBDA_HANDLER_STARTUP_V4` on cold start
- [ ] API response has `_debug_fix_v4.fix_version = "v4"`
- [ ] API response has `_debug_fix_v4.subclaim_count`
- [ ] API response has `_debug_fix_v4.provider_failure_details` (if providers fail)

## Expected API Response Structure

```json
{
  "request_id": "...",
  "status_label": "...",
  "text_grounding": {
    "queries": ["query1", "query2", "query3"],
    "sourcesCount": 0,
    "providerUsed": ["orchestrated"],
    "providersAttempted": ["mediastack", "gdelt"],
    "providersSucceeded": [],
    "providersFailed": ["mediastack", "gdelt"]
  },
  "retrieval_status": {
    "mode": "degraded",
    "status": "failed",
    "providersAttempted": ["mediastack", "gdelt"],
    "providersSucceeded": [],
    "providersFailed": ["mediastack", "gdelt"],
    "warnings": ["All evidence providers failed..."]
  },
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
        "acceptedCount": 0,
        "errorMessage": "Request timeout after 5000ms"
      },
      {
        "provider": "gdelt",
        "query": "Russia Ukraine war latest news",
        "reason": "zero_results",
        "stage": "raw_result",
        "rawCount": 0,
        "normalizedCount": 0,
        "acceptedCount": 0
      }
    ]
  }
}
```

## Diagnosis Guide

### If `subclaim_count = 1`:

**Meaning**: Claim decomposition is failing and falling back to single subclaim

**Check CloudWatch for**:
- `decomposition_error` event
- `error_message` field
- `error_stack` field

**Possible causes**:
- NOVA API timeout (15 seconds)
- NOVA API credentials issue
- NOVA API rate limiting
- NOVA response parsing failure

**Next steps**:
- Increase NOVA timeout
- Verify NOVA credentials
- Check NOVA API status
- Review NOVA response format

### If `provider_failure_details` shows failures:

**Mediastack timeout**:
- Increase Mediastack client timeout (currently 5000ms)
- Check Mediastack API status
- Verify Mediastack API key

**Mediastack zero_results**:
- Review Mediastack query parameters
- Check if query is too constrained (keywords, language, date filters)
- Test Mediastack API directly with same query

**GDELT timeout**:
- Increase GDELT client timeout (currently 3500ms)
- Check GDELT API status
- Verify GDELT throttling settings

**GDELT zero_results**:
- Review GDELT query parameters
- Check if query is too constrained
- Test GDELT API directly with same query

## Files Changed

1. `backend/src/orchestration/claimDecomposer.ts`
2. `backend/src/types/orchestration.ts`
3. `backend/src/lambda.ts`
4. `V4_QUERY_GENERATION_PROVIDER_FAILURE_FIX.md` (documentation)
5. `scripts/verify-v4.ps1` (verification script)
6. `V4_DEPLOYMENT_SUMMARY.md` (this file)

## Next Steps After V4

Once V4 is deployed and we can see the actual failure reasons:

1. **If decomposition is failing**: Fix NOVA client issues
2. **If providers are timing out**: Increase timeouts or optimize queries
3. **If providers return zero results**: Review query parameters and constraints
4. **If providers are unauthorized**: Verify API keys and credentials

V4 gives us the visibility needed to diagnose and fix the root causes.
