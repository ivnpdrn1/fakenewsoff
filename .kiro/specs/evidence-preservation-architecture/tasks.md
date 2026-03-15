# Implementation Plan: Evidence Preservation Architecture

## Overview

This implementation adds comprehensive evidence preservation across the entire orchestration pipeline to ensure evidence is NEVER lost when Bedrock model invocation fails at any stage. The implementation extends existing components with pass-through contracts, adds degraded state tracking, and implements evidence preservation invariant validation.

The system will preserve evidence through all AI-dependent stages (evidence filter, stance classifier, contradiction searcher, verdict synthesizer) and validate that evidence is never lost during response packaging.

## Tasks

- [ ] 1. Extend evidence filter with enhanced pass-through mode
  - [ ] 1.1 Add FilterResult interface to evidenceFilter.ts
    - Define FilterResult with passed, rejected, fallbackUsed, and modelFailure fields
    - Update filter() method signature to return FilterResult
    - _Requirements: 2.2, 5.1, 5.2, 5.3_
  
  - [ ] 1.2 Enhance pass-through mode in evidenceFilter.ts
    - Wrap Bedrock model call in try-catch
    - On failure, preserve all candidates with neutral scores (0.7)
    - Log EVIDENCE_FILTER_FALLBACK event with failure details
    - Set fallbackUsed = true in result
    - _Requirements: 1.1, 2.2, 5.1, 5.2, 5.3, 5.4_
  
  - [ ] 1.3 Add FILTERED_SOURCES_COUNT logging
    - Log passed_count, rejected_count, and fallback_used
    - Include model failure message if fallback was used
    - _Requirements: 4.1, 4.2_
  
  - [ ]* 1.4 Write unit tests for evidence filter pass-through
    - Test Bedrock timeout triggers pass-through
    - Test Bedrock rate limit triggers pass-through
    - Test Bedrock invalid response triggers pass-through
    - Test evidence preserved with neutral scores
    - _Requirements: 7.1_
  
  - [ ]* 1.5 Write property test for evidence filter pass-through
    - **Property 1: Evidence Filter Pass-Through**
    - **Validates: Requirement 1.1**
    - Generate random evidence retrieval successes
    - Inject filter model failures
    - Verify evidence preserved with default metadata
    - _Requirements: 7.1_


- [ ] 2. Extend stance classifier with pass-through mode
  - [ ] 2.1 Add ClassificationResult interface to sourceClassifier.ts
    - Define ClassificationResult with classified, fallbackUsed, and modelFailure fields
    - Update classify() method signature to return ClassificationResult
    - _Requirements: 2.3, 2.4_
  
  - [ ] 2.2 Implement pass-through mode in sourceClassifier.ts
    - Wrap Bedrock model call in try-catch
    - On failure, preserve all evidence with neutral stance ("mentions")
    - Log STANCE_CLASSIFICATION_FALLBACK event with failure details
    - Set fallbackUsed = true in result
    - _Requirements: 1.2, 2.3, 2.4_
  
  - [ ]* 2.3 Write unit tests for stance classifier pass-through
    - Test Bedrock timeout triggers pass-through
    - Test Bedrock rate limit triggers pass-through
    - Test Bedrock invalid response triggers pass-through
    - Test evidence preserved with neutral stance
    - _Requirements: 7.2_
  
  - [ ]* 2.4 Write property test for stance classifier pass-through
    - **Property 2: Stance Classifier Pass-Through**
    - **Validates: Requirement 1.2**
    - Generate random evidence retrieval successes
    - Inject stance classifier model failures
    - Verify evidence preserved with neutral stance metadata
    - _Requirements: 7.2_

- [ ] 3. Extend contradiction searcher with pass-through mode
  - [ ] 3.1 Add ContradictionSearchResult interface to contradictionSearcher.ts
    - Define ContradictionSearchResult with evidence, foundContradictions, fallbackUsed, and modelFailure fields
    - Update searchContradictions() method signature to return ContradictionSearchResult
    - _Requirements: 2.7, 2.8_
  
  - [ ] 3.2 Implement pass-through mode in contradictionSearcher.ts
    - Wrap Bedrock model call in try-catch
    - On failure, return empty contradiction evidence
    - Log CONTRADICTION_SEARCH_FALLBACK event with failure details
    - Set fallbackUsed = true in result
    - _Requirements: 1.4, 2.7, 2.8_
  
  - [ ]* 3.3 Write unit tests for contradiction searcher pass-through
    - Test Bedrock timeout triggers pass-through
    - Test Bedrock rate limit triggers pass-through
    - Test Bedrock invalid response triggers pass-through
    - Test empty contradiction evidence returned
    - _Requirements: 7.3_
  
  - [ ]* 3.4 Write property test for contradiction searcher pass-through
    - **Property 4: Contradiction Searcher Pass-Through**
    - **Validates: Requirement 1.4**
    - Generate random evidence retrieval successes
    - Inject contradiction searcher failures
    - Verify evidence preserved without contradiction metadata
    - _Requirements: 7.3_


