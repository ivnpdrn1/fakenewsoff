# Implementation Plan: Production-Grade Evidence Retrieval Reliability

## Overview

This implementation plan transforms FakeNewsOff's evidence retrieval system from demo-reliable to production-reliable through a 6-phase rollout.

## Implementation Language

TypeScript (as specified in the design document)

## Tasks

### Phase 1: Foundation Components (Week 1)

- [ ] 1. Set up core types and interfaces
  - Create `backend/src/types/productionRetrieval.ts` with all type definitions
  - _Requirements: 1.1-1.5, 2.1-2.6, 6.1-6.6, 8.1-8.6, 9.1-9.7, 10.1-10.5_


- [ ] 2. Implement InputTypeDetector
  - [ ] 2.1 Create `backend/src/services/inputTypeDetector.ts`
    - Implement detect() method with URL, headline, article body, and raw claim detection
    - _Requirements: 1.5_
  
  - [ ]* 2.2 Write property test for InputTypeDetector
    - **Property 2: Input Type Detection**
    - **Validates: Requirements 1.5**
  
  - [ ]* 2.3 Write unit tests for InputTypeDetector
    - Test URL detection (various URL formats)
    - Test headline detection (short, title case)
    - Test article body detection (long, paragraphs)
    - Test edge cases (empty, special characters)
    - _Requirements: 1.5_

- [ ] 3. Implement ClaimNormalizerService
  - [ ] 3.1 Create `backend/src/services/claimNormalizerService.ts`
    - Implement normalize() method with entity, event, temporal, location extraction
    - Implement serialize(), parse(), prettyPrint() methods
    - Use regex patterns for entity extraction
    - Generate 2-3 retrieval queries with different formulations
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 18.1, 18.2, 18.3_
  
  - [ ]* 3.2 Write property tests for ClaimNormalizerService
    - **Property 3: Entity Extraction Completeness**
    - **Validates: Requirements 2.1**
    - **Property 7: Query Generation Minimum**
    - **Validates: Requirements 2.5**
    - **Property 8: Normalized Claim Structure Completeness**
    - **Validates: Requirements 2.6**
    - **Property 38: Normalized Claim Serialization Round-Trip**
    - **Validates: Requirements 18.1, 18.2, 18.3, 18.4**
    - **Property 39: Invalid JSON Error Handling**
    - **Validates: Requirements 18.5**
  
  - [ ]* 3.3 Write unit tests for ClaimNormalizerService
    - Test entity extraction (proper nouns, dates, locations)
    - Test event identification (actions, verbs)
    - Test query generation (multiple formulations)
    - Test fallback behavior (extraction failures)
    - Test serialization/deserialization
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 18.1-18.5_


- [ ] 4. Implement EvidenceProviderAdapter layer
  - [ ] 4.1 Create `backend/src/services/evidenceProviderAdapter.ts`
    - Define EvidenceProvider interface with search() and healthCheck() methods
    - Implement EvidenceProviderAdapter class with provider registry
    - Implement search() with fallback logic across providers
    - Implement registerProvider() and getHealthStatus() methods
    - _Requirements: 16.1, 16.2, 16.3, 16.4_
  
  - [ ] 4.2 Create BingNewsProvider wrapper
    - Create `backend/src/services/providers/bingNewsProvider.ts`
    - Wrap existing BingNewsClient in EvidenceProvider interface
    - Implement search() delegating to existing client
    - Implement healthCheck() method
    - _Requirements: 16.1, 16.3_
  
  - [ ] 4.3 Create GDELTProvider wrapper
    - Create `backend/src/services/providers/gdeltProvider.ts`
    - Wrap existing GDELTClient in EvidenceProvider interface
    - Implement search() delegating to existing client
    - Implement healthCheck() method
    - _Requirements: 16.1, 16.3_
  
  - [ ]* 4.4 Write property tests for EvidenceProviderAdapter
    - **Property 25: Provider Error Logging**
    - **Validates: Requirements 11.1, 11.2, 11.3**
    - **Property 26: Graceful Degradation**
    - **Validates: Requirements 11.4**
    - **Property 35: Provider Interface Definition**
    - **Validates: Requirements 16.1**
    - **Property 37: Provider Registry Loading**
    - **Validates: Requirements 16.3, 16.4**
  
  - [ ]* 4.5 Write unit tests for provider adapters
    - Test provider registration
    - Test search with fallback logic
    - Test health check aggregation
    - Test error handling and logging
    - _Requirements: 11.1-11.4, 16.1-16.4_

