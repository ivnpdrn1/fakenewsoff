# Stance Classifier Orchestrator Preservation Fix - Bugfix Design

## Overview

The stance classifier correctly identifies trusted sources (Reuters, BBC, AP, etc.) as "supports" when they contain explicit confirmation patterns. However, the evidenceOrchestrator overrides these stance values by hardcoding them to 'mentions' at three locations during stage 1, 2, and 3 query execution. This causes all sources to appear as "mentions" in the final verdict, resulting in artificially low confidence scores even when trusted sources explicitly confirm the claim.

The fix preserves the stance value from groundTextOnly() by casting sources to NormalizedSourceWithStance and using the actual stance property instead of hardcoding to 'mentions'. This ensures the stance classifier's work is not discarded and confidence scores accurately reflect the strength of supporting evidence.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when evidenceOrchestrator processes sources with stance values other than 'mentions'
- **Property (P)**: The desired behavior - evidenceOrchestrator preserves the stance value from groundTextOnly()
- **Preservation**: Existing orchestration logic, filtering, aggregation, and test suite that must remain unchanged
- **evidenceOrchestrator**: The class in `backend/src/orchestration/evidenceOrchestrator.ts` that coordinates multi-stage evidence retrieval
- **groundTextOnly**: The grounding service method that returns NormalizedSourceWithStance[] with stance classifications
- **NormalizedSourceWithStance**: Type from `backend/src/types/grounding.ts` that includes stance, stanceJustification, provider, and credibilityTier
- **Stage 1/2/3**: The three query execution stages in evidenceOrchestrator.orchestrate() where sources are converted to evidence candidates

## Bug Details

### Bug Condition

The bug manifests when evidenceOrchestrator processes sources returned from groundTextOnly() that have stance values other than 'mentions' (specifically 'supports', 'refutes', or 'unclear'). The orchestrator hardcodes stance to 'mentions' at three locations, overriding the stance classifier's work.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { source: NormalizedSourceWithStance, stage: 1 | 2 | 3 }
  OUTPUT: boolean
  
  RETURN input.source.stance IN ['supports', 'refutes', 'unclear']
         AND input.stage IN [1, 2, 3]
         AND orchestratorOverridesStanceToMentions(input.source, input.stage)
