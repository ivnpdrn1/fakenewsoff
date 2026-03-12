# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Historical Claims Return Empty Evidence
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Test well-documented historical claims (Reagan death, WWII end date) that should have evidence but return empty results with 7-day freshness
  - Test that historical claims return empty evidence array with current 7-day freshness (from Bug Condition in design)
  - Test cases: "Ronald Reagan is dead", "World War II ended in 1945", "The moon landing was faked"
  - The test assertions should match the Expected Behavior Properties from design (evidence.length > 0, verdict != "Unverified")
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause (empty evidence arrays, "Unverified" verdicts)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.3, 2.4, 2.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Recent News and Demo Mode Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (recent news within 7 days, demo mode claims)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Test 1: Recent breaking news claims use 7-day freshness and return results (no retry)
  - Test 2: Demo mode claims return deterministic results without adaptive freshness
  - Test 3: Claims with no evidence return "Unverified" after trying all strategies
  - Test 4: All claims complete within 5-second performance budget
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.5, 3.6_

- [x] 3. Fix for historical claims evidence retrieval

  - [x] 3.1 Add adaptive freshness types and configuration
    - Add `FreshnessStrategy` type: `'7d' | '30d' | '1y' | 'web'` to `backend/src/types/grounding.ts`
    - Extend `GroundingBundle` type with `freshnessStrategy?: FreshnessStrategy`, `retryCount?: number`, `typoNormalizationApplied?: boolean`
    - Add `AdaptiveFreshnessOptions` interface with `maxRetries`, `timeoutBudgetMs`, `strategies` fields
    - _Bug_Condition: isBugCondition(input) where isHistoricalClaim(input.claim) AND hasWellDocumentedEvidence(input.claim) AND currentSystem.retrieveEvidence(input.claim).length == 0_
    - _Expected_Behavior: Historical claims return credible evidence with freshnessStrategy in ['30d', '1y']_
    - _Preservation: Type changes are additive, no breaking changes to existing types_
    - _Requirements: 2.1, 2.3, 2.4, 2.5_

  - [x] 3.2 Add freshness logging to API clients
    - Add freshness parameter logging to `backend/src/clients/bingNewsClient.ts` search() method (line 58)
    - Add timespan parameter logging to `backend/src/clients/gdeltClient.ts` search() method (line 58)
    - Log values used in each request for trace visibility
    - _Bug_Condition: Hardcoded freshness parameters prevent historical evidence retrieval_
    - _Expected_Behavior: Freshness parameters are logged for debugging and trace collection_
    - _Preservation: No functional changes, only logging additions_
    - _Requirements: 2.1, 2.3_

  - [x] 3.3 Implement typo-tolerant entity name normalization
    - Add `normalizeEntityName()` function to `backend/src/utils/claimNormalizer.ts`
    - Implement Levenshtein distance calculation for fuzzy matching
    - Create dictionary of common historical figures and places (Ronald Reagan, World War II, etc.)
    - Add `normalizeClaimWithTypoTolerance()` function that combines basic normalization with entity normalization
    - Preserve existing `normalizeClaimForCache()` function unchanged
    - _Bug_Condition: No typo tolerance causes "Ronald Regan" to return different results than "Ronald Reagan"_
    - _Expected_Behavior: Typo variations normalize to correct entity names and return same evidence_
    - _Preservation: Existing normalization function unchanged, new function is additive_
    - _Requirements: 2.2_

  - [x] 3.4 Add trace events for adaptive freshness
    - Add `freshness_strategy_change` event to `backend/src/utils/traceCollector.ts`
    - Add `typo_normalization_applied` event with original and normalized claims
    - Add `adaptive_freshness_retry` event with retry count and elapsed time
    - Add `adaptive_freshness_success` event with successful strategy and sources found
    - _Bug_Condition: No visibility into freshness strategy decisions_
    - _Expected_Behavior: All adaptive freshness decisions are logged in trace for explainability_
    - _Preservation: Trace collection is additive, no changes to existing events_
    - _Requirements: 2.1, 2.3, 2.4_

  - [x] 3.5 Implement adaptive freshness strategy in groundingService
    - Add `tryProvidersWithAdaptiveFreshness()` method to `backend/src/services/groundingService.ts`
    - Implement cascading retrieval: 7d → 30d → 1y with timeout budget management
    - Add demo mode short-circuit (skip adaptive freshness in demo mode)
    - Track elapsed time and short-circuit if approaching 5-second budget
    - Add `tryProvidersWithFreshness()` helper that accepts freshness parameters
    - Map freshness strategy to provider-specific parameters (Bing: Week/Month/Year, GDELT: 7d/30d/365d)
    - Log freshness strategy changes and retry attempts
    - Return bundle with `freshnessStrategy` and `retryCount` metadata
    - _Bug_Condition: No fallback strategy when 7-day freshness returns empty results_
    - _Expected_Behavior: System retries with broader time windows (30d, 1y) until evidence found_
    - _Preservation: Demo mode bypasses adaptive freshness, uses original 7-day behavior_
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 3.1, 3.2, 3.5_

  - [x] 3.6 Integrate typo normalization into ground() method
    - Modify `ground()` method in `backend/src/services/groundingService.ts`
    - Apply `normalizeClaimWithTypoTolerance()` before query extraction
    - Only apply in production mode (skip in demo mode)
    - Log when typo normalization is applied
    - Set `typoNormalizationApplied` flag in bundle metadata
    - _Bug_Condition: Typo variations return different results than correct spellings_
    - _Expected_Behavior: Typos are normalized before retrieval, return same evidence as correct spelling_
    - _Preservation: Demo mode skips typo normalization, preserves deterministic behavior_
    - _Requirements: 2.2, 3.2_

  - [x] 3.7 Adjust recency scoring for historical sources
    - Modify `calculateRecencyScore()` in `backend/src/services/groundingService.ts` (line 442)
    - For articles older than 30 days, use floor score of 0.3 instead of 0.0
    - For articles older than 1 year, use floor score of 0.2 instead of 0.0
    - Add historical claim detection heuristic (past-tense verbs, historical dates)
    - Adjust recency weight in combined scoring for historical claims
    - _Bug_Condition: Recency scoring penalizes credible historical sources with score 0.0_
    - _Expected_Behavior: Historical sources receive floor scores (0.2-0.3) to contribute to relevance_
    - _Preservation: Recent news scoring unchanged, only affects articles older than 30 days_
    - _Requirements: 2.1, 2.5, 3.6_

  - [x] 3.8 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Historical Claims Return Evidence
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - Verify historical claims now return evidence arrays with credible sources
    - Verify verdicts are "Supported" or "Disputed" instead of "Unverified"
    - Verify `freshnessStrategy` is '30d' or '1y' for historical claims
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.3, 2.4, 2.5_

  - [x] 3.9 Verify preservation tests still pass
    - **Property 2: Preservation** - Recent News and Demo Mode Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - Verify recent news claims still use 7-day freshness (no retry)
    - Verify demo mode claims return identical deterministic results
    - Verify performance budget is maintained (< 5 seconds)
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.5, 3.6_

