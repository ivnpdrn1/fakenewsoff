# Bugfix Requirements Document

## Introduction

This bugfix addresses async resource leaks in Jest property-based tests using fast-check, which cause "Cannot log after tests are done" errors and incorrect mock assertion failures. The fix ensures all async operations complete before test teardown while preserving the cache event logging functionality for production audit trails.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN fast-check property tests using `fc.asyncProperty` are not awaited or returned THEN Jest completes test execution before async operations finish, causing "Cannot log after tests are done" errors

1.2 WHEN `console.log` is called from async operations after Jest test teardown THEN Jest throws "Attempted to log {event:'cache_stored', ...}" errors

1.3 WHEN mock assertions check `expect(jest.fn()).toHaveBeenCalledTimes(X)` instead of the actual mocked function THEN the test fails with "Expected number of calls: 2 Received: 0" because it's asserting against a fresh mock instance

1.4 WHEN property test generators produce whitespace-only strings for required fields THEN the test expectations don't match the actual service behavior (which may short-circuit on empty input)

1.5 WHEN property tests fail THEN there is no seed/path information to reproduce the exact failing case

### Expected Behavior (Correct)

2.1 WHEN fast-check property tests using `fc.asyncProperty` are executed THEN the test SHALL either await or return the `fc.assert()` call to ensure all async operations complete before test teardown

2.2 WHEN cache service logs events during tests THEN the system SHALL either suppress console.log in test mode or ensure logging completes before test teardown without removing the logging logic from production code

2.3 WHEN mock assertions verify function calls THEN the test SHALL assert against the actual mocked function reference (e.g., `expect(dynamodb.storeAnalysisRecord).toHaveBeenCalledTimes(X)`) not a fresh `jest.fn()` instance

2.4 WHEN property test generators create input data THEN the generators SHALL either constrain to meaningful values (e.g., non-whitespace strings) or adjust expectations to match service behavior for edge cases

2.5 WHEN property tests are configured THEN the tests SHALL include fast-check options with seed information and comments documenting how to reproduce failures

### Unchanged Behavior (Regression Prevention)

3.1 WHEN cache service stores or retrieves data in production THEN the system SHALL CONTINUE TO log cache events (cache_stored, cache_hit, cache_miss, cache_bypassed) to console for audit trails

3.2 WHEN property tests validate cache behavior THEN the tests SHALL CONTINUE TO verify all existing properties (serialization, TTL, hash computation, cache age, bypass flags)

3.3 WHEN cache service computes content hashes THEN the system SHALL CONTINUE TO exclude imageUrl from hash computation to allow caching of same text with different images

3.4 WHEN multiple cached records exist for the same content hash THEN the system SHALL CONTINUE TO return the most recent record

3.5 WHEN cache records are stored THEN the system SHALL CONTINUE TO set TTL to 30 days from storage time
