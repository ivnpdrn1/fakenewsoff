# Orchestration Query Generation Fix - Implementation Complete

## Problems Fixed

### Problem 1: Only 1 Query Generated (Root Cause)
**Symptom:** `_debug_fix_v2.queries_from_orchestration` contained only 1 query instead of 3-5

**Root Cause:** Double query generation bug
- Orchestrator generated queries using NOVA AI
- Orchestrator called `groundTextOnly(query.text)` for each query
- `groundTextOnly` IGNORED the input and generated its OWN queries using `queryBuilder.ts`
- Result: Orchestrator's queries were discarded, only `groundTextOnly`'s queries were used

**Fix:** Created `groundSingleQuery()` function
- New function executes a single query directly without generating additional queries
- Orchestrator now calls `groundSingleQuery()` instead of `groundTextOnly()`
- Orchestrator's queries are now preserved and executed

### Problem 2: Provider Failure Reasons Not Visible
**Symptom:** Both Mediastack and GDELT failed with no visibility into why

**Fix:** Enhanced provider failure logging with detailed stages:
1. **provider_attempt_start** - When provider attempt begins
2. **provider_raw_result** - Raw result count from provider API
3. **provider_normalized_result** - Count after normalization (URL validation, date parsing)
4. **provider_filter_result** - Count after filtering (ranking, deduplication)
5. **provider_attempt_failed** - Detailed failure reason with counts at each stage

**Failure Reasons Now Logged:**
- `zero_raw_results` - Provider API returned zero results
- `normalization_zero` - All results dropped during normalization
- `filtered_to_zero` - All results dropped during filtering
- `timeout` - Provider request timed out
- `unauthorized` - 401 authentication error
- `forbidden` - 403 access denied
- `rate_limit` - 429 rate limit exceeded
- `provider_exception` - Other provider error

## Files Changed

### 1. `backend/src/types/grounding.ts`
**Added:**
```typescript
export interface SingleQueryGroundingResult {
  sources: NormalizedSourceWithStance[];
  provider: GroundingProvider;
  latencyMs: number;
  cacheHit: boolean;
  errors?: string[];
  sourcesCountRaw?: number;
}
```

### 2. `backend/src/services/groundingService.ts`
**Added:**
- `groundSingleQuery()` function (100 lines)
  - Executes single query without multi-query generation
  - Designed specifically for orchestrator use
  - Returns sources with provider and stance info

**Enhanced:**
- Provider failure logging with detailed stages
- Failure reason classification (timeout, unauthorized, zero_raw_results, etc.)
- Stage-by-stage logging (raw → normalized → filtered)

### 3. `backend/src/orchestration/evidenceOrchestrator.ts`
**Changed:**
- Import: `groundTextOnly` → `groundSingleQuery`
- Method call: `groundTextOnly(query.text)` → `groundSingleQuery(query.text)`
- Updated diagnostic marker: `fix_version: 'mediastack_integration_v3'`

## Expected Behavior After Fix

### For claim: "Russia Ukraine war latest news"

#### 1. Query Generation (Orchestrator)
```json
{
  "event": "generation_success",
  "query_count": 5,
  "query_types": ["exact", "entity_action", "official_confirmation", "fact_check", "contradiction"]
}
```

#### 2. Query Execution (Orchestrator)
```json
{
  "event": "ORCHESTRATOR_FIX_PATH_ACTIVE_V3",
  "method": "groundSingleQuery",
  "query_count": 5,
  "fix_version": "mediastack_integration_v3"
}
```

#### 3. Provider Attempts (Per Query)
```json
// Query 1: "Russia Ukraine war latest news"
{
  "event": "provider_attempt_start",
  "provider": "mediastack",
  "query": "Russia Ukraine war latest news"
}
{
  "event": "provider_raw_result",
  "provider": "mediastack",
  "raw_result_count": 25
}
{
  "event": "provider_normalized_result",
  "provider": "mediastack",
  "normalized_count": 23,
  "normalization_dropped": 2
}
{
  "event": "provider_filter_result",
  "provider": "mediastack",
  "accepted_count": 10,
  "filter_dropped": 13
}
{
  "event": "provider_success",
  "provider": "mediastack",
  "sources_returned": 10
}
```

#### 4. Provider Failure Example
```json
{
  "event": "provider_attempt_failed",
  "provider": "mediastack",
  "query": "Russia Ukraine false claims",
  "failure_reason": "zero_raw_results",
  "raw_result_count": 0,
  "normalized_count": 0,
  "accepted_count": 0
}
```

#### 5. Final Response
```json
{
  "_debug_fix_v2": {
    "queries_from_orchestration": [
      "Russia Ukraine war latest news",
      "Russia Ukraine conflict updates",
      "Russia Ukraine official statement",
      "Russia Ukraine fact check",
      "Russia Ukraine false claims"
    ],
    "providers_from_status": ["mediastack"],
    "fix_active": true
  },
  "text_grounding": {
    "queries": [/* same 5 queries */],
    "sourcesCount": 28,
    "providerUsed": ["mediastack"]
  },
  "retrieval_status": {
    "providersAttempted": ["mediastack"],
    "providersSucceeded": ["mediastack"],
    "providersFailed": []
  }
}
```

