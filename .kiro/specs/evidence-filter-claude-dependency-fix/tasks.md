# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Claude Override Causes Evidence Rejection
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases: CLAUDE_MODEL_ID set with valid evidence candidates
  - Test that when CLAUDE_MODEL_ID is set, evidenceFilter invokes Claude and rejects all evidence (from Bug Condition in design)
  - Test implementation details:
    - Set `process.env.CLAUDE_MODEL_ID = 'anthropic.claude-3-haiku-20240307-v1:0'`
    - Create 9 valid evidence candidates (mix of Mediastack, GDELT, Serper sources)
    - Call evidenceFilter on these candidates
    - Assert that model invocation fails with authorization error
    - Assert that all candidates are rejected (passed=false)
    - Assert that final sourcesCount = 0
  - The test assertions should match the Expected Behavior Properties from design:
    - After fix: NOVA model should be used (not Claude)
    - After fix: Pass-through fallback should preserve evidence
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found:
    - Evidence filter invokes Claude 3 Haiku instead of NOVA
    - All evidence candidates rejected due to "Model use case details have not been submitted"
    - Final response has sourcesCount=0 despite providers retrieving sources
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Filtering Logic Unchanged for Normal Operations
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (when CLAUDE_MODEL_ID is NOT set and NOVA is functioning)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - Generic page rejection: homepage, category, tag, search, unavailable pages are rejected
    - Low quality rejection: evidence with composite score < 0.6 is rejected with "LOW_RELEVANCE"
    - Unrelated content rejection: unrelated content is rejected with "UNRELATED"
    - High quality pass: relevant evidence with score >= 0.6 passes with quality scores
    - Provider logic: Mediastack, GDELT, Serper retrieval works correctly
    - Demo mode: Demo mode bypasses NOVA and uses deterministic responses
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [-] 3. Fix for Evidence Filter Claude Dependency

  - [x] 3.1 Change model selection in novaClient.ts
    - Open `backend/src/services/novaClient.ts`
    - Navigate to line 73 where BEDROCK_MODEL_ID is defined
    - Replace `process.env.CLAUDE_MODEL_ID` with `process.env.NOVA_MODEL_ID`
    - Before: `const BEDROCK_MODEL_ID = process.env.CLAUDE_MODEL_ID || 'amazon.nova-lite-v1:0';`
    - After: `const BEDROCK_MODEL_ID = process.env.NOVA_MODEL_ID || 'amazon.nova-lite-v1:0';`
    - This ensures Claude cannot override NOVA for evidence filtering operations
    - _Bug_Condition: isBugCondition(input) where input.CLAUDE_MODEL_ID IS_SET_
    - _Expected_Behavior: evidenceFilter uses amazon.nova-lite-v1:0 regardless of CLAUDE_MODEL_ID_
    - _Preservation: All other NOVA client functions remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.6_

  - [x] 3.2 Add pass-through fallback in evidenceFilter.ts
    - Open `backend/src/orchestration/evidenceFilter.ts`
    - Navigate to `filterSingle()` function (lines 125-175)
    - Wrap entire filter logic in try-catch block
    - On error, return pass-through result:
      ```typescript
      {
        passed: true,
        reason: undefined,
        scores: {
          relevance: 0.7,
          credibility: 0.7,
          freshness: 0.7,
          composite: 0.7
        }
      }
      ```
    - Update neutral score values in `scoreQuality()` catch block from 0.5 to 0.7
    - This ensures pass-through candidates pass the 0.6 threshold
    - _Bug_Condition: Model invocation fails for any reason_
    - _Expected_Behavior: Evidence preserved with neutral scores (0.7) in pass-through mode_
    - _Preservation: Existing rejection logic for generic pages, low quality, unrelated content unchanged_
    - _Requirements: 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.3 Add diagnostic logging
    - In evidenceFilter.ts catch block, add logging:
      - `EVIDENCE_FILTER_MODEL_ERROR` with error details
      - `EVIDENCE_FILTER_PASS_THROUGH_FALLBACK` when falling back
      - `EVIDENCE_FILTER_CANDIDATE_PRESERVED` for each preserved candidate
    - This provides visibility into model failures and fallback behavior
    - _Expected_Behavior: Diagnostic events logged to CloudWatch_
    - _Requirements: 2.7_

  - [x] 3.4 Update envValidation.ts (optional)
    - Open `backend/src/utils/envValidation.ts`
    - Add `NOVA_MODEL_ID` to environment variable schema
    - Add as optional string with default `amazon.nova-lite-v1:0`
    - Add comment explaining it's for NOVA model selection
    - This improves documentation but is not critical for the fix
    - _Requirements: 2.6_

  - [ ] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - NOVA Model Selection and Pass-Through
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify that:
      - NOVA model is used (not Claude) even when CLAUDE_MODEL_ID is set
      - Pass-through fallback preserves evidence when model fails
      - sourcesCount > 0 for valid evidence candidates
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Filtering Logic Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix:
      - Generic page rejection still works
      - Low quality rejection still works
      - Unrelated content rejection still works
      - High quality evidence still passes
      - Provider logic unchanged
      - Demo mode unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ] 4. Integration Testing

  - [ ] 4.1 Test full orchestration with CLAUDE_MODEL_ID set
    - Set `process.env.CLAUDE_MODEL_ID` in test environment
    - Simulate full orchestration pipeline with "Ukraine war" claim
    - Mock providers to return 9 sources (6 Mediastack, 3 Serper)
    - Assert that NOVA is used for evidence filtering (not Claude)
    - Assert that sourcesCount > 0 in final response
    - Assert that sources array is not empty
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 4.2 Test NOVA failure scenario
    - Mock NOVA invocation to fail with network error
    - Simulate orchestration pipeline with valid evidence
    - Assert that pass-through fallback is used
    - Assert that evidence is preserved with 0.7 scores
    - Assert that diagnostic logs contain EVIDENCE_FILTER_PASS_THROUGH_FALLBACK
    - _Requirements: 2.4, 2.5, 2.7_

  - [ ] 4.3 Test production scenario simulation
    - Use real providers (Mediastack, Serper) with "Ukraine war" query
    - Ensure CLAUDE_MODEL_ID is NOT set (normal production mode)
    - Assert that NOVA is used for evidence filtering
    - Assert that sourcesCount > 0
    - Assert that evidence graph can render
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

