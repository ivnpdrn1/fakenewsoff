# Implementation Plan: Text-Only Grounding

## Overview

This implementation plan transforms the application from a URL-based fact-checker into a general-purpose claim verification tool. The feature enables users to fact-check text claims without requiring a URL by automatically generating search queries, retrieving sources from multiple providers, classifying stance relationships, and returning at least 3 sources when available.

The implementation follows a 5-phase approach: Core Infrastructure (Backend), API Integration, Frontend Components, Testing, and Performance Optimization. Each task builds incrementally on previous work, with checkpoints to ensure quality gates are met.

## Tasks

### Phase 1: Core Infrastructure (Backend)

- [ ] 1. Create Query Builder component
  - [x] 1.1 Create queryBuilder.ts with core interfaces
    - Create `backend/src/utils/queryBuilder.ts`
    - Define `QueryRequest`, `QueryGenerationResult` interfaces
    - Implement `parseQueryRequest()` function for extracting entities and key phrases
    - Implement `formatQuery()` function for converting QueryRequest to search string
    - _Requirements: 1.2, 1.4, 13.1, 13.2, 13.3, 13.5_
  
  - [x] 1.2 Implement query generation logic
    - Implement `generateQueries()` function that produces 3-6 diverse queries
    - Add entity extraction using regex patterns for people, places, organizations
    - Add key phrase extraction using stop word removal and n-gram analysis
    - Add temporal keyword detection (yesterday, today, recent, breaking, latest)
    - Add recency hint generation for temporal queries
    - Add quoted phrase generation for main claims
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 13.4_
  
  - [ ]* 1.3 Write unit tests for Query Builder
    - Test query generation with various text patterns
    - Test entity extraction with known entities
    - Test temporal keyword detection
    - Test quoted phrase generation
    - Test edge cases (empty text, very long text, special characters)
    - _Requirements: 11.1_

- [ ] 2. Create Stance Classifier component
  - [x] 2.1 Create stanceClassifier.ts with core interfaces
    - Create `backend/src/services/stanceClassifier.ts`
    - Define `Stance` type and `StanceResult` interface
    - Implement keyword-based heuristics for support detection
    - Implement keyword-based heuristics for contradiction detection
    - _Requirements: 4.8, 5.1, 5.3, 5.5, 5.6_
  
  - [x] 2.2 Implement LLM fallback for uncertain cases
    - Add LLM invocation for uncertain stance classifications
    - Implement stance justification generation (max 1 sentence)
    - Add confidence scoring logic
    - Handle edge cases (satire, opinion, unclear)
    - _Requirements: 5.2, 5.4_
  
  - [ ]* 2.3 Write unit tests for Stance Classifier
    - Test keyword detection with known support/contradiction keywords
    - Test LLM fallback with mocked LLM responses
    - Test justification length constraint
    - Test edge cases (satire, opinion, unclear)
    - _Requirements: 11.1_

- [ ] 3. Extend Grounding Service for text-only grounding
  - [x] 3.1 Add groundTextOnly() method to groundingService.ts
    - Extend `backend/src/services/groundingService.ts`
    - Implement `groundTextOnly()` method that accepts text and returns TextGroundingBundle
    - Add multi-query orchestration logic
    - Add provider fallback logic (Bing → GDELT)
    - Add result aggregation across queries
    - _Requirements: 1.1, 2.1, 2.2_
  
  - [x] 3.2 Implement deduplication logic
    - Add URL deduplication (exact match after normalization)
    - Add title similarity deduplication (>80% Jaccard similarity)
    - Add domain diversity scoring
    - _Requirements: 2.3, 2.4, 3.3_
  
  - [x] 3.3 Implement ranking and capping logic
    - Add ranking by relevance (0.3), credibility (0.3), recency (0.2), diversity (0.2)
    - Add result capping at 6 sources
    - Add minimum source guarantee (return at least 3 if available)
    - _Requirements: 3.1, 3.2, 3.5_
  
  - [x] 3.4 Add zero results handling
    - Implement reason code generation (PROVIDER_EMPTY, QUERY_TOO_VAGUE, KEYS_MISSING)
    - Add logging for zero results scenarios
    - _Requirements: 7.1, 7.2, 7.3, 7.5_
  
  - [ ]* 3.5 Write unit tests for Grounding Service extensions
    - Test text-only request triggers query generation
    - Test provider fallback with mocked providers
    - Test minimum source guarantee
    - Test zero results handling with reason codes
    - Test deduplication by URL and title similarity
    - _Requirements: 11.2, 11.3, 11.6, 11.7_

