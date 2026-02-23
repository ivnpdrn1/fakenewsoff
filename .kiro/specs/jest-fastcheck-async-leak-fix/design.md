# Jest/fast-check Async Leak Fix - Bugfix Design

## Overview

This bugfix addresses async resource leaks in Jest property-based tests using fast-check, which cause "Cannot log after tests are done" errors. The fix involves three main changes:

1. Ensure all `fc.assert()` calls with `fc.asyncProperty` are properly awaited or returned
2. Fix mock assertions to check actual mocked functions instead of fresh `jest.fn()` instances
3. Implement a test-safe logger wrapper in cacheService.ts that suppresses console.log in test mode while preserving production audit trail logging

The approach is minimal and surgical: fix async handling in tests, correct mock assertions, and add a small logger abstraction that routes logs to an in-memory buffer during tests.

## Glossary

- **Bug_Condition (C)**: The condition that triggers async leaks - when `fc.assert()` with `fc.asyncProperty` is not awaited/returned, or when console.log executes after Jest teardown
- **Property (P)**: The desired behavior - all async operations complete before test teardown, no "Cannot log after tests are done" errors
- **Preservation**: Existing cache event logging in production must remain unchanged for audit trails
- **fc.assert()**: fast-check's assertion function that runs property-based tests
- **fc.asyncProperty**: fast-check's async property generator that returns a Promise
- **Mock Assertion Bug**: Asserting against `expect(jest.fn())` instead of the actual mocked function reference

## Bug Details

### Fault Condition

The bug manifests when property-based tests using `fc.asyncProperty` do not properly await or return the `fc.assert()` call, causing Jest to complete test execution before async operations finish. Additionally, console.log calls from cache service events execute after Jest teardown, triggering "Cannot log after tests are done" errors.

**Formal Specification:**
```
FUNCTION isBugCondition(testCode)
  INPUT: testCode of type TestFunction
  OUTPUT: boolean
  
  RETURN (testCode.contains("fc.assert") 
         AND testCode.contains("fc.asyncProperty")
         AND NOT testCode.properlyAwaitsOrReturns("fc.assert"))
         OR (testCode.executesConsoleLog 
         AND testCode.executionTime > jestTeardownTime)
         OR (testCode.assertsAgainst("jest.fn()")
         AND NOT testCode.assertsAgainst(actualMockedFunction))
END FUNCTION
```

### Examples

1. **Async Leak in cacheService.property.test.ts**:
   - Line 108: `fc.assert(fc.asyncProperty(...))` - NOT awaited or returned
   - Expected: `await fc.assert(fc.asyncProperty(...))` or `return fc.assert(fc.asyncProperty(...))`
   - Result: Test completes before async operations finish, causing console.log to execute after teardown

2. **Mock Assertion Bug in cacheService.property.test.ts**:
   - Line 122: `expect(dynamodb.storeAnalysisRecord).toHaveBeenCalledTimes(1)` - Correct
   - But if it were `expect(jest.fn()).toHaveBeenCalledTimes(1)` - Would fail with "Expected: 2, Received: 0"
   - Expected: Always assert against the actual mocked function reference

3. **Console.log After Teardown**:
   - cacheService.ts line 169: `console.log(JSON.stringify({event: 'cache_stored', ...}))`
   - When called from async test after Jest teardown: "Cannot log after tests are done"
   - Expected: In test mode, log to in-memory buffer instead of console

4. **Whitespace-only Input Edge Case**:
   - Generator: `fc.string({ minLength: 10, maxLength: 500 })` can produce whitespace-only strings
   - Service behavior: May short-circuit on empty/whitespace input
   - Expected: Either constrain generator to non-whitespace OR adjust expectations to handle early-return

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Cache service must continue to log events (cache_stored, cache_hit, cache_miss, cache_bypassed) in production for audit trails
- All existing cache behavior (TTL, hash computation, record retrieval) must remain unchanged
- Property test validations for serialization, cache age, bypass flags must continue to work

**Scope:**
All production code behavior should be completely unaffected by this fix. The changes are:
- Test code: Add await/return to fc.assert() calls
- Test code: Fix mock assertions to use actual mocked functions
- Production code: Add minimal logger wrapper that detects test mode and routes logs appropriately

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Missing Async Handling**: The property tests in cacheService.property.test.ts do not await or return `fc.assert()` calls when using `fc.asyncProperty`. This causes Jest to complete test execution before the async property tests finish, leading to console.log calls executing after Jest teardown.

