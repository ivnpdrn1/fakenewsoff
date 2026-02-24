# Backend Test Failures Fix - Bugfix Design

## Overview

This bugfix addresses three critical test failures in the FakeNewsOff backend:

1. **llmJson parsing bug**: The `parseStrictJson` function loses required fields (like `request_id`) when extracting JSON surrounded by prose, causing property test failures
2. **fetchService timeout test hang**: The timeout test hangs due to improper fake timer handling with `jest.advanceTimersByTime()` instead of async `jest.advanceTimersByTimeAsync()`
3. **Test-unsafe logging**: Both `llmJson.ts` and `fetchService.ts` log to console during tests, causing "Cannot log after tests are done" errors

The fix will preserve all production logging behavior while making tests reliable and deterministic. The approach follows the test-safe logging pattern established in `cacheService.ts`.

## Glossary

- **Bug_Condition (C)**: The conditions that trigger the bugs - JSON extraction losing fields, timer advancement blocking, and async console logging
- **Property (P)**: The desired behavior - complete JSON parsing, non-blocking timer tests, and buffered test logging
- **Preservation**: Production logging behavior, cache logic, fetch logic, and JSON repair semantics that must remain unchanged
- **parseStrictJson**: The function in `backend/src/utils/llmJson.ts` that parses LLM JSON responses with repair and fallback mechanisms
- **repairJsonResponse**: The helper function that extracts JSON from markdown/prose and repairs trailing commas
- **fetchFullText**: The function in `backend/src/services/fetchService.ts` that fetches and extracts article text with timeout handling
- **logRepairSuccess / logParseFallback**: Logging functions in llmJson.ts that write to console
- **logFetchMetrics / logCacheHit**: Logging functions in fetchService.ts that write to console
- **Fake Timers**: Jest's timer mocking system that requires async advancement for promises to resolve

## Bug Details

### Fault Condition

The bugs manifest in three distinct scenarios:

**Bug 1: JSON Field Loss**
The bug occurs when `parseStrictJson` receives JSON surrounded by prose (prefix and suffix text). The `repairJsonResponse` function extracts the JSON substring correctly, but the extraction logic uses `substring(start, end + 1)` which may truncate the JSON if nested braces exist in string values, causing required fields to be lost during parsing.

**Formal Specification:**
```
FUNCTION isBugCondition_JsonParsing(input)
  INPUT: input of type string
  OUTPUT: boolean
  
  RETURN input contains valid JSON object
         AND input has prose text before first '{'
         AND input has prose text after last '}'
         AND JSON contains required field 'request_id'
         AND parseStrictJson(input).data.request_id is undefined
END FUNCTION
```

**Bug 2: Timer Test Hang**
The bug occurs when the fetchService timeout test uses `jest.advanceTimersByTime()` (synchronous) instead of `jest.advanceTimersByTimeAsync()` (asynchronous). The synchronous version advances timers but doesn't allow pending promises to resolve, causing the test to hang indefinitely.

**Formal Specification:**
```
FUNCTION isBugCondition_TimerHang(testContext)
  INPUT: testContext containing timer state
  OUTPUT: boolean
  
  RETURN testContext.useFakeTimers is true
         AND testContext.hasPendingPromises is true
         AND testContext.timerAdvancement is 'synchronous'
         AND testContext.testTimeout < testContext.expectedDuration
END FUNCTION
```

**Bug 3: Async Logging**
The bug occurs when llmJson or fetchService log events to console during test execution. Since logging happens asynchronously (after test completion), Jest reports "Cannot log after tests are done" errors.

**Formal Specification:**
```
FUNCTION isBugCondition_AsyncLogging(executionContext)
  INPUT: executionContext containing environment and logging state
  OUTPUT: boolean
  
  RETURN executionContext.NODE_ENV === 'test'
         AND executionContext.loggingTarget === 'console'
         AND executionContext.testPhase === 'teardown'
END FUNCTION
```

### Examples