- [ ] 4. Extend Source Normalizer with credibility and similarity
  - [x] 4.1 Add credibility tier assignment
    - Extend `backend/src/services/sourceNormalizer.ts`
    - Implement `assignCredibilityTier()` function using domain mapping
    - Add tier 1 domains (reuters, apnews, bbc, nytimes, washingtonpost, wsj, npr)
    - Add tier 2 domains (cnn, theguardian, bloomberg, politico, axios)
    - Default to tier 3 for all other domains
    - _Requirements: 4.9_
  
  - [x] 4.2 Add title similarity calculation
    - Implement `calculateTitleSimilarity()` using Jaccard index
    - Implement `deduplicateByTitleSimilarity()` with 80% threshold
    - _Requirements: 2.4_
  
  - [ ]* 4.3 Write unit tests for Source Normalizer extensions
    - Test credibility tier assignment for known domains
    - Test title similarity calculation with various title pairs
    - Test deduplication by title similarity
    - _Requirements: 11.1_

- [ ] 5. Update type definitions
  - [x] 5.1 Extend grounding.ts types
    - Extend `backend/src/types/grounding.ts`
    - Add `NormalizedSourceWithStance` interface
    - Add `TextGroundingBundle` interface
    - Add `ReasonCode` type
    - Add `Stance` type
    - _Requirements: 4.8, 6.6, 6.7, 6.8, 6.9_
  
  - [x] 5.2 Update backend-schemas.ts with Zod schemas
    - Extend `frontend/shared/schemas/backend-schemas.ts`
    - Add Zod schema for `NormalizedSourceWithStance`
    - Add Zod schema for `TextGroundingBundle`
    - Add Zod schema for extended API response with grounding metadata
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 6. Extend Demo Mode for text-only scenarios
  - [x] 6.1 Add getDemoTextGroundingBundle() to demoGrounding.ts
    - Extend `backend/src/utils/demoGrounding.ts`
    - Implement `getDemoTextGroundingBundle()` that returns exactly 3 sources
    - Add deterministic source generation based on text hash
    - Add varied stance values (1 supports, 1 contradicts, 1 mentions)
    - Add realistic metadata (titles, snippets, dates)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [ ]* 6.2 Write unit tests for Demo Mode extensions
    - Test demo mode always returns exactly 3 sources
    - Test demo mode determinism (same input → same output)
    - Test demo mode stance diversity
    - _Requirements: 11.5_

- [x] 7. Checkpoint - Backend infrastructure complete
  - Ensure all TypeScript type checking passes
  - Ensure all backend unit tests pass
  - Ensure no linting errors
  - Ask the user if questions arise

### Phase 2: API Integration

