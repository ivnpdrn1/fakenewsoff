# Implementation Plan: Provider Failure Detail Propagation Fix

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Provider Failure Details Lost During Propagation
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate provider failure details are lost in pipeline layer
  - **Scoped PBT Approach**: Scope the property to concrete failing case - orchestration with provider failures
  - Test that when `pipelineState.providerFailureDetails` contains failure entries, the returned `retrievalStatus.providerFailureDetails` is empty (Bug Condition from design)
  - Create mock `pipelineState` with 2 provider failures (mediastack quota_exceeded, gdelt rate_limit)
  - Call `iterativeOrchestrationPipeline.execute()` with the mock state
  - Assert that `result.retrievalStatus.providerFailureDetails` is empty array (current buggy behavior)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexample: "Pipeline layer omits providerFailureDetails from retrievalStatus despite pipelineState containing 2 failure entries"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.2, 1.3, 2.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Multi-Query Orchestration Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for successful orchestration (no provider failures)
  - Test Case 1: Verify orchestration_method_used = "multiQuery" is preserved
  - Test Case 2: Verify ground_method_used = "groundTextOnly" is preserved
  - Test Case 3: Verify queries_count = 6 is preserved
  - Test Case 4: Verify sourcesCount > 0 when providers succeed
  - Test Case 5: Verify retrievalStatus.mode, status, source fields are unchanged
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for provider failure detail propagation

  - [x] 3.1 Add providerFailureDetails field to retrievalStatus object
    - File: `backend/src/orchestration/iterativeOrchestrationPipeline.ts`
    - Location: Around line 365, in the return statement
    - Add single line: `providerFailureDetails: pipelineState.providerFailureDetails,`
    - This propagates failure details from orchestrator to lambda response
    - _Bug_Condition: isBugCondition(X) where X.providerFailures.length > 0_
    - _Expected_Behavior: result.retrievalStatus.providerFailureDetails.length > 0 when providers fail_
    - _Preservation: Multi-query orchestration path continues to use orchestration_method_used = "multiQuery", queries_count = 6, and sourcesCount > 0 when providers succeed_
    - _Requirements: 1.2, 1.3, 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 Add PROVIDER_FAILURE_DETAILS_PROPAGATED log
    - File: `backend/src/orchestration/iterativeOrchestrationPipeline.ts`
    - Location: After line 370, before the return statement
    - Add conditional log when providerFailureDetails array is non-empty
    - Log entry_count and unique provider names
    - Add both structured log (logs array) and logger.info call
    - _Requirements: 2.6_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Provider Failure Details Propagated
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - Update test assertion to verify `result.retrievalStatus.providerFailureDetails.length === 2`
    - Verify each failure detail contains: provider, query, reason, stage, rawCount, normalizedCount, acceptedCount, errorMessage
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Multi-Query Orchestration Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Add integration tests for end-to-end propagation

  - [x] 4.1 Write integration test for lambda response construction
    - File: `backend/src/lambda.test.ts` (or new integration test file)
    - Mock orchestration result with providerFailureDetails
    - Verify both `retrieval_status.providerFailureDetails` and `_debug_fix_v4.provider_failure_details` are populated
    - Verify failure details include all required fields
    - _Requirements: 2.3, 2.4_

  - [x] 4.2 Write integration test for orchestrator failure capture
    - File: `backend/src/orchestration/evidenceOrchestrator.test.ts` (or new test file)
    - Mock provider failures in staged execution
    - Verify `state.providerFailureDetails` contains correct entries
    - Verify failure reasons match expected values (rate_limit, quota_exceeded, etc.)
    - _Requirements: 2.4_

- [-] 5. Optional: Add claim-level cache for resilience

  - [ ] 5.1 Implement claim cache functions
    - File: `backend/src/services/groundingCache.ts`
    - Add `getCachedClaimResult()` function with 5-minute TTL
    - Add `setCachedClaimResult()` function
    - Add `normalizeClaimForCache()` helper
    - Use Map-based cache with timestamp tracking
    - _Note: This is an optional enhancement for reducing repeated provider attempts_

  - [ ] 5.2 Integrate claim cache in groundTextOnly
    - File: `backend/src/services/groundingService.ts`
    - Check cache before executing queries
    - Store result in cache after successful grounding
    - Add cache hit logging
    - _Note: This is an optional enhancement_

- [x] 6. Checkpoint - Ensure all tests pass and verify production behavior
  - Run full test suite: `npm test`
  - Build backend: `npm run build`
  - Deploy to AWS: `sam build && sam deploy --no-confirm-changeset`
  - Test with live claim: "Russia Ukraine war latest news"
  - Verify `provider_failure_details` is non-empty if providers fail
  - Search logs for "PROVIDER_FAILURE_DETAILS_PROPAGATED"
  - Verify no regression in multi-query orchestration (queries_count = 6, orchestration_method_used = "multiQuery")
  - Ask user if questions arise