**Bug 1 Examples:**
- Input: `"Here is the result:\n{\"request_id\": \"abc-123\", \"status\": \"ok\"}\nEnd of analysis."`
  - Expected: `request_id` field is preserved
  - Actual: `request_id` becomes undefined after parsing

- Input: `"Analysis:\n{\"request_id\": \"xyz-789\", \"confidence_score\": 85}\nDone."`
  - Expected: Both fields preserved
  - Actual: `request_id` lost, only `confidence_score` remains

**Bug 2 Examples:**
- Test: "should timeout after 8000ms"
  - Expected: Test completes in <1 second with fake timers
  - Actual: Test hangs indefinitely, Jest kills worker after 60 seconds

**Bug 3 Examples:**
- Test: llmJson property test with 50 runs
  - Expected: No console errors
  - Actual: "Cannot log after tests are done" error from `logRepairSuccess`

- Test: fetchService cache hit test
  - Expected: Clean test completion
  - Actual: "Cannot log after tests are done" error from `logCacheHit`

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Production logging must continue to write to console for audit trail (NODE_ENV !== 'test')
- JSON repair logic must continue to handle markdown code blocks, trailing commas, and prose extraction
- Fallback response structure must remain unchanged (status_label: "Unverified", confidence_score: 30, etc.)
- fetchService cache logic must continue to work (LRU eviction, TTL expiration, cache hits/misses)
- fetchService timeout behavior must remain 8000ms in production
- fetchService HTML size limits must remain 2MB
- fetchService paywall detection must continue to work

**Scope:**
All inputs that do NOT involve test execution (NODE_ENV !== 'test') should be completely unaffected by this fix. This includes:
- Production API requests with LLM JSON responses
- Production article fetching with caching
- Production logging for monitoring and debugging
- All existing error handling and fallback mechanisms

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

### Bug 1: JSON Field Loss

1. **Incorrect Substring Extraction**: The `repairJsonResponse` function uses `substring(start, end + 1)` where `start = firstBrace` and `end = lastBrace`. However, if the JSON contains nested braces in string values (e.g., `"code": "function() { return {}; }"`), the `lastIndexOf('}')` may find an inner brace instead of the outermost closing brace, truncating the JSON prematurely.

2. **No Schema Validation After Repair**: After successfully repairing and parsing JSON, the function returns `{ success: true, data: parsed }` without validating that required fields are present. If the repair truncated the JSON, required fields may be missing but the function still reports success.

3. **Greedy Extraction Logic**: The extraction prefers objects over arrays but doesn't validate that the extracted substring is a complete, well-formed JSON object before attempting to parse it.

### Bug 2: Timer Test Hang

1. **Synchronous Timer Advancement**: The test uses `jest.advanceTimersByTime(8000)` which is synchronous. This advances the timer but doesn't yield control to the event loop, preventing the AbortController's timeout callback from executing and the fetch promise from rejecting.

2. **Missing Async/Await**: The test doesn't await the timer advancement, so the promise chain never resolves. The correct approach is `await jest.advanceTimersByTimeAsync(8000)` which advances timers AND processes the microtask queue.

3. **Insufficient Test Timeout**: Jest's default timeout is 5000ms, but the test expects to simulate 8000ms of fake time. If the test hangs, it will exceed the default timeout.

4. **Missing Timer Cleanup**: The test doesn't restore real timers in an `afterEach` hook, potentially causing timer state to leak between tests.

### Bug 3: Async Logging

1. **Direct Console Logging in Test Mode**: Both `llmJson.ts` and `fetchService.ts` call `console.log()` directly without checking `NODE_ENV`. This causes async logging that may complete after test teardown.

2. **No Test Event Buffer**: Unlike `cacheService.ts` which has `testEventBuffer` and `logCacheEvent()` helper, the other services don't have a test-safe logging mechanism.

3. **Missing Test Accessors**: There are no `__getTestEvents()` or `__resetTestEvents()` functions to allow tests to inspect logged events without triggering async console writes.

