# Implementation Plan: Iterative Evidence Orchestration

## Overview

This implementation transforms FakeNewsOff's truth-analysis pipeline from shallow single-pass retrieval into a multi-stage evidence orchestration system. The implementation follows a bottom-up approach: Types → Configuration → NOVA Extensions → Core Components → Integration → Testing.

The system will use NOVA as a reasoning coordinator for claim decomposition, query generation, evidence classification, contradiction analysis, and verdict synthesis. Multi-pass retrieval with quality filtering and source diversity enforcement will produce jury-grade truth analysis.

## Tasks

- [x] 1. Set up types and data structures
  - [x] 1.1 Create orchestration.ts with core type definitions
    - Define Subclaim, ClaimDecomposition, Query, QuerySet interfaces
    - Define EvidenceCandidate, FilteredEvidence, QualityScore interfaces
    - Define SourceClass, ClassifiedSource, PageType types
    - Define EvidenceBucket, ContradictionResult, Verdict interfaces
    - Define RetrievalPass, OrchestrationConfig, OrchestrationResult interfaces
    - Define PipelineState, PipelineLog, PipelineMetrics interfaces
    - _Requirements: All requirements (foundational types)_

  - [ ]* 1.2 Write property test for type completeness
    - **Property 11: Evidence Score Completeness**
    - **Validates: Requirements 8.1-8.11**
    - Verify QualityScore contains all required dimensions
    - Generate random evidence candidates and verify scoring structure

- [-] 2. Implement configuration system
  - [x] 2.1 Create orchestrationConfig.ts with configuration loading
    - Implement DEFAULT_CONFIG with all default values
    - Implement environment variable parsing
    - Implement validateConfig function with range checks
    - Export PipelineConfig type and config loader
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [ ]* 2.2 Write property test for configuration validation
    - **Property 16: Configuration Respect**
    - **Validates: Requirements 14.1-14.6**
    - Generate random valid and invalid configurations
    - Verify validation catches out-of-range values

  - [x] 2.3 Create novaUsageTracker.ts for NOVA usage limits
    - Implement NovaUsageTracker class with call/token tracking
    - Implement canMakeCall() with rate limiting logic
    - Implement recordCall() for usage tracking
    - Implement getUsage() for metrics reporting
    - _Requirements: 15.6_

- [x] 3. Extend NOVA client with new reasoning functions
  - [x] 3.1 Add claim decomposition function to novaClient.ts
    - Implement decomposeClaimToSubclaims() function
    - Create prompt template for claim decomposition
    - Implement JSON parsing with error handling
    - Add unit tests for decomposition with example claims
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 15.1_

  - [ ]* 3.2 Write property test for claim decomposition
    - **Property 1: Claim Decomposition Completeness**
    - **Validates: Requirements 1.1-1.7**
    - Generate claims with known structure (actors, actions, objects, places, times)
    - Verify all present subclaim types are extracted

  - [x] 3.3 Add query generation function to novaClient.ts
    - Implement generateQueriesFromSubclaims() function
    - Create prompt template for query generation
    - Implement JSON parsing with error handling
    - Add unit tests for query generation with example decompositions
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 15.2_

  - [ ]* 3.4 Write property test for query type diversity
    - **Property 2: Query Type Diversity**
    - **Validates: Requirements 2.1-2.8**
    - Generate random claim decompositions
    - Verify queries cover multiple query types appropriate to subclaims

  - [x] 3.5 Add evidence classification functions to novaClient.ts
    - Implement classifyEvidencePageType() function
    - Implement scoreEvidenceQuality() function
    - Create prompt templates for classification and scoring
    - Implement JSON parsing with fallbacks
    - Add unit tests for classification with example candidates
    - _Requirements: 4.11, 8.12, 15.3_

  - [x] 3.6 Add content verification function to novaClient.ts
    - Implement verifyEvidenceContent() function
    - Create prompt template for content verification
    - Implement extraction and relevance checking
    - Add unit tests for verification with example content
    - _Requirements: 16.1, 16.2, 16.3, 16.5_

  - [x] 3.7 Add verdict synthesis function to novaClient.ts
    - Implement synthesizeVerdict() function
    - Create prompt template for verdict synthesis
    - Implement JSON parsing with error handling
    - Add unit tests for synthesis with example evidence buckets
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 15.5_

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement core evidence filtering components
  - [x] 5.1 Create evidenceFilter.ts with EvidenceFilter class
    - Implement filter() method coordinating all filtering steps
    - Implement classifyPageType() using NOVA classification
    - Implement scoreQuality() using NOVA scoring
    - Implement verifyContent() using NOVA verification
    - Add rejection logic for generic/broken/unrelated pages
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 8.1-8.12, 11.1, 11.2, 11.3, 16.1, 16.2, 16.3_

  - [ ]* 5.2 Write property test for generic page rejection
    - **Property 4: Generic Page Rejection**
    - **Validates: Requirements 4.1-4.5**
    - Generate evidence candidates with various page types
    - Verify homepage/category/tag/search pages are rejected

  - [ ]* 5.3 Write property test for broken page rejection
    - **Property 5: Broken Page Rejection**
    - **Validates: Requirements 4.6, 4.7, 11.1-11.3**
    - Generate evidence candidates with broken/unavailable status
    - Verify they are excluded from final evidence set

  - [ ]* 5.4 Write property test for content relevance filtering
    - **Property 6: Content Relevance Filtering**
    - **Validates: Requirements 4.8, 4.9, 4.10**
    - Generate evidence with unrelated/duplicate/vague content
    - Verify rejection from final evidence set

  - [x] 5.5 Create sourceClassifier.ts with SourceClassifier class
    - Implement classify() method for evidence classification
    - Implement classifyByDomain() for known sources
    - Implement classifyByContent() using NOVA for unknown sources
    - Add authority level assignment logic
    - _Requirements: 3.1-3.12, 5.1-5.12_

  - [ ]* 5.6 Write property test for primary source prioritization
    - **Property 7: Primary Source Prioritization**
    - **Validates: Requirements 5.1-5.12**
    - Generate claims involving official events
    - Verify primary sources ranked higher than secondary sources