- [ ] 5. Checkpoint - Verify foundation components
  - Ensure all tests pass, ask the user if questions arise.



### Phase 2: Retrieval Orchestration (Week 2)

- [ ] 6. Implement RetrievalOrchestrator
  - [ ] 6.1 Create `backend/src/services/retrievalOrchestrator.ts`
    - Implement orchestrate() method coordinating all strategies
    - Implement executeStrategy() for each of 6 strategies
    - Implement hasSufficientEvidence() for early termination logic
    - Implement generateAlternativeQueries() for query reformulation
    - Execute strategies in order: url_analysis, exact_headline, normalized_claim, entity_event, time_expanded, reputable_domains
    - Track queries attempted, providers used, latency
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 10.1, 10.2, 14.1, 14.2, 14.3_
  
  - [ ]* 6.2 Write property tests for RetrievalOrchestrator
    - **Property 1: Input Type Processing**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
    - **Property 9: Strategy Execution Order**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
    - **Property 10: Early Termination on Sufficient Evidence**
    - **Validates: Requirements 3.8**
    - **Property 11: Query Reformulation on Failure**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - **Property 24: Retrieval Metadata Completeness**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**
    - **Property 32: Latency Budget Compliance**
    - **Validates: Requirements 14.1, 14.2, 14.3**
    - **Property 33: Default Latency Budget**
    - **Validates: Requirements 14.4**
  
  - [ ]* 6.3 Write unit tests for RetrievalOrchestrator
    - Test strategy execution order
    - Test early termination logic
    - Test latency budget enforcement
    - Test query reformulation on zero results
    - Test metadata collection
    - _Requirements: 3.1-3.8, 4.1-4.3, 10.1-10.5, 14.1-14.4_

- [ ] 7. Implement ObservabilityService
  - [ ] 7.1 Create `backend/src/services/observabilityService.ts`
    - Implement logEvent() for generic pipeline events
    - Implement logStrategyExecution() for strategy tracking
    - Implement logProviderInvocation() for provider tracking
    - Implement logDeduplication() for dedup tracking
    - Implement logVerdictDetermination() for verdict tracking
    - Include timestamp, requestId, component, event, data in all logs
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_
  
  - [ ]* 7.2 Write property test for ObservabilityService
    - **Property 34: Structured Logging Completeness**
    - **Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5**
  
  - [ ]* 7.3 Write unit tests for ObservabilityService
    - Test log entry structure
    - Test all log methods
    - Test timestamp and requestId inclusion
    - _Requirements: 15.1-15.5_

- [ ] 8. Checkpoint - Verify orchestration components
  - Ensure all tests pass, ask the user if questions arise.



### Phase 3: Evidence Scoring and Aggregation (Week 3)

- [ ] 9. Implement EvidenceScoringEngine
  - [ ] 9.1 Create `backend/src/services/evidenceScoringEngine.ts`
    - Implement score() method for multi-dimensional scoring
    - Implement calculateCredibilityScore() using domain reputation tiers
    - Implement calculateRelevanceScore() using keyword overlap
    - Implement calculateFreshnessScore() using publish date decay
    - Implement calculateStanceScore() for support/contradict detection
    - Implement calculateEntityOverlapScore() for entity matching
    - Implement calculateCompositeScore() with weighted average (credibility 30%, relevance 30%, freshness 15%, entityOverlap 15%, stance 10%)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [ ]* 9.2 Write property tests for EvidenceScoringEngine
    - **Property 15: Evidence Score Bounds**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
    - **Property 16: Evidence Score Structure Completeness**
    - **Validates: Requirements 6.6**
  
  - [ ]* 9.3 Write unit tests for EvidenceScoringEngine
    - Test credibility scoring with known domains
    - Test relevance scoring with keyword overlap
    - Test freshness scoring with various dates
    - Test stance scoring with support/contradict examples
    - Test entity overlap scoring
    - Test composite score calculation
    - Test score bounds validation
    - _Requirements: 6.1-6.6_

