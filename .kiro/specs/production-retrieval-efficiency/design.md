# Production Retrieval Efficiency Bugfix Design

## Overview

The production evidence retrieval system exhibits inefficient provider usage that wastes API quota and causes unnecessary failures. Despite having available provider capacity (only 17/100 Mediastack requests used), the system returns zero sources due to sending all 6 generated queries to all providers without budgeting, lacking provider cooldown/throttling logic, having no short-term caching, and not using staged execution.

This bugfix implements production-grade retrieval behavior with:
- Query budgeting (max 1-2 queries per provider initially)
- Provider cooldown tracking with reason codes
- Short-term caching (5-15 min evidence, 2-5 min rate-limit)
- Staged execution (Mediastack → GDELT → expand if needed)
- Enhanced provider failure propagation
- Provider health summary fields

The fix targets the `evidenceOrchestrator.executePass()` method and `groundingService.ground()` method to implement efficient staged retrieval with proper budgeting and caching.

## Glossary

- **Bug_Condition (C)**: The condition that triggers inefficient retrieval - when the system sends all 6 queries to all providers without budgeting or staged execution
- **Property (P)**: The desired behavior - system uses query budgeting (max 1-2 queries per provider initially), provider cooldown tracking, short-term caching, and staged execution
- **Preservation**: Existing evidence quality, normalization, classification, and acceptance criteria that must remain unchanged
- **Query Budgeting**: Limiting the number of queries sent to each provider per retrieval stage (Mediastack max 1 query first pass, GDELT max 1 query first pass)
- **Provider Cooldown**: Temporary unavailability marking when a provider returns rate-limit, quota, throttling, 429, or subscription-limit errors
- **Staged Execution**: Progressive retrieval strategy: Stage 1 (best 1 query with Mediastack), Stage 2 (if zero usable evidence, try GDELT with 1 query), Stage 3 (if still zero, try one additional ranked query)
- **Short-term Caching**: Caching successful evidence for 5-15 minutes and provider rate-limit cooldown for 2-5 minutes
- **evidenceOrchestrator.executePass()**: The method in `backend/src/orchestration/evidenceOrchestrator.ts` that executes parallel queries to providers
- **groundingService.ground()**: The method in `backend/src/services/groundingService.ts` that calls providers sequentially
- **groundSingleQuery()**: The function in `backend/src/services/groundingService.ts` that wraps single query grounding

## Bug Details

### Bug Condition

The bug manifests when the orchestration pipeline generates 6 queries for a claim and sends all queries to all providers without budgeting, cooldown logic, caching, or staged execution. The `evidenceOrchestrator.executePass()` method calls `groundSingleQuery()` for each query in parallel, which in turn calls `groundingService.ground()`. The grounding service attempts all providers sequentially for each query without checking for cooldowns or cached results, leading to wasted API calls and unnecessary failures.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { queries: Query[], claim: string, passNumber: number }
  OUTPUT: boolean
  
  RETURN input.queries.length >= 3
         AND allQueriesSentToAllProviders(input.queries)
         AND NOT queryBudgetingApplied(input.queries)
         AND NOT providerCooldownChecked()
         AND NOT shortTermCacheChecked()
         AND NOT stagedExecutionUsed()
