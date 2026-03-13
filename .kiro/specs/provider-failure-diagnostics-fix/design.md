# Design Document: Provider Failure Detail Propagation Fix

## Technical Context

### Current Architecture

The evidence retrieval system has multiple layers:

1. **Grounding Layer** (`groundingService.ts`):
   - `tryProviders()` method captures provider failures in `lastProviderFailure` object
   - Returns `GroundingBundle` with optional `providerFailureDetails` field
   - Already includes: provider, query, reason, latency, counts, http_status, error_message

2. **Orchestration Layer** (`evidenceOrchestrator.ts`):
   - Uses staged execution for multi-query orchestration
   - Tracks failures in local `providerFailureDetails` array
   - Stores in `(this as any)._lastProviderFailureDetails` (line 504)
   - Adds to `state.providerFailureDetails` in orchestrate() method (line 81)

3. **Pipeline Layer** (`iterativeOrchestrationPipeline.ts`):
   - Receives `pipelineState` from orchestrator with `providerFailureDetails`
   - **BUG**: Constructs `retrievalStatus` object but omits `providerFailureDetails` (line 365)
   - Returns `OrchestrationResult` with incomplete `retrievalStatus`

4. **Lambda Layer** (`lambda.ts`):
   - Reads `orchestrationResult.retrievalStatus.providerFailureDetails`
   - Populates `_debug_fix_v4.provider_failure_details` (line 335)
   - **BUG**: Receives empty array because pipeline layer didn't propagate it

### Root Cause

File: `backend/src/orchestration/iterativeOrchestrationPipeline.ts` (lines 360-370)

```typescript
retrievalStatus: {
  mode: retrievalMode,
  status: retrievalStatus,
  source: retrievalSource,
  cacheHit: false,
  providersAttempted,
  providersSucceeded,
  providersFailed,
  warnings,
  // MISSING: providerFailureDetails
},
```

The `pipelineState.providerFailureDetails` exists but is not included in the returned `retrievalStatus` object.

### Provider Cooldown Status

The grounding service already implements provider cooldown:
- `setProviderCooldown()` method exists (line 1565)
- Called for rate_limit, quota_exceeded, throttled errors
- Cooldown durations: 5 min for rate_limit, 2 min for quota/throttle
- Checked before each provider attempt

**Issue**: The cooldown is working, but we need to ensure it's consistently applied across all failure scenarios.

## Implementation Plan

### 1. Fix Pipeline Layer Propagation

**File**: `backend/src/orchestration/iterativeOrchestrationPipeline.ts`

**Change**: Add `providerFailureDetails` to `retrievalStatus` object

**Location**: Around line 365, in the return statement

**Before**:
```typescript
retrievalStatus: {
  mode: retrievalMode,
  status: retrievalStatus,
  source: retrievalSource,
  cacheHit: false,
  providersAttempted,
  providersSucceeded,
  providersFailed,
  warnings,
},
```

**After**:
```typescript
retrievalStatus: {
  mode: retrievalMode,
  status: retrievalStatus,
  source: retrievalSource,
  cacheHit: false,
  providersAttempted,
  providersSucceeded,
  providersFailed,
  warnings,
  providerFailureDetails: pipelineState.providerFailureDetails,
},
```

### 2. Add Propagation Proof Log

**File**: `backend/src/orchestration/iterativeOrchestrationPipeline.ts`

**Change**: Add log entry after constructing retrievalStatus

**Location**: After line 370, before the return statement

**Code**:
```typescript
// Log provider failure details propagation
if (pipelineState.providerFailureDetails && pipelineState.providerFailureDetails.length > 0) {
  const providerNames = [...new Set(pipelineState.providerFailureDetails.map(d => d.provider))];
  logs.push({
    stage: 'pipeline',
    timestamp: new Date().toISOString(),
    message: 'PROVIDER_FAILURE_DETAILS_PROPAGATED',
    data: {
      entry_count: pipelineState.providerFailureDetails.length,
      providers: providerNames,
    },
  });
  
  logger.info('Provider failure details propagated', {
    event: 'PROVIDER_FAILURE_DETAILS_PROPAGATED',
    requestId,
    entry_count: pipelineState.providerFailureDetails.length,
    providers: providerNames,
  });
}
```

### 3. Enhance Orchestrator Failure Tracking

**File**: `backend/src/orchestration/evidenceOrchestrator.ts`

**Change**: Ensure all provider failures are captured with complete details

**Current Status**: Already captures failures in staged execution (lines 220, 325, 442)

**Enhancement**: Add stage information to match the type definition

