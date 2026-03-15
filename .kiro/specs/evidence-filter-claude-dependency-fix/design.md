# Evidence Filter Claude Dependency Fix + Evidence Preservation Architecture - Bugfix Design

## Overview

The evidence filter is rejecting 100% of evidence in production because the `CLAUDE_MODEL_ID` environment variable overrides the intended Amazon NOVA Lite model selection. When the system attempts to invoke Claude 3 Haiku for evidence classification and scoring, it fails with "Model use case details have not been submitted for this account", causing all evidence to be rejected despite providers successfully retrieving sources.

This fix implements a two-phase solution:

**Phase 1: NOVA Model Selection Fix (Immediate)**
1. Remove Claude precedence in model selection (change to `NOVA_MODEL_ID` environment variable)
2. Add explicit pass-through fallback when model invocation fails in evidenceFilter
3. Add diagnostic logging to track model failures and fallback behavior

**Phase 2: Comprehensive Evidence Preservation Architecture (Hardening)**
4. Implement "preserve evidence first" architecture across the entire orchestration pipeline
5. Add pass-through contracts for all AI-dependent stages after retrieval
6. Add explicit degraded-state flags in response structure
7. Add response packaging invariant checks with ERROR logging
8. Extend evidence preservation to verdict synthesis, stance classification, and contradiction search

This ensures the evidence filter always uses NOVA for production operations and gracefully degrades to pass-through mode if NOVA becomes unavailable. More importantly, it guarantees that evidence is NEVER lost if Bedrock model invocation fails at any stage, making FakeNewsOff resilient to temporary model unavailability.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when `CLAUDE_MODEL_ID` environment variable is set in Lambda, causing Claude invocation instead of NOVA
- **Property (P)**: The desired behavior - evidence filter uses Amazon NOVA Lite and falls back to pass-through mode on failure
- **Preservation**: Existing filtering logic (page type rejection, quality scoring, content verification) that must remain unchanged
- **novaClient.ts**: The service in `backend/src/services/novaClient.ts` that provides NOVA model invocation functions
- **evidenceFilter.ts**: The orchestration component in `backend/src/orchestration/evidenceFilter.ts` that filters evidence candidates
- **BEDROCK_MODEL_ID**: The constant at line 73 of novaClient.ts that determines which Bedrock model to invoke
- **Pass-through mode**: Fallback behavior where evidence is preserved with neutral quality scores (0.7) when model invocation fails
- **Evidence Preservation Invariant**: The architectural guarantee that if evidence retrieval succeeds, retrieved evidence must be preserved through response packaging even when AI model stages fail
- **Degraded State**: Operational mode where the system continues to function with reduced AI enrichment but preserved evidence when Bedrock models are unavailable
- **Pass-through Contract**: The agreement that for every AI-dependent stage after retrieval, if the stage succeeds use the enriched result, if it fails keep the original evidence and continue with degraded metadata
- **iterativeOrchestrationPipeline.ts**: The orchestration pipeline in `backend/src/orchestration/iterativeOrchestrationPipeline.ts` that coordinates multi-pass evidence retrieval and synthesis

## Bug Details

### Bug Condition

The bug manifests when the Lambda function has `CLAUDE_MODEL_ID` environment variable set, causing the system to invoke Claude 3 Haiku instead of Amazon NOVA Lite for evidence filtering operations. The Claude model is not authorized for this AWS account, resulting in 100% evidence rejection.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type EnvironmentContext
  OUTPUT: boolean
  
  RETURN input.CLAUDE_MODEL_ID IS_SET
         AND evidenceFilterInvokesModel()
         AND modelInvocationFails(error: "Model use case details have not been submitted")
         AND allEvidenceRejected()