## Correctness Properties

Property 1: Fault Condition - JSON Field Preservation

_For any_ input where JSON is surrounded by prose and contains required fields (like `request_id`), the fixed `parseStrictJson` function SHALL extract the complete JSON object and preserve all required fields, ensuring `request_id` and other fields remain accessible after parsing.

**Validates: Requirements 2.1, 2.2**

Property 2: Fault Condition - Non-Blocking Timer Tests

_For any_ test that uses fake timers and advances time to trigger timeouts, the fixed test SHALL use `jest.advanceTimersByTimeAsync()` to allow promises to resolve, complete within the test timeout, and clean up timers properly in `afterEach`.

**Validates: Requirements 2.3, 2.4**

Property 3: Fault Condition - Test-Safe Logging

_For any_ logging call in llmJson or fetchService when `NODE_ENV === 'test'`, the fixed code SHALL buffer log events in memory instead of writing to console, preventing "Cannot log after tests are done" errors.

**Validates: Requirements 2.5, 2.6**

Property 4: Preservation - Production Logging Unchanged

_For any_ logging call when `NODE_ENV !== 'test'`, the fixed code SHALL produce exactly the same console output as the original code, preserving the audit trail for production monitoring.

**Validates: Requirements 3.5, 3.6**

Property 5: Preservation - JSON Repair Semantics

_For any_ input that does NOT trigger the field loss bug (valid JSON without prose, markdown-wrapped JSON, JSON with trailing commas), the fixed `parseStrictJson` SHALL produce exactly the same result as the original function, preserving all existing repair and fallback behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

Property 6: Preservation - Fetch Service Behavior

_For any_ fetch request in production, the fixed `fetchService` SHALL produce exactly the same result as the original (cache hits, timeouts, size limits, paywall detection), preserving all existing functionality.

**Validates: Requirements 3.7, 3.8, 3.9**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

#### File 1: `backend/src/utils/llmJson.ts`

**Function**: `repairJsonResponse`

**Specific Changes**:
1. **Improve JSON Extraction Logic**: Replace the simple `lastIndexOf('}')` approach with a proper brace-matching algorithm that counts opening and closing braces to find the true end of the JSON object
   - Start from `firstBrace` position
   - Track brace depth (increment for '{', decrement for '}')
   - When depth returns to 0, that's the true closing brace
   - This handles nested objects and braces in string values correctly

2. **Add Schema Validation After Repair**: After successfully parsing repaired JSON, validate that required fields are present before returning success
   - Check for `request_id` field existence
   - If missing, continue to fallback instead of returning incomplete data
   - This ensures the function never returns `success: true` with missing required fields

**Function**: `logRepairSuccess` and `logParseFallback`

**Specific Changes**:
3. **Implement Test-Safe Logging**: Replace direct `console.log()` calls with a conditional logging helper
   - Add `testEventBuffer: any[] = []` at module level
   - Create `logJsonEvent(event: any)` helper that checks `process.env.NODE_ENV === 'test'`
   - If test mode: push to buffer, else: console.log
   - Export `__getTestEvents()` and `__resetTestEvents()` for test access

4. **Update Logging Call Sites**: Replace `console.log(JSON.stringify(logData))` with `logJsonEvent(logData)` in both logging functions

#### File 2: `backend/src/services/fetchService.ts`

**Function**: `logFetchMetrics` and `logCacheHit`

**Specific Changes**:
5. **Implement Test-Safe Logging**: Add the same pattern as llmJson
   - Add `testEventBuffer: any[] = []` at module level
   - Create `logFetchEvent(event: any)` helper that checks `process.env.NODE_ENV === 'test'`
   - If test mode: push to buffer, else: console.log
   - Export `__getTestEvents()` and `__resetTestEvents()` for test access

6. **Update Logging Call Sites**: Replace `console.log(JSON.stringify(logData))` with `logFetchEvent(logData)` in both logging functions

#### File 3: `backend/src/services/fetchService.test.ts`

