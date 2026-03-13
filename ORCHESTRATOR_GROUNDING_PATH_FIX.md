# Orchestrator Multi-Query Grounding Path Fix (v6)

## Problem

The EvidenceOrchestrator was calling `groundingService.ground()` for each individual query in a loop, which bypassed the multi-query provider pipeline. The `groundTextOnly()` method is designed to handle multiple queries efficiently with proper provider fallback, but it wasn't being used by the orchestrator.

## Root Cause

```typescript
// OLD CODE (WRONG PATH - v5):
const groundingService = getGroundingService();
const results = await Promise.all(
  queries.map(async (query) => {
    const bundle = await groundingService.ground(query.text, ...);
    // Each query calls ground() separately - inefficient
  })
);
```

The orchestrator was calling `ground()` for each query individually, which:
- Made multiple separate provider calls instead of batching
- Didn't leverage the multi-query optimization in `groundTextOnly()`
- Bypassed query generation and aggregation logic

## Solution (v6)

Updated EvidenceOrchestrator to call `groundTextOnly()` once with the claim text, which:
- Generates optimized queries internally
- Executes all queries through the multi-query provider pipeline
- Aggregates results efficiently
- Provides proper Mediastack → GDELT fallback
- Returns sources with stance and credibility already classified

```typescript
// NEW CODE (CORRECT PATH - v6):
import { groundTextOnly } from '../services/groundingService';

// Call groundTextOnly once with the claim
const textBundle = await groundTextOnly(claim, undefined, false);

// Convert TextGroundingBundle sources to evidence candidates
for (const source of textBundle.sources) {
  candidates.push({
    ...this.toEvidenceCandidate(source, matchedQuery, passNumber),
    provider: source.provider,
    stance: source.stance,
    credibilityTier: source.credibilityTier,
  });
}
```

## Files Changed

### 1. `backend/src/orchestration/evidenceOrchestrator.ts`

**Changes:**
- Removed import of `getGroundingService`
- Added import of `groundTextOnly`
- Updated `executePass()` method to call `groundTextOnly()` once with claim text
- Added diagnostic markers: `ORCHESTRATOR_MULTIQUERY_GROUNDING` and `ORCHESTRATOR_MULTIQUERY_COMPLETE`
- Updated fix version to `production_retrieval_efficiency_v2`
- Sources now include proper `provider`, `stance`, and `credibilityTier` from `TextGroundingBundle`

**Key Code:**
```typescript
// Call groundTextOnly with the claim - it will generate queries and execute multi-query pipeline
const textBundle = await groundTextOnly(claim, undefined, false);

// Convert TextGroundingBundle sources to evidence candidates
for (const source of textBundle.sources) {
  // Match source to original query based on query text similarity
  const matchedQuery = queries.find(q => 
    textBundle.queries.some(tq => tq.toLowerCase().includes(q.text.toLowerCase()))
  ) || queries[0];

  candidates.push({
    ...this.toEvidenceCandidate(source, matchedQuery, passNumber),
    provider: source.provider,
    stance: source.stance,
    credibilityTier: source.credibilityTier,
  });
}
```

### 2. `backend/src/lambda.ts`

**Changes:**
- Updated `build_fix_version` from `v5` to `v6`
- Updated `orchestration_method_used` to `multiQuery`
- Updated `ground_method_used` to `groundTextOnly`
- Updated fix description

## Expected Behavior After Fix

### Diagnostic Markers

The orchestrator now logs:
```json
{
  "event": "ORCHESTRATOR_MULTIQUERY_GROUNDING",
  "service": "evidenceOrchestrator",
  "pass_number": 1,
  "query_count": 6,
  "orchestration_method_used": "multiQuery",
  "ground_method_used": "groundTextOnly",
  "fix_version": "production_retrieval_efficiency_v2"
}
```

And after completion:
```json
{
  "event": "ORCHESTRATOR_MULTIQUERY_COMPLETE",
  "service": "evidenceOrchestrator",
  "pass_number": 1,
  "sources_retrieved": 10,
  "queries_executed": 6,
  "providers_used": ["mediastack"],
  "cache_hit": false
}
```