END FUNCTION
```

### Examples

- **Stage 1 Processing**: Reuters source classified as "supports" by stanceClassifier → evidenceOrchestrator overrides to 'mentions' at line ~228 → final verdict shows Reuters as "mentions"
- **Stage 2 Processing**: BBC source classified as "supports" by stanceClassifier → evidenceOrchestrator overrides to 'mentions' at line ~349 → final verdict shows BBC as "mentions"
- **Stage 3 Processing**: AP source classified as "supports" by stanceClassifier → evidenceOrchestrator overrides to 'mentions' at line ~486 → final verdict shows AP as "mentions"
- **Confidence Score Impact**: Multiple trusted sources explicitly confirm claim → all marked as "mentions" → confidence score 0.35 instead of expected 0.85-0.95

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Source filtering by relevance and quality thresholds must continue to work
- Multi-stage orchestration logic (stage 1, 2, 3) must remain unchanged
- Query ranking and selection must continue to work
- Evidence aggregation across stages must remain unchanged
- Provider failure handling and diagnostics must continue to work
- Cache hit/miss logic must remain unchanged
- All logging and monitoring must continue to work

**Scope:**
All orchestration logic that does NOT involve stance value assignment should be completely unaffected by this fix. This includes:
- Query execution and provider selection
- Source deduplication and ranking
- Pass continuation logic
- Error handling and retry logic
- Performance monitoring and diagnostics

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is:

1. **Copy-Paste Error**: The three stage execution blocks (stage 1, 2, 3) were likely copied from a template that hardcoded stance to 'mentions' as a placeholder value

2. **Type Mismatch Oversight**: The code treats sources as generic objects without leveraging the NormalizedSourceWithStance type, leading to manual property assignment instead of property preservation

3. **Incomplete Integration**: When the stance classifier was integrated with groundTextOnly(), the orchestrator was not updated to preserve the stance values it returns

4. **Missing Type Safety**: The lack of explicit type casting to NormalizedSourceWithStance allowed the hardcoded 'mentions' value to persist without TypeScript warnings

## Correctness Properties

Property 1: Bug Condition - Stance Preservation from Classifier

_For any_ source returned from groundTextOnly() with stance value 'supports', 'refutes', 'unclear', or 'mentions', the fixed evidenceOrchestrator SHALL preserve that exact stance value when converting the source to an evidence candidate in stages 1, 2, and 3, ensuring the stance classifier's work is not discarded.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - Orchestration Logic Unchanged

_For any_ orchestration operation that does NOT involve stance value assignment (query execution, source filtering, evidence aggregation, provider selection, cache handling, error handling), the fixed evidenceOrchestrator SHALL produce exactly the same behavior as the original code, preserving all existing orchestration logic.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

The fix has been implemented in `backend/src/orchestration/evidenceOrchestrator.ts`.

**File**: `backend/src/orchestration/evidenceOrchestrator.ts`

**Function**: `async executePass()` (private method)

**Specific Changes**:

1. **Stage 1 Query Execution (line ~228)**:
   - Cast source to NormalizedSourceWithStance type
   - Replace hardcoded `stance: 'mentions'` with `stance: sourceWithStance.stance`
   - Replace hardcoded `credibilityTier: 2` with `credibilityTier: sourceWithStance.credibilityTier || 2`

2. **Stage 2 Query Execution (line ~349)**:
   - Cast source to NormalizedSourceWithStance type
   - Replace hardcoded `stance: 'mentions'` with `stance: sourceWithStance.stance`
   - Replace hardcoded `credibilityTier: 2` with `credibilityTier: sourceWithStance.credibilityTier || 2`

3. **Stage 3 Query Execution (line ~486)**:
   - Cast source to NormalizedSourceWithStance type
   - Replace hardcoded `stance: 'mentions'` with `stance: sourceWithStance.stance`
   - Replace hardcoded `credibilityTier: 2` with `credibilityTier: sourceWithStance.credibilityTier || 2`

4. **Type Safety**: Add explicit type casting to NormalizedSourceWithStance to leverage TypeScript type checking

5. **Comments**: Add inline comments explaining the preservation requirement to prevent future regressions

**Code Pattern Applied (all 3 stages)**:
```typescript
// BEFORE:
for (const source of result.sources) {
  const candidate = this.toEvidenceCandidate(source, query, passNumber);
  candidates.push({
    ...candidate,
    provider: result.providerUsed,
    stance: 'mentions',  // ❌ HARDCODED
    credibilityTier: 2,  // ❌ HARDCODED
  });
}

// AFTER:
for (const source of result.sources) {
  // Preserve stance from groundTextOnly - DO NOT override
  const sourceWithStance = source as NormalizedSourceWithStance;
  const candidate = this.toEvidenceCandidate(sourceWithStance, query, passNumber);
  candidates.push({
    ...candidate,
    provider: result.providerUsed,
    // Preserve stance from source - DO NOT override to 'mentions'
    stance: sourceWithStance.stance,  // ✅ PRESERVED
    credibilityTier: sourceWithStance.credibilityTier || 2,  // ✅ PRESERVED
  });
}
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, verify the fix works correctly by confirming stance values are preserved, then verify existing orchestration behavior is unchanged through the comprehensive test suite.

### Exploratory Bug Condition Checking

**Goal**: Confirm that the unfixed code hardcodes stance to 'mentions' and the fixed code preserves stance values from groundTextOnly().

**Test Plan**: The fix has already been implemented and validated. The exploratory phase would have involved:
1. Examining the three stage execution blocks in evidenceOrchestrator.ts
2. Confirming hardcoded `stance: 'mentions'` at lines ~228, ~349, ~486
3. Tracing the data flow from groundTextOnly() → evidenceOrchestrator → verdictSynthesis
4. Observing that trusted sources classified as "supports" appear as "mentions" in final verdict

