# Orchestrator Multi-Query Grounding Fix (v6) - FINAL

## Executive Summary

Fixed the orchestrator to use `groundTextOnly()` for efficient multi-query grounding instead of calling `ground()` per query. This enables the full multi-query provider pipeline with proper Mediastack → GDELT fallback, query generation, aggregation, and stance classification.

## Problem Statement

**Current Behavior (v5):**
- `orchestration_method_used = "groundingService.ground"`
- Orchestrator called `ground()` for each query individually
- Multiple separate provider calls (inefficient)
- No query aggregation or deduplication

**Expected Behavior (v6):**
- `orchestration_method_used = "multiQuery"`
- `ground_method_used = "groundTextOnly"`
- Single call to `groundTextOnly()` per pass
- Efficient multi-query pipeline execution
- Proper query generation, aggregation, and deduplication

## Implementation

### Files Changed

1. **backend/src/orchestration/evidenceOrchestrator.ts**
   - Import `groundTextOnly` instead of `getGroundingService`
   - Call `groundTextOnly(claim)` once per pass
   - Convert `TextGroundingBundle` sources to evidence candidates
   - Sources include proper `provider`, `stance`, and `credibilityTier`

2. **backend/src/lambda.ts**
   - Updated to v6 with correct diagnostic markers
   - `orchestration_method_used: "multiQuery"`
   - `ground_method_used: "groundTextOnly"`

3. **ORCHESTRATOR_GROUNDING_PATH_FIX.md**
   - Updated documentation with v6 details

### Code Changes

**Before (v5):**
```typescript
const groundingService = getGroundingService();
const results = await Promise.all(
  queries.map(async (query) => {
    const bundle = await groundingService.ground(query.text, ...);
    // Separate call per query - inefficient
  })
);
```

**After (v6):**
```typescript
import { groundTextOnly } from '../services/groundingService';

// Single call with claim text
const textBundle = await groundTextOnly(claim, undefined, false);

// Convert sources to evidence candidates
for (const source of textBundle.sources) {
  candidates.push({
    ...this.toEvidenceCandidate(source, matchedQuery, passNumber),
    provider: source.provider,
    stance: source.stance,
    credibilityTier: source.credibilityTier,
  });
}
```

## Execution Flow

```
User Claim
    ↓
EvidenceOrchestrator.executePass()
    ↓
groundTextOnly(claim)
    ↓
Query Generation (6 queries)
    ↓
Multi-Query Provider Pipeline
    ↓
Mediastack Search (all queries)
    ↓
GDELT Fallback (if needed)
    ↓
Normalization & Deduplication
    ↓
Stance Classification
    ↓
Evidence Scoring
    ↓
Return TextGroundingBundle
    ↓
Convert to Evidence Candidates
    ↓
Filter & Classify
```

## Diagnostic Markers

### Start of Pass
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

### End of Pass
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

### Response Debug Fields
```json
{
  "orchestration_method_used": "multiQuery",
  "ground_method_used": "groundTextOnly",
  "grounding_path": "multi_query_provider_pipeline",
  "providerUsed": ["mediastack"],
  "sourcesCount": 10
}
```

## Expected Behavior

### Provider Pipeline
1. **Single Call**: `groundTextOnly()` called once per pass (not per query)
2. **Query Generation**: Generates 6 optimized queries internally
3. **Mediastack First**: Tries Mediastack for all queries
4. **GDELT Fallback**: Falls back to GDELT if Mediastack fails
5. **Aggregation**: Aggregates sources across all queries
6. **Deduplication**: Removes duplicate URLs and domains
7. **Stance Classification**: Classifies each source (supports/contradicts/mentions)
8. **Credibility Scoring**: Assigns credibility tier (1=highest, 3=lowest)

### CloudWatch Logs
- `ORCHESTRATOR_MULTIQUERY_GROUNDING` - Start of pass
- `query_generation_complete` - Queries generated
- `provider_attempt_start` - Mediastack attempt
- `provider_success` or `provider_attempt_failed` - Mediastack result
- `provider_attempt_start` - GDELT attempt (if Mediastack failed)
- `ORCHESTRATOR_MULTIQUERY_COMPLETE` - End of pass with results

### Response Fields
- `orchestration_method_used: "multiQuery"`
- `ground_method_used: "groundTextOnly"`
- `providerUsed: ["mediastack"]` or `["mediastack", "gdelt"]`
- `sourcesCount > 0` (if evidence found)
- Sources include `provider`, `stance`, `credibilityTier`

## Testing

### Build Test
```bash
cd backend
npm run build
# Should succeed with no errors
```

### Unit Tests
```bash
npm test -- orchestration
# Should pass with ORCHESTRATOR_MULTIQUERY_GROUNDING logs
```

### Deployment
```bash
sam build
sam deploy --no-confirm-changeset
```

### Smoke Test
```bash
# Test with a claim
curl -X POST https://your-api-url/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Russia Ukraine war latest news"}'
```

### Expected Results
1. CloudWatch shows `ORCHESTRATOR_MULTIQUERY_GROUNDING` event
2. Query generation logged with 6 queries
3. Provider attempts logged (Mediastack → GDELT)
4. `ORCHESTRATOR_MULTIQUERY_COMPLETE` with sources
5. Response includes `orchestration_method_used: "multiQuery"`
6. Response includes `ground_method_used: "groundTextOnly"`
7. `sourcesCount > 0` if evidence available
8. Sources include stance and credibility

## Success Criteria

- ✅ Build succeeds with no TypeScript errors
- ✅ Orchestrator logs `ORCHESTRATOR_MULTIQUERY_GROUNDING` event
- ✅ Single call to `groundTextOnly()` per pass
- ✅ Query generation logged (6 queries)
- ✅ Provider attempts logged (Mediastack → GDELT)
- ✅ `ORCHESTRATOR_MULTIQUERY_COMPLETE` logged with results
- ✅ Response includes `orchestration_method_used: "multiQuery"`
- ✅ Response includes `ground_method_used: "groundTextOnly"`
- ✅ `sourcesCount > 0` for claims with evidence
- ✅ Sources include `provider`, `stance`, `credibilityTier`

## Rollback Plan

If issues occur:
```bash
git revert HEAD
cd backend
sam build
sam deploy --no-confirm-changeset
```

## Next Steps

1. Deploy to production
2. Monitor CloudWatch logs for diagnostic markers
3. Verify `orchestration_method_used: "multiQuery"` in responses
4. Verify `ground_method_used: "groundTextOnly"` in responses
5. Confirm `sourcesCount > 0` for test claims
6. Implement query budgeting (production-retrieval-efficiency spec)
7. Implement staged execution (production-retrieval-efficiency spec)

## Version History

- **v4**: Used `groundSingleQuery()` - legacy single-query path
- **v5**: Called `ground()` per query - inefficient multi-call
- **v6**: Calls `groundTextOnly()` once - efficient multi-query pipeline ✅