### Debug Output

Expected debug fields in response:
```json
{
  "orchestration_method_used": "multiQuery",
  "ground_method_used": "groundTextOnly",
  "grounding_path": "multi_query_provider_pipeline",
  "providerUsed": ["mediastack"] or ["mediastack", "gdelt"],
  "sourcesCount": > 0
}
```

### Provider Behavior

1. **Single Call**: Orchestrator calls `groundTextOnly()` once per pass (not per query)
2. **Query Generation**: `groundTextOnly()` generates optimized queries internally
3. **Multi-Query Pipeline**: All queries executed through efficient multi-query pipeline
4. **Mediastack First**: Tries Mediastack for all queries first
5. **GDELT Fallback**: Falls back to GDELT if Mediastack fails or returns zero results
6. **Adaptive Freshness**: Uses 7d → 30d → 1y → web search cascade for historical claims
7. **Result Aggregation**: Aggregates and deduplicates sources across all queries
8. **Stance Classification**: Sources include stance (supports/contradicts/mentions) and credibility tier

## Testing

### Manual Test

```bash
# Deploy the fix
cd backend
sam build
sam deploy

# Test with a claim
curl -X POST https://your-api-url/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Russia Ukraine war latest news"}'
```

### Expected Results

1. **CloudWatch Logs** should show:
   - `ORCHESTRATOR_MULTIQUERY_GROUNDING` event at start of pass
   - `query_generation_complete` with queries generated
   - `provider_attempt_start` for Mediastack
   - `provider_success` or `provider_attempt_failed` for Mediastack
   - If Mediastack fails: `provider_attempt_start` for GDELT
   - `ORCHESTRATOR_MULTIQUERY_COMPLETE` event with results
   - Provider failure details with reason codes

2. **Response** should include:
   - `orchestration_method_used: "multiQuery"`
   - `ground_method_used: "groundTextOnly"`
   - `sourcesCount > 0` (if providers have data)
   - `providerUsed: ["mediastack"]` or `["gdelt"]`
   - `_debug_fix_v6` with grounding path info

3. **Efficiency Improvements**:
   - Single call to `groundTextOnly()` per pass (not per query)
   - Queries executed in optimized multi-query pipeline
   - Results aggregated and deduplicated efficiently
   - Sources include proper stance and credibility classification

## Deployment Steps

1. **Build**:
   ```bash
   cd backend
   npm run build
   sam build
   ```

2. **Deploy**:
   ```bash
   sam deploy --no-confirm-changeset
   ```

3. **Verify**:
   ```bash
   # Check CloudWatch logs for ORCHESTRATOR_USING_GROUNDTEXTONLY
   aws logs tail /aws/lambda/FakeNewsOffFunction --follow
   ```

4. **Test**:
   ```bash
   # Run smoke test
   ./scripts/verify-v5.ps1
   ```

## Rollback Plan

If issues occur, revert to v4:

```bash
git revert HEAD
cd backend
sam build
sam deploy --no-confirm-changeset
```

## Success Criteria

- ✅ Orchestrator logs `ORCHESTRATOR_MULTIQUERY_GROUNDING` event
- ✅ Single call to `groundTextOnly()` per pass (not per query)
- ✅ Query generation logged with `query_generation_complete` event
- ✅ Provider attempts logged with `provider_attempt_start` events
- ✅ Mediastack tried first, GDELT as fallback
- ✅ `sourcesCount > 0` for claims with available evidence
- ✅ `orchestration_method_used: "multiQuery"` in response
- ✅ `ground_method_used: "groundTextOnly"` in response
- ✅ Sources include proper stance and credibility classification
- ✅ Efficient multi-query pipeline execution

## Notes

- The fix changes from calling `ground()` per query to calling `groundTextOnly()` once per pass
- This enables the full multi-query provider pipeline with query generation, aggregation, and deduplication
- The diagnostic markers now show `orchestration_method_used: "multiQuery"` and `ground_method_used: "groundTextOnly"`
- Sources now include stance (supports/contradicts/mentions) and credibility tier (1-3)
- Future work: Implement query budgeting and staged execution as specified in the production-retrieval-efficiency spec
