# V4.5: Provider Failure Details Propagation Fix

## Root Cause

Provider failure details are logged in CloudWatch but NOT propagated to the API response.

**Data Flow Gap**:
```
groundingService.ground() 
  → logs failures to CloudWatch ✓
  → returns GroundingBundle WITHOUT failure details ✗
  
groundSingleQuery()
  → receives GroundingBundle WITHOUT failure details ✗
  → returns SingleQueryGroundingResult WITHOUT failure details ✗
  
evidenceOrchestrator.orchestrate()
  → receives results WITHOUT failure details ✗
  → cannot collect failure details ✗
  
iterativeOrchestrationPipeline.analyzeWithIterativeOrchestration()
  → builds RetrievalStatus WITHOUT providerFailureDetails ✗
  → returns OrchestrationResult with empty providerFailureDetails ✗
  
lambda.handler()
  → packages response with empty provider_failure_details ✗
```

## Files to Change

1. `backend/src/types/grounding.ts` - Add providerFailureDetails to GroundingBundle
2. `backend/src/services/groundingService.ts` - Collect and return failure details
3. `backend/src/orchestration/evidenceOrchestrator.ts` - Collect failure details from queries
4. `backend/src/orchestration/iterativeOrchestrationPipeline.ts` - Aggregate and populate RetrievalStatus
5. `backend/src/lambda.ts` - Add propagation log marker

## Changes Required

See implementation files for exact changes.