- [ ] 10. Implement EvidenceAggregator
  - [ ] 10.1 Create `backend/src/services/evidenceAggregator.ts`
    - Implement aggregate() method merging multiple evidence sets
    - Implement deduplicateByUrl() with canonical URL normalization
    - Implement deduplicateByTitle() with Levenshtein distance (threshold 0.85)
    - Implement canonicalizeUrl() removing tracking params
    - Implement calculateTitleSimilarity() using Levenshtein distance
    - Retain highest credibility score among duplicates
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ]* 10.2 Write property tests for EvidenceAggregator
    - **Property 12: URL Deduplication**
    - **Validates: Requirements 5.1, 5.4**
    - **Property 13: Title Similarity Deduplication**
    - **Validates: Requirements 5.2, 5.4**
    - **Property 14: Domain Deduplication for Exact Titles**
    - **Validates: Requirements 5.3, 5.4**
  
  - [ ]* 10.3 Write unit tests for EvidenceAggregator
    - Test URL canonicalization (remove tracking params)
    - Test title similarity calculation
    - Test deduplication by URL
    - Test deduplication by title similarity
    - Test deduplication by domain + exact title
    - Test duplicate selection (highest credibility)
    - _Requirements: 5.1-5.4_

- [ ] 11. Checkpoint - Verify scoring and aggregation
  - Ensure all tests pass, ask the user if questions arise.



### Phase 4: Extended Verdict Engine (Week 4)

- [ ] 12. Extend VerdictEngine with score-based classification
  - [ ] 12.1 Create `backend/src/services/verdictEngineExtended.ts`
    - Implement determineVerdict() using evidence scores
    - Implement calculateConfidence() based on evidence quality and quantity
    - Implement generateReasonCodes() for all reason code types
    - Implement generateConfidenceExplanation() for human-readable explanations
    - Classification logic: Supported (>= 3 sources, composite >= 0.7, consistent stance), Disputed (conflicting stance), Unverified (< 3 sources or composite < 0.5), Manipulated (manipulation indicators)
    - Reason codes: NO_EVIDENCE_FOUND, SINGLE_SOURCE_ONLY, PROVIDER_TIMEOUT, LOW_RELEVANCE_EVIDENCE, CONFLICTING_REPORTS, STRONG_CORROBORATION, MULTIPLE_CREDIBLE_SOURCES, INSUFFICIENT_QUALITY
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_
  
  - [ ]* 12.2 Write property tests for VerdictEngine
    - **Property 18: Verdict Classification Validity**
    - **Validates: Requirements 8.1**
    - **Property 19: Verdict Classification Logic**
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5**
    - **Property 20: Score-Based Classification**
    - **Validates: Requirements 8.6**
    - **Property 21: Reason Code Presence**
    - **Validates: Requirements 9.1**
    - **Property 22: Specific Reason Codes**
    - **Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.6**
    - **Property 23: Multiple Reason Codes**
    - **Validates: Requirements 9.7**
  
  - [ ]* 12.3 Write unit tests for VerdictEngine
    - Test classification logic (supported, disputed, unverified, manipulated)
    - Test reason code generation for each scenario
    - Test confidence calculation
    - Test explanation generation
    - Test score threshold enforcement
    - _Requirements: 8.1-8.6, 9.1-9.7_

- [ ] 13. Implement UrlAnalysisPipeline
  - [ ] 13.1 Create `backend/src/services/urlAnalysisPipeline.ts`
    - Implement analyze() method for URL verification
    - Implement fetchArticle() reusing existing FetchService
    - Implement extractClaims() using existing NovaClient
    - Implement searchCorroboration() using RetrievalOrchestrator
    - Return both article content and corroborating evidence
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ] 13.2 Create ClaimExtractor service
    - Create `backend/src/services/claimExtractor.ts`
    - Implement extract() method using NovaClient for claim extraction
    - Extract 1-3 key claims from article body
    - _Requirements: 7.2_
  
  - [ ]* 13.3 Write property test for UrlAnalysisPipeline
    - **Property 17: URL Analysis Pipeline Execution**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
  
  - [ ]* 13.4 Write unit tests for UrlAnalysisPipeline
    - Test article fetching
    - Test claim extraction
    - Test corroboration search
    - Test single source detection
    - Test error handling (404, timeout, parse failure)
    - _Requirements: 7.1-7.5_

- [ ] 14. Checkpoint - Verify verdict engine and URL analysis
  - Ensure all tests pass, ask the user if questions arise.



### Phase 5: API Integration and Backward Compatibility (Week 5)