**Locations**: Lines 220, 325, 442

**Update failure detail objects to include**:
- `stage: 'attempt_failed'` (already using numeric stage, keep it)
- Ensure all fields match the type definition

### 4. Verify Lambda Response Construction

**File**: `backend/src/lambda.ts`

**Current Status**: Already reads from `orchestrationResult.retrievalStatus.providerFailureDetails` (line 335)

**Verification**: Confirm the field is correctly populated in `_debug_fix_v4.provider_failure_details`

**No changes needed** - lambda layer is already correct.

### 5. Add Short-Term Claim Cache (Optional Enhancement)

**File**: `backend/src/services/groundingCache.ts`

**Purpose**: Reduce repeated provider attempts for the same claim within a short time window

**Implementation**:
```typescript
// Add claim-level cache with 5-minute TTL
const claimCache = new Map<string, { timestamp: number; result: TextGroundingBundle }>();

export function getCachedClaimResult(claim: string): TextGroundingBundle | undefined {
  const normalized = normalizeClaimForCache(claim);
  const cached = claimCache.get(normalized);
  
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return cached.result;
  }
  
  // Clean up expired entries
  if (cached) {
    claimCache.delete(normalized);
  }
  
  return undefined;
}

export function setCachedClaimResult(claim: string, result: TextGroundingBundle): void {
  const normalized = normalizeClaimForCache(claim);
  claimCache.set(normalized, { timestamp: Date.now(), result });
}

function normalizeClaimForCache(claim: string): string {
  return claim.toLowerCase().trim().replace(/\s+/g, ' ');
}
```

**Integration**: Check cache in `groundTextOnly()` before executing queries

## Testing Strategy

### Unit Tests

1. **Pipeline Layer Test**: Verify `providerFailureDetails` propagation
   - Mock `pipelineState` with failure details
   - Assert `retrievalStatus.providerFailureDetails` is populated

2. **Orchestrator Test**: Verify failure capture
   - Mock provider failures
   - Assert `state.providerFailureDetails` contains correct entries

### Integration Tests

1. **End-to-End Propagation Test**:
   - Trigger provider failure (use invalid API key or mock)
   - Verify failure details appear in lambda response
   - Check both `retrieval_status.providerFailureDetails` and `_debug_fix_v4.provider_failure_details`

2. **Cooldown Activation Test**:
   - Trigger rate_limit error
   - Verify cooldown is activated
   - Verify subsequent requests skip the provider

### Production Validation

1. **Live Claim Test**: "Russia Ukraine war latest news"
   - Verify `provider_failure_details` is non-empty if providers fail
   - Verify failure reasons are clear (quota_exceeded, rate_limit, etc.)
   - Verify `sourcesCount > 0` if any provider succeeds

2. **Log Verification**:
   - Search for "PROVIDER_FAILURE_DETAILS_PROPAGATED" in logs
   - Verify entry_count and provider names are logged

## Deployment Steps

1. **Build and Test**:
   ```bash
   cd backend
   npm test
   npm run build
   ```

2. **Deploy to AWS**:
   ```bash
   cd backend
   sam build
   sam deploy --no-confirm-changeset
   ```

3. **Verify Deployment**:
   ```bash
   # Test with live claim
   curl -X POST https://[API_URL]/analyze \
     -H "Content-Type: application/json" \
     -d '{"claim": "Russia Ukraine war latest news"}'
   ```

4. **Check Logs**:
   ```bash
   # Search for propagation log
   aws logs tail /aws/lambda/ClaimVerifierFunction --follow | grep "PROVIDER_FAILURE_DETAILS_PROPAGATED"
   ```

## Files Changed

1. `backend/src/orchestration/iterativeOrchestrationPipeline.ts`
   - Add `providerFailureDetails` to `retrievalStatus` object
   - Add propagation proof log

2. `backend/src/services/groundingCache.ts` (optional)
   - Add claim-level cache functions

3. `backend/src/services/groundingService.ts` (optional)
   - Integrate claim cache in `groundTextOnly()`

## Sample Response JSON

### With Provider Failures