**Test Cases**:
1. **Stage 1 Stance Override**: Process a source with stance "supports" in stage 1 (fails on unfixed code - overrides to 'mentions')
2. **Stage 2 Stance Override**: Process a source with stance "supports" in stage 2 (fails on unfixed code - overrides to 'mentions')
3. **Stage 3 Stance Override**: Process a source with stance "supports" in stage 3 (fails on unfixed code - overrides to 'mentions')
4. **Confidence Score Impact**: Process multiple trusted sources with stance "supports" (fails on unfixed code - confidence score artificially low)

**Expected Counterexamples**:
- Stance values are hardcoded to 'mentions' regardless of classifier output
- Possible causes: copy-paste error, type mismatch oversight, incomplete integration

### Fix Checking

**Goal**: Verify that for all sources where the stance classifier assigns a stance value, the fixed orchestrator preserves that value.

**Pseudocode:**
```
FOR ALL source WHERE source.stance IN ['supports', 'refutes', 'mentions', 'unclear'] DO
  FOR ALL stage IN [1, 2, 3] DO
    candidate := evidenceOrchestrator_fixed.processSource(source, stage)
    ASSERT candidate.stance = source.stance
    ASSERT candidate.credibilityTier = source.credibilityTier OR 2
  END FOR
END FOR
```

### Preservation Checking

**Goal**: Verify that for all orchestration operations that do NOT involve stance assignment, the fixed orchestrator produces the same results as the original.

**Pseudocode:**
```
FOR ALL orchestrationOperation WHERE NOT involvesStanceAssignment(orchestrationOperation) DO
  ASSERT evidenceOrchestrator_original(orchestrationOperation) = 
         evidenceOrchestrator_fixed(orchestrationOperation)
END FOR
```

**Testing Approach**: The comprehensive test suite provides strong preservation guarantees:
- 33 orchestrator tests verify multi-stage orchestration logic
- 22 stance classifier tests verify stance classification accuracy
- 508 backend tests verify end-to-end system behavior

**Test Plan**: Run the full test suite to verify no regressions:
1. **Orchestrator Tests**: Verify query execution, source filtering, evidence aggregation
2. **Stance Classifier Tests**: Verify stance classification continues to work correctly
3. **Integration Tests**: Verify end-to-end evidence retrieval and verdict synthesis
4. **Type Checking**: Verify TypeScript compilation succeeds

**Test Cases**:
1. **Query Execution Preservation**: Verify stage 1, 2, 3 query execution logic unchanged (33 orchestrator tests)
2. **Source Filtering Preservation**: Verify relevance and quality filtering unchanged (orchestrator tests)
3. **Evidence Aggregation Preservation**: Verify multi-stage aggregation unchanged (orchestrator tests)
4. **Stance Classification Preservation**: Verify classifier logic unchanged (22 stance classifier tests)

### Unit Tests

- Test stance preservation for each stage (1, 2, 3) with all stance values ('supports', 'refutes', 'mentions', 'unclear')
- Test credibilityTier preservation with explicit values (1, 2, 3) and fallback to 2
- Test that sources with stance 'mentions' continue to work (no regression)
- Test that provider and other metadata fields are preserved correctly

### Property-Based Tests

- Generate random sources with random stance values and verify preservation across all stages
- Generate random orchestration scenarios and verify existing behavior unchanged
- Test that confidence scores increase appropriately when trusted sources have stance "supports"

### Integration Tests

- Test full orchestration pipeline with trusted sources classified as "supports"
- Test verdict synthesis with mixed stance values (supports, refutes, mentions)
- Test that confidence scores reflect stance distribution correctly
- Verify all 508 backend tests continue to pass

## Deployment Plan

The fix has been implemented and validated. The deployment plan is:

1. **Copy Updated File**: Copy `backend/src/orchestration/evidenceOrchestrator.ts` to `lambda-code/`
2. **Build Lambda Package**: Run build script to create deployment package
3. **Deploy to Lambda**: Deploy to function `fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe`
4. **Test with Direct Invocation**: Use `scripts/test-lambda-direct.ps1` to verify stance preservation
5. **Monitor Production Logs**: Verify stance values appear correctly in CloudWatch logs
6. **Validate Confidence Scores**: Confirm confidence scores increase for claims with trusted supporting sources