- [x] 6. Implement claim analysis components
  - [x] 6.1 Create claimDecomposer.ts with ClaimDecomposer class
    - Implement decompose() method calling NOVA
    - Add error handling with fallback to single subclaim
    - Add logging for decomposition results
    - _Requirements: 1.1-1.8, 13.1_

  - [x] 6.2 Create queryGenerator.ts with QueryGenerator class
    - Implement generateQueries() method calling NOVA
    - Add error handling with fallback to keyword extraction
    - Add logging for generated queries
    - _Requirements: 2.1-2.9, 13.2_

- [ ] 7. Implement evidence orchestration
  - [x] 7.1 Create evidenceOrchestrator.ts with EvidenceOrchestrator class
    - Implement orchestrate() method coordinating multi-pass retrieval
    - Implement executePass() for single retrieval pass
    - Implement shouldContinue() with stopping conditions
    - Implement buildNextPass() for progressive refinement
    - Add integration with existing GroundingService
    - Add logging for retrieval stages
    - _Requirements: 3.1-3.12, 7.1-7.10, 13.3_

  - [ ]* 7.2 Write property test for source class retrieval diversity
    - **Property 3: Source Class Retrieval Diversity**
    - **Validates: Requirements 3.1-3.12**
    - Generate query sets targeting different source classes
    - Verify orchestrator attempts retrieval from multiple classes

  - [ ]* 7.3 Write property test for iterative refinement stopping conditions
    - **Property 9: Iterative Refinement Stopping Conditions**
    - **Validates: Requirements 7.8, 7.9, 7.10**
    - Generate orchestration runs with various quality levels
    - Verify stopping when threshold reached, max passes reached, or no improvement

  - [ ]* 7.4 Write property test for multi-pass progression
    - **Property 10: Multi-Pass Progression**
    - **Validates: Requirements 7.2-7.7**
    - Generate orchestration runs not meeting first-pass threshold
    - Verify second pass uses targeted strategies, third pass uses contradiction/primary

  - [ ] 7.5 Implement source diversity enforcement algorithm
    - Implement enforceSourceDiversity() function
    - Add two-pass selection (diversity first, then quality)
    - Add primary source requirement enforcement
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ]* 7.6 Write property test for final evidence diversity
    - **Property 12: Final Evidence Diversity**
    - **Validates: Requirements 9.1-9.6**
    - Generate evidence sets with multiple source classes available
    - Verify final set includes at least one from each available class

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement contradiction search and verdict synthesis
  - [x] 9.1 Create contradictionSearcher.ts with ContradictionSearcher class
    - Implement searchContradictions() method
    - Implement generateContradictionQueries() using NOVA
    - Add integration with GroundingService and EvidenceFilter
    - Add logging for contradiction search results
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 13.6_

  - [ ]* 9.2 Write property test for contradictory evidence inclusion
    - **Property 8: Contradictory Evidence Inclusion**
    - **Validates: Requirements 6.4**
    - Generate verdicts where contradictory evidence was found
    - Verify contradictory evidence included in final analysis

  - [x] 9.3 Create verdictSynthesizer.ts with VerdictSynthesizer class
    - Implement synthesize() method calling NOVA
    - Add error handling with partial results fallback
    - Add logging for verdict production
    - _Requirements: 10.1-10.9, 13.7_

  - [ ]* 9.4 Write property test for verdict structure completeness
    - **Property 13: Verdict Structure Completeness**
    - **Validates: Requirements 10.1-10.8**
    - Generate completed evidence collections
    - Verify verdict contains all required fields

  - [ ]* 9.5 Write property test for evidence categorization
    - **Property 14: Evidence Categorization**
    - **Validates: Requirements 12.1-12.6**
    - Generate final evidence sets
    - Verify each piece categorized by type for user display

