# Historical Claims Evidence Retrieval Fix - Design Document

## Overview

The FakeNewsOff system currently fails to retrieve evidence for well-documented historical claims due to hardcoded 7-day freshness parameters in evidence providers (Bing News and GDELT). This design addresses four root causes: freshness bias, lack of typo tolerance, absence of fallback strategies, and recency scoring bias.

The fix implements an adaptive freshness strategy that cascades through broader time windows (7d → 30d → 1y → web search) when initial attempts return empty results. It adds typo-tolerant entity name normalization to handle spelling variations, implements a comprehensive fallback retrieval chain, and adjusts evidence scoring to not penalize credible historical sources.

This approach ensures the system handles both recent breaking news AND historical factual claims while preserving existing demo mode functionality and maintaining the 5-second performance budget.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when historical claims (events older than 7 days) return empty evidence despite being well-documented
- **Property (P)**: The desired behavior - historical claims should return credible evidence sources from appropriate time periods
- **Preservation**: Existing recent news retrieval (7-day freshness) and demo mode functionality that must remain unchanged
- **Adaptive Freshness**: Cascading retrieval strategy that progressively broadens time windows when initial attempts fail
- **Typo Tolerance**: Fuzzy matching and entity name normalization to handle spelling variations in proper nouns
- **Fallback Chain**: Sequential retrieval strategy: News APIs (7d) → News APIs (30d) → News APIs (1y) → Web Search
- **Historical Claim**: A claim about events that occurred more than 7 days ago (e.g., "Ronald Reagan is dead")
- **Recent Claim**: A claim about breaking news within the 7-day window (e.g., current political events)

## Bug Details

### Bug Condition

The bug manifests when a user submits a well-documented historical claim (events older than 7 days) and the system returns "Unverified" with empty evidence array. The root causes are:

1. **Hardcoded Freshness Parameters**: `bingNewsClient.ts` uses `freshness: 'Week'` and `gdeltClient.ts` uses `timespan: '7d'`, excluding older sources
2. **No Typo Tolerance**: `claimNormalizer.ts` only performs basic normalization (lowercase, trim, collapse spaces) without handling entity name variations
3. **No Fallback Strategy**: `groundingService.ts` only tries Bing News and GDELT with 7-day freshness, then gives up
4. **Recency Scoring Bias**: `calculateRecencyScore()` in `groundingService.ts` applies linear decay over 30 days, potentially penalizing credible historical sources

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { claim: string, claimDate: Date }
  OUTPUT: boolean
  
  RETURN isHistoricalClaim(input.claim)
         AND hasWellDocumentedEvidence(input.claim)
         AND currentSystem.retrieveEvidence(input.claim).length == 0
         AND NOT isDemoMode()
END FUNCTION

FUNCTION isHistoricalClaim(claim)
  // Heuristic: claim references events older than 7 days
  RETURN claimReferencesDate(claim) < (currentDate - 7 days)
         OR claimContainsHistoricalKeywords(claim)