END FUNCTION
```

### Examples

- **Example 1**: System generates 6 queries for claim "Biden announced new policy". All 6 queries are sent to Mediastack, then all 6 to GDELT. Mediastack returns rate-limit on query 3, but system continues sending queries 4-6 to Mediastack. Expected: After rate-limit on query 3, mark Mediastack as cooled-down and skip queries 4-6.

- **Example 2**: User submits same claim twice within 2 minutes. System makes fresh API calls both times. Expected: Second request returns cached results without making new API calls.

- **Example 3**: System sends all 6 queries to Mediastack in parallel. Mediastack returns 0 results for all queries. System then sends all 6 queries to GDELT. Expected: Send only best 1 query to Mediastack first (Stage 1), if zero results then send best 1 query to GDELT (Stage 2), if still zero then try one additional ranked query (Stage 3).

- **Edge Case**: Provider returns 429 rate-limit error. System continues attempting calls within same request. Expected: Mark provider as temporarily unavailable with cooldown timestamp and skip further calls.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Evidence quality scoring and filtering must continue to work exactly as before
- Source normalization (Mediastack, GDELT, Bing) must remain unchanged
- Evidence classification by stance (supports, contradicts, mentions) must remain unchanged
- Acceptance criteria for evidence sources must remain unchanged
- Query generation logic must remain unchanged

**Scope:**
All inputs that do NOT involve the orchestration retrieval flow should be completely unaffected by this fix. This includes:
- Demo mode evidence retrieval
- Direct grounding service calls outside orchestration
- Evidence filtering and classification logic
- Verdict synthesis and reasoning

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **No Query Budgeting in Orchestrator**: The `evidenceOrchestrator.executePass()` method sends all queries in parallel using `Promise.all()` without limiting queries per provider. It calls `groundSingleQuery()` for each query without checking how many queries have been sent to each provider.

2. **No Provider Cooldown Tracking**: The `groundingService.ground()` method attempts all providers sequentially without checking if a provider has recently returned a rate-limit error. There is no cooldown state tracking between calls within the same request or across requests.

3. **No Short-term Caching**: The existing `GroundingCache` has a 15-minute TTL (GROUNDING_CACHE_TTL_SECONDS=900), but there is no separate short-term cache for rate-limit cooldowns (2-5 minutes). The cache is only checked in `ground()` method, not in orchestration flow.

4. **No Staged Execution**: The orchestrator sends all queries to all providers without progressive stages. It should implement: Stage 1 (best 1 query with Mediastack), Stage 2 (if zero usable evidence, try GDELT with 1 query), Stage 3 (if still zero, try one additional ranked query).

5. **Insufficient Provider Failure Propagation**: When providers fail, the system logs errors but does not consistently populate `provider_failure_details` in the response or debug fields with structured information (provider, query, reason, stage, latency, counts, http_status, error_message).

6. **No Provider Health Summary**: The system does not track or report provider budget usage, cooldown states, cache hit sources, or staged retrieval phases in response/debug fields.

## Correctness Properties

Property 1: Bug Condition - Efficient Query Budgeting and Staged Execution

_For any_ orchestration request where multiple queries are generated (isBugCondition returns true), the fixed system SHALL use query budgeting (max 1-2 queries per provider initially), provider cooldown tracking, short-term caching, and staged execution (Stage 1: best 1 query with Mediastack, Stage 2: if zero usable evidence try GDELT with 1 query, Stage 3: if still zero try one additional ranked query), minimizing unnecessary API calls while maximizing retrieval success.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

Property 2: Preservation - Evidence Quality and Classification

_For any_ evidence sources successfully retrieved, the fixed system SHALL produce exactly the same quality scores, normalization, stance classification, and acceptance decisions as the original system, preserving all existing evidence processing behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `backend/src/orchestration/evidenceOrchestrator.ts`

**Function**: `executePass()`

**Specific Changes**:
1. **Implement Staged Execution**: Replace parallel `Promise.all()` with sequential staged execution:
   - Stage 1: Send best 1 query to Mediastack (ranked by relevance)
   - Stage 2: If zero usable evidence from Stage 1, send best 1 query to GDELT
   - Stage 3: If still zero usable evidence, send one additional ranked query to available provider
   - Track stage number in evidence metadata

2. **Add Query Ranking**: Implement query ranking by relevance score before staged execution:
   - Prioritize 'exact' and 'entity_action' query types
   - Use query text length and specificity as secondary factors
   - Return ranked query list for staged execution

3. **Add Provider Budget Tracking**: Track queries sent per provider within each pass:
   - Maintain `providerQueryCount` map (provider → count)
   - Enforce budget limits: Mediastack max 1 query Stage 1, GDELT max 1 query Stage 2
   - Skip providers that have exceeded budget

4. **Check Provider Cooldowns**: Before calling provider, check cooldown state:
   - Call `getProviderCooldown(provider)` from grounding service
   - Skip provider if cooldown active
   - Log cooldown skip event

5. **Check Short-term Cache**: Before calling provider, check cache:
   - Call `getCachedResult(query)` from grounding service
   - Return cached result if available
   - Log cache hit event

6. **Populate Provider Failure Details**: When provider fails, collect structured failure info:
   - provider, query, reason, stage, latency, raw_count, normalized_count, accepted_count, http_status, error_message
   - Add to `providerFailureDetails` array in pipeline state
   - Include in final orchestration result

7. **Add Provider Health Summary**: Track provider health metrics:
   - provider_budget_used (queries sent per provider)
   - provider_cooldowns_active (list of cooled-down providers)
   - cache_hit_source (which queries hit cache)
   - staged_retrieval_phase_reached (max stage reached)
   - Include in final orchestration result

**File**: `backend/src/services/groundingService.ts`

**Function**: `ground()`

**Specific Changes**:
1. **Add Provider Cooldown State**: Implement in-memory cooldown tracking:
   - Create `providerCooldowns` map (provider → { until: timestamp, reason: string })
   - When provider returns rate-limit/quota/429 error, set cooldown until now + 2-5 minutes
   - Check cooldown before attempting provider call
   - Export `getProviderCooldown(provider)` and `setProviderCooldown(provider, reason, durationMs)` functions

2. **Add Short-term Rate-limit Cache**: Implement separate cache for rate-limit cooldowns:
   - Create `rateLimitCache` with 2-5 minute TTL
   - Store rate-limit errors with provider and timestamp
   - Check before attempting provider call
   - Export `getRateLimitCached(provider)` function

3. **Enhance Error Classification**: Improve error reason detection:
   - Detect rate-limit: 429, "rate limit", "too many requests"
   - Detect quota: "quota exceeded", "subscription limit"
   - Detect throttling: "throttled", "slow down"
   - Set appropriate cooldown duration based on error type

4. **Populate Provider Failure Details**: When provider fails, return structured failure info:
   - Include in GroundingBundle: `providerFailureDetails: { provider, query, reason, latency, raw_count, normalized_count, accepted_count, http_status, error_message }`
   - Log structured failure event

5. **Add Provider Health Tracking**: Track provider call statistics:
   - Maintain `providerStats` map (provider → { calls: number, successes: number, failures: number, lastCallTime: timestamp })
   - Update on each provider call
   - Export `getProviderStats()` function

**File**: `backend/src/types/orchestration.ts`

**Type**: `PipelineState`

**Specific Changes**:
1. **Add Provider Failure Details Field**:
   ```typescript
   providerFailureDetails?: Array<{
     provider: string;
     query: string;
     reason: string;
     stage: number;
     latency: number;
     raw_count: number;
     normalized_count: number;
     accepted_count: number;
     http_status?: number;
     error_message: string;
   }>;
   ```

2. **Add Provider Health Summary Field**:
   ```typescript
   providerHealthSummary?: {
     provider_budget_used: Record<string, number>;
     provider_cooldowns_active: string[];
     cache_hit_source: string[];
     staged_retrieval_phase_reached: number;
   };
   ```

**File**: `backend/src/types/grounding.ts`

**Type**: `GroundingBundle`

**Specific Changes**:
1. **Add Provider Failure Details Field**:
   ```typescript
   providerFailureDetails?: {
     provider: string;
     query: string;
     reason: string;
     latency: number;
     raw_count: number;
     normalized_count: number;
     accepted_count: number;
     http_status?: number;
     error_message: string;
   };
   ```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate orchestration with 6 queries and observe provider call patterns. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **All Queries Sent to All Providers Test**: Generate 6 queries, observe that all 6 are sent to Mediastack, then all 6 to GDELT (will fail on unfixed code - demonstrates no query budgeting)
2. **No Cooldown After Rate-limit Test**: Simulate Mediastack returning 429 on query 3, observe that queries 4-6 are still sent to Mediastack (will fail on unfixed code - demonstrates no cooldown tracking)
3. **No Cache on Repeated Request Test**: Submit same claim twice within 2 minutes, observe that fresh API calls are made both times (will fail on unfixed code - demonstrates no short-term caching)
4. **No Staged Execution Test**: Observe that all queries are sent in parallel to all providers without progressive stages (will fail on unfixed code - demonstrates no staged execution)

**Expected Counterexamples**:
- All 6 queries sent to all providers without budgeting
- Provider calls continue after rate-limit errors
- Fresh API calls made for repeated requests within cache window
- Parallel fan-out to all providers without staged progression
- Possible causes: no query budgeting in orchestrator, no cooldown tracking in grounding service, no short-term cache check, no staged execution logic

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := executePass_fixed(input.queries, input.claim, input.passNumber)
  ASSERT queryBudgetingApplied(result)
  ASSERT providerCooldownsRespected(result)
  ASSERT shortTermCacheUsed(result)
  ASSERT stagedExecutionUsed(result)
  ASSERT providerFailureDetailsPropagated(result)
  ASSERT providerHealthSummaryIncluded(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT executePass_original(input) = executePass_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for demo mode, direct grounding calls, and evidence filtering, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Evidence Quality Preservation**: Observe that evidence quality scoring works correctly on unfixed code, then write test to verify this continues after fix
2. **Source Normalization Preservation**: Observe that source normalization works correctly on unfixed code, then write test to verify this continues after fix
3. **Stance Classification Preservation**: Observe that stance classification works correctly on unfixed code, then write test to verify this continues after fix
4. **Demo Mode Preservation**: Observe that demo mode evidence retrieval works correctly on unfixed code, then write test to verify this continues after fix

### Unit Tests

- Test query ranking by relevance score
- Test staged execution logic (Stage 1 → Stage 2 → Stage 3)
- Test provider budget tracking and enforcement
- Test provider cooldown state management
- Test short-term cache hit/miss scenarios
- Test provider failure details population
- Test provider health summary calculation
- Test error classification (rate-limit, quota, throttling)

### Property-Based Tests

- Generate random query sets and verify query budgeting is always applied (max 1-2 queries per provider initially)
- Generate random provider error sequences and verify cooldowns are always respected
- Generate random repeated requests and verify caching is always used within TTL window
- Generate random evidence sets and verify quality scoring, normalization, and classification are preserved

### Integration Tests

- Test full orchestration flow with staged execution and query budgeting
- Test orchestration with provider rate-limit errors and cooldown tracking
- Test orchestration with repeated requests and cache hits
- Test orchestration with provider failures and failure details propagation
- Test orchestration with provider health summary in response