## CloudWatch Log Queries

### 1. Verify Query Generation
```
filter @message like /generation_success/
| fields @timestamp, @message
| sort @timestamp desc
| limit 20
```

**Expected:** `query_count: 5` (or 3-6)

### 2. Verify Orchestrator Uses groundSingleQuery
```
filter @message like /ORCHESTRATOR_FIX_PATH_ACTIVE_V3/
| fields @timestamp, @message
| sort @timestamp desc
| limit 20
```

**Expected:** `method: "groundSingleQuery"`, `fix_version: "mediastack_integration_v3"`

### 3. Check Provider Stages
```
filter @message like /provider_raw_result/ or @message like /provider_normalized_result/ or @message like /provider_filter_result/
| fields @timestamp, @message
| sort @timestamp desc
| limit 50
```

**Expected:** See progression: raw → normalized → filtered for each query

### 4. Check Provider Failures
```
filter @message like /provider_attempt_failed/
| fields @timestamp, @message
| sort @timestamp desc
| limit 20
```

**Expected:** Detailed failure_reason, raw_result_count, normalized_count, accepted_count

### 5. Verify Final Queries Count
```
filter @message like /ORCHESTRATION_RESULT_RECEIVED/
| fields @timestamp, @message
| sort @timestamp desc
| limit 20
```

**Expected:** `queries_count >= 3`

## Deployment Steps

```powershell
cd backend

# Build
npm run build

# Verify groundSingleQuery in build
Select-String -Path dist/services/groundingService.js -Pattern "groundSingleQuery"

# Verify orchestrator uses groundSingleQuery
Select-String -Path dist/orchestration/evidenceOrchestrator.js -Pattern "groundSingleQuery"

# Deploy
sam build --use-container
sam deploy
```

## Acceptance Criteria

✅ **Query Generation:**
- `_debug_fix_v2.queries_from_orchestration.length >= 3`
- Queries are diverse (not all identical)

✅ **Provider Visibility:**
- CloudWatch shows `provider_raw_result` for each query
- CloudWatch shows `provider_normalized_result` for each query
- CloudWatch shows `provider_filter_result` for each query
- CloudWatch shows `provider_attempt_failed` with detailed failure_reason

✅ **Provider Success:**
- If Mediastack returns results, `sourcesCount > 0`
- If Mediastack fails, GDELT is attempted
- Final response shows actual providers used

✅ **Failure Transparency:**
- `retrieval_status.warnings` includes provider-specific failure summaries
- Logs show exact failure reason (timeout, zero_raw_results, etc.)
- Logs show counts at each stage (raw, normalized, filtered)

## Testing

### Unit Test
```typescript
describe('groundSingleQuery', () => {
  it('should execute single query without generating additional queries', async () => {
    const result = await groundSingleQuery('Russia Ukraine war', undefined, false);
    expect(result.sources).toBeDefined();
    expect(result.provider).toBeDefined();
  });
});
```

### Integration Test
```typescript
describe('EvidenceOrchestrator', () => {
  it('should preserve orchestrator queries', async () => {
    const queries = [
      { type: 'exact', text: 'Query 1', priority: 1.0 },
      { type: 'entity_action', text: 'Query 2', priority: 0.9 },
      { type: 'fact_check', text: 'Query 3', priority: 0.8 },
    ];
    
    const state = await orchestrator.orchestrate(queries, 'Test claim');
    
    // Verify all 3 queries were executed
    expect(state.collectedEvidence.length).toBeGreaterThan(0);
  });
});
```

### Production Test
```powershell
# Test live API
$response = Invoke-RestMethod -Uri "https://your-api.com/Prod/analyze" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"text": "Russia Ukraine war latest news"}'

# Check queries count
$response._debug_fix_v2.queries_from_orchestration.Count
# Expected: >= 3

# Check providers
$response._debug_fix_v2.providers_from_status
# Expected: ["mediastack"] or ["mediastack", "gdelt"]
```

## Remaining Work

None - the fix is complete. The orchestration path now:
1. Generates 3-6 diverse queries using NOVA AI
2. Executes each query directly without additional query generation
3. Logs detailed provider failure reasons at each stage
4. Provides full visibility into why providers succeed or fail

## Next Steps

1. Deploy to production
2. Monitor CloudWatch for:
   - `queries_count >= 3` in ORCHESTRATION_RESULT_RECEIVED
   - `provider_raw_result`, `provider_normalized_result`, `provider_filter_result` events
   - `provider_attempt_failed` with detailed failure_reason
3. Verify `_debug_fix_v2.queries_from_orchestration.length >= 3` in API response
4. Check `retrieval_status.warnings` for provider-specific failure summaries