- [ ] 4. Add comprehensive unit tests
  - Test adaptive freshness strategy with mocked API responses (empty → empty → success)
  - Test typo normalization with various spelling variations (Levenshtein distance 1-2)
  - Test fallback strategy cascading (7d → 30d → 1y)
  - Test timeout budget management (short-circuit when approaching 5s)
  - Test demo mode short-circuit (skip adaptive freshness)
  - Test recency scoring adjustments (floor scores for old articles)
  - Test freshness parameter mapping (strategy → Bing/GDELT parameters)
  - Test trace event collection for all adaptive freshness events
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.5_

- [ ] 5. Add integration tests for full flow
  - Test full flow: historical claim → adaptive freshness → evidence retrieval → verdict
  - Test full flow: typo claim → normalization → evidence retrieval → verdict
  - Test full flow: recent claim → 7-day freshness → evidence retrieval → verdict (no retry)
  - Test full flow: demo mode claim → deterministic bundle → verdict (no adaptive logic)
  - Test trace collection: verify all adaptive freshness events are logged
  - Test cache interaction: verify adaptive freshness results are cached correctly
  - Test performance: verify all flows complete within 5-second budget
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.5, 3.6_

- [ ] 6. Add feature flag and deployment configuration
  - Add `ADAPTIVE_FRESHNESS_ENABLED` feature flag to environment configuration
  - Add feature flag check in `ground()` method to enable/disable adaptive freshness
  - Default to disabled for initial deployment
  - Document gradual rollout plan: 10% → 50% → 100%
  - Add monitoring metrics configuration for success rate and latency
  - _Requirements: 2.1, 2.3, 2.4, 2.5_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Run all unit tests and verify they pass
  - Run all integration tests and verify they pass
  - Run bug condition exploration test and verify it passes (historical claims return evidence)
  - Run preservation tests and verify they pass (recent news and demo mode unchanged)
  - Verify performance budget is maintained (< 5 seconds for all claims)
  - Ask the user if questions arise