- [x] 5. Build and Deploy

  - [x] 5.1 Build backend
    - Run `cd backend && npm run build`
    - Verify no TypeScript errors
    - Verify all tests pass

  - [x] 5.2 Deploy to Lambda
    - Run `sam build`
    - Run `sam deploy --no-confirm-changeset`
    - Verify deployment succeeds

  - [x] 5.3 Verify Lambda configuration
    - Run: `aws lambda get-function-configuration --function-name fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe --query 'Environment.Variables' --output json`
    - Verify CLAUDE_MODEL_ID is NOT set (or is ignored)
    - Verify NOVA_MODEL_ID is set to `amazon.nova-lite-v1:0` (or uses default)

  - [x] 5.4 Live verification test
    - Run: `curl -X POST https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/analyze -H "Content-Type: application/json" -d '{"claim":"Ukraine war"}' | jq '.text_grounding.sourcesCount, .text_grounding.sources | length'`
    - Assert that sourcesCount > 0
    - Assert that sources array length > 0
    - Verify evidence is visible in response

  - [x] 5.5 Check CloudWatch logs
    - Run: `aws logs tail /aws/lambda/fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe --follow`
    - Filter for: EVIDENCE_FILTER_MODEL_ERROR, EVIDENCE_FILTER_PASS_THROUGH_FALLBACK, EVIDENCE_FILTER_CANDIDATE_PRESERVED
    - Verify diagnostic logging is working
    - Verify no unexpected errors

- [ ] 6. Checkpoint - Ensure all tests pass
  - Run full test suite: `npm test`
  - Verify all unit tests pass
  - Verify all property-based tests pass
  - Verify all integration tests pass
  - Verify live production query returns evidence
  - Ask the user if questions arise