- [ ] 4. Extend verdict synthesizer with pass-through mode
  - [ ] 4.1 Add SynthesisResult interface to verdictSynthesizer.ts
    - Define SynthesisResult with verdict, fallbackUsed, and modelFailure fields
    - Update synthesize() method signature to return SynthesisResult
    - _Requirements: 2.5, 2.6_
  
  - [ ] 4.2 Implement pass-through mode in verdictSynthesizer.ts
    - Wrap Bedrock model call in try-catch
    - On failure, return degraded verdict with preserved evidence
    - Verdict classification: "unverified"
    - Confidence: 0
    - Rationale: "Verdict synthesis failed - evidence preserved for manual review"
    - Log VERDICT_SYNTHESIS_FALLBACK event with failure details
    - Set fallbackUsed = true in result
    - _Requirements: 1.3, 2.5, 2.6, 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ]* 4.3 Write unit tests for verdict synthesizer pass-through
    - Test Bedrock timeout triggers pass-through
    - Test Bedrock rate limit triggers pass-through
    - Test Bedrock invalid response triggers pass-through
    - Test degraded verdict returned with preserved evidence
    - _Requirements: 7.2_
  
  - [ ]* 4.4 Write property test for verdict synthesizer pass-through
    - **Property 3: Verdict Synthesizer Pass-Through**
    - **Validates: Requirement 1.3**
    - Generate random evidence retrieval successes
    - Inject verdict synthesizer model failures
    - Verify evidence preserved with degraded verdict
    - _Requirements: 7.2_

- [ ] 5. Checkpoint - Ensure all component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Add degraded state tracking to orchestration pipeline
  - [ ] 6.1 Create DegradedStateTracker class
    - Create backend/src/utils/degradedStateTracker.ts
    - Implement trackStage() method
    - Implement getMetadata() method
    - Implement hasAnyDegradation() method
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ] 6.2 Integrate DegradedStateTracker into iterativeOrchestrationPipeline.ts
    - Initialize tracker at pipeline start
    - Track fallback usage from each stage
    - Collect metadata at pipeline end
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ] 6.3 Add degraded state fields to RetrievalStatus type
    - Add evidencePreserved, degradedStages, and modelFailures fields to RetrievalStatus in backend/src/types/orchestration.ts
    - Update pipeline to populate these fields
    - _Requirements: 3.1, 3.2, 3.3, 3.5_
  
  - [ ]* 6.4 Write unit tests for DegradedStateTracker
    - Test stage tracking
    - Test metadata generation
    - Test degradation detection
    - _Requirements: 3.1, 3.2, 3.3_


- [ ] 7. Implement evidence preservation invariant validation
  - [ ] 7.1 Add evidence count logging to iterativeOrchestrationPipeline.ts
    - Log RETRIEVED_SOURCES_COUNT after evidence retrieval (already exists)
    - Log FILTERED_SOURCES_COUNT after evidence filtering (already exists)
    - Log BUCKETED_SOURCES_COUNT after stance classification (already exists)
    - Log SOURCES_BEFORE_PACKAGING before response packaging (already exists)
    - Log SOURCES_AFTER_PACKAGING after response packaging (already exists)
    - _Requirements: 4.1, 4.2, 10.1, 10.2_
  
  - [ ] 7.2 Implement validateEvidencePreservationInvariant() function
    - Create backend/src/utils/evidencePreservationValidator.ts
    - Implement invariant validation logic
    - Log EVIDENCE_PRESERVATION_INVARIANT event with status
    - _Requirements: 4.3, 4.4, 10.3, 10.4, 10.5_
  
  - [ ] 7.3 Integrate invariant validation into pipeline
    - Call validateEvidencePreservationInvariant() before response packaging
    - Log ERROR if invariant violated
    - Log INFO if invariant satisfied
    - _Requirements: 4.3, 4.4, 10.3, 10.4, 10.5_
  
  - [ ]* 7.4 Write unit tests for invariant validation
    - Test PASS case (evidence preserved)
    - Test FAIL case (evidence lost)
    - Test edge cases (zero sources before packaging)
    - _Requirements: 7.4_
  
  - [ ]* 7.5 Write property test for evidence preservation invariant
    - **Property 6: Evidence Preservation Invariant**
    - **Validates: Requirement 4.4**
    - Generate random pipeline states with live sources
    - Verify invariant holds after packaging
    - _Requirements: 7.4_