END FUNCTION
```

### Examples

- **Example 1**: User submits claim "Ukraine war" → Mediastack retrieves 6 sources, Serper retrieves 3 sources → evidenceFilter invokes Claude 3 Haiku for page type classification → Bedrock returns "Model use case details have not been submitted" → All 9 sources rejected → Final response: `sourcesCount=0`

- **Example 2**: User submits claim "Climate change" → GDELT retrieves 5 sources → evidenceFilter invokes Claude 3 Haiku for quality scoring → Bedrock returns authorization error → All 5 sources rejected → Final response: `sourcesCount=0`

- **Example 3**: User submits claim "Election results" → Serper retrieves 4 sources → evidenceFilter invokes Claude 3 Haiku for content verification → Bedrock returns authorization error → All 4 sources rejected → Final response: `sourcesCount=0`

- **Edge Case**: If `CLAUDE_MODEL_ID` is unset, system correctly uses `amazon.nova-lite-v1:0` and evidence filtering works as expected

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Evidence filter must continue to reject generic pages (homepage, category, tag, search, unavailable) with appropriate rejection reasons
- Evidence filter must continue to reject low-quality evidence (composite score < 0.6) with "LOW_RELEVANCE" reason
- Evidence filter must continue to reject unrelated content with "UNRELATED" reason
- Evidence filter must continue to pass high-quality relevant evidence with quality scores
- When all evidence legitimately fails quality checks, system must continue to return `sourcesCount=0`
- When NOVA model is available and functioning, system must continue to use NOVA-based classification and scoring
- Provider retrieval logic must remain completely unchanged
- Demo mode behavior must remain unchanged

**Scope:**
All inputs that do NOT involve model selection or model invocation failure should be completely unaffected by this fix. This includes:
- Provider retrieval operations (Mediastack, GDELT, Serper)
- Evidence orchestration logic
- Source classification and packaging
- Demo mode operations
- Cache operations
- All other NOVA client functions (claim extraction, synthesis, label determination, etc.)

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is confirmed:

1. **Incorrect Environment Variable Precedence**: Line 73 of `novaClient.ts` uses `process.env.CLAUDE_MODEL_ID` as the primary model selection variable
   - The Lambda function has `CLAUDE_MODEL_ID` set to `anthropic.claude-3-haiku-20240307-v1:0`
   - This overrides the intended default of `amazon.nova-lite-v1:0`
   - The code was likely written for experimentation but never updated for production

2. **Model Authorization Failure**: Claude 3 Haiku is not authorized for this AWS account
   - When evidenceFilter calls `classifyEvidencePageType()`, it invokes Claude
   - Bedrock returns "Model use case details have not been submitted for this account"
   - The error propagates up and causes evidence rejection

3. **Insufficient Fallback Handling**: The current error handling in evidenceFilter catches errors but doesn't provide adequate fallback
   - `classifyPageType()` returns 'unknown' on error, which doesn't trigger rejection
   - `scoreQuality()` returns neutral scores (0.5) on error, which may fall below threshold (0.6)
   - `verifyContent()` returns `relevant: true` on error, which is correct
   - However, the neutral score of 0.5 causes rejection due to LOW_RELEVANCE

4. **Missing Diagnostic Logging**: No explicit logs indicate when model invocation fails or when pass-through mode is used
   - Difficult to diagnose in production without clear error messages
   - No visibility into which model is being invoked

## Correctness Properties

Property 1: Bug Condition - NOVA Model Selection

_For any_ evidence filtering operation where the system needs to classify page types, score quality, or verify content, the fixed novaClient SHALL use Amazon NOVA Lite (`amazon.nova-lite-v1:0`) regardless of the `CLAUDE_MODEL_ID` environment variable, ensuring evidence filtering operations always invoke the authorized model.

**Validates: Requirements 2.1, 2.2, 2.3, 2.6**

Property 2: Preservation - Pass-Through Fallback

_For any_ evidence filtering operation where NOVA model invocation fails for any reason (network error, timeout, authorization error), the fixed evidenceFilter SHALL fall back to pass-through mode with neutral quality scores (0.7) and preserve the evidence, preventing total evidence loss due to model unavailability.

**Validates: Requirements 2.4, 2.5**

Property 3: Preservation - Filtering Logic

_For any_ evidence filtering operation where NOVA model is available and functioning correctly, the fixed evidenceFilter SHALL produce exactly the same filtering decisions as the original code, preserving all existing rejection logic for generic pages, low-quality evidence, and unrelated content.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Phase 1: NOVA Model Selection Fix (Immediate)

**File 1**: `backend/src/services/novaClient.ts`

**Line**: 73

**Specific Changes**:
1. **Change Model Selection Variable**: Replace `CLAUDE_MODEL_ID` with `NOVA_MODEL_ID`
   - Before: `const BEDROCK_MODEL_ID = process.env.CLAUDE_MODEL_ID || 'amazon.nova-lite-v1:0';`
   - After: `const BEDROCK_MODEL_ID = process.env.NOVA_MODEL_ID || 'amazon.nova-lite-v1:0';`
   - This ensures Claude cannot override NOVA for evidence filtering operations

**File 2**: `backend/src/orchestration/evidenceFilter.ts`

**Function**: `filterSingle()` (lines 125-175)

**Specific Changes**:
1. **Wrap Entire Filter Logic in Try-Catch**: Add top-level error handling for model failures
   - Catch any error from `classifyPageType()`, `scoreQuality()`, or `verifyContent()`
   - On error, return pass-through result with neutral scores (0.7) and `passed: true`

2. **Add Diagnostic Logging**: Log when model invocation fails and pass-through is used
   - Log event: `EVIDENCE_FILTER_MODEL_ERROR` with error details
   - Log event: `EVIDENCE_FILTER_PASS_THROUGH_FALLBACK` when falling back
   - Log event: `EVIDENCE_FILTER_CANDIDATE_PRESERVED` for each preserved candidate

3. **Update Neutral Score Values**: Change fallback scores from 0.5 to 0.7
   - In `scoreQuality()` catch block, change all scores from 0.5 to 0.7
   - This ensures pass-through candidates pass the 0.6 threshold

**File 3**: `backend/src/utils/envValidation.ts` (Optional)

**Section**: Environment variable schema

**Specific Changes**:
1. **Add NOVA_MODEL_ID to Schema**: Document the new environment variable
   - Add `NOVA_MODEL_ID` as optional string with default `amazon.nova-lite-v1:0`
   - Add comment explaining it's for NOVA model selection
   - This is optional but improves documentation

### Phase 2: Comprehensive Evidence Preservation Architecture (Hardening)

**File 4**: `backend/src/types/orchestration.ts`

**Section**: Type definitions

**Specific Changes**:
1. **Add Degraded State Fields to RetrievalStatus**:
   ```typescript
   export interface RetrievalStatus {
     // ... existing fields ...
     degradedStages?: string[];  // List of stages that fell back to pass-through
     evidencePreserved: boolean;  // Whether evidence was preserved despite failures
     modelFailures?: Array<{
       stage: string;
       error: string;
       timestamp: string;
     }>;
   }
   ```

**File 5**: `backend/src/orchestration/iterativeOrchestrationPipeline.ts`

**Function**: `analyzeWithIterativeOrchestration()` (main orchestration function)

**Specific Changes**:
1. **Add Evidence Preservation Tracking**:
   - Track evidence count before each AI-dependent stage
   - Track evidence count after each AI-dependent stage
   - Log `EVIDENCE_PRESERVATION_CHECKPOINT` at each stage

2. **Wrap Verdict Synthesis in Try-Catch**:
   - If `synthesizeVerdict()` fails, preserve sources and return degraded verdict
   - Log `VERDICT_SYNTHESIS_FALLBACK` with error details
   - Continue with evidence intact

3. **Wrap Stance Classification in Try-Catch**:
   - If stance classification fails, preserve evidence with default stance='mentions'
   - Log `STANCE_CLASSIFICATION_FALLBACK` with error details
   - Continue with evidence intact

4. **Wrap Contradiction Search in Try-Catch**:
   - If contradiction search fails, preserve evidence without contradiction metadata
   - Log `CONTRADICTION_SEARCH_FALLBACK` with error details
   - Continue with evidence intact

5. **Add Response Packaging Invariant Check**:
   - Before packaging: Log `LIVE_SOURCES_BEFORE_PACKAGING` with count
   - After packaging: Log `LIVE_SOURCES_AFTER_PACKAGING` with count
   - If before > 0 and after = 0, log `EVIDENCE_PRESERVATION_INVARIANT_VIOLATION` as ERROR

6. **Initialize Degraded State Tracking**:
   ```typescript
   const degradedStages: string[] = [];
   const modelFailures: Array<{stage: string; error: string; timestamp: string}> = [];
   ```

7. **Populate Degraded State in retrievalStatus**:
   ```typescript
   retrievalStatus: {
     // ... existing fields ...
     degradedStages: degradedStages.length > 0 ? degradedStages : undefined,
     evidencePreserved: collectedEvidence.length > 0,
     modelFailures: modelFailures.length > 0 ? modelFailures : undefined,
   }
   ```

**File 6**: `backend/src/orchestration/sourceClassifier.ts`

**Function**: `classifyStance()` (if it exists)

**Specific Changes**:
1. **Add Try-Catch Wrapper**:
   - Wrap NOVA invocation in try-catch
   - On error, return default stance='mentions'
   - Log `STANCE_CLASSIFICATION_ERROR` with error details

**File 7**: `backend/src/orchestration/contradictionSearcher.ts`

**Function**: `searchContradictions()` (if it exists)

**Specific Changes**:
1. **Add Try-Catch Wrapper**:
   - Wrap NOVA invocation in try-catch
   - On error, return empty contradictions array
   - Log `CONTRADICTION_SEARCH_ERROR` with error details

**File 8**: `backend/src/orchestration/verdictSynthesizer.ts`

**Function**: `synthesizeVerdict()`

**Specific Changes**:
1. **Add Try-Catch Wrapper**:
   - Wrap NOVA invocation in try-catch
   - On error, return degraded verdict with classification='unverified' and preserved evidence
   - Log `VERDICT_SYNTHESIS_ERROR` with error details
   - Ensure `bestEvidence` field contains the original evidence

### Evidence Preservation Policy

**Rule**: Retrieval success > Model scoring

This means:
- If providers return evidence, that evidence MUST reach the final response
- Model failures (filter, stance, verdict, contradiction) can degrade metadata but CANNOT remove evidence
- Only explicit business rules (deduplication, domain diversity) can remove evidence
- Pass-through mode is preferred over evidence loss

### Response Packaging Invariant

**Invariant**: If `collectedEvidence.length > 0` before packaging, then `sources.length > 0` after packaging, unless explicit filtering rules removed them.

**Enforcement**:
1. Log `LIVE_SOURCES_BEFORE_PACKAGING` with count
2. Log `LIVE_SOURCES_AFTER_PACKAGING` with count
3. If before > 0 and after = 0, log `EVIDENCE_PRESERVATION_INVARIANT_VIOLATION` as ERROR with details about what removed the evidence

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code (by setting `CLAUDE_MODEL_ID` in test environment), then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that setting `CLAUDE_MODEL_ID` causes evidence rejection.

**Test Plan**: Write tests that set `CLAUDE_MODEL_ID` environment variable and simulate evidence filtering. Run these tests on the UNFIXED code to observe failures and confirm the root cause.

**Test Cases**:
1. **Claude Override Test**: Set `CLAUDE_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0` → Create evidence candidates → Call evidenceFilter → Assert that model invocation fails (will fail on unfixed code)
2. **Evidence Rejection Test**: Set `CLAUDE_MODEL_ID` → Provide 9 valid evidence candidates → Call evidenceFilter → Assert that all candidates are rejected (will fail on unfixed code)
3. **Model Selection Test**: Set `CLAUDE_MODEL_ID` → Inspect `BEDROCK_MODEL_ID` constant → Assert it equals Claude model ID (will fail on unfixed code)
4. **Production Simulation Test**: Set `CLAUDE_MODEL_ID` → Simulate full orchestration pipeline → Assert `sourcesCount > 0` (will fail on unfixed code)

**Expected Counterexamples**:
- Evidence filter invokes Claude 3 Haiku instead of NOVA
- All evidence candidates are rejected due to model authorization errors
- Final response contains `sourcesCount=0` despite providers retrieving sources
- Possible causes: incorrect environment variable precedence, insufficient fallback handling

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (CLAUDE_MODEL_ID is set), the fixed function produces the expected behavior (uses NOVA and falls back gracefully).

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := evidenceFilter_fixed(input)
  ASSERT result.modelUsed = 'amazon.nova-lite-v1:0'
  ASSERT result.sourcesCount > 0 OR result.passThrough = true
END FOR
```

