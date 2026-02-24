# Bugfix Requirements Document

## Introduction

The FakeNewsOff backend test suite has multiple failing tests that need to be fixed while preserving production logging behavior. The issues include:

1. **llmJson property test failure**: The test "should handle JSON with prose before and after" fails because the `request_id` field becomes undefined after parsing JSON surrounded by prose
2. **fetchService timeout test hanging**: The test "Timeout handling should timeout after 8000ms" hangs and fails due to Jest's 5000ms default timeout and improper fake timer handling
3. **Test-unsafe logging**: Both `llmJson.ts` and `fetchService.ts` log to console during tests, which can cause "Cannot log after tests are done" errors

The fix must preserve all production logging behavior while making tests reliable and deterministic.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `parseStrictJson` receives JSON surrounded by prose (prefix and suffix text) THEN the system extracts JSON but loses required fields like `request_id` during parsing

1.2 WHEN `parseStrictJson` successfully repairs JSON but the result fails schema validation (missing required fields) THEN the system returns `success: true` with incomplete data instead of returning failure or fallback

1.3 WHEN the fetchService timeout test runs with fake timers THEN the system hangs because timers are not properly advanced and pending promises are not resolved

1.4 WHEN the fetchService timeout test completes THEN Jest reports "A worker process has failed to exit gracefully" due to open handles from unresolved timeouts

1.5 WHEN `llmJson.ts` logs events during test execution THEN the system writes to console after test teardown causing "Cannot log after tests are done" errors

1.6 WHEN `fetchService.ts` logs cache events during test execution THEN the system writes to console after test teardown causing "Cannot log after tests are done" errors

### Expected Behavior (Correct)

2.1 WHEN `parseStrictJson` receives JSON surrounded by prose THEN the system SHALL extract the first complete JSON object and preserve all required fields including `request_id`

2.2 WHEN `parseStrictJson` successfully repairs JSON but schema validation fails THEN the system SHALL return the controlled fallback response (not the invalid parsed data)

2.3 WHEN the fetchService timeout test runs with fake timers THEN the system SHALL properly advance timers using `jest.advanceTimersByTimeAsync()` and resolve all pending promises

2.4 WHEN the fetchService timeout test completes THEN the system SHALL clean up all timers and restore real timers to prevent worker exit failures

2.5 WHEN `llmJson.ts` runs in test mode (NODE_ENV === 'test') THEN the system SHALL buffer log events instead of writing to console

2.6 WHEN `fetchService.ts` runs in test mode (NODE_ENV === 'test') THEN the system SHALL buffer log events instead of writing to console

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `parseStrictJson` receives valid JSON without prose THEN the system SHALL CONTINUE TO parse it correctly and preserve all fields

3.2 WHEN `parseStrictJson` receives completely malformed input THEN the system SHALL CONTINUE TO return the controlled fallback response

3.3 WHEN `parseStrictJson` receives JSON with markdown code blocks THEN the system SHALL CONTINUE TO extract and parse the JSON correctly

3.4 WHEN `parseStrictJson` receives JSON with trailing commas THEN the system SHALL CONTINUE TO repair and parse it successfully

3.5 WHEN fetchService runs in production mode (NODE_ENV !== 'test') THEN the system SHALL CONTINUE TO log all events to console for audit trail

3.6 WHEN llmJson runs in production mode (NODE_ENV !== 'test') THEN the system SHALL CONTINUE TO log all events to console for audit trail

3.7 WHEN fetchService cache hits occur THEN the system SHALL CONTINUE TO return cached results without making network requests

3.8 WHEN fetchService detects paywalls or HTTP errors THEN the system SHALL CONTINUE TO add appropriate warnings to the result

3.9 WHEN fetchService receives HTML larger than 2MB THEN the system SHALL CONTINUE TO reject it with appropriate warnings
