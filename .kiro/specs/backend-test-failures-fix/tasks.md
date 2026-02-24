# Implementation Plan

- [x] 1. Write bug condition exploration tests
  - **Property 1: Fault Condition** - Test Failures on Unfixed Code
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior - they will validate the fix when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  
  - [x] 1.1 Run llmJson property test on unfixed code
    - Run `npm test -- llmJson.property.test.ts` to observe JSON field loss
    - Test should FAIL showing `request_id` becomes undefined after parsing JSON with prose
    - Document the fast-check seed and path from the failure output
    - Verify the bug condition: JSON surrounded by prose loses required fields
    - _Requirements: 1.1, 1.2_
  
  - [x] 1.2 Run fetchService timeout test on unfixed code
    - Run `npm test -- fetchService.test.ts -t "timeout"` to observe test hang
    - Test should HANG and Jest should kill worker after 60 seconds
    - Document the "worker process has failed to exit gracefully" error
    - Verify the bug condition: synchronous timer advancement blocks promise resolution
    - _Requirements: 1.3, 1.4_
  
  - [x] 1.3 Run all tests to observe async logging errors
    - Run `npm test` to observe "Cannot log after tests are done" errors
    - Document which logging functions (logRepairSuccess, logParseFallback, logFetchMetrics, logCacheHit) trigger errors
    - Verify the bug condition: console.log called after test teardown
    - _Requirements: 1.5, 1.6_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Buggy Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  
  - [x] 2.1 Test valid JSON parsing preservation
    - Observe: `parseStrictJson('{"request_id": "abc", "status": "ok"}')` on unfixed code
    - Write property-based test: for all valid JSON without prose, parsing result is identical
    - Verify test passes on UNFIXED code
    - _Requirements: 3.1_
  
  - [x] 2.2 Test malformed input fallback preservation
    - Observe: `parseStrictJson('This is not JSON')` returns fallback on unfixed code
    - Write property-based test: for all malformed input, fallback response is identical
    - Verify test passes on UNFIXED code
    - _Requirements: 3.2_
  
  - [x] 2.3 Test markdown JSON extraction preservation
    - Observe: `parseStrictJson('```json\n{"request_id": "abc"}\n```')` on unfixed code
    - Write property-based test: for all markdown-wrapped JSON, extraction is identical
    - Verify test passes on UNFIXED code
    - _Requirements: 3.3_
  
  - [x] 2.4 Test trailing comma repair preservation
    - Observe: `parseStrictJson('{"request_id": "abc", "value": 42,}')` on unfixed code
    - Write property-based test: for all JSON with trailing commas, repair is identical
    - Verify test passes on UNFIXED code
    - _Requirements: 3.4_
  
  - [x] 2.5 Test production logging preservation
    - Observe: Set NODE_ENV=production and run llmJson/fetchService operations
    - Verify console output format and content on unfixed code
    - Write test: for all operations in production mode, console output is identical
    - Verify test passes on UNFIXED code
    - _Requirements: 3.5, 3.6_
  
  - [x] 2.6 Test cache behavior preservation
    - Observe: fetchService cache hits, misses, TTL expiration on unfixed code
    - Write property-based test: for all cache operations, behavior is identical
    - Verify test passes on UNFIXED code
    - _Requirements: 3.7, 3.8, 3.9_