**Test Cases**:
1. **NOVA Selection Test**: Set `CLAUDE_MODEL_ID` → Call evidenceFilter → Assert NOVA is used (not Claude)
2. **Pass-Through Fallback Test**: Mock NOVA failure → Call evidenceFilter → Assert pass-through mode is used
3. **Evidence Preservation Test**: Mock NOVA failure → Provide 9 candidates → Assert at least some pass through
4. **Diagnostic Logging Test**: Mock NOVA failure → Call evidenceFilter → Assert `EVIDENCE_FILTER_MODEL_ERROR` is logged

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (CLAUDE_MODEL_ID is not set, NOVA is functioning), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT evidenceFilter_original(input) = evidenceFilter_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for normal NOVA operations, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Generic Page Rejection Preservation**: Observe that homepage/category/tag pages are rejected on unfixed code → Write test to verify this continues after fix
2. **Low Quality Rejection Preservation**: Observe that low-quality evidence (score < 0.6) is rejected on unfixed code → Write test to verify this continues after fix
3. **Unrelated Content Rejection Preservation**: Observe that unrelated content is rejected on unfixed code → Write test to verify this continues after fix
4. **High Quality Pass Preservation**: Observe that high-quality relevant evidence passes on unfixed code → Write test to verify this continues after fix
5. **Provider Logic Preservation**: Observe that provider retrieval works correctly on unfixed code → Write test to verify this continues after fix
6. **Demo Mode Preservation**: Observe that demo mode bypasses NOVA on unfixed code → Write test to verify this continues after fix