- [ ] 8. Add pass-through mode activation utility
  - [ ] 8.1 Create executeWithPassThrough() utility function
    - Create backend/src/utils/passThroughExecutor.ts
    - Implement generic pass-through wrapper
    - Add error handling and logging
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_
  
  - [ ] 8.2 Refactor components to use executeWithPassThrough()
    - Update evidenceFilter.ts to use utility
    - Update sourceClassifier.ts to use utility
    - Update contradictionSearcher.ts to use utility
    - Update verdictSynthesizer.ts to use utility
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_
  
  - [ ]* 8.3 Write unit tests for executeWithPassThrough()
    - Test success case (no fallback)
    - Test failure case (fallback activated)
    - Test logging behavior
    - _Requirements: All requirements (utility function)_

- [ ] 9. Checkpoint - Ensure all integration tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 10. Add comprehensive integration tests
  - [ ] 10.1 Write integration test for evidence filter pass-through
    - Simulate Bedrock timeout during filtering
    - Verify evidence preserved with neutral scores
    - Verify degraded state flags set correctly
    - _Requirements: 7.1_
  
  - [ ] 10.2 Write integration test for stance classifier pass-through
    - Simulate Bedrock timeout during stance classification
    - Verify evidence preserved with neutral stance
    - Verify degraded state flags set correctly
    - _Requirements: 7.2_
  
  - [ ] 10.3 Write integration test for contradiction searcher pass-through
    - Simulate Bedrock timeout during contradiction search
    - Verify evidence preserved without contradiction metadata
    - Verify degraded state flags set correctly
    - _Requirements: 7.3_
  
  - [ ] 10.4 Write integration test for verdict synthesizer pass-through
    - Simulate Bedrock timeout during verdict synthesis
    - Verify evidence preserved with degraded verdict
    - Verify degraded state flags set correctly
    - _Requirements: 7.2_
  
  - [ ] 10.5 Write integration test for multiple stage failures
    - Simulate failures in multiple stages (filter + stance + verdict)
    - Verify evidence preserved through all failures
    - Verify all degraded stages tracked correctly
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ] 10.6 Write integration test for evidence preservation invariant
    - Test invariant validation with various evidence counts
    - Test invariant PASS case
    - Test invariant FAIL case (should not occur in practice)
    - _Requirements: 7.4_

- [ ] 11. Add property-based tests for universal correctness
  - [ ]* 11.1 Write property test for no evidence loss from model failures
    - **Property 5: No Evidence Loss from Model Failures**
    - **Validates: Requirement 1.5**
    - Generate random evidence retrieval successes
    - Inject random Bedrock model failures at any stage
    - Verify response packager never returns empty sources
    - _Requirements: 7.5_
  
  - [ ]* 11.2 Write property test for degraded state flags presence
    - **Property 7: Degraded State Flags Presence**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - Generate random pipeline executions with pass-through mode
    - Verify API response includes degradedStages and evidencePreserved
    - _Requirements: 7.5_
  
  - [ ]* 11.3 Write property test for model failure tracking
    - **Property 8: Model Failure Tracking**
    - **Validates: Requirement 3.3**
    - Generate random pipeline executions with Bedrock failures
    - Verify API response includes failure details in modelFailures array
    - _Requirements: 7.5_
  
  - [ ]* 11.4 Write property test for backward compatibility
    - **Property 9: Backward Compatibility**
    - **Validates: Requirement 8.5**
    - Generate random API responses with new fields
    - Verify existing client code (without new field handling) doesn't break
    - _Requirements: 8.5_


