# Orchestration Query Generation Root Cause Analysis

## Problem

Live API shows only 1 query generated instead of 3-5:
```json
{
  "_debug_fix_v2": {
    "queries_from_orchestration": ["Russia Ukraine war latest news"],  // Only 1 query!
    "fix_active": true
  }
}
```

## Root Cause

The orchestration path has a **double query generation bug**:

### Current Flow (BROKEN):

1. **QueryGenerator** (orchestration) generates queries using NOVA AI
   - Input: Claim decomposition
   - Output: 5-10 diverse queries with types (exact, entity_action, contradiction, etc.)
   - Location: `backend/src/orchestration/queryGenerator.ts`

2. **EvidenceOrchestrator** calls `groundTextOnly(query.text)` for each query
   - Location: `backend/src/orchestration/evidenceOrchestrator.ts` line 117
   - Code: `const textBundle = await groundTextOnly(query.text, undefined, false);`

3. **groundTextOnly** IGNORES the input query and generates its OWN queries
   - Location: `backend/src/services/groundingService.ts` line 1227
   - Code: `const queryResult = generateQueries(text);`
   - Uses `queryBuilder.ts` to generate 3-6 queries
   - Then calls `service.ground()` for EACH of those queries

4. **Result**: Orchestrator's carefully crafted queries are discarded!

### Why Only 1 Query Appears:

The orchestrator generates multiple queries (e.g., 5 queries), but for EACH orchestrator query:
- `groundTextOnly` generates 3-6 sub-queries
- These sub-queries are executed
- But the orchestrator only sees 1 result per call

The orchestrator then aggregates results, but the `queries` field in the final response comes from the orchestrator's query list, not the actual executed queries.

## Code Evidence

### 1. Orchestrator calls groundTextOnly:
```typescript
// backend/src/orchestration/evidenceOrchestrator.ts:117
const textBundle = await groundTextOnly(query.text, undefined, false);
```

### 2. groundTextOnly generates its own queries:
```typescript
// backend/src/services/groundingService.ts:1227
const queryResult = generateQueries(text);
const queries = queryResult.queries;

logger.info('Query generation complete', {
  event: 'query_generation_complete',
  queries_generated: queries.length,
  queries: queries,
});
```

### 3. groundTextOnly executes those queries:
```typescript
// backend/src/services/groundingService.ts:1260
const queryPromises = queries.map((query) =>
  service.ground(query, undefined, requestId, false)
);
```

## Why This Breaks Multi-Query Generation

The orchestrator expects to control query generation, but `groundTextOnly` has its own query generation logic. This creates two problems:

1. **Query duplication**: If orchestrator generates 5 queries, and each calls `groundTextOnly` which generates 3 queries, we execute 15 queries total (wasteful)

2. **Query loss**: The orchestrator's queries are used as input to `groundTextOnly`, which then extracts entities/keywords and generates different queries

3. **Single query symptom**: When the orchestrator passes a simple query like "Russia Ukraine war latest news", `groundTextOnly` might only generate 1-2 queries from it (not 3-5)

## Solution

We need to create a **direct grounding path** for the orchestrator that:
1. Takes a single query string
2. Calls `service.ground()` directly (no query generation)
3. Returns normalized sources with provider info

### Option A: Add `groundSingleQuery` function
```typescript
export async function groundSingleQuery(
  query: string,
  requestId?: string,
  demoMode = false
): Promise<SingleQueryGroundingResult> {
  const service = getGroundingService();
  const result = await service.ground(query, undefined, requestId, demoMode);
  
  return {
    sources: result.sources.map(s => ({
      ...s,
      provider: result.providerUsed,
      stance: 'mentions',
      credibilityTier: 2,
    })),
    provider: result.providerUsed,
    latencyMs: result.latencyMs,
    cacheHit: result.cacheHit || false,
  };
}
```

### Option B: Add parameter to groundTextOnly
```typescript
export async function groundTextOnly(
  text: string,
  requestId?: string,
  demoMode = false,
  skipQueryGeneration = false  // NEW parameter
): Promise<TextGroundingBundle> {
  if (skipQueryGeneration) {
    // Direct grounding path for orchestrator
    const service = getGroundingService();
    const result = await service.ground(text, undefined, requestId, demoMode);
    return {
      sources: result.sources.map(s => ({...s, provider: result.providerUsed})),
      queries: [text],
      providerUsed: [result.providerUsed],
      sourcesCount: result.sources.length,
      cacheHit: result.cacheHit || false,
      latencyMs: result.latencyMs,
    };
  }
  
  // Existing multi-query generation logic
  const queryResult = generateQueries(text);
  // ...
}
```