- [ ] 8. Update /analyze endpoint for text-only requests
  - [ ] 8.1 Add text-only detection logic to lambda.ts
    - Extend `backend/src/lambda.ts`
    - Add detection for requests with text and no URL
    - Add query generation step using Query Builder
    - Add grounding step using groundTextOnly()
    - Add stance classification step for each source
    - _Requirements: 1.1, 6.1_
  
  - [ ] 8.2 Update API response format
    - Add `sources` array to response
    - Add `grounding.queries` array to response
    - Add `grounding.provider_used` array to response
    - Add `grounding.sources_count` field to response
    - Add `grounding.cache_hit` field to response
    - Add `grounding.reason_codes` array for zero results
    - Add `grounding.latency_ms` field to response
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [ ] 8.3 Add error handling for text-only requests
    - Handle empty text input (return 400)
    - Handle query generation errors (fall back to simple queries)
    - Handle provider errors (fall back to GDELT)
    - Handle stance classification errors (default to "unclear")
    - Handle cache errors (log warning, proceed without cache)
    - _Requirements: 7.4_
  
  - [ ]* 8.4 Write integration tests for /analyze endpoint
    - Test text-only request end-to-end with mocked providers
    - Test zero results handling
    - Test demo mode integration
    - Test cache hit/miss scenarios
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ] 9. Checkpoint - API integration complete
  - Ensure all API tests pass
  - Ensure API response schema validation passes
  - Test API manually with Postman or curl
  - Ask the user if questions arise

### Phase 3: Frontend Components

- [ ] 10. Create SourceCard component
  - [ ] 10.1 Create SourceCard.tsx with props interface
    - Create `frontend/web/src/components/SourceCard.tsx`
    - Define `SourceCardProps` interface
    - Implement component rendering with all metadata fields
    - Add clickable title link to source URL
    - Add publisher name display
    - Add conditional publication date display
    - Add snippet text display
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ] 10.2 Add stance badge with styling
    - Add stance badge component with stance value
    - Add green styling for "supports" stance
    - Add red styling for "contradicts" stance
    - Add blue styling for "mentions" stance
    - Add gray styling for "unclear" stance
    - Add provider tag display
    - _Requirements: 9.6, 9.7, 9.8_
  
  - [ ]* 10.3 Write component tests for SourceCard
    - Test rendering with all fields populated
    - Test rendering with missing published_at
    - Test stance badge styling for each stance value
    - Test clickable title link
    - _Requirements: 11.1_

- [ ] 11. Create ZeroResultsDisplay component
  - [ ] 11.1 Create ZeroResultsDisplay.tsx with props interface
    - Create `frontend/web/src/components/ZeroResultsDisplay.tsx`
    - Define `ZeroResultsDisplayProps` interface
    - Add "No credible sources found" message
    - Add "Queries attempted" section with query list
    - Add "Why" section with reason code explanations
    - Add "Try" section with helpful suggestions
    - _Requirements: 10.1, 10.2, 10.3_
  
  - [ ] 11.2 Add reason code translations
    - Implement reason code to user-friendly message mapping
    - PROVIDER_EMPTY → "Providers returned zero results"
    - QUERY_TOO_VAGUE → "Query was too vague to search effectively"
    - KEYS_MISSING → "Search providers are not configured"
    - _Requirements: 10.4, 10.5_
  
  - [ ]* 11.3 Write component tests for ZeroResultsDisplay
    - Test rendering with various reason codes
    - Test query list rendering
    - Test reason code translations
    - _Requirements: 11.1_

- [ ] 12. Update Results page to integrate new components
  - [ ] 12.1 Update Results.tsx to render SourceCard components
    - Extend `frontend/web/src/pages/Results.tsx`
    - Add conditional rendering: sources array not empty → render SourceCard grid
    - Add conditional rendering: sources array empty → render ZeroResultsDisplay
    - Add sources grid layout with responsive design
    - _Requirements: 9.1, 10.1_
  
  - [ ]* 12.2 Write integration tests for Results page
    - Test rendering with sources
    - Test rendering with zero results
    - Test rendering with various source counts
    - _Requirements: 11.1_

- [ ] 13. Checkpoint - Frontend components complete
  - Ensure all frontend tests pass
  - Ensure frontend builds successfully
  - Test frontend manually in browser
  - Ask the user if questions arise

### Phase 4: Testing (Property-Based Tests)