END FUNCTION
```

### Examples

- **Example 1**: User submits "Ronald Reagan is dead"
  - Expected: Verdict "Supported" with obituaries, biographical articles, news archives
  - Actual: Verdict "Unverified" with empty evidence array
  - Reason: Reagan died in 2004, all sources are older than 7 days

- **Example 2**: User submits "Ronald Regan is dead" (typo in last name)
  - Expected: System normalizes to "Ronald Reagan", returns "Supported" with evidence
  - Actual: Verdict "Unverified" with empty evidence array
  - Reason: No typo tolerance, searches for exact misspelled name

- **Example 3**: User submits "World War II ended in 1945"
  - Expected: Verdict "Supported" with historical sources
  - Actual: Verdict "Unverified" with empty evidence array
  - Reason: Event is 79 years old, no sources within 7-day window

- **Edge Case**: User submits "The moon landing was faked" (historical conspiracy theory)
  - Expected: Verdict "Disputed" with both supporting and contradicting sources from historical archives
  - Actual: Verdict "Unverified" with empty evidence array
  - Reason: Original moon landing (1969) is historical, even recent debunking articles may be older than 7 days


## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Recent breaking-news claims (within 7-day window) must continue to use 7-day freshness and return results as before
- Demo mode with deterministic example claims must continue to return deterministic results without modification
- Claims with no real evidence available (neither recent nor historical) must continue to return "Unverified" with empty evidence array
- Explainable AI trace functionality must continue to show retrieval decisions and strategies
- Performance budget of less than 5 seconds must be maintained
- Evidence filtering and scoring must continue to apply credibility and relevance criteria
- Results page rendering for empty evidence state must continue to work correctly

**Scope:**
All inputs that do NOT involve historical claims (events older than 7 days) should be completely unaffected by this fix. This includes:
- Recent breaking news within 7-day window
- Demo mode example claims
- Claims that genuinely have no evidence available
- All existing trace, caching, and performance optimizations

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Hardcoded Freshness Parameters in API Clients**
   - `bingNewsClient.ts` line 62: `freshness: options?.freshness ?? 'Week'` - defaults to 7 days
   - `gdeltClient.ts` line 62: `timespan: options?.timespan ?? '7d'` - defaults to 7 days
   - These parameters are passed through but always use the same default values
   - No mechanism exists to broaden the time window when initial search fails

2. **Insufficient Claim Normalization**
   - `claimNormalizer.ts` only performs basic text normalization (lowercase, trim, collapse spaces)
   - No entity name normalization or fuzzy matching for proper nouns
   - Spelling variations like "Ronald Regan" vs "Ronald Reagan" are not handled
   - No phonetic matching or common typo correction

3. **No Fallback Retrieval Strategy**
   - `groundingService.ts` `tryProviders()` method tries Bing and GDELT once with 7-day freshness
   - If both return empty results, the method immediately returns empty bundle
   - No retry with broader time windows
   - No fallback to web search (only news search is attempted)

4. **Recency Scoring Bias**
   - `calculateRecencyScore()` in `groundingService.ts` line 442: applies linear decay over 30 days
   - Formula: `Math.max(0, 1.0 - ageInDays / 30)`
   - Articles older than 30 days receive score of 0.0
   - This penalizes credible historical sources even when they're the most authoritative


## Correctness Properties

Property 1: Bug Condition - Historical Claims Return Evidence

_For any_ claim that references well-documented historical events (older than 7 days) and returns empty results with 7-day freshness, the fixed system SHALL retry with progressively broader time windows (30 days, 1 year) and return credible evidence sources from appropriate historical periods, resulting in "Supported" or "Disputed" verdicts instead of "Unverified".

**Validates: Requirements 2.1, 2.3, 2.4, 2.5**

Property 2: Preservation - Recent News Behavior

_For any_ claim about recent breaking news (within 7-day window), the fixed system SHALL continue to use 7-day freshness as the first attempt and return results with the same performance and quality as the original system, preserving existing recent news retrieval behavior.

**Validates: Requirements 3.1, 3.5, 3.6**

Property 3: Typo Tolerance - Entity Name Normalization

_For any_ claim containing minor spelling variations in entity names (proper nouns like person names, place names), the fixed system SHALL normalize the claim using typo-tolerant techniques before retrieval and return the same evidence as the correctly-spelled version would return.

**Validates: Requirements 2.2**

Property 4: Preservation - Demo Mode Determinism

_For any_ demo mode request with example claims, the fixed system SHALL bypass adaptive freshness and typo normalization, returning exactly the same deterministic results as the original system without modification.

**Validates: Requirements 3.2**

Property 5: Performance Preservation

_For any_ claim (historical or recent), the fixed system SHALL complete evidence retrieval within the 5-second performance budget, using timeout controls and short-circuit logic to prevent cascading delays.

**Validates: Requirements 3.5**


## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, we need to make the following changes:

**File 1**: `backend/src/clients/bingNewsClient.ts`

**Function**: `search()`

**Specific Changes**:
1. **Make Freshness Configurable**: The `freshness` parameter is already optional in `BingSearchOptions`, but the default is hardcoded to `'Week'`. Keep this default for backward compatibility, but allow callers to override it.
   - No code changes needed - the parameter is already configurable
   - Callers can now pass `freshness: 'Month'` or `freshness: 'Year'` to broaden the search

2. **Add Logging for Freshness Parameter**: Log the freshness value used in each request for trace visibility
   - Add freshness value to the debug log at line 58

**File 2**: `backend/src/clients/gdeltClient.ts`

**Function**: `search()`

**Specific Changes**:
1. **Make Timespan Configurable**: The `timespan` parameter is already optional in `GDELTSearchOptions`, but the default is hardcoded to `'7d'`. Keep this default for backward compatibility, but allow callers to override it.
   - No code changes needed - the parameter is already configurable
   - Callers can now pass `timespan: '30d'` or `timespan: '365d'` to broaden the search

2. **Add Logging for Timespan Parameter**: Log the timespan value used in each request for trace visibility
   - Add timespan value to the debug log at line 58

**File 3**: `backend/src/utils/claimNormalizer.ts`

**Function**: Add new `normalizeEntityNames()` function

**Specific Changes**:
1. **Add Entity Name Normalization Function**: Create a new function that applies typo-tolerant normalization to entity names (proper nouns)
   - Use simple heuristics: capitalize first letter of each word, handle common typos
   - Implement Levenshtein distance calculation for fuzzy matching against known entities
   - Create a small dictionary of common historical figures and places for normalization

2. **Preserve Existing Function**: Keep `normalizeClaimForCache()` unchanged for backward compatibility

3. **Add Integration Point**: Create a new `normalizeClaimWithTypoTolerance()` function that combines basic normalization with entity name normalization

**File 4**: `backend/src/services/groundingService.ts`

**Function**: `tryProviders()`

**Specific Changes**:
1. **Add Adaptive Freshness Strategy**: Implement cascading retrieval with progressively broader time windows
   - First attempt: Use existing 7-day freshness (Bing: 'Week', GDELT: '7d')
   - If empty results: Retry with 30-day freshness (Bing: 'Month', GDELT: '30d')
   - If still empty: Retry with 1-year freshness (Bing: 'Year', GDELT: '365d')
   - Track which strategy succeeded in the bundle

2. **Add Timeout Budget Management**: Implement cumulative timeout tracking to ensure total latency stays under 5 seconds
   - Track elapsed time across all retry attempts
   - Short-circuit if approaching 5-second budget
   - Reduce timeout for later attempts to stay within budget

3. **Add Trace Events**: Log freshness strategy changes and retry attempts
   - Log when broadening time window
   - Log which freshness level succeeded
   - Include in bundle metadata for explainable AI trace

4. **Add Demo Mode Short-Circuit**: Skip adaptive freshness in demo mode to preserve deterministic behavior
   - Check `demoMode` flag before entering retry loop
   - Use existing 7-day freshness only in demo mode

**File 5**: `backend/src/services/groundingService.ts`

**Function**: `ground()`

**Specific Changes**:
1. **Add Typo-Tolerant Normalization**: Apply entity name normalization before query extraction
   - Call `normalizeClaimWithTypoTolerance()` on the headline before `extractQuery()`
   - Only apply in production mode (skip in demo mode)
   - Log when typo normalization is applied

2. **Pass Freshness Parameters**: Modify calls to `bingClient.search()` and `gdeltClient.search()` to accept freshness parameters
   - Add freshness parameters to the method signature
   - Pass through to API clients

**File 6**: `backend/src/services/groundingService.ts`

**Function**: `calculateRecencyScore()`

**Specific Changes**:
1. **Adjust Recency Scoring for Historical Claims**: Modify the scoring formula to not penalize older but credible sources
   - For articles older than 30 days, use a floor score of 0.3 instead of 0.0
   - For articles older than 1 year, use a floor score of 0.2 instead of 0.0
   - This ensures historical sources still contribute to relevance scoring

2. **Add Historical Claim Detection**: Create a heuristic to detect if a claim is historical
   - Check for past-tense verbs and historical date references
   - If historical claim detected, adjust recency weight in combined scoring


**File 7**: `backend/src/types/grounding.ts`

**Type Definitions**: Add new types for adaptive freshness

**Specific Changes**:
1. **Add FreshnessStrategy Type**: Define enum for freshness levels
   ```typescript
   export type FreshnessStrategy = '7d' | '30d' | '1y' | 'web';
   ```

2. **Extend GroundingBundle Type**: Add metadata fields for adaptive freshness
   ```typescript
   freshnessStrategy?: FreshnessStrategy;
   retryCount?: number;
   typoNormalizationApplied?: boolean;
   ```

3. **Add AdaptiveFreshnessOptions Type**: Configuration for adaptive retrieval
   ```typescript
   export interface AdaptiveFreshnessOptions {
     maxRetries: number;
     timeoutBudgetMs: number;
     strategies: FreshnessStrategy[];
   }
   ```

**File 8**: `backend/src/utils/traceCollector.ts`

**Function**: Add trace events for adaptive freshness

**Specific Changes**:
1. **Add Freshness Strategy Event**: Log when freshness strategy changes
   - Event type: `freshness_strategy_change`
   - Include: previous strategy, new strategy, reason for change

2. **Add Typo Normalization Event**: Log when typo normalization is applied
   - Event type: `typo_normalization_applied`
   - Include: original claim, normalized claim, entities detected

3. **Add Retry Attempt Event**: Log each retry attempt in adaptive freshness
   - Event type: `adaptive_freshness_retry`
   - Include: retry count, freshness level, elapsed time

4. **Add Success Event**: Log which strategy succeeded
   - Event type: `adaptive_freshness_success`
   - Include: successful strategy, total retries, sources found

### Implementation Pseudocode

**Adaptive Freshness Strategy:**
```
FUNCTION tryProvidersWithAdaptiveFreshness(query, requestId, demoMode)
  INPUT: query (string), requestId (string), demoMode (boolean)
  OUTPUT: GroundingBundle
  
  IF demoMode THEN
    RETURN tryProviders(query, requestId, '7d')  // Original behavior
  END IF
  
  startTime := currentTime()
  timeoutBudget := 5000ms
  strategies := ['7d', '30d', '1y']
  errors := []
  
  FOR EACH strategy IN strategies DO
    elapsedTime := currentTime() - startTime
    
    IF elapsedTime >= timeoutBudget THEN
      LOG "Timeout budget exceeded, stopping adaptive freshness"
      BREAK
    END IF
    
    remainingTime := timeoutBudget - elapsedTime
    attemptTimeout := MIN(3500ms, remainingTime)
    
    LOG "Attempting freshness strategy: " + strategy
    
    bundle := tryProvidersWithFreshness(query, requestId, strategy, attemptTimeout)
    
    IF bundle.sources.length > 0 THEN
      LOG "Adaptive freshness succeeded with strategy: " + strategy
      bundle.freshnessStrategy := strategy
      bundle.retryCount := indexOf(strategy, strategies)
      RETURN bundle
    END IF
    
    errors.APPEND("Strategy " + strategy + " returned zero results")
  END FOR
  
  LOG "All adaptive freshness strategies exhausted"
  RETURN emptyBundle(errors)