**Test**: "Timeout handling - should timeout after 8000ms"

**Specific Changes**:
7. **Use Async Timer Advancement**: Replace `jest.advanceTimersByTime(8000)` with `await jest.advanceTimersByTimeAsync(8000)`
   - This allows the AbortController timeout to fire and promises to resolve
   - Ensures the test doesn't hang

8. **Add Timer Cleanup**: Add `afterEach` hook to restore real timers
   - Call `jest.useRealTimers()` in `afterEach` to prevent timer state leakage
   - This ensures each test starts with clean timer state

9. **Increase Test Timeout**: Add `jest.setTimeout(10000)` or use test-level timeout
   - Ensures the test has enough time to complete even if something goes wrong
   - Prevents Jest from killing the worker prematurely

10. **Fix Timer Restoration**: Move `jest.useRealTimers()` from inside the test to `afterEach`
    - Current code calls it at the end of the test, but if the test fails, it never runs
    - `afterEach` ensures cleanup happens even on test failure

#### File 4: `backend/src/services/fetchService.test.ts` (cache tests)

**Tests**: "LRU cache behavior - should return cached result on cache hit"

**Specific Changes**:
11. **Update Console Spy Assertions**: Since logging now goes to buffer in test mode, update tests to use `__getTestEvents()` instead of spying on console.log
    - Remove `jest.spyOn(console, 'log')` 
    - Import `__getTestEvents` and `__resetTestEvents`
    - Call `__resetTestEvents()` in `beforeEach`
    - Assert on `__getTestEvents()` array contents instead of console spy

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Run existing failing tests on UNFIXED code to observe failures and understand the root cause. Use fast-check seed/path to reproduce exact failures.

**Test Cases**:
1. **JSON Field Loss Test**: Run `npm test -- llmJson.property.test.ts` on unfixed code
   - Expected failure: Property test "should handle JSON with prose before and after" fails
   - Counterexample: fast-check will provide seed and path showing exact input that loses `request_id`
   - Reproduction: Use `fc.assert(..., { seed: <seed>, path: "<path>" })` to reproduce exact failure

2. **Timer Hang Test**: Run `npm test -- fetchService.test.ts -t "timeout"` on unfixed code
   - Expected failure: Test hangs and Jest kills worker after 60 seconds
   - Counterexample: "A worker process has failed to exit gracefully" error message
   - Reproduction: Run test with `--verbose` to see hanging promise

3. **Async Logging Test**: Run `npm test` on unfixed code
   - Expected failure: "Cannot log after tests are done" errors in test output
   - Counterexample: Error messages showing which logging functions are called after teardown
   - Reproduction: Run tests multiple times to trigger async timing issues

**Expected Counterexamples**:
- JSON parsing: `request_id` field becomes undefined after parsing JSON with prose
- Timer test: Test hangs indefinitely, never resolves
- Logging: Console errors about logging after test completion

**Root Cause Confirmation**:
- If JSON extraction uses `lastIndexOf('}')` and fails on nested braces, hypothesis confirmed
- If timer test uses synchronous `advanceTimersByTime`, hypothesis confirmed
- If logging calls `console.log` directly in test mode, hypothesis confirmed

### Fix Checking

**Goal**: Verify that for all inputs where the bug conditions hold, the fixed functions produce the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition_JsonParsing(input) DO
  result := parseStrictJson_fixed(input)
  ASSERT result.success === true
  ASSERT result.data.request_id !== undefined
  ASSERT result.data.request_id === originalValue
END FOR

FOR ALL testContext WHERE isBugCondition_TimerHang(testContext) DO
  testResult := runTimeoutTest_fixed(testContext)
  ASSERT testResult.completed === true
  ASSERT testResult.duration < 5000  // Completes quickly with fake timers
  ASSERT testResult.warnings.includes('Request timeout')
END FOR