2. **Console.log Timing**: The cacheService.ts logs events using `console.log()` which executes asynchronously. When tests complete before these logs execute, Jest throws "Cannot log after tests are done" errors.

3. **Mock Assertion Pattern**: Some tests may be asserting against `expect(jest.fn())` instead of the actual mocked function reference (e.g., `dynamodb.storeAnalysisRecord`), causing assertion failures.

4. **Generator Constraints**: Property test generators use `fc.string({ minLength: 10 })` which can produce whitespace-only strings, but test expectations may not account for service behavior on such inputs.

## Correctness Properties

Property 1: Fault Condition - Async Operations Complete Before Teardown

_For any_ property-based test using `fc.asyncProperty`, the test SHALL either await or return the `fc.assert()` call, ensuring all async operations complete before Jest test teardown, preventing "Cannot log after tests are done" errors.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Production Logging Unchanged

_For any_ cache service operation in production (NODE_ENV !== 'test'), the system SHALL continue to log cache events to console exactly as before, preserving the audit trail functionality for production monitoring.

**Validates: Requirements 3.1**

## Fix Implementation

### Changes Required

**File 1**: `backend/src/services/cacheService.ts`

**Changes**:
1. **Add Logger Wrapper**: Implement a small logger abstraction at the top of the file
   - In production: Logs to console normally
   - In test mode (NODE_ENV === 'test'): Stores events in in-memory array
   - Export test-only accessors: `__getTestEvents()` and `__resetTestEvents()`

2. **Replace console.log Calls**: Replace all 4 `console.log()` calls with `logCacheEvent()`
   - Line 60: cache_bypassed (global_disable)
   - Line 70: cache_bypassed (request_bypass)
   - Line 82: cache_miss
   - Line 99: cache_hit
   - Line 169: cache_stored

**Specific Implementation**:
```typescript
// Add at top of file after imports
let testEventBuffer: any[] = [];

function logCacheEvent(event: any): void {
  if (process.env.NODE_ENV === 'test') {
    testEventBuffer.push(event);
  } else {
    console.log(JSON.stringify(event));
  }
}

// Test-only accessors (not exported in production builds)
export function __getTestEvents(): any[] {
  return [...testEventBuffer];
}

export function __resetTestEvents(): void {
  testEventBuffer = [];
}
```

**File 2**: `backend/src/services/cacheService.property.test.ts`

**Changes**:
1. **Fix Async Handling**: Add `await` or `return` to all `fc.assert()` calls with `fc.asyncProperty`
   - Line 108: `it('should preserve all response fields...')` - Add `return` before `fc.assert`
   - Line 161: `it('should return cached=true...')` - Add `return` before `fc.assert`
   - Line 210: `it('should not return cached results...')` - Add `return` before `fc.assert`
   - Line 244: `it('should produce different hashes...')` - Add `return` before `fc.assert`
   - Line 293: `it('should produce same hash...')` - Add `return` before `fc.assert`
   - Line 339: `it('should accurately calculate cache age...')` - Add `return` before `fc.assert`
   - Line 382: `it('should return most recent result...')` - Add `return` before `fc.assert`
   - Line 436: `it('should set TTL to 30 days...')` - Add `return` before `fc.assert`
   - Line 469: `it('should bypass cache...')` - Add `return` before `fc.assert`
   - Line 497: `it('should compute hash...')` - Add `return` before `fc.assert`

2. **Add beforeEach Hook**: Reset test event buffer before each test
   ```typescript
   beforeEach(() => {
     jest.clearAllMocks();
     __resetTestEvents(); // Add this line
     delete process.env.CACHE_DISABLE;
   });
   ```

3. **Fix Generator Constraints**: Update `analysisRequestArbitrary` to constrain text fields
   - Change `fc.string({ minLength: 10, maxLength: 500 })` to filter whitespace-only:
   ```typescript
   text: fc.string({ minLength: 10, maxLength: 500 }).filter(s => s.trim().length > 0)
   ```

4. **Add Reproducibility**: Add fast-check configuration with seed documentation
   - Add to each test: `{ numRuns: 50, seed: 42, path: "0:0:0" }` (example)
   - Add comment documenting how to reproduce failures

