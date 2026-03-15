# Verdict Synthesis Debug Plan

## Current Status

Based on EC2 production path testing, the pipeline works correctly through:
1. ✅ Live Serper retrieval
2. ✅ Evidence normalization  
3. ✅ Stance classification
4. ✅ Credibility scoring
5. ✅ Real Bedrock/NOVA invocation (no errors)
6. ❌ Verdict synthesis returns fallback: "unverified" with 30% confidence

## Root Cause Analysis

### Issue 1: Crypto Import (RESOLVED)
- **Status**: Already fixed in code
- **Location**: `backend/src/services/novaClient.ts` line 10, 310
- **Current state**: Uses `import { randomUUID } from 'crypto'` and calls `randomUUID()` directly
- **No action needed**

### Issue 2: Verdict Synthesis Fallback Structure Mismatch

**Problem**: The `parseStrictJson` function in `llmJson.ts` always returns `success: true`, even when using fallback. The fallback structure doesn't match the expected `Verdict` structure.

**Fallback structure** (from `llmJson.ts` line 95-105):
```typescript
{
  status_label: 'Unverified',
  confidence_score: 30,
  recommendation: string,
  sift_guidance: string,
  sources: [],
  misinformation_type: null
}
```

**Expected Verdict structure** (from `orchestration.ts` line 250-265):
```typescript
{
  classification: VerdictClassification,  // NOT status_label
  confidence: number,                      // NOT confidence_score
  supportedSubclaims: string[],
  unsupportedSubclaims: string[],
  contradictorySummary: string,
  unresolvedUncertainties: string[],
  bestEvidence: FilteredEvidence[],
  rationale: string
}
```

**Detection logic** (in `novaClient.ts` line 1015-1025):
```typescript
const hasValidStructure = 
  parsed.data &&
  'classification' in parsed.data &&
  'confidence' in parsed.data &&
  'supportedSubclaims' in parsed.data &&
  'unsupportedSubclaims' in parsed.data;

if (!hasValidStructure) {
  // Logs VERDICT_SYNTHESIS_INVALID_STRUCTURE
  throw new Error('Invalid verdict structure from parseStrictJson');
}
```

This detection SHOULD catch the fallback, but the fallback is being returned before this check runs.

## Debugging Strategy

### Step 1: Add Comprehensive Logging

Add logging at key points in `synthesizeVerdict` function:

1. **Before Bedrock call**: Log prompt length, evidence counts
2. **After Bedrock call**: Log raw response (first 500 chars)
3. **After parseStrictJson**: Log parsed structure keys
4. **Structure validation**: Log whether validation passed/failed
5. **Fallback path**: Log when fallback is triggered

**Logging events to add**:
- `VERDICT_SYNTHESIS_RAW_RESPONSE` - Already present (line 1000)
- `VERDICT_SYNTHESIS_PARSED` - Already present (line 1032)
- `VERDICT_SYNTHESIS_INVALID_STRUCTURE` - Already present (line 1023)
- `VERDICT_SYNTHESIS_ERROR` - Already present (line 1048)

### Step 2: Investigate Bedrock Response Format

The issue might be that Bedrock/NOVA is returning a response in an unexpected format that `parseStrictJson` can't parse, triggering the fallback.

**Possible causes**:
1. Bedrock returns wrapper object (e.g., `{ output: { message: { content: [...] } } }`)
2. Response is valid JSON but doesn't match expected schema
3. Response contains markdown or prose that repair logic can't handle
4. Model is returning a different schema than prompted

### Step 3: Test Hypothesis

Run the EC2 test again and examine the logs for:
1. `VERDICT_SYNTHESIS_RAW_RESPONSE` - What does Bedrock actually return?
2. `VERDICT_SYNTHESIS_INVALID_STRUCTURE` - Is this event logged?
3. `VERDICT_SYNTHESIS_ERROR` - Is this event logged?

## Expected Behavior

For claim "Russia invaded Ukraine in February 2022" with:
- 2+ supporting sources from trusted domains (reuters.com, bbc.com, etc.)
- 0 contradicting sources
- High credibility evidence

**Expected verdict**:
- `classification`: "true"
- `confidence`: 0.85-0.95
- `rationale`: Mentions source credibility and count

## Action Items

1. ✅ Fix test file to detect fallback verdicts (already done)
2. ⏳ Run EC2 test and collect logs
3. ⏳ Analyze `VERDICT_SYNTHESIS_RAW_RESPONSE` to see actual Bedrock output
4. ⏳ Determine if issue is:
   - Bedrock returning wrong format
   - parseStrictJson fallback being triggered incorrectly
   - Structure validation failing when it shouldn't
5. ⏳ Implement targeted fix based on findings

## Files to Monitor

- `backend/src/services/novaClient.ts` - Verdict synthesis logic
- `backend/src/utils/llmJson.ts` - JSON parsing with fallback
- `backend/src/orchestration/verdictSynthesizer.ts` - Verdict synthesizer service
- `backend/test-full-production-path.ts` - Integration test

## Next Steps

User should:
1. Run the full production path test on EC2
2. Collect and share the complete log output
3. Look specifically for these log events:
   - `VERDICT_SYNTHESIS_RAW_RESPONSE`
   - `VERDICT_SYNTHESIS_PARSED`
   - `VERDICT_SYNTHESIS_INVALID_STRUCTURE`
   - `VERDICT_SYNTHESIS_ERROR`

This will reveal exactly where the verdict synthesis is failing.