### Unit Tests

- Test model selection with `NOVA_MODEL_ID` set vs unset
- Test model selection with `CLAUDE_MODEL_ID` set (should be ignored)
- Test pass-through fallback when NOVA invocation fails
- Test diagnostic logging for model errors
- Test neutral score values (0.7) in pass-through mode
- Test that generic page rejection still works after fix
- Test that quality threshold rejection still works after fix

### Property-Based Tests

- Generate random evidence candidates and verify pass-through preserves them when NOVA fails
- Generate random page types and verify rejection logic is preserved
- Generate random quality scores and verify threshold logic is preserved
- Test across many scenarios that filtering decisions match original behavior when NOVA is available

### Integration Tests

- Test full orchestration pipeline with `CLAUDE_MODEL_ID` set (should use NOVA)
- Test full orchestration pipeline with NOVA failure (should use pass-through)
- Test production scenario: "Ukraine war" claim → providers retrieve sources → evidence filter preserves some → `sourcesCount > 0`
- Test that CloudWatch logs contain diagnostic events when model fails

### Phase 2 Integration Tests (Evidence Preservation Architecture)

- **Verdict Synthesis Failure Test**: Provider returns 6 sources → verdict synthesis fails → Assert final response still has 6 or dedup-preserved sources
- **Stance Classification Failure Test**: Provider returns 3 sources → stance classification fails → Assert final response still contains sources with default stance
- **Contradiction Search Failure Test**: Provider returns evidence → contradiction search fails → Assert final response still contains sources
- **Packaging Invariant Test**: `LIVE_SOURCES_BEFORE_PACKAGING > 0` → Assert `LIVE_SOURCES_AFTER_PACKAGING > 0` unless explicitly documented by filtering rules
- **Degraded State Flags Test**: Mock model failure → Assert `degradedStages` contains failed stage name
- **Model Failures Tracking Test**: Mock model failure → Assert `modelFailures` array contains error details
- **Evidence Preserved Flag Test**: Provider succeeds, model fails → Assert `evidencePreserved=true`
- **Full Degradation Test**: All AI stages fail → Assert evidence still reaches final response with degraded metadata