- [ ] 15. Extend API response schema
  - [ ] 15.1 Update `backend/src/types/grounding.ts`
    - Add ExtendedAnalysisResponse interface with optional new fields
    - Add normalizedClaim, retrievalMetadata, evidenceSummary, reasonCodes, confidenceExplanation fields
    - Maintain all existing fields (status, confidence, sources, sift, recommendation)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  
  - [ ]* 15.2 Write property tests for response schema
    - **Property 27: Extended Response Structure**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4**
    - **Property 28: Backward Compatibility**
    - **Validates: Requirements 12.5**
  
  - [ ]* 15.3 Write unit tests for response schema
    - Test all existing fields are present
    - Test new fields are optional
    - Test backward compatibility with old response format
    - _Requirements: 12.1-12.5_

- [ ] 16. Integrate production retrieval into lambda handler
  - [ ] 16.1 Update `backend/src/lambda.ts`
    - Add feature flag ENABLE_PRODUCTION_RETRIEVAL (default: false)
    - When flag enabled, use new RetrievalOrchestrator pipeline
    - When flag disabled, use existing GroundingService
    - Wire all components: InputTypeDetector → ClaimNormalizer → RetrievalOrchestrator → EvidenceScoringEngine → EvidenceAggregator → VerdictEngine
    - For URL inputs, use UrlAnalysisPipeline
    - Populate extended response fields
    - _Requirements: 1.1-1.5, 12.1-12.5_
  
  - [ ]* 16.2 Write integration tests for lambda handler
    - Test end-to-end flow with production retrieval enabled
    - Test end-to-end flow with production retrieval disabled
    - Test URL analysis path
    - Test text claim path
    - Test response structure
    - _Requirements: 1.1-1.5, 12.1-12.5_

- [ ] 17. Extend CacheService for new response fields
  - [ ] 17.1 Update `backend/src/services/cacheService.ts`
    - Add cache versioning (version 2)
    - Include normalizedClaim, retrievalMetadata, reasonCodes in cached responses
    - Handle cache hits from old format (version 1)
    - _Requirements: 12.1-12.5_
  
  - [ ]* 17.2 Write unit tests for cache versioning
    - Test caching with new fields
    - Test cache hits from old format
    - Test cache migration
    - _Requirements: 12.1-12.5_

- [ ] 18. Extend Demo Mode with new response fields
  - [ ] 18.1 Update `backend/src/utils/demoMode.ts`
    - Add getDemoNormalizedClaim() function
    - Add getDemoRetrievalMetadata() function
    - Add getDemoReasonCodes() function
    - Extend existing demo fixtures with new fields
    - _Requirements: 13.1, 13.2, 13.3, 13.4_
  
  - [ ]* 18.2 Write property tests for Demo Mode
    - **Property 29: Demo Mode Isolation**
    - **Validates: Requirements 13.1, 13.2**
    - **Property 30: Production Mode Real-Time Queries**
    - **Validates: Requirements 13.3**
    - **Property 31: Mode Switching Without Code Changes**
    - **Validates: Requirements 13.4**
  
  - [ ]* 18.3 Write unit tests for Demo Mode
    - Test demo mode returns synthetic data
    - Test demo mode does not invoke providers
    - Test production mode uses real providers
    - Test mode switching via configuration
    - _Requirements: 13.1-13.4_

- [ ] 19. Checkpoint - Verify API integration and compatibility
  - Ensure all tests pass, ask the user if questions arise.



### Phase 6: Production Validation and Rollout (Week 6)

- [ ] 20. Add configuration management
  - [ ] 20.1 Create `backend/src/config/productionRetrievalConfig.ts`
    - Export DEFAULT_CONFIG with all default values
    - Export loadConfig() to load from environment variables
    - Support configuration overrides for latency budget, strategies, thresholds
    - _Requirements: 14.1-14.4_
  
  - [ ]* 20.2 Write unit tests for configuration
    - Test default configuration values
    - Test environment variable loading
    - Test configuration validation
    - _Requirements: 14.1-14.4_