FOR ALL executionContext WHERE isBugCondition_AsyncLogging(executionContext) DO
  testResult := runTestWithLogging_fixed(executionContext)
  ASSERT testResult.consoleErrors.length === 0
  ASSERT testResult.testEvents.length > 0  // Events buffered, not logged
END FOR
```

**Test Plan**:
1. Run property test with fast-check seed that previously failed - should now pass
2. Run timeout test - should complete in <1 second
3. Run all tests - should have no "Cannot log after tests are done" errors

### Preservation Checking

**Goal**: Verify that for all inputs where the bug conditions do NOT hold, the fixed functions produce the same results as the original functions.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition_JsonParsing(input) DO
  ASSERT parseStrictJson_original(input) = parseStrictJson_fixed(input)
END FOR

FOR ALL request WHERE NOT isBugCondition_AsyncLogging(request) DO
  // In production mode, logging should be identical
  ASSERT fetchFullText_original(request).logs = fetchFullText_fixed(request).logs
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for non-buggy inputs, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Valid JSON Preservation**: Verify that valid JSON without prose parses identically
   - Input: `{"request_id": "abc", "status": "ok"}`
   - Expected: Same result before and after fix

2. **Markdown JSON Preservation**: Verify that markdown-wrapped JSON parses identically
   - Input: ` ```json\n{"request_id": "abc"}\n``` `
   - Expected: Same result before and after fix

3. **Trailing Comma Preservation**: Verify that JSON with trailing commas repairs identically
   - Input: `{"request_id": "abc", "value": 42,}`
   - Expected: Same result before and after fix

4. **Fallback Preservation**: Verify that completely malformed input returns same fallback
   - Input: `"This is not JSON at all"`
   - Expected: Same fallback response before and after fix

5. **Production Logging Preservation**: Verify that production logging is unchanged
   - Set `NODE_ENV=production`
   - Run fetch and parse operations
   - Verify console output is identical to unfixed version

6. **Cache Behavior Preservation**: Verify that cache hits, misses, and eviction work identically
   - Test cache hit returns same result
   - Test cache miss fetches same content
   - Test TTL expiration works same way

### Unit Tests

- Test brace-matching algorithm with nested objects and string values containing braces
- Test schema validation after repair catches missing required fields
- Test async timer advancement resolves promises correctly
- Test timer cleanup in afterEach prevents state leakage
- Test event buffer captures logs in test mode
- Test console logging works in production mode
- Test `__getTestEvents()` and `__resetTestEvents()` accessors

### Property-Based Tests

- Generate random JSON objects with prose wrappers and verify all fields preserved
- Generate random JSON with nested structures and verify complete extraction
- Generate random valid JSON inputs and verify identical parsing before/after fix
- Generate random malformed inputs and verify identical fallback before/after fix
- Generate random fetch scenarios and verify identical cache behavior before/after fix

### Integration Tests

- Run full test suite with `npm test` and verify all tests pass
- Run tests multiple times to verify no async logging errors
- Test production deployment with real LLM responses and verify logging works
- Test production fetch service with real URLs and verify caching works
- Verify no performance regression in JSON parsing or fetch operations

### Reproduction Instructions

**Bug 1: JSON Field Loss**
```bash
# Run property test to get failing seed/path
npm test -- llmJson.property.test.ts

# Output will show:
# Property failed after X tests
# Seed: 1234567890
# Path: "0:1:2:3"
# Counterexample: { prefix: "Here is:", suffix: "Done.", response: {...} }

# Reproduce exact failure:
# Edit test to add: { seed: 1234567890, path: "0:1:2:3" }
```

**Bug 2: Timer Hang**
```bash
# Run timeout test (will hang for 60 seconds)
npm test -- fetchService.test.ts -t "timeout"

# Output will show:
# A worker process has failed to exit gracefully and has been force exited.
```

**Bug 3: Async Logging**
```bash
# Run all tests
npm test

# Output will show:
# Cannot log after tests are done. Did you forget to wait for something async?
# console.log
#   at logRepairSuccess (src/utils/llmJson.ts:XX:XX)
```