- [ ] 14. Write property tests for Query Builder (Properties 1-4)
  - [ ]* 14.1 Property 1: Text-only requests trigger query generation
    - **Property 1: For any request with non-empty text and no URL, the system should generate between 3 and 6 search queries**
    - **Validates: Requirements 1.1, 1.2**
    - Create `backend/src/utils/queryBuilder.property.test.ts`
    - Use fast-check to generate random text inputs
    - Verify 3-6 queries generated for each input
  
  - [ ]* 14.2 Property 2: Temporal keywords trigger recency hints
    - **Property 2: For any text containing temporal keywords, at least one generated query should include recency hints**
    - **Validates: Requirements 1.3**
    - Use fast-check to generate text with temporal keywords
    - Verify at least one query includes recency context
  
  - [ ]* 14.3 Property 3: Query builder extracts entities and key phrases
    - **Property 3: For any non-empty text input, the query builder should extract at least one entity or key phrase**
    - **Validates: Requirements 1.4**
    - Use fast-check to generate random text
    - Verify at least one entity or key phrase extracted
  
  - [ ]* 14.4 Property 4: Query builder includes quoted phrases
    - **Property 4: For any text with an identifiable main claim, at least one query should contain quoted phrases**
    - **Validates: Requirements 1.5**
    - Use fast-check to generate text with claims
    - Verify at least one query includes quoted phrases

- [ ] 15. Write property tests for Grounding Service (Properties 5-12)
  - [ ]* 15.1 Property 5: Provider fallback on insufficient results
    - **Property 5: For any query where Bing returns <3 results, the system should query GDELT as fallback**
    - **Validates: Requirements 2.2**
    - Create `backend/src/services/groundingService.property.test.ts`
    - Use fast-check to generate queries
    - Mock Bing to return <3 results
    - Verify GDELT is called
  
  - [ ]* 15.2 Property 6: URL deduplication
    - **Property 6: For any set of sources with duplicate URLs, each unique URL should appear at most once**
    - **Validates: Requirements 2.3**
    - Use fast-check to generate sources with duplicate URLs
    - Verify deduplication removes duplicates
  
  - [ ]* 15.3 Property 7: Title similarity deduplication
    - **Property 7: For any set of sources with >80% title similarity and same publisher, only one should appear**
    - **Validates: Requirements 2.4**
    - Use fast-check to generate sources with similar titles
    - Verify deduplication removes similar titles
  
  - [ ]* 15.4 Property 8: Provider results normalized
    - **Property 8: For any provider-specific result, normalization should produce valid NormalizedSource**
    - **Validates: Requirements 2.5, 4.1-4.9**
    - Use fast-check to generate Bing and GDELT results
    - Verify all required fields populated after normalization
  
  - [ ]* 15.5 Property 9: Minimum source guarantee
    - **Property 9: For any grounding request where providers return ≥3 sources, final result should have ≥3 sources**
    - **Validates: Requirements 3.1**
    - Use fast-check to generate provider results with ≥3 sources
    - Verify final result has ≥3 sources
  
  - [ ]* 15.6 Property 10: Source ranking order
    - **Property 10: For any set of sources, final result should be ordered by descending score**
    - **Validates: Requirements 3.2**
    - Use fast-check to generate sources with random scores
    - Verify final result is sorted by score descending
  
  - [ ]* 15.7 Property 11: Domain diversity
    - **Property 11: For any final result with ≥4 sources, at least 3 different domains should be represented**
    - **Validates: Requirements 3.3**
    - Use fast-check to generate sources from various domains
    - Verify domain diversity in final result
  
  - [ ]* 15.8 Property 12: Result count bounds
    - **Property 12: For any successful grounding request, final result should have 0 or 3-6 sources**
    - **Validates: Requirements 3.5**
    - Use fast-check to generate various provider results
    - Verify final result count is 0 or 3-6