- [ ] 12. Add parser and pretty printer for degraded state
  - [x] 12.1 Create DegradedStateParser class
    - Create backend/src/utils/degradedStateParser.ts
    - Implement parse() method for degradedStages arrays
    - Implement parse() method for modelFailures arrays
    - Add validation and error handling
    - _Requirements: 9.1, 9.2, 9.5_
  
  - [x] 12.2 Create DegradedStatePrettyPrinter class
    - Create backend/src/utils/degradedStatePrettyPrinter.ts
    - Implement format() method for human-readable output
    - Add formatting for stage names and failure messages
    - _Requirements: 9.3_
  
  - [ ]* 12.3 Write unit tests for DegradedStateParser
    - Test parsing valid degraded state objects
    - Test parsing invalid objects (error handling)
    - Test edge cases (empty arrays, null values)
    - _Requirements: 9.5_
  
  - [ ]* 12.4 Write unit tests for DegradedStatePrettyPrinter
    - Test formatting various degraded state objects
    - Test output readability
    - Test edge cases (empty arrays, long messages)
    - _Requirements: 9.3_
  
  - [ ]* 12.5 Write property test for round-trip consistency
    - **Property: Round-trip consistency**
    - **Validates: Requirement 9.4**
    - Generate random valid degraded state objects
    - Parse → Print → Parse
    - Verify equivalent object produced
    - _Requirements: 9.4_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Add documentation and observability
  - [ ] 14.1 Add inline code documentation
    - Document all new interfaces and classes
    - Document pass-through mode behavior
    - Document evidence preservation invariant
    - Add usage examples
    - _Requirements: All requirements (documentation)_
  
  - [ ] 14.2 Update API documentation
    - Document new RetrievalStatus fields
    - Document degraded state metadata structure
    - Document when pass-through mode is activated
    - Add examples of degraded responses
    - _Requirements: 3.5, 8.5_
  
  - [ ] 14.3 Add monitoring dashboard queries
    - Create CloudWatch Insights queries for evidencePreserved frequency
    - Create queries for degradedStages distribution
    - Create queries for modelFailures patterns
    - Create queries for invariant violations
    - _Requirements: All requirements (observability)_
  
  - [ ] 14.4 Create developer guide
    - Document how to interpret degraded state flags
    - Document how to debug evidence preservation issues
    - Document how to add pass-through mode to new stages
    - Document how to validate evidence preservation invariant
    - _Requirements: All requirements (documentation)_


- [ ] 15. Performance optimization and validation
  - [ ] 15.1 Measure logging overhead
    - Benchmark diagnostic logging performance
    - Verify overhead < 5ms per request
    - Optimize if necessary
    - _Requirements: All requirements (performance)_
  
  - [ ] 15.2 Measure pass-through mode overhead
    - Benchmark pass-through mode activation
    - Verify overhead < 1ms per stage
    - Compare with AI model call latency
    - _Requirements: All requirements (performance)_
  
  - [ ] 15.3 Measure memory overhead
    - Measure degraded state tracking memory usage
    - Verify < 1KB per request
    - Profile Lambda memory usage
    - _Requirements: All requirements (performance)_
  
  - [ ] 15.4 Run load tests
    - Test with high request volume
    - Test with high model failure rate
    - Verify system stability
    - _Requirements: All requirements (performance)_

- [ ] 16. Deployment and rollout
  - [ ] 16.1 Deploy to staging environment
    - Deploy all changes to staging
    - Run smoke tests
    - Verify degraded state tracking works
    - _Requirements: All requirements (deployment)_
  
  - [ ] 16.2 Monitor staging metrics
    - Monitor evidencePreserved frequency
    - Monitor degradedStages distribution
    - Monitor modelFailures patterns
    - Monitor invariant violations (should be zero)
    - _Requirements: All requirements (deployment)_
  
  - [ ] 16.3 Deploy to production
    - Deploy all changes to production
    - Monitor metrics closely
    - Be ready to rollback if issues arise
    - _Requirements: All requirements (deployment)_
  
  - [ ] 16.4 Create rollback plan
    - Document rollback procedure
    - Test rollback in staging
    - Prepare feature flag for emergency disable
    - _Requirements: All requirements (deployment)_

- [ ] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties using fast-check with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- Implementation extends existing components without breaking changes
- All pass-through modes must log fallback activation
- Evidence preservation invariant must be validated before response packaging
- Degraded state flags must be included in API response when pass-through is used
- Performance overhead must be < 5% of total request latency