- [ ] 10. Implement pipeline integration
  - [x] 10.1 Create iterativeOrchestrationPipeline.ts with main pipeline function
    - Implement analyzeWithIterativeOrchestration() function
    - Wire together all components in correct order
    - Add comprehensive error handling with graceful degradation
    - Add structured logging for all stages
    - Add metrics collection
    - _Requirements: 13.1-13.7_

  - [ ]* 10.2 Write property test for pipeline observability
    - **Property 15: Pipeline Observability**
    - **Validates: Requirements 13.1-13.7**
    - Generate pipeline executions
    - Verify structured logs generated for each major stage

  - [x] 10.3 Add feature flag and integration to lambda.ts
    - Add USE_ITERATIVE_ORCHESTRATION environment variable
    - Implement conditional routing to new pipeline
    - Maintain backward compatibility with existing endpoint
    - Add EnhancedAnalysisResponse type with optional orchestration field
    - _Requirements: All requirements (integration point)_

  - [ ] 10.4 Implement round-trip verification utility
    - Create verifyRoundTrip() function
    - Implement re-analysis logic
    - Implement classification compatibility checking
    - Add confidence range validation
    - _Requirements: 16.4_

  - [ ]* 10.5 Write property test for verdict consistency (round-trip)
    - **Property 18: Verdict Consistency (Round-Trip)**
    - **Validates: Requirements 16.4**
    - Generate final verdicts with supporting evidence
    - Re-analyze original claim with that evidence
    - Verify same classification (allowing minor confidence variations)

- [ ] 11. Implement error handling and resilience
  - [ ] 11.1 Add retry logic with exponential backoff
    - Implement retryWithBackoff() utility function
    - Add to NOVA client calls
    - Add to grounding service calls
    - _Requirements: All requirements (error handling)_

  - [ ] 11.2 Add circuit breaker for NOVA calls
    - Implement circuitBreaker() utility function
    - Add threshold-based failure detection
    - Add automatic recovery logic
    - _Requirements: 15.6_

  - [ ] 11.3 Add graceful degradation handlers
    - Implement fallbackToHeuristics() for NOVA failures
    - Implement returnPartialResults() for pipeline failures
    - Add fallback logic to each component
    - _Requirements: All requirements (error handling)_

