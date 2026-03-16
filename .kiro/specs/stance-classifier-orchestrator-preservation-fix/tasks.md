# Implementation Plan

## Completed Work

✅ All implementation and testing complete:
- Enhanced stanceClassifier.ts with explicit confirmation detection
- Fixed evidenceOrchestrator.ts to preserve stance values (3 locations)
- Updated groundingService.ts to pass sourceDomain parameter
- All 508 backend tests passing
- All 33 orchestrator tests passing
- All 22 stance classifier tests passing
- Code compiles successfully

## Deployment and Validation Tasks

- [ ] 1. Copy updated evidenceOrchestrator.ts to lambda-code directory
  - Copy `backend/src/orchestration/evidenceOrchestrator.ts` to `lambda-code/src/orchestration/evidenceOrchestrator.ts`
  - Verify file copied successfully
  - _Requirements: Deployment preparation_

- [ ] 2. Build Lambda deployment package
  - Navigate to lambda-code directory
  - Run `npm install` to ensure dependencies are current
  - Run `npm run build` to compile TypeScript
  - Verify build completes without errors
  - Verify dist/ directory contains compiled code
  - _Requirements: Deployment preparation_

- [ ] 3. Deploy to Lambda function
  - Package the lambda-code directory (zip or SAM deploy)
  - Deploy to Lambda function: `fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe`
  - Verify deployment succeeds
  - Note deployment timestamp for log correlation
  - _Requirements: Production deployment_

- [ ] 4. Test with direct Lambda invocation
  - Use `scripts/test-lambda-direct.ps1` with test claim: "Russia invaded Ukraine in February 2022"
  - Verify Lambda responds successfully (no errors)
  - Verify response includes evidence from trusted sources (Reuters, BBC, AP)
  - Verify stance values are preserved (not all "mentions")
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 5. Verify stance preservation in production logs
  - Open CloudWatch Logs for the Lambda function
  - Filter logs by deployment timestamp
  - Search for stance values in evidence candidates
  - Verify trusted sources show stance "supports" (not "mentions")
  - Verify stanceJustification includes confirmation patterns
  - Document log entries showing correct stance preservation
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 6. Validate improved confidence scores
  - Test claim: "Russia invaded Ukraine in February 2022"
  - Expected results:
    - Reuters/BBC/AP sources should show stance "supports" (not "mentions")
    - Credibility scoring should report correct average (not 0.0)
    - Final verdict confidence should be >0.50 (ideally 0.85-0.95)
    - Rationale should mention source credibility and count
  - Compare with pre-fix behavior (all "mentions", low confidence)
  - Document confidence score improvement
  - _Requirements: 2.5_

- [ ] 7. Verify preservation of existing behavior
  - Test with claims that have mixed stance values (supports, refutes, mentions)
  - Verify all stance values are preserved correctly
  - Verify source filtering and ranking still works
  - Verify multi-stage orchestration logic unchanged
  - Verify error handling and diagnostics still work
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 8. Document completion and results
  - Create completion report with:
    - Deployment timestamp and Lambda function name
    - Test results showing stance preservation
    - Confidence score improvements (before/after comparison)
    - CloudWatch log excerpts demonstrating correct behavior
    - Confirmation that all preservation requirements met
  - Update project documentation with fix details
  - Close related issues or tickets
  - _Requirements: All requirements validated_

## Test Claim for Validation

**Claim**: "Russia invaded Ukraine in February 2022"

**Expected Results After Fix**:
- Reuters/BBC/AP sources should show stance "supports" (not "mentions")
- Credibility scoring should report correct average (not 0.0)
- Final verdict confidence should be >0.50 (ideally 0.85-0.95)
- Rationale should mention source credibility and count

**Pre-Fix Behavior** (for comparison):
- All sources showed stance "mentions" regardless of classifier output
- Confidence scores artificially low (<0.5)
- Trusted source detection undermined

## Lambda Function Details

- **Function Name**: `fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe`
- **Region**: (verify from AWS console)
- **Test Script**: `scripts/test-lambda-direct.ps1`
- **CloudWatch Log Group**: `/aws/lambda/fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe`

## Success Criteria

- [ ] Lambda deployment succeeds without errors
- [ ] Direct Lambda invocation returns successful response
- [ ] CloudWatch logs show stance values preserved (not hardcoded to "mentions")
- [ ] Confidence scores reflect stance distribution correctly (>0.50 for strong supporting evidence)
- [ ] All existing orchestration behavior preserved (no regressions)
- [ ] Documentation updated with deployment results