```json
{
  "retrieval_status": {
    "mode": "degraded",
    "status": "partial",
    "source": "live",
    "cacheHit": false,
    "providersAttempted": ["mediastack", "gdelt"],
    "providersSucceeded": [],
    "providersFailed": ["mediastack", "gdelt"],
    "warnings": ["Limited evidence retrieved"],
    "providerFailureDetails": [
      {
        "provider": "mediastack",
        "query": "Russia Ukraine war latest developments",
        "reason": "quota_exceeded",
        "stage": "attempt_failed",
        "rawCount": 0,
        "normalizedCount": 0,
        "acceptedCount": 0,
        "errorMessage": "API quota exceeded for current billing period"
      },
      {
        "provider": "gdelt",
        "query": "Ukraine conflict recent news",
        "reason": "rate_limit",
        "stage": "attempt_failed",
        "rawCount": 0,
        "normalizedCount": 0,
        "acceptedCount": 0,
        "errorMessage": "Rate limit exceeded, please try again later"
      }
    ]
  },
  "_debug_fix_v4": {
    "orchestration_method_used": "multiQuery",
    "ground_method_used": "groundTextOnly",
    "grounding_path": "multi_query_provider_pipeline",
    "queries_count": 6,
    "provider_failure_details": [
      {
        "provider": "mediastack",
        "query": "Russia Ukraine war latest developments",
        "reason": "quota_exceeded",
        "stage": "attempt_failed",
        "rawCount": 0,
        "normalizedCount": 0,
        "acceptedCount": 0,
        "errorMessage": "API quota exceeded for current billing period"
      },
      {
        "provider": "gdelt",
        "query": "Ukraine conflict recent news",
        "reason": "rate_limit",
        "stage": "attempt_failed",
        "rawCount": 0,
        "normalizedCount": 0,
        "acceptedCount": 0,
        "errorMessage": "Rate limit exceeded, please try again later"
      }
    ]
  }
}
```

### With Successful Retrieval

```json
{
  "retrieval_status": {
    "mode": "production",
    "status": "complete",
    "source": "live",
    "cacheHit": false,
    "providersAttempted": ["mediastack"],
    "providersSucceeded": ["mediastack"],
    "providersFailed": [],
    "warnings": []
  },
  "_debug_fix_v4": {
    "orchestration_method_used": "multiQuery",
    "ground_method_used": "groundTextOnly",
    "grounding_path": "multi_query_provider_pipeline",
    "queries_count": 6,
    "provider_failure_details": []
  },
  "sourcesCount": 5
}
```

## Correctness Properties

### Property 1: Failure Detail Preservation

**Bug Condition**:
```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type OrchestrationRequest
  OUTPUT: boolean
  
  // Bug occurs when providers fail during orchestration
  RETURN (X.providerFailures.length > 0)
END FUNCTION
```

**Property**: Fix Checking
```pascal
FOR ALL X WHERE isBugCondition(X) DO
  result ← orchestrate'(X)
  ASSERT result.retrievalStatus.providerFailureDetails.length > 0
  ASSERT result.retrievalStatus.providerFailureDetails.length = X.providerFailures.length
  FOR EACH detail IN result.retrievalStatus.providerFailureDetails DO
    ASSERT detail.provider IS NOT NULL
    ASSERT detail.query IS NOT NULL
    ASSERT detail.reason IN ['rate_limit', 'quota_exceeded', 'timeout', 'zero_raw_results', 'normalization_zero', 'filtered_to_zero', 'attempt_failed']
    ASSERT detail.error_message IS NOT NULL
  END FOR
END FOR
```

**Property**: Preservation Checking
```pascal
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT orchestrate(X).sourcesCount = orchestrate'(X).sourcesCount
  ASSERT orchestrate(X).orchestration_method = orchestrate'(X).orchestration_method
  ASSERT orchestrate(X).queries_count = orchestrate'(X).queries_count
END FOR
```

### Property 2: Cooldown Activation

**Bug Condition**:
```pascal
FUNCTION isCooldownBugCondition(X)
  INPUT: X of type ProviderResponse
  OUTPUT: boolean
  
  // Bug occurs when provider returns rate limit or quota exceeded
  RETURN (X.reason IN ['rate_limit', 'quota_exceeded'] OR X.http_status = 429)
END FUNCTION
```

**Property**: Fix Checking
```pascal
FOR ALL X WHERE isCooldownBugCondition(X) DO
  orchestrate'(X)
  cooldown ← getProviderCooldown(X.provider)
  ASSERT cooldown IS NOT NULL
  ASSERT cooldown.until > currentTime()
  ASSERT cooldown.reason IN ['rate_limit', 'quota_exceeded', 'throttled']
END FOR
```

## Risk Assessment

### Low Risk Changes
- Adding `providerFailureDetails` to `retrievalStatus` (read-only propagation)
- Adding propagation proof log (observability only)

### Medium Risk Changes
- Claim-level cache (optional, can be added later)

### Mitigation
- All changes are additive (no removal of existing functionality)
- Existing tests continue to pass
- New fields are optional in type definitions