**File 3**: `backend/src/services/fetchService.property.test.ts`

**Changes**:
1. **Verify Async Handling**: Confirm all `fc.assert()` calls are already awaited
   - Line 34: Already has `await fc.assert()` ✓
   - Line 130: Already has `await fc.assert()` ✓
   - Line 182: Already has `await fc.assert()` ✓
   - Line 221: Already has `await fc.assert()` ✓
   - Line 268: Already has `await fc.assert()` ✓
   - No changes needed for this file

**File 4**: `backend/src/utils/llmJson.property.test.ts`

**Changes**:
1. **Fix Async Handling**: These tests use synchronous properties, but verify they don't need async
   - All tests use `fc.property` (not `fc.asyncProperty`) - No changes needed
   - Tests are synchronous JSON parsing - Correct as-is

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, verify the bugs exist on unfixed code by observing test failures and console errors, then verify the fix resolves all issues without breaking existing functionality.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm the root cause analysis by observing "Cannot log after tests are done" errors and async timing issues.

**Test Plan**: Run the existing property tests on UNFIXED code and observe failures. Document the specific error messages and timing issues.

**Test Cases**:
1. **Async Leak Test**: Run `cacheService.property.test.ts` and observe "Cannot log after tests are done" errors (will fail on unfixed code)
2. **Mock Assertion Test**: If mock assertions use `jest.fn()`, observe "Expected: 2, Received: 0" errors (may fail on unfixed code)
3. **Whitespace Input Test**: Run tests with whitespace-only strings and observe expectation mismatches (may fail on unfixed code)

**Expected Counterexamples**:
- Jest error: "Cannot log after tests are done. Did you forget to wait for something async in your test?"
- Console output: "Attempted to log {event:'cache_stored', ...} after test completed"
- Possible causes: Missing await on fc.assert(), console.log executing after teardown

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed code produces the expected behavior.

**Pseudocode:**
```
FOR ALL propertyTest WHERE usesAsyncProperty(propertyTest) DO
  result := runTest_fixed(propertyTest)
  ASSERT result.completesBeforeTeardown = true
  ASSERT result.noConsoleErrors = true
  ASSERT result.allAsyncOperationsComplete = true
END FOR
```

**Test Plan**:
1. Run all property tests after fix
2. Verify no "Cannot log after tests are done" errors
3. Verify all tests pass with proper async handling
4. Verify test event buffer captures logs in test mode
5. Verify production logging still works (manual verification or integration test)

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same result as the original code.

**Pseudocode:**
```
FOR ALL cacheOperation WHERE inProductionMode(cacheOperation) DO
  ASSERT cacheService_original(operation) = cacheService_fixed(operation)
  ASSERT consoleLogOutput_original = consoleLogOutput_fixed
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because it generates many test cases automatically and catches edge cases that manual tests might miss.

**Test Plan**: 
1. Verify cache behavior unchanged: Run all existing property tests and confirm they still pass
2. Verify production logging unchanged: Create a test that sets NODE_ENV to production and verifies console.log is called
3. Verify test logging buffered: Create a test that verifies events are captured in test mode

**Test Cases**:
1. **Cache Behavior Preservation**: All 10 existing property tests should pass with identical behavior
2. **Production Logging Preservation**: Verify console.log is called in production mode (NODE_ENV !== 'test')
3. **Test Logging Buffered**: Verify __getTestEvents() returns logged events in test mode
4. **Mock Assertions Preservation**: Verify all mock assertions still work correctly

### Unit Tests

- Test logger wrapper in isolation: verify it logs to console in production, buffers in test mode
- Test each async property test individually to ensure proper await/return
- Test generator constraints: verify text fields don't produce whitespace-only strings
- Test mock assertions: verify they check actual mocked functions

### Property-Based Tests

- All existing property tests should continue to pass after fix
- Add reproducibility: document seed/path usage for failed test reproduction
- Add test for logger wrapper: generate random events and verify buffering in test mode
- Add test for whitespace handling: generate edge case inputs and verify service behavior

### Integration Tests

- Run full test suite and verify no "Cannot log after tests are done" errors
- Verify cache service works correctly in production mode with console logging
- Verify cache service works correctly in test mode with event buffering
- Test seed-based reproduction: use documented seed to reproduce a specific test case