- [ ] 16. Write property tests for Stance Classifier (Properties 13-16)
  - [ ]* 16.1 Property 13: Stance classification validity
    - **Property 13: For any classified source, stance should be one of: supports, contradicts, mentions, unclear**
    - **Validates: Requirements 4.8, 5.3**
    - Create `backend/src/services/stanceClassifier.property.test.ts`
    - Use fast-check to generate sources
    - Verify stance is valid enum value
  
  - [ ]* 16.2 Property 14: Stance justification length
    - **Property 14: For any classified source, justification should be at most 1 sentence**
    - **Validates: Requirements 5.4**
    - Use fast-check to generate sources
    - Verify justification has at most 1 period
  
  - [ ]* 16.3 Property 15: Support keyword detection
    - **Property 15: For any source with support keywords in title/snippet, heuristic should detect them**
    - **Validates: Requirements 5.5**
    - Use fast-check to generate sources with support keywords
    - Verify keyword detection works
  
  - [ ]* 16.4 Property 16: Contradiction keyword detection
    - **Property 16: For any source with contradiction keywords in title/snippet, heuristic should detect them**
    - **Validates: Requirements 5.6**
    - Use fast-check to generate sources with contradiction keywords
    - Verify keyword detection works

- [ ] 17. Write property tests for API Response (Properties 17-19)
  - [ ]* 17.1 Property 17: API response structure for text-only requests
    - **Property 17: For any text-only request, API response should include sources, queries, provider_used, sources_count, cache_hit**
    - **Validates: Requirements 6.1-6.5**
    - Create `backend/src/lambda.property.test.ts`
    - Use fast-check to generate text-only requests
    - Verify response structure is complete
  
  - [ ]* 17.2 Property 18: Zero results reason codes
    - **Property 18: For any text-only request with no sources found, response should include reason_codes**
    - **Validates: Requirements 6.6, 7.3**
    - Use fast-check to generate requests that yield zero results
    - Verify reason_codes array is populated
  
  - [ ]* 17.3 Property 19: Zero results metadata
    - **Property 19: For any text-only request with zero results, response should have empty sources and populated queries**
    - **Validates: Requirements 7.1, 7.2**
    - Use fast-check to generate requests that yield zero results
    - Verify sources is empty and queries is populated

- [ ] 18. Write property tests for Demo Mode (Properties 20-22)
  - [ ]* 18.1 Property 20: Demo mode determinism
    - **Property 20: For any text input, running demo mode twice should produce identical sources**
    - **Validates: Requirements 8.4**
    - Create `backend/src/utils/demoGrounding.property.test.ts`
    - Use fast-check to generate text inputs
    - Run demo mode twice, verify identical output
  
  - [ ]* 18.2 Property 21: Demo mode source count
    - **Property 21: For any text input in demo mode, system should return exactly 3 sources**
    - **Validates: Requirements 8.1**
    - Use fast-check to generate text inputs
    - Verify demo mode always returns 3 sources
  
  - [ ]* 18.3 Property 22: Demo mode stance diversity
    - **Property 22: For any text input in demo mode, 3 sources should include at least 2 different stances**
    - **Validates: Requirements 8.2**
    - Use fast-check to generate text inputs
    - Verify stance diversity in demo mode results

- [ ] 19. Write property tests for Frontend Components (Properties 23-28)
  - [ ]* 19.1 Property 23: SourceCard rendering
    - **Property 23: For any non-empty sources array, Results page should render one SourceCard per source**
    - **Validates: Requirements 9.1**
    - Create `frontend/web/src/components/SourceCard.property.test.tsx`
    - Use fast-check to generate sources arrays
    - Verify SourceCard count matches sources count
  
  - [ ]* 19.2 Property 24: SourceCard displays required fields
    - **Property 24: For any SourceCard, rendered output should include title, publisher, snippet, stance badge, provider tag**
    - **Validates: Requirements 9.2, 9.3, 9.5, 9.6, 9.7**
    - Use fast-check to generate sources
    - Verify all required fields are rendered
  
  - [ ]* 19.3 Property 25: SourceCard conditional date display
    - **Property 25: For any source with published_at, SourceCard should display date; without published_at, no date**
    - **Validates: Requirements 9.4**
    - Use fast-check to generate sources with/without published_at
    - Verify conditional date rendering
  
  - [ ]* 19.4 Property 26: SourceCard stance styling
    - **Property 26: For any SourceCard, stance badge should have distinct styling based on stance value**
    - **Validates: Requirements 9.8**
    - Use fast-check to generate sources with different stances
    - Verify stance badge styling is correct
  
  - [ ]* 19.5 Property 27: Zero results queries display
    - **Property 27: For any zero-results response with queries, Results page should display all queries**
    - **Validates: Requirements 10.3**
    - Create `frontend/web/src/components/ZeroResultsDisplay.property.test.tsx`
    - Use fast-check to generate zero-results responses
    - Verify all queries are displayed
  
  - [ ]* 19.6 Property 28: Reason code translation
    - **Property 28: For any reason code, Results page should display user-friendly explanation**
    - **Validates: Requirements 10.5**
    - Use fast-check to generate reason codes
    - Verify translations are correct