END FUNCTION

FUNCTION tryProvidersWithFreshness(query, requestId, strategy, timeout)
  INPUT: query (string), requestId (string), strategy (FreshnessStrategy), timeout (number)
  OUTPUT: GroundingBundle
  
  // Map strategy to provider-specific parameters
  bingFreshness := mapStrategyToBing(strategy)  // '7d' -> 'Week', '30d' -> 'Month', '1y' -> 'Year'
  gdeltTimespan := mapStrategyToGDELT(strategy) // '7d' -> '7d', '30d' -> '30d', '1y' -> '365d'
  
  // Try Bing with freshness parameter
  IF bingClient EXISTS THEN
    articles := bingClient.search(query, { freshness: bingFreshness, timeout: timeout })
    IF articles.length > 0 THEN
      RETURN createBundle(articles, 'bing', strategy)
    END IF
  END IF
  
  // Try GDELT with timespan parameter
  articles := gdeltClient.search(query, { timespan: gdeltTimespan, timeout: timeout })
  IF articles.length > 0 THEN
    RETURN createBundle(articles, 'gdelt', strategy)
  END IF
  
  RETURN emptyBundle()
END FUNCTION
```

**Typo-Tolerant Normalization:**
```
FUNCTION normalizeClaimWithTypoTolerance(claim)
  INPUT: claim (string)
  OUTPUT: normalized claim (string)
  
  // Step 1: Basic normalization
  normalized := normalizeClaimForCache(claim)
  
  // Step 2: Extract potential entity names (capitalized words)
  entities := extractPotentialEntities(normalized)
  
  // Step 3: Normalize each entity
  FOR EACH entity IN entities DO
    normalizedEntity := normalizeEntityName(entity)
    IF normalizedEntity != entity THEN
      normalized := REPLACE(normalized, entity, normalizedEntity)
      LOG "Typo normalization applied: " + entity + " -> " + normalizedEntity
    END IF
  END FOR
  
  RETURN normalized