## Recommended Fix: Option A

Create a new `groundSingleQuery` function specifically for the orchestrator:
- Clear separation of concerns
- No risk of breaking existing `groundTextOnly` behavior
- Explicit contract for orchestrator use case
- Better logging and tracing

## Additional Issues to Fix

### 1. Provider Failure Logging

Current logging doesn't show:
- Which specific query failed
- HTTP status codes
- Timeout vs error vs zero results
- Normalization stage failures

Need to add:
```typescript
logger.warn('Provider attempt failed', {
  event: 'provider_attempt_failed',
  provider: 'mediastack',
  query: query.substring(0, 100),
  failure_reason: 'timeout' | 'unauthorized' | 'zero_raw_results' | 'normalization_zero' | 'filtered_to_zero',
  http_status: 429,
  timeout_ms: 5000,
  raw_result_count: 0,
  normalized_count: 0,
  accepted_count: 0,
  error_message: error.message,
});
```

### 2. Provider Stage Logging

Need to log each stage:
```typescript
// Stage 1: Attempt start
logger.info('Provider attempt start', {
  event: 'provider_attempt_start',
  provider: 'mediastack',
  query: query.substring(0, 100),
});

// Stage 2: Raw result
logger.info('Provider raw result', {
  event: 'provider_raw_result',
  provider: 'mediastack',
  raw_count: response.data.length,
});

// Stage 3: Normalized result
logger.info('Provider normalized result', {
  event: 'provider_normalized_result',
  provider: 'mediastack',
  normalized_count: normalized.length,
});

// Stage 4: Filter result
logger.info('Provider filter result', {
  event: 'provider_filter_result',
  provider: 'mediastack',
  accepted_count: ranked.length,
});
```

## Expected Behavior After Fix

For claim: "Russia Ukraine war latest news"

### Orchestrator generates 5 queries:
```json
[
  {
    "type": "exact",
    "text": "Russia Ukraine war latest news",
    "priority": 1.0
  },
  {
    "type": "entity_action",
    "text": "Russia Ukraine conflict updates",
    "priority": 0.9
  },
  {
    "type": "official_confirmation",
    "text": "Russia Ukraine official statement",
    "priority": 0.8
  },
  {
    "type": "fact_check",
    "text": "Russia Ukraine fact check",
    "priority": 0.7
  },
  {
    "type": "contradiction",
    "text": "Russia Ukraine false claims",
    "priority": 0.6
  }
]
```

### Each query calls groundSingleQuery:
- Query 1: "Russia Ukraine war latest news" → Mediastack → 10 sources
- Query 2: "Russia Ukraine conflict updates" → Mediastack → 8 sources
- Query 3: "Russia Ukraine official statement" → Mediastack → 5 sources
- Query 4: "Russia Ukraine fact check" → GDELT → 3 sources
- Query 5: "Russia Ukraine false claims" → GDELT → 2 sources

### Final response:
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
    "providers_from_status": ["mediastack", "gdelt"],
    "fix_active": true
  },
  "text_grounding": {
    "queries": [/* same 5 queries */],
    "sourcesCount": 28,
    "providerUsed": ["mediastack", "gdelt"]
  }
}
```

## Files to Change

1. **backend/src/services/groundingService.ts**
   - Add `groundSingleQuery` function
   - Add detailed provider failure logging
   - Add provider stage logging

2. **backend/src/orchestration/evidenceOrchestrator.ts**
   - Replace `groundTextOnly()` with `groundSingleQuery()`
   - Update imports

3. **backend/src/types/grounding.ts**
   - Add `SingleQueryGroundingResult` interface

## Test Plan

1. **Unit test**: Verify `groundSingleQuery` calls `ground()` directly
2. **Integration test**: Verify orchestrator generates 5 queries and executes all 5
3. **Production test**: Verify `_debug_fix_v2.queries_from_orchestration.length >= 3`