- [ ] 21. Add error handling and recovery
  - [ ] 21.1 Create error handling utilities in `backend/src/utils/productionRetrievalErrors.ts`
    - Implement handleProviderError() for provider failures
    - Implement handleNormalizationError() for normalization failures
    - Implement handleScoringError() for scoring failures
    - Implement handleUrlAnalysisError() for URL analysis failures
    - Implement handleLatencyBudgetExceeded() for timeout scenarios
    - All error handlers should log errors and return graceful fallbacks
    - _Requirements: 11.1-11.4, 14.1-14.3_
  
  - [ ]* 21.2 Write unit tests for error handling
    - Test provider error recovery
    - Test normalization error fallback
    - Test scoring error defaults
    - Test URL analysis error handling
    - Test latency budget exceeded handling
    - _Requirements: 11.1-11.4, 14.1-14.3_

- [ ] 22. Add validation gates compliance
  - [ ] 22.1 Run TypeScript type checking
    - Execute `npm run typecheck` in backend directory
    - Fix any type errors
    - _Requirements: 17.1_
  
  - [ ] 22.2 Run linting
    - Execute `npm run lint` in backend directory
    - Fix any linting errors
    - _Requirements: 17.2_
  
  - [ ] 22.3 Run all existing tests
    - Execute `npm test` in backend directory
    - Ensure all existing tests pass
    - _Requirements: 17.3, 17.4_
  
  - [ ] 22.4 Run build
    - Execute `npm run build` in backend directory
    - Ensure build succeeds without errors
    - _Requirements: 17.5_

- [ ] 23. Add integration tests for complete pipeline
  - [ ]* 23.1 Write end-to-end integration tests
    - Test complete flow: raw claim → verdict with all components
    - Test complete flow: URL → article analysis → verdict
    - Test provider fallback scenarios
    - Test latency budget enforcement
    - Test demo mode vs production mode
    - _Requirements: 1.1-1.5, 7.1-7.5, 11.1-11.4, 13.1-13.4, 14.1-14.4_

- [ ] 24. Add performance benchmarks
  - [ ]* 24.1 Create performance test suite
    - Benchmark end-to-end latency (P50, P95, P99)
    - Benchmark individual component latency
    - Benchmark memory usage
    - Target: P95 < 10 seconds, P99 < 15 seconds
    - _Requirements: 14.1-14.4_

- [ ] 25. Update documentation
  - [ ] 25.1 Update architecture documentation
    - Document new components and their interactions
    - Update `backend/docs/architecture.md`
    - _Requirements: All_
  
  - [ ] 25.2 Create deployment guide
    - Document feature flag usage
    - Document configuration options
    - Document rollout strategy
    - Create `backend/docs/production-retrieval-deployment.md`
    - _Requirements: All_
  
  - [ ] 25.3 Update API documentation
    - Document extended response fields
    - Document backward compatibility guarantees
    - Update `backend/docs/api.md` or equivalent
    - _Requirements: 12.1-12.5_

- [ ] 26. Final checkpoint - Production readiness validation
  - Ensure all tests pass, ask the user if questions arise.



## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at the end of each phase
- Property tests validate universal correctness properties using fast-check library with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- All property tests must include the tag format: `Feature: production-grade-evidence-retrieval-reliability, Property {number}: {property_text}`
- The feature flag `ENABLE_PRODUCTION_RETRIEVAL` controls rollout (default: false)
- All new code must pass existing validation gates: typecheck, lint, tests, build
- Backward compatibility is critical - all existing API contracts must be preserved
- Demo Mode must remain functional throughout implementation

## Property Test Configuration

All property-based tests should use the following configuration:

```typescript
import fc from 'fast-check';

// Example property test structure
describe('Property N: Property Name', () => {
  it('should validate property description', async () => {
    // Feature: production-grade-evidence-retrieval-reliability, Property N
    await fc.assert(
      fc.asyncProperty(
        // arbitraries here
        async (input) => {
          // test logic here
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

## Rollout Strategy

1. Deploy with `ENABLE_PRODUCTION_RETRIEVAL=false` (default to existing behavior)
2. Enable for internal testing
3. Enable for 10% of traffic
4. Monitor metrics (latency, error rate, verdict distribution)
5. Increase to 50% if metrics are good
6. Increase to 100% after 1 week of stable operation

## Rollback Plan

- If error rate > 5%, rollback to existing behavior
- If P95 latency > 15 seconds, rollback
- If verdict quality degrades, rollback

## Key Metrics to Monitor

- Request latency (P50, P95, P99)
- Provider success rate
- Strategy execution counts
- Evidence quality scores (average)
- Verdict distribution
- Reason code distribution
- Cache hit rate
- Error rate by component