- [x] 3. Phase 1 — Test-safe logging

  - [x] 3.1 Add test-safe logging to llmJson.ts
    - Add `testEventBuffer: any[] = []` at module level
    - Create `logJsonEvent(event: any)` helper that checks `process.env.NODE_ENV === 'test'`
    - If test mode: push to buffer, else: console.log(JSON.stringify(event))
    - Export `__getTestEvents()` and `__resetTestEvents()` functions
    - Replace `console.log(JSON.stringify(logData))` with `logJsonEvent(logData)` in logRepairSuccess and logParseFallback
    - _Bug_Condition: isBugCondition_AsyncLogging(executionContext) where NODE_ENV === 'test' AND loggingTarget === 'console'_
    - _Expected_Behavior: Buffer events in test mode, console.log in production mode_
    - _Preservation: Production logging behavior unchanged (Requirements 3.6)_
    - _Requirements: 1.5, 2.5, 3.6_
  
  - [x] 3.2 Add test-safe logging to fetchService.ts
    - Add `testEventBuffer: any[] = []` at module level
    - Create `logFetchEvent(event: any)` helper that checks `process.env.NODE_ENV === 'test'`
    - If test mode: push to buffer, else: console.log(JSON.stringify(event))
    - Export `__getTestEvents()` and `__resetTestEvents()` functions
    - Replace `console.log(JSON.stringify(logData))` with `logFetchEvent(logData)` in logFetchMetrics and logCacheHit
    - _Bug_Condition: isBugCondition_AsyncLogging(executionContext) where NODE_ENV === 'test' AND loggingTarget === 'console'_
    - _Expected_Behavior: Buffer events in test mode, console.log in production mode_
    - _Preservation: Production logging behavior unchanged (Requirements 3.5)_
    - _Requirements: 1.6, 2.6, 3.5_
  
  - [x] 3.3 Run llmJson tests to verify logging fix
    - Run `npm test -- llmJson` (smallest relevant test file)
    - Verify no "Cannot log after tests are done" errors
    - Verify tests can access events via `__getTestEvents()`
    - **EXPECTED OUTCOME**: Async logging errors eliminated for llmJson

  - [x] 3.4 Run fetchService tests to verify logging fix
    - Run `npm test -- fetchService.test.ts` (smallest relevant test file)
    - Verify no "Cannot log after tests are done" errors
    - Verify tests can access events via `__getTestEvents()`
    - **EXPECTED OUTCOME**: Async logging errors eliminated for fetchService

- [x] 4. Phase 2 — llmJson parsing correctness

  - [x] 4.1 Implement brace-matching JSON extraction
    - In `repairJsonResponse`, replace `lastIndexOf('}')` with proper brace-matching algorithm
    - Start from `firstBrace` position and track brace depth
    - Increment depth for '{', decrement for '}', handle string escapes
    - When depth returns to 0, that's the true closing brace
    - Extract substring from `firstBrace` to true closing brace
    - _Bug_Condition: isBugCondition_JsonParsing(input) where JSON has prose AND nested braces_
    - _Expected_Behavior: Extract first complete JSON object preserving all fields_
    - _Preservation: Valid JSON, markdown JSON, trailing comma repair unchanged (Requirements 3.1, 3.3, 3.4)_
    - _Requirements: 1.1, 2.1, 3.1, 3.3, 3.4_
  
  - [x] 4.2 Add schema validation after repair
    - After successfully parsing repaired JSON, check for required fields (request_id)
    - If required fields missing, continue to fallback instead of returning incomplete data
    - Only return `success: true` if schema validation passes
    - _Bug_Condition: isBugCondition_JsonParsing(input) where repair succeeds but schema validation fails_
    - _Expected_Behavior: Return fallback when required fields missing_
    - _Preservation: Malformed input fallback unchanged (Requirements 3.2)_
    - _Requirements: 1.2, 2.2, 3.2_
  
  - [x] 4.3 Update llmJson.property.test.ts if needed
    - Review property test "should handle JSON with prose before and after"
    - Ensure test matches intended behavior (request_id must be present)
    - Do NOT weaken the property - only update if test logic is incorrect
    - If test is correct, no changes needed
    - _Requirements: 2.1, 2.2_
  
  - [x] 4.4 Run llmJson property test to verify fix
    - Run `npm test -- llmJson.property.test.ts` (smallest relevant test file)
    - Use fast-check seed from step 1.1 to reproduce exact failure case
    - **EXPECTED OUTCOME**: Property test now PASSES (confirms bug is fixed)
    - Verify `request_id` field is preserved in all test cases
    - _Requirements: 2.1, 2.2_