- [ ] 20. Write property test for Query Parsing (Property 29)
  - [ ]* 20.1 Property 29: Query parsing round-trip
    - **Property 29: For any valid QueryRequest, parse → format → parse should produce equivalent object**
    - **Validates: Requirements 13.6**
    - Use fast-check to generate QueryRequest objects
    - Verify round-trip consistency

- [ ] 21. Checkpoint - All property tests complete
  - Ensure all 29 property tests pass
  - Ensure property test coverage is 100%
  - Review property test quality and iteration counts
  - Ask the user if questions arise

### Phase 5: Performance Optimization and Final Integration

- [ ] 22. Implement parallel execution optimizations
  - [ ] 22.1 Add parallel provider queries
    - Update groundTextOnly() to execute all queries in parallel using Promise.all()
    - Add timeout of 3500ms per provider call
    - Add result aggregation as queries complete
    - _Requirements: 2.1_
  
  - [ ] 22.2 Add parallel stance classification
    - Update stance classification to process all sources in parallel
    - Add batching for LLM calls when multiple sources need classification
    - _Requirements: 5.1, 5.2_
  
  - [ ] 22.3 Add early termination logic
    - If first query returns 6+ high-quality sources, skip remaining queries
    - If cache hit, skip all provider calls
    - _Requirements: 3.1_

- [ ] 23. Add performance monitoring and logging
  - [ ] 23.1 Add latency tracking
    - Add timing for query generation (<100ms target)
    - Add timing for provider calls (<1500ms target)
    - Add timing for stance classification (<300ms target)
    - Add timing for total text-only grounding (<2000ms target)
    - _Requirements: 6.5_
  
  - [ ] 23.2 Add structured logging
    - Log query generation start/complete
    - Log provider call start/complete/error
    - Log stance classification start/complete/error
    - Log cache hit/miss
    - Log zero results with reason codes
    - Log demo mode usage
    - _Requirements: 7.5_

- [ ] 24. Run quality gates and final validation
  - [ ] 24.1 Run all quality checks
    - Run TypeScript type checking (must pass)
    - Run linting (must pass)
    - Run code formatting checks (must pass)
    - Run all unit tests (must pass)
    - Run all property tests (must pass)
    - Run build (must pass)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  
  - [ ] 24.2 Run integration tests
    - Test end-to-end text-only grounding with staging providers
    - Test cache hit/miss scenarios
    - Test demo mode consistency
    - Test zero results handling
    - Test frontend rendering with various source counts
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  
  - [ ] 24.3 Run performance benchmarks
    - Verify query generation <100ms (p95)
    - Verify text-only grounding <2000ms (p95)
    - Verify stance classification <300ms (p95)
    - Verify cache hit latency <10ms (p95)
    - _Requirements: Performance targets from design_

- [ ] 25. Final checkpoint - Feature complete
  - Ensure all tasks completed
  - Ensure all tests pass
  - Ensure all quality gates pass
  - Ensure performance targets met
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at phase boundaries
- Property tests validate universal correctness properties (29 total)
- Unit tests validate specific examples and edge cases
- All code examples use TypeScript as specified in the design document
- Implementation follows the 5-phase approach: Backend Infrastructure → API Integration → Frontend Components → Testing → Performance Optimization