- [ ] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Add comprehensive unit tests
  - [ ] 13.1 Write unit tests for ClaimDecomposer
    - Test specific claim examples (actors, actions, objects, places, times)
    - Test edge cases (empty claims, malformed input, special characters)
    - Test error conditions (NOVA timeout, invalid response)
    - _Requirements: 1.1-1.8_

  - [ ] 13.2 Write unit tests for QueryGenerator
    - Test specific decomposition examples
    - Test query type generation for different subclaim types
    - Test error conditions (NOVA timeout, invalid response)
    - _Requirements: 2.1-2.9_

  - [ ] 13.3 Write unit tests for EvidenceFilter
    - Test page type classification with specific examples
    - Test quality scoring with specific evidence candidates
    - Test content verification with specific content
    - Test rejection logic for each rejection reason
    - _Requirements: 4.1-4.11, 8.1-8.12, 11.1-11.3, 16.1-16.3_

  - [ ] 13.4 Write unit tests for SourceClassifier
    - Test domain-based classification for known sources
    - Test content-based classification for unknown sources
    - Test authority level assignment
    - _Requirements: 3.1-3.12, 5.1-5.12_

  - [ ] 13.5 Write unit tests for EvidenceOrchestrator
    - Test single-pass execution
    - Test multi-pass execution with refinement
    - Test stopping conditions
    - Test source diversity enforcement
    - Test integration with GroundingService (mocked)
    - _Requirements: 3.1-3.12, 7.1-7.10, 9.1-9.6_

  - [ ] 13.6 Write unit tests for ContradictionSearcher
    - Test contradiction query generation
    - Test contradiction evidence retrieval
    - Test contradiction strength assessment
    - _Requirements: 6.1-6.5_

  - [ ] 13.7 Write unit tests for VerdictSynthesizer
    - Test verdict classification logic
    - Test confidence calculation
    - Test rationale generation
    - Test verdict structure completeness
    - _Requirements: 10.1-10.9_

  - [ ] 13.8 Write unit tests for configuration system
    - Test configuration loading from environment
    - Test configuration validation
    - Test default values
    - _Requirements: 14.1-14.6_

  - [ ] 13.9 Write unit tests for NOVA usage tracker
    - Test call counting
    - Test token counting
    - Test rate limiting
    - Test usage reporting
    - _Requirements: 15.6_

- [x] 14. Add integration tests
  - [x] 14.1 Write end-to-end integration test for complete pipeline
    - Test claim → verdict flow with real NOVA client (test environment)
    - Test with real GroundingService (test API keys)
    - Verify all components work together
    - Measure performance benchmarks (latency, NOVA call count)
    - _Requirements: All requirements (integration)_

  - [x] 14.2 Write integration test for error scenarios
    - Test NOVA timeout handling
    - Test grounding service failure handling
    - Test partial results handling
    - Test graceful degradation
    - _Requirements: All requirements (error handling)_

  - [x] 14.3 Write integration test for feature flag
    - Test routing to new pipeline when flag enabled
    - Test routing to legacy pipeline when flag disabled
    - Test backward compatibility
    - _Requirements: All requirements (integration)_

- [ ] 15. Add performance optimization
  - [ ] 15.1 Implement NOVA response caching
    - Create cache key generation from prompts
    - Add cache lookup before NOVA calls
    - Add cache storage after NOVA responses
    - Set appropriate TTL values
    - _Requirements: 15.6_

  - [ ] 15.2 Implement parallel execution for independent operations
    - Parallelize query execution within a pass
    - Parallelize evidence filtering operations
    - Add concurrency limits to prevent overload
    - _Requirements: All requirements (performance)_

  - [ ] 15.3 Add timeout enforcement
    - Add timeouts to all NOVA calls
    - Add timeouts to all grounding calls
    - Add overall pipeline timeout
    - _Requirements: All requirements (performance)_

- [ ] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Add documentation and observability
  - [ ] 17.1 Add inline code documentation
    - Document all public interfaces
    - Document complex algorithms
    - Add usage examples
    - _Requirements: All requirements (documentation)_

  - [ ] 17.2 Add metrics collection and logging
    - Implement PipelineMetrics collection
    - Add structured logging for all stages
    - Add performance metrics (latency, call counts)
    - Add quality metrics (evidence scores, diversity)
    - _Requirements: 13.1-13.7_

  - [ ] 17.3 Update API documentation
    - Document EnhancedAnalysisResponse structure
    - Document feature flag usage
    - Document configuration options
    - Add migration guide from legacy pipeline
    - _Requirements: All requirements (documentation)_

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties using fast-check with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- Implementation follows bottom-up order: Types → Configuration → NOVA → Components → Integration
- Feature flag enables gradual rollout without breaking existing functionality
- All NOVA calls must respect usage limits and include error handling
- Round-trip verification ensures evidence actually supports verdicts