### Acceptance Criteria

After deployment, for a query where mediastack or serper returns evidence:
- `text_grounding.sourcesCount > 0`
- `sources` array is not empty
- Evidence graph can render
- Degraded mode may still occur, but evidence remains visible
- Model failures no longer cause total evidence disappearance
- CloudWatch logs show `LIVE_SOURCES_BEFORE_PACKAGING` and `LIVE_SOURCES_AFTER_PACKAGING`
- If packaging invariant is violated, ERROR log appears with details

### Deployment Steps

1. **Build and Test**:
   ```bash
   cd backend
   npm run build
   npm test
   ```

2. **Deploy to Lambda**:
   ```bash
   sam build
   sam deploy --no-confirm-changeset
   ```

3. **Verify Deployment**:
   ```bash
   aws lambda get-function-configuration \
     --function-name fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe \
     --query 'Environment.Variables' \
     --output json
   ```

4. **Live Verification Command**:
   ```bash
   curl -X POST https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/analyze \
     -H "Content-Type: application/json" \
     -d '{"claim":"Ukraine war"}' | jq '.text_grounding.sourcesCount, .text_grounding.sources | length, .retrieval_status.evidencePreserved, .retrieval_status.degradedStages'
   ```

5. **Check CloudWatch Logs**:
   ```bash
   aws logs tail /aws/lambda/fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe --follow | Select-String "LIVE_SOURCES|EVIDENCE_PRESERVATION|DEGRADED"
   ```

### Do Not Change

- Provider ordering (mediastack, gdelt, serper)
- Freshness strategy
- Query expansion logic
- Caching behavior
- API contract except additive fields (degradedStages, evidencePreserved, modelFailures)
