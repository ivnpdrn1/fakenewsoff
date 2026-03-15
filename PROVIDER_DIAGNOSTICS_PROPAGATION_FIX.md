# Provider Diagnostics and Propagation Fix

**Date**: 2026-03-14  
**Deploy Time**: 01:52 UTC  
**Status**: DIAGNOSTIC LOGGING DEPLOYED

## Changes Deployed

### 1. Evidence Orchestrator Logging
**File**: `backend/src/orchestration/evidenceOrchestrator.ts`

Added comprehensive logging to track provider failure capture:
- `PROVIDER_FAILURE_DETAILS_CAPTURED` - Logs when failures are collected
- `PROVIDER_FAILURE_DETAILS_MISSING` - Warns when no failures captured

**Location**: After orchestration completes, before returning pipeline state

### 2. Grounding Service Logging
**File**: `backend/src/services/groundingService.ts`

Added logging at provider failure return point:
- `PROVIDER_FINAL_DECISION` - Logs final decision when all providers fail
- Includes: attempted providers, failure details presence, last failure info

**Location**: In `tryProviders()` method, before returning failure bundle

### 3. Existing Diagnostic Logs (from previous deploy)
**File**: `backend/src/orchestration/iterativeOrchestrationPipeline.ts`
- `LIVE_ORCHESTRATION_STATE` - Pipeline state after orchestration
- `LIVE_EVIDENCE_BUCKETING` - Evidence bucketing counts

**File**: `backend/src/lambda.ts`
- `LIVE_SOURCES_BEFORE_PACKAGING` - Evidence before response packaging
- `LIVE_SOURCES_AFTER_PACKAGING` - Evidence after response packaging

## Root Cause Analysis

### Provider Failure Details Flow

```
groundingService.tryProviders()
  ↓ Collects lastProviderFailure (single object)
  ↓ Returns GroundingBundle with providerFailureDetails
  ↓
evidenceOrchestrator.executePass()
  ↓ Collects providerFailureDetails from each query into array
  ↓ Stores in (this as any)._lastProviderFailureDetails
  ↓
evidenceOrchestrator.orchestrate()
  ↓ Adds _lastProviderFailureDetails to state.providerFailureDetails
  ↓ Returns PipelineState with providerFailureDetails array
  ↓
iterativeOrchestrationPipeline.analyzeWithIterativeOrchestration()
  ↓ Receives orchestrationResult.retrievalStatus.providerFailureDetails
  ↓ Transforms to match RetrievalStatus type
  ↓ Returns OrchestrationResult
  ↓
lambda.ts handler
  ↓ Packages orchestrationResult.retrievalStatus into final response
  ↓ Returns to client
```

### Current Issue

The `providerFailureDetails` array is being properly collected in the orchestrator (lines 240-280 in evidenceOrchestrator.ts), but it's showing as empty in the final response. This suggests one of:

1. **No failures are being captured** - The grounding service isn't setting `lastProviderFailure`
2. **Failures are being captured but not propagated** - The array isn't being passed through correctly
3. **Failures are being cleared somewhere** - Something is resetting the array

## Expected Behavior After Fix

When all providers fail, the response should include:

```json
{
  "retrieval_status": {
    "providersFailed": ["mediastack", "gdelt", "serper"],
    "providerFailureDetails": [
      {
        "provider": "mediastack",
        "query": "Breaking news",
        "reason": "client_not_initialized",
        "stage": 1,
        "latency": 0,
        "raw_count": 0,
        "normalized_count": 0,
        "accepted_count": 0,
        "error_message": "Mediastack client not initialized (API key not configured)"
      },
      {
        "provider": "gdelt",
        "query": "Breaking news",
        "reason": "zero_raw_results",
        "stage": 2,
        "latency": 1234,
        "raw_count": 0,
        "normalized_count": 0,
        "accepted_count": 0,
        "error_message": "Provider returned zero results"
      },
      {
        "provider": "serper",
        "query": "Breaking news",
        "reason": "zero_raw_results",
        "stage": 3,
        "latency": 2345,
        "raw_count": 0,
        "normalized_count": 0,
        "accepted_count": 0,
        "error_message": "Provider returned zero results"
      }
    ]
  }
}
```

## Diagnostic Logs to Check

After the next request, check CloudWatch for:

1. `PROVIDER_FINAL_DECISION` - Shows if grounding service is capturing failures
2. `PROVIDER_FAILURE_DETAILS_CAPTURED` - Shows if orchestrator is receiving failures
3. `PROVIDER_FAILURE_DETAILS_MISSING` - Warns if orchestrator receives no failures
4. `LIVE_ORCHESTRATION_STATE` - Shows pipeline state including failure count

## Next Steps

1. **Check CloudWatch logs** for the diagnostic events above
2. **Identify where failures are lost**:
   - If `PROVIDER_FINAL_DECISION` shows failures but `PROVIDER_FAILURE_DETAILS_CAPTURED` doesn't → Issue in orchestrator collection
   - If `PROVIDER_FAILURE_DETAILS_CAPTURED` shows failures but final response is empty → Issue in pipeline propagation
   - If `PROVIDER_FINAL_DECISION` shows no failures → Issue in grounding service failure tracking

3. **Fix the identified issue**:
   - If orchestrator collection: Fix the array collection logic in `evidenceOrchestrator.ts`
   - If pipeline propagation: Fix the transformation in `iterativeOrchestrationPipeline.ts`
   - If grounding service: Fix the `lastProviderFailure` tracking in `groundingService.ts`

## Files Modified

1. `backend/src/orchestration/evidenceOrchestrator.ts`
   - Added `PROVIDER_FAILURE_DETAILS_CAPTURED` logging
   - Added `PROVIDER_FAILURE_DETAILS_MISSING` warning

2. `backend/src/services/groundingService.ts`
   - Added `PROVIDER_FINAL_DECISION` logging

## Test Results

- Build: ✅ Success
- Tests: ✅ 467 tests passed
- Deploy: ✅ Deployed at 01:52 UTC

## Current Production Status

```
sourcesCount: 0
providersAttempted: ["mediastack", "gdelt", "serper"]
providersFailed: ["mediastack", "gdelt", "serper"]
providerFailureDetails: [] (STILL EMPTY - awaiting diagnostic logs)
```

The diagnostic logs will reveal exactly where the provider failures are being lost in the pipeline.