- [x] 5. Phase 3 — fetchService timeout test stability

  - [x] 5.1 Fix timeout test timer handling
    - Replace `jest.advanceTimersByTime(8000)` with `await jest.advanceTimersByTimeAsync(8000)`
    - This allows AbortController timeout to fire and promises to resolve
    - _Bug_Condition: isBugCondition_TimerHang(testContext) where timerAdvancement is 'synchronous'_
    - _Expected_Behavior: Timers advance and promises resolve without blocking_
    - _Preservation: Production timeout behavior unchanged (8000ms)_
    - _Requirements: 1.3, 2.3_
  
  - [x] 5.2 Add timer cleanup in afterEach
    - Add `afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); })`
    - Move `jest.useRealTimers()` from inside test to afterEach
    - Ensures cleanup happens even on test failure
    - _Bug_Condition: isBugCondition_TimerHang(testContext) where timer cleanup is missing_
    - _Expected_Behavior: Timers restored after each test_
    - _Preservation: No impact on production code_
    - _Requirements: 1.4, 2.4_
  
  - [x] 5.3 Increase test timeout
    - Add `jest.setTimeout(10000)` or use test-level timeout
    - Ensures test has enough time to complete even if something goes wrong
    - Prevents Jest from killing worker prematurely
    - _Bug_Condition: isBugCondition_TimerHang(testContext) where testTimeout < expectedDuration_
    - _Expected_Behavior: Test timeout > simulated time (10000ms > 8000ms)_
    - _Preservation: No impact on production code_
    - _Requirements: 1.4, 2.4_
  
  - [x] 5.4 Run fetchService timeout test to verify fix
    - Run `npm test -- fetchService.test.ts -t "timeout"` (smallest relevant test file)
    - **EXPECTED OUTCOME**: Test completes in <1 second (not 60 seconds)
    - Verify no "worker process has failed to exit gracefully" error
    - Verify test passes and timeout warning is present
    - _Requirements: 2.3, 2.4_

- [x] 6. Phase 4 — Verify all fixes

  - [x] 6.1 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - All Bugs Fixed
    - **IMPORTANT**: Re-run the SAME tests from task 1 - do NOT write new tests
    - The tests from task 1 encode the expected behavior
    - When these tests pass, it confirms the expected behavior is satisfied
    - Run `npm test -- llmJson.property.test.ts` - should PASS
    - Run `npm test -- fetchService.test.ts -t "timeout"` - should PASS
    - Run `npm test` - should have NO "Cannot log after tests are done" errors
    - **EXPECTED OUTCOME**: All tests PASS (confirms all bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [x] 6.2 Verify preservation tests still pass
    - **Property 2: Preservation** - No Regressions
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: All tests PASS (confirms no regressions)
    - Verify valid JSON parsing unchanged
    - Verify malformed input fallback unchanged
    - Verify markdown extraction unchanged
    - Verify trailing comma repair unchanged
    - Verify production logging unchanged
    - Verify cache behavior unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_
  
  - [x] 6.3 Run full test suite
    - Run `npm test` to verify all tests pass
    - Verify no async logging errors
    - Verify no timeout errors
    - Verify no worker exit failures
    - **EXPECTED OUTCOME**: All tests pass cleanly
  
  - [x] 6.4 Check for open handles
    - Run `npm test -- --detectOpenHandles` to verify no resource leaks
    - Verify no open handles reported
    - Verify timers are properly cleaned up
    - **EXPECTED OUTCOME**: No open handles detected
  
  - [x] 6.5 Summarize changes and confirm success
    - Document all changes made:
      - llmJson.ts: test-safe logging + brace-matching extraction + schema validation
      - fetchService.ts: test-safe logging
      - fetchService.test.ts: async timer advancement + cleanup + timeout increase
    - Confirm all tests pass
    - Confirm no regressions in production behavior

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