END FUNCTION

FUNCTION normalizeEntityName(entity)
  INPUT: entity (string)
  OUTPUT: normalized entity (string)
  
  // Dictionary of common historical figures and places
  knownEntities := [
    "Ronald Reagan",
    "World War II",
    "United States",
    // ... more entries
  ]
  
  // Find closest match using Levenshtein distance
  bestMatch := entity
  minDistance := INFINITY
  
  FOR EACH known IN knownEntities DO
    distance := levenshteinDistance(entity, known)
    
    // If distance is small (1-2 characters), consider it a typo
    IF distance <= 2 AND distance < minDistance THEN
      minDistance := distance
      bestMatch := known
    END IF
  END FOR
  
  RETURN bestMatch
END FUNCTION

FUNCTION levenshteinDistance(str1, str2)
  INPUT: str1 (string), str2 (string)
  OUTPUT: distance (number)
  
  // Standard Levenshtein distance algorithm
  // Returns minimum number of single-character edits (insertions, deletions, substitutions)
  // Implementation omitted for brevity
END FUNCTION
```


## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code (exploratory testing), then verify the fix works correctly and preserves existing behavior (fix checking and preservation checking).

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that submit historical claims to the UNFIXED grounding service and assert that empty evidence is returned. Run these tests to observe failures and understand the root cause.

**Test Cases**:
1. **Historical Figure Death Test**: Submit "Ronald Reagan is dead" to unfixed system
   - Expected on unfixed code: Returns empty evidence array, verdict "Unverified"
   - Confirms: Freshness bias prevents retrieval of historical sources

2. **Historical Event Test**: Submit "World War II ended in 1945" to unfixed system
   - Expected on unfixed code: Returns empty evidence array, verdict "Unverified"
   - Confirms: Very old events (79 years) have no sources within 7-day window

3. **Typo Test**: Submit "Ronald Regan is dead" (misspelled) to unfixed system
   - Expected on unfixed code: Returns empty evidence array, verdict "Unverified"
   - Confirms: No typo tolerance in claim normalization

4. **Historical Conspiracy Test**: Submit "The moon landing was faked" to unfixed system
   - Expected on unfixed code: Returns empty evidence array, verdict "Unverified"
   - Confirms: Even recent debunking articles may be older than 7 days

**Expected Counterexamples**:
- All historical claims return empty evidence with 7-day freshness
- Typo variations return different results than correct spellings
- Possible causes confirmed: hardcoded freshness, no typo tolerance, no fallback strategy

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (historical claims), the fixed function produces the expected behavior (returns credible evidence).

**Pseudocode:**
```
FOR ALL claim WHERE isHistoricalClaim(claim) AND hasWellDocumentedEvidence(claim) DO
  bundle := groundingService_fixed.ground(claim)
  ASSERT bundle.sources.length > 0
  ASSERT bundle.freshnessStrategy IN ['30d', '1y']
  ASSERT bundle.sources[0].credibilityTier IN [1, 2]
