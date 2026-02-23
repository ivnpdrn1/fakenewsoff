# Tasks: Jest/fast-check Async Leak Fix

## Phase 1: Implement Logger Wrapper

- [x] 1.1 Add logger wrapper to cacheService.ts
  - [x] 1.1.1 Add testEventBuffer array at module level
  - [x] 1.1.2 Implement logCacheEvent() function with NODE_ENV check
  - [x] 1.1.3 Export __getTestEvents() test accessor
  - [x] 1.1.4 Export __resetTestEvents() test accessor

- [x] 1.2 Replace console.log calls with logCacheEvent()
  - [x] 1.2.1 Replace console.log in checkCache() - cache_bypassed (global_disable)
  - [x] 1.2.2 Replace console.log in checkCache() - cache_bypassed (request_bypass)
  - [x] 1.2.3 Replace console.log in checkCache() - cache_miss
  - [x] 1.2.4 Replace console.log in checkCache() - cache_hit
  - [x] 1.2.5 Replace console.log in storeInCache() - cache_stored

## Phase 2: Fix Async Handling in Tests

- [x] 2.1 Fix cacheService.property.test.ts async handling
  - [x] 2.1.1 Add return to fc.assert() at line 108 (preserve all response fields)
  - [x] 2.1.2 Add return to fc.assert() at line 161 (cached=true for repeated requests)
  - [x] 2.1.3 Add return to fc.assert() at line 210 (no cached results older than 24 hours)
  - [x] 2.1.4 Add return to fc.assert() at line 244 (different hashes for different content)
  - [x] 2.1.5 Add return to fc.assert() at line 293 (same hash for same content with different imageUrl)
  - [x] 2.1.6 Add return to fc.assert() at line 339 (accurately calculate cache age)
  - [x] 2.1.7 Add return to fc.assert() at line 382 (return most recent result)
  - [x] 2.1.8 Add return to fc.assert() at line 436 (set TTL to 30 days)
  - [x] 2.1.9 Add return to fc.assert() at line 469 (bypass cache when flag set)
  - [x] 2.1.10 Add return to fc.assert() at line 497 (compute hash from all relevant fields)

- [x] 2.2 Add test event buffer reset to beforeEach hook
  - [x] 2.2.1 Import __resetTestEvents from cacheService
  - [x] 2.2.2 Call __resetTestEvents() in beforeEach hook

## Phase 3: Fix Generator Constraints

- [x] 3.1 Update analysisRequestArbitrary in cacheService.property.test.ts
  - [x] 3.1.1 Add filter to text field to exclude whitespace-only strings
  - [x] 3.1.2 Verify other string fields (title, selectedText) have appropriate constraints

## Phase 4: Add Reproducibility

- [x] 4.1 Document seed/path usage in test files
  - [x] 4.1.1 Add comment block explaining how to reproduce failures with seed
  - [x] 4.1.2 Add example fast-check configuration with seed option
  - [x] 4.1.3 Document path parameter usage for narrowing down failures

## Phase 5: Verify and Test

- [x] 5.1 Run property tests and verify no async leaks
  - [x] 5.1.1 Run cacheService.property.test.ts
  - [x] 5.1.2 Verify no "Cannot log after tests are done" errors
  - [x] 5.1.3 Verify all tests pass

- [x] 5.2 Verify production logging preserved
  - [x] 5.2.1 Create manual test or integration test for production mode
  - [x] 5.2.2 Verify console.log is called in production (NODE_ENV !== 'test')
  - [x] 5.2.3 Verify event buffer is used in test mode (NODE_ENV === 'test')

- [x] 5.3 Run full test suite
  - [x] 5.3.1 Run all tests: npm test
  - [x] 5.3.2 Verify no regressions in other test files
  - [x] 5.3.3 Verify fetchService.property.test.ts still passes (already has await)
  - [x] 5.3.4 Verify llmJson.property.test.ts still passes (synchronous properties)

## Phase 6: Documentation

- [x] 6.1 Add inline comments for logger wrapper
  - [x] 6.1.1 Document why logger wrapper is needed (test mode safety)
  - [x] 6.1.2 Document test-only accessor usage
  - [x] 6.1.3 Add JSDoc comments for exported test functions

- [x] 6.2 Update test comments for reproducibility
  - [x] 6.2.1 Add seed/path documentation to test file header
  - [x] 6.2.2 Add example of reproducing a failure with specific seed