END FOR
```

**Test Cases**:
1. **Historical Figure Death - Fixed**: Submit "Ronald Reagan is dead" to fixed system
   - Expected: Returns evidence array with obituaries/biographical articles
   - Expected: Verdict "Supported"
   - Expected: `freshnessStrategy` is '30d' or '1y'
   - Expected: Sources have credibilityTier 1 or 2

2. **Historical Event - Fixed**: Submit "World War II ended in 1945" to fixed system
   - Expected: Returns evidence array with historical sources
   - Expected: Verdict "Supported"
   - Expected: `freshnessStrategy` is '1y'

3. **Typo Tolerance - Fixed**: Submit "Ronald Regan is dead" to fixed system
   - Expected: Returns same evidence as "Ronald Reagan is dead"
   - Expected: `typoNormalizationApplied` is true
   - Expected: Trace shows normalization from "Regan" to "Reagan"

4. **Historical Conspiracy - Fixed**: Submit "The moon landing was faked" to fixed system
   - Expected: Returns evidence array with both supporting and contradicting sources
   - Expected: Verdict "Disputed"
   - Expected: Sources include historical debunking articles

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (recent news, demo mode), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL claim WHERE NOT isHistoricalClaim(claim) DO
  bundle_original := groundingService_original.ground(claim)
  bundle_fixed := groundingService_fixed.ground(claim)
  ASSERT bundle_original.sources.length == bundle_fixed.sources.length
  ASSERT bundle_original.providerUsed == bundle_fixed.providerUsed
  ASSERT bundle_original.latencyMs ≈ bundle_fixed.latencyMs (within 10%)
END FOR

FOR ALL demoModeClaim IN demoExamples DO
  bundle_original := groundingService_original.ground(demoModeClaim, demoMode=true)
  bundle_fixed := groundingService_fixed.ground(demoModeClaim, demoMode=true)
  ASSERT bundle_original == bundle_fixed  // Exact equality for demo mode
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for recent news and demo mode, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Recent News Preservation**: Submit recent breaking news claim (within 7 days) to both systems
   - Observe on unfixed code: Returns evidence with 7-day freshness
   - Test on fixed code: Returns identical evidence with same freshness strategy
   - Assert: `freshnessStrategy` is '7d' (no retry needed)
   - Assert: Latency is similar (no extra overhead)

2. **Demo Mode Preservation**: Submit all demo example claims with demoMode=true
   - Observe on unfixed code: Returns deterministic demo bundles
   - Test on fixed code: Returns identical demo bundles
   - Assert: No adaptive freshness applied
   - Assert: No typo normalization applied
   - Assert: Exact equality of results

3. **Empty Evidence Preservation**: Submit claim with genuinely no evidence available
   - Observe on unfixed code: Returns empty evidence array after trying 7-day freshness
   - Test on fixed code: Returns empty evidence array after trying all strategies
   - Assert: Still returns "Unverified" when no evidence exists
   - Assert: Errors array contains all attempted strategies

4. **Performance Budget Preservation**: Submit any claim and measure latency
   - Observe on unfixed code: Completes within 5 seconds
   - Test on fixed code: Completes within 5 seconds
   - Assert: Total latency < 5000ms
   - Assert: Timeout budget management prevents cascading delays

### Unit Tests

- Test adaptive freshness strategy with mocked API responses (empty → empty → success)
- Test typo normalization with various spelling variations (Levenshtein distance 1-2)
- Test fallback strategy cascading (7d → 30d → 1y)
- Test timeout budget management (short-circuit when approaching 5s)
- Test demo mode short-circuit (skip adaptive freshness)
- Test recency scoring adjustments (floor scores for old articles)
- Test freshness parameter mapping (strategy → Bing/GDELT parameters)

### Property-Based Tests

- Generate random historical claims and verify adaptive freshness succeeds
- Generate random typo variations and verify normalization produces consistent results
- Generate random recent claims and verify 7-day freshness is used (no retry)
- Generate random demo mode claims and verify deterministic results
- Test that all claims complete within 5-second budget across many scenarios

### Integration Tests

- Test full flow: historical claim → adaptive freshness → evidence retrieval → verdict
- Test full flow: typo claim → normalization → evidence retrieval → verdict
- Test full flow: recent claim → 7-day freshness → evidence retrieval → verdict (no retry)
- Test full flow: demo mode claim → deterministic bundle → verdict (no adaptive logic)
- Test trace collection: verify all adaptive freshness events are logged
- Test cache interaction: verify adaptive freshness results are cached correctly


## Performance Considerations

### Latency Impact

**Adaptive Freshness Adds Latency**: Each retry attempt adds API call latency (up to 3.5 seconds per attempt). With 3 strategies (7d, 30d, 1y), worst-case latency could be 10.5 seconds without mitigation.

**Mitigation Strategies**:
1. **Timeout Budget Management**: Track cumulative elapsed time and short-circuit if approaching 5-second budget
2. **Reduced Timeout for Later Attempts**: First attempt gets 3.5s, second gets 2s, third gets 1s (if time remains)
3. **Short-Circuit on Success**: If first attempt (7d) succeeds, no additional latency is incurred
4. **Parallel Retry (Future Enhancement)**: Could try multiple freshness levels in parallel, but increases API costs

**Expected Latency Distribution**:
- Recent news (7d succeeds): 0.5-2s (no change from current)
- Historical claims (30d succeeds): 2-4s (one retry)
- Very old claims (1y succeeds): 4-5s (two retries)
- No evidence available: 5s (timeout budget exhausted)

### Caching Strategy

**Cache Key Considerations**: Typo normalization changes the cache key, which could reduce cache hit rate initially but improves over time as normalized keys converge.

**Cache Effectiveness**:
- Original system: "Ronald Reagan" and "Ronald Regan" have separate cache entries
- Fixed system: Both normalize to "Ronald Reagan", share same cache entry
- Result: Higher cache hit rate for typo variations, lower storage overhead

**Cache TTL**: Existing 15-minute TTL (900 seconds) is appropriate for both recent and historical claims. Historical evidence doesn't change frequently, so caching is effective.

### API Cost Impact

**Increased API Calls**: Adaptive freshness increases API calls for historical claims (up to 3x for worst case). However:
- Recent news (majority of traffic) has no increase (7d succeeds immediately)
- Historical claims are likely a minority of total traffic
- Cache hit rate reduces repeated API calls for same historical claims

**Cost Mitigation**:
- Aggressive caching for historical claims (consider longer TTL for old events)
- Monitor API usage and adjust retry strategy if costs become prohibitive
- Consider feature flag to disable adaptive freshness if needed

### Memory and CPU Impact

**Typo Normalization**: Levenshtein distance calculation is O(n*m) where n and m are string lengths. For entity names (typically 10-30 characters), this is negligible.

**Entity Dictionary**: Small in-memory dictionary of common historical figures/places (100-1000 entries) has minimal memory footprint (<100KB).

**Trace Collection**: Additional trace events for adaptive freshness add minimal overhead (JSON serialization of small objects).

## Deployment Strategy

### Feature Flag

Deploy behind feature flag `ADAPTIVE_FRESHNESS_ENABLED` for gradual rollout:
- Phase 1: Enable for 10% of production traffic, monitor latency and success rate
- Phase 2: Enable for 50% of production traffic, validate no regressions
- Phase 3: Enable for 100% of production traffic

### Monitoring Metrics

**Success Metrics**:
- Historical claim evidence retrieval rate (target: >80% for well-documented claims)
- Freshness strategy distribution (7d vs 30d vs 1y)
- Typo normalization application rate
- Cache hit rate improvement

**Performance Metrics**:
- P50, P95, P99 latency for historical claims
- Timeout budget exhaustion rate
- API call count increase
- Cache hit rate

**Quality Metrics**:
- Verdict distribution for historical claims (Supported/Disputed vs Unverified)
- Source credibility tier distribution
- User feedback on historical claim results

### Rollback Plan

If issues are detected:
1. Disable feature flag `ADAPTIVE_FRESHNESS_ENABLED`
2. System reverts to original 7-day freshness behavior
3. Investigate issues in staging environment
4. Fix and redeploy with feature flag disabled
5. Re-enable feature flag after validation

### A/B Testing

Run A/B test to measure improvement:
- Control group: Original system (7-day freshness only)
- Treatment group: Fixed system (adaptive freshness + typo tolerance)
- Metrics: Evidence retrieval rate, user satisfaction, latency

**Hypothesis**: Treatment group will show >50% improvement in evidence retrieval rate for historical claims with <20% latency increase.

## Alternative Approaches Considered

### Alternative 1: Historical Knowledge Base

**Approach**: Maintain a separate knowledge base of historical facts with pre-verified evidence sources.

**Pros**:
- No API latency for known historical claims
- Guaranteed high-quality sources
- No freshness bias

**Cons**:
- Requires manual curation and maintenance
- Limited coverage (can't handle all historical claims)
- Stale data if not regularly updated
- High operational overhead

**Decision**: Rejected due to maintenance burden and limited scalability.

### Alternative 2: Semantic Search with Embeddings

**Approach**: Use semantic embeddings to find similar claims in cache, even with typos or paraphrasing.

**Pros**:
- Handles typos and paraphrasing automatically
- No need for entity dictionary
- More robust than Levenshtein distance

**Cons**:
- Requires embedding model (additional latency and cost)
- More complex implementation
- Harder to debug and explain

**Decision**: Deferred to future enhancement. Current Levenshtein approach is simpler and sufficient for common typos.

### Alternative 3: Web Search Fallback

**Approach**: If news APIs return empty, fall back to general web search (Bing Web Search API).

**Pros**:
- Broader coverage than news-only search
- Can find historical sources not in news databases

**Cons**:
- Web search results may be lower quality (blogs, forums, etc.)
- Requires additional API integration and cost
- May return irrelevant results

**Decision**: Considered for future enhancement. Current adaptive freshness with news APIs should handle most historical claims. If evidence retrieval rate is still low after this fix, web search fallback can be added.

