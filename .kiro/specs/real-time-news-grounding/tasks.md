# Implementation Plan: Real-time News Grounding

## Overview

This implementation plan breaks down the real-time news grounding feature into discrete coding tasks. The plan follows a logical progression: environment validation → core infrastructure → API clients → grounding service → NOVA synthesis → API extension → demo mode → frontend integration → comprehensive testing. Each task builds on previous work, with validation checkpoints to ensure quality gates remain green.

The implementation uses TypeScript with Node.js for the backend, integrating Bing News Search API (primary) and GDELT Document API (fallback). All code must pass typecheck, lint, formatcheck, test, and build commands. Demo mode support is built-in throughout, enabling jury demonstrations without API keys.

## Tasks

- [ ] EXECUTE NOW: apply node runtime migration + CI guard + deploy + prove runtime via AWS CLI

- [x] 1. Environment validation and configuration
  - [x] 1.1 Validate environment variables and dependencies
    - Add new environment variables to `.env.example`: BING_NEWS_ENDPOINT, BING_NEWS_KEY, GDELT_DOC_ENDPOINT, GROUNDING_TIMEOUT_MS, GROUNDING_CACHE_TTL_SECONDS, GROUNDING_MAX_RESULTS
    - Document default values and required vs optional variables
    - Add startup validation for BING_NEWS_KEY format (if provided)
    - Log warning if BING_NEWS_KEY not set (will use GDELT only)
    - _Requirements: FR2.1, FR2.2, NFR4.1_
  
  - [x] 1.2 Install required dependencies
    - Add `psl` package for domain extraction (eTLD+1 format)
    - Add `url-parse` package for URL normalization
    - Verify `lru-cache`, `node-fetch`, `fast-check`, `zod` already in dependencies
    - Update package.json and run npm install
    - _Requirements: FR3.1, FR3.2_

- [x] 2. Implement core type definitions and schemas
  - [x] 2.1 Create grounding type definitions
    - Create `backend/src/types/grounding.ts` with interfaces: NormalizedSource, GroundingBundle, BingNewsArticle, BingSearchOptions, GDELTArticle, GDELTSearchOptions
    - Define provider type: 'bing' | 'gdelt' | 'none' | 'demo'
    - Add JSDoc comments for all interfaces
    - _Requirements: FR2.1, FR2.2, FR3.1, FR3.2_
  
  - [x] 2.2 Create Zod schemas for grounding types
    - Create `backend/src/schemas/grounding.ts` with Zod schemas: EvidenceSourceSchema, SIFTStepSchema, SIFTDetailsSchema, GroundingMetadataSchema
    - Extend AnalysisResponseSchema with new fields: credible_sources, sift, grounding
    - Ensure backward compatibility (new fields optional in validation)
    - _Requirements: FR5.2, FR6.1, FR6.2_
  
  - [ ]* 2.3 Write property test for schema validation
    - **Property 15: NOVA Output Conforms to Schema**
    - **Validates: Requirements FR5.2**
    - Generate random NOVA synthesis outputs with fast-check
    - Verify all outputs validate against AnalysisResponseSchema
    - Test required fields, enum values, array lengths, nested objects
    - _Requirements: FR5.2_

- [x] 3. Implement utility modules
  - [x] 3.1 Create query extraction and normalization utility
    - Create `backend/src/utils/queryExtractor.ts` with functions: extractQuery(), normalizeQuery()
    - Remove stop words (the, a, an, is, are, was, were, etc.)
    - Normalize whitespace, lowercase, trim
    - Handle edge cases: empty input, only stop words, special characters
    - _Requirements: FR1.3, FR1.4_
  
  - [x] 3.2 Create domain tier mapping utility
    - Create `backend/src/utils/domainTiers.ts` with domain tier map
    - Define tier 1.0 domains: reuters.com, apnews.com, bbc.com, npr.org, pbs.org
    - Define tier 0.8 domains: nytimes.com, washingtonpost.com, theguardian.com, wsj.com
    - Define tier 0.6 domains: cnn.com, foxnews.com, nbcnews.com, abcnews.go.com
    - Export function getDomainTier(domain: string): number (default 0.5)
    - _Requirements: FR3.4_
  
  - [ ]* 3.3 Write property tests for query normalization
    - **Property 2: Query Extraction Produces Non-Empty Normalized Queries**
    - **Property 3: Query Normalization Is Idempotent**
    - **Validates: Requirements FR1.3, FR1.4**
    - Generate random headline strings with fast-check
    - Verify non-empty headlines produce non-empty queries
    - Verify normalizing twice produces same result
    - _Requirements: FR1.3, FR1.4_

- [x] 4. Implement Bing News API client
  - [x] 4.1 Create Bing News client with search method
    - Create `backend/src/clients/bingNewsClient.ts` with BingNewsClient class
    - Implement search(query, options) method using node-fetch
    - Set Ocp-Apim-Subscription-Key header with API key from env
    - Configure timeout: GROUNDING_TIMEOUT_MS (default 3500ms)
    - Parse response JSON and extract articles array
    - _Requirements: FR2.1_
  
  - [x] 4.2 Add retry logic and error handling
    - Implement retry with exponential backoff: 2 attempts, 200ms/400ms delays
    - Catch network errors, timeouts, rate limits
    - Throw BingNewsError with error details for logging
    - Return empty array on non-fatal errors (log warning)
    - _Requirements: FR2.4, NFR2.1, NFR2.2_
  
  - [ ]* 4.3 Write unit tests for Bing client
    - Test successful search returns articles
    - Test timeout throws error after 3500ms
    - Test retry on network error (2 attempts)
    - Test rate limit error handling
    - Test malformed JSON response handling
    - Mock node-fetch with jest.mock()
    - _Requirements: FR2.1, FR2.4_
  
  - [ ]* 4.4 Write property test for Bing client
    - **Property 4: Bing Client Returns Structured Articles**
    - **Validates: Requirements FR2.1**
    - Generate random valid search queries
    - Verify all returned articles have required fields (url, title, snippet, publishDate, domain)
    - Use mock responses with fast-check arbitraries
    - _Requirements: FR2.1_

- [x] 5. Implement GDELT API client
  - [x] 5.1 Create GDELT client with search method
    - Create `backend/src/clients/gdeltClient.ts` with GDELTClient class
    - Implement search(query, options) method using node-fetch
    - No authentication required (public API)
    - Configure timeout: GROUNDING_TIMEOUT_MS (default 3500ms)
    - Parse response JSON and extract articles array
    - _Requirements: FR2.2_
  
  - [x] 5.2 Add retry logic and error handling
    - Implement retry with exponential backoff: 2 attempts, 200ms/400ms delays
    - Catch network errors, timeouts, empty results
    - Throw GDELTError with error details for logging
    - Return empty array on non-fatal errors (log warning)
    - _Requirements: FR2.4, NFR2.1, NFR2.2_
  
  - [ ]* 5.3 Write unit tests for GDELT client
    - Test successful search returns articles
    - Test timeout throws error after 3500ms
    - Test retry on network error (2 attempts)
    - Test empty results handling
    - Test malformed JSON response handling
    - Mock node-fetch with jest.mock()
    - _Requirements: FR2.2, FR2.4_
  
  - [ ]* 5.4 Write property test for GDELT client
    - **Property 5: GDELT Client Returns Structured Articles**
    - **Validates: Requirements FR2.2**
    - Generate random valid search queries
    - Verify all returned articles have required fields (url, title, snippet, publishDate, domain)
    - Use mock responses with fast-check arbitraries
    - _Requirements: FR2.2_

- [ ] 6. Checkpoint - Validate API clients
  - Run `npm run typecheck && npm run lint && npm run test`
  - Ensure all tests pass for Bing and GDELT clients
  - Manually test with real API keys (if available)
  - Ensure all tests pass, ask the user if questions arise

- [x] 7. Implement source normalization module
  - [x] 7.1 Create URL normalization function
    - Create `backend/src/services/sourceNormalizer.ts` with normalizeUrl() function
    - Remove tracking parameters: utm_*, fbclid, gclid, etc.
    - Normalize protocol to lowercase (https://)
    - Remove trailing slashes
    - Use url-parse library for parsing
    - _Requirements: FR3.1_
  
  - [x] 7.2 Create domain extraction function
    - Implement extractDomain() function using psl library
    - Extract eTLD+1 format (e.g., bbc.co.uk from www.bbc.co.uk)
    - Handle edge cases: IP addresses, localhost, invalid domains
    - Return null for invalid URLs
    - _Requirements: FR3.2_
  
  - [x] 7.3 Create source normalization function
    - Implement normalize() function accepting BingNewsArticle[] or GDELTArticle[]
    - Map to NormalizedSource format with all required fields
    - Normalize URLs, extract domains, parse dates to ISO8601
    - Truncate snippets to 200 characters
    - Handle missing fields with safe defaults
    - _Requirements: FR3.1, FR3.2_
  
  - [ ]* 7.4 Write property tests for normalization
    - **Property 7: URL Normalization Is Idempotent**
    - **Property 8: Domain Extraction Produces eTLD+1 Format**
    - **Validates: Requirements FR3.1, FR3.2**
    - Generate random URLs with tracking params
    - Verify normalizing twice produces same result
    - Verify domains are in eTLD+1 format
    - _Requirements: FR3.1, FR3.2_

- [x] 8. Implement deduplication and ranking module
  - [x] 8.1 Create deduplication function
    - Implement deduplicate() function in sourceNormalizer.ts
    - Remove exact URL duplicates (keep first occurrence)
    - Group by domain, keep highest-scored per domain
    - Preserve order of remaining sources
    - _Requirements: FR3.3_
  
  - [x] 8.2 Create scoring functions
    - Implement calculateRecencyScore() using age in days (linear decay over 30 days)
    - Implement calculateDomainScore() using domain tier map
    - Implement calculateLexicalSimilarity() using Jaccard similarity on tokens
    - Combine scores: 0.4 * recency + 0.4 * domain + 0.2 * lexical
    - _Requirements: FR3.4_
  
  - [x] 8.3 Create ranking function
    - Implement rank() function accepting sources and query
    - Calculate score for each source using scoring functions
    - Sort by score descending
    - Cap results at GROUNDING_MAX_RESULTS (default 10)
    - _Requirements: FR3.5_
  
  - [ ]* 8.4 Write property tests for deduplication and ranking
    - **Property 9: Deduplication Removes Duplicates**
    - **Property 10: Source Scores Are Bounded and Ordered**
    - **Property 11: Ranking Produces Sorted and Capped Results**
    - **Validates: Requirements FR3.3, FR3.4, FR3.5**
    - Generate random source arrays with duplicates
    - Verify deduplication reduces length
    - Verify scores in [0, 1] range
    - Verify sorted descending by score
    - _Requirements: FR3.3, FR3.4, FR3.5_

- [x] 9. Implement grounding cache
  - [x] 9.1 Create cache service with LRU/TTL
    - Create `backend/src/services/groundingCache.ts` with GroundingCache class
    - Use lru-cache library with max entries and TTL configuration
    - Implement get(query), set(query, bundle), clear() methods
    - Configure max entries: GROUNDING_CACHE_MAX_ENTRIES (default 1000)
    - Configure TTL: GROUNDING_CACHE_TTL_SECONDS (default 900)
    - _Requirements: FR4.1, FR4.2, FR4.3_
  
  - [x] 9.2 Add cache logging
    - Log cache hit with query and request_id
    - Log cache miss with query and request_id
    - Use structured JSON logging format
    - _Requirements: FR4.4, NFR3.1, NFR3.2_
  
  - [ ]* 9.3 Write unit tests for cache
    - Test cache stores and retrieves bundles
    - Test cache returns null after TTL expires
    - Test LRU eviction when cache full
    - Test clear() removes all entries
    - Use fake timers for TTL testing
    - _Requirements: FR4.1, FR4.2, FR4.3_
  
  - [ ]* 9.4 Write property test for cache
    - **Property 12: Cache Round-Trip Preserves Bundles**
    - **Validates: Requirements FR4.1**
    - Generate random grounding bundles and queries
    - Verify storing and retrieving produces equivalent bundle
    - Test with various TTL values
    - _Requirements: FR4.1_

- [ ] 10. Checkpoint - Validate normalization and caching
  - Run `npm run typecheck && npm run lint && npm run test`
  - Ensure all tests pass for normalization, ranking, and caching
  - Verify cache TTL and LRU eviction work correctly
  - Ensure all tests pass, ask the user if questions arise

- [x] 11. Implement grounding service orchestration
  - [x] 11.1 Create grounding service with provider selection
    - Create `backend/src/services/groundingService.ts` with GroundingService class
    - Inject BingNewsClient, GDELTClient, GroundingCache dependencies
    - Implement ground(headline, url?) method
    - Extract and normalize query from headline
    - Check cache first, return if hit
    - Try Bing first (if API key available), fallback to GDELT on error/empty
    - Return empty sources with providerUsed: 'none' if all fail
    - _Requirements: FR2.3, FR2.4, FR4.1_
  
  - [x] 11.2 Implement provider fallback chain
    - Try Bing News API first
    - On error, timeout, or zero results, try GDELT
    - On error, timeout, or zero results, return empty sources
    - Log provider used and fallback events
    - Include error details in grounding.errors array
    - _Requirements: FR2.3, FR2.4, NFR2.3_
  
  - [x] 11.3 Integrate normalization, deduplication, and ranking
    - Normalize raw articles from provider
    - Deduplicate by URL and domain
    - Score and rank sources
    - Cap at GROUNDING_MAX_RESULTS
    - Store in cache before returning
    - _Requirements: FR3.1, FR3.2, FR3.3, FR3.4, FR3.5_
  
  - [x] 11.4 Add structured logging
    - Log grounding_provider_used event with provider name
    - Log grounding_results_count event with count
    - Log grounding_latency_ms event with latency
    - Log grounding_fallback event when fallback occurs
    - Log grounding_error event on errors
    - Log grounding_cache_hit event on cache hit
    - Include request_id in all logs
    - _Requirements: NFR3.1, NFR3.2_
  
  - [ ]* 11.5 Write unit tests for grounding service
    - Test successful Bing grounding
    - Test fallback to GDELT when Bing fails
    - Test empty sources when all providers fail
    - Test cache hit returns cached bundle
    - Test cache miss triggers API call
    - Test normalization, deduplication, ranking applied
    - Mock all dependencies
    - _Requirements: FR2.3, FR2.4, FR3.1, FR3.2, FR3.3, FR3.4, FR3.5, FR4.1_
  
  - [ ]* 11.6 Write property tests for grounding service
    - **Property 1: Input Validation Accepts Valid Requests**
    - **Property 6: Graceful Error Handling Never Throws to User**
    - **Property 13: Structured Logging Includes Required Fields**
    - **Validates: Requirements FR1.1, FR1.2, FR2.4, NFR2.1, NFR2.2, NFR3.1, NFR3.2**
    - Generate random valid/invalid headlines
    - Verify valid inputs accepted, invalid handled gracefully
    - Verify no exceptions thrown to user
    - Verify all log events have required fields
    - _Requirements: FR1.1, FR1.2, FR2.4, NFR3.1, NFR3.2_

- [x] 12. Implement demo mode grounding
  - [x] 12.1 Create demo grounding bundle generator
    - Create `backend/src/utils/demoGrounding.ts` with getDemoGroundingBundle() function
    - Return deterministic mock sources based on headline keywords
    - Include realistic metadata: URLs, titles, snippets, dates, domains
    - Set providerUsed: 'demo', latencyMs: 0
    - No external API calls
    - _Requirements: FR7.1, FR7.2, FR7.3_
  
  - [x] 12.2 Integrate demo mode into grounding service
    - Check for demo_mode flag in request
    - If true, call getDemoGroundingBundle() instead of real APIs
    - Skip cache for demo mode (always return fresh)
    - Log demo mode usage
    - _Requirements: FR7.1, FR7.2_
  
  - [ ]* 12.3 Write property test for demo mode
    - **Property 18: Demo Mode Is Deterministic**
    - **Property 19: Demo Sources Have Required Metadata**
    - **Validates: Requirements FR7.1, FR7.3, FR7.4**
    - Generate random headlines
    - Verify calling demo mode twice produces identical results
    - Verify all sources have required fields with non-empty values
    - _Requirements: FR7.1, FR7.3, FR7.4_

- [ ] 13. Checkpoint - Validate grounding service
  - Run `npm run typecheck && npm run lint && npm run test`
  - Ensure all tests pass for grounding service
  - Test with real API keys (if available)
  - Test demo mode produces deterministic output
  - Ensure all tests pass, ask the user if questions arise

- [x] 14. Enhance NOVA synthesis with grounding
  - [x] 14.1 Update NOVA prompt with grounding bundle
    - Modify existing NOVA synthesis function to accept GroundingBundle parameter
    - Add grounding sources to system prompt with formatted template
    - Include provider metadata in prompt (providerUsed, sources_count)
    - Update prompt instructions to reference sources for evidence
    - _Requirements: FR5.1_
  
  - [x] 14.2 Update NOVA output schema for SIFT details
    - Modify NOVA prompt to output structured SIFT object (not string)
    - Each SIFT step: summary (string) + evidence_urls (array)
    - Trace step includes earliest_source (optional)
    - Update prompt to extract top 5 credible sources with explanations
    - _Requirements: FR5.2_
  
  - [x] 14.3 Integrate JSON repair pipeline
    - Use existing parseStrictJson() function for NOVA output
    - Handle malformed JSON with repair pipeline
    - Fallback to safe defaults on parse failure
    - Log parse errors with details
    - _Requirements: FR5.3, FR5.4_
  
  - [ ]* 14.4 Write unit tests for NOVA synthesis
    - Test NOVA accepts grounding bundle
    - Test NOVA output validates against schema
    - Test JSON repair handles malformed output
    - Test fallback to safe defaults on parse failure
    - Mock NOVA API calls
    - _Requirements: FR5.1, FR5.2, FR5.3, FR5.4_
  
  - [ ]* 14.5 Write property tests for NOVA synthesis
    - **Property 14: NOVA Synthesis Accepts Grounding Bundle**
    - **Property 16: JSON Repair Handles Malformed Output**
    - **Validates: Requirements FR5.1, FR5.3, FR5.4**
    - Generate random grounding bundles
    - Verify NOVA accepts all valid bundles
    - Generate malformed JSON strings
    - Verify repair pipeline handles or returns safe defaults
    - _Requirements: FR5.1, FR5.3, FR5.4_

- [x] 15. Extend API response schema
  - [x] 15.1 Add new fields to AnalysisResponse
    - Add credible_sources: EvidenceSource[] field (top 5)
    - Add sift: SIFTDetails field (structured object)
    - Add grounding: GroundingMetadata field (provider, count, errors)
    - Keep existing sources and sift_guidance fields for backward compatibility
    - _Requirements: FR6.1, FR6.2, FR6.3_
  
  - [x] 15.2 Populate new fields from NOVA output
    - Extract credible_sources from NOVA output
    - Extract sift object from NOVA output
    - Populate grounding metadata from GroundingBundle
    - Copy credible_sources to sources for backward compatibility
    - Concatenate sift summaries to sift_guidance for backward compatibility
    - _Requirements: FR6.1, FR6.2, FR6.3_
  
  - [ ]* 15.3 Write property test for response schema
    - **Property 17: Response Schema Backward Compatibility**
    - **Validates: Requirements FR6.1, FR6.2, FR6.3**
    - Generate random analysis responses with new fields
    - Verify responses validate against both old and new schemas
    - Verify existing consumers can parse responses
    - _Requirements: FR6.1, FR6.2, FR6.3_

- [x] 16. Integrate grounding into main analysis flow
  - [x] 16.1 Update analyzeContent function
    - Call groundingService.ground() with headline and URL
    - Pass grounding bundle to NOVA synthesis
    - Populate new response fields from NOVA output
    - Handle grounding errors gracefully (continue with empty sources)
    - _Requirements: FR2.3, FR2.4, FR5.1, FR6.1_
  
  - [x] 16.2 Add input sanitization
    - Sanitize user input before passing to API clients
    - Remove SQL injection patterns, XSS attempts, command injection
    - Log sanitization events
    - _Requirements: NFR4.2_
  
  - [ ]* 16.3 Write integration tests for full flow
    - Test end-to-end: headline → grounding → NOVA → response
    - Test with demo mode (no real API calls)
    - Test with mock API clients
    - Test error handling at each stage
    - Verify response schema validation
    - _Requirements: FR2.3, FR2.4, FR5.1, FR5.2, FR6.1_

- [ ] 17. Checkpoint - Validate backend integration
  - Run `npm run typecheck && npm run lint && npm run test && npm run build`
  - Ensure all validation commands pass
  - Test complete flow with demo mode
  - Test with real API keys (if available)
  - Ensure all tests pass, ask the user if questions arise

- [x] 18. Update frontend to display grounding data
  - [x] 18.1 Update ResultsCard to display credible sources
    - Modify `frontend/web/src/components/ResultsCard.tsx`
    - Render credible_sources array (top 5) with title, domain, snippet, why
    - Show "No sources found" message if empty
    - Open links in new tab with rel="noopener noreferrer"
    - Use semantic list markup (ul, li)
    - _Requirements: FR8.1_
  
  - [x] 18.2 Create SIFT modal components
    - Create `frontend/web/src/components/SIFTModal.tsx` for each SIFT step
    - Display summary text from sift.<step>.summary
    - Display evidence URLs as clickable links
    - For Trace step, display earliest_source if available
    - Add close button and keyboard navigation (Escape key)
    - _Requirements: FR8.2_
  
  - [x] 18.3 Update SIFTPanel to open modals
    - Modify `frontend/web/src/components/SIFTPanel.tsx`
    - Add click handlers to each SIFT tile
    - Open corresponding modal with details
    - Pass sift step data to modal
    - _Requirements: FR8.2_
  
  - [x] 18.4 Add transparency metadata display
    - Add section to ResultsCard showing grounding metadata
    - Display "Search terms used: {query}"
    - Display "Provider used: {providerUsed}" (Bing/GDELT/Demo)
    - Display "Sources found: {sources_count}"
    - Show errors if present (in collapsed section)
    - _Requirements: FR8.3_
  
  - [ ]* 18.5 Write unit tests for frontend components
    - Test ResultsCard renders credible sources
    - Test SIFT modals display all step details
    - Test SIFT modals open/close correctly
    - Test transparency metadata displays correctly
    - Test empty sources message displays
    - _Requirements: FR8.1, FR8.2, FR8.3_
  
  - [ ]* 18.6 Write property tests for frontend rendering
    - **Property 20: Frontend Renders All Source Fields**
    - **Property 21: SIFT Modals Render All Step Details**
    - **Property 22: Transparency Metadata Is Displayed**
    - **Validates: Requirements FR8.1, FR8.2, FR8.3**
    - Generate random credible sources and SIFT details
    - Verify all fields rendered in UI
    - Verify modals display all evidence URLs
    - _Requirements: FR8.1, FR8.2, FR8.3_

- [ ] 19. Update browser extension for grounding
  - [ ] 19.1 Update extension popup to display credible sources
    - Modify `frontend/extension/src/popup.tsx`
    - Display top 3 credible sources (truncated)
    - Show "View all sources" link to Web UI
    - _Requirements: FR8.1_
  
  - [ ] 19.2 Update background worker notification
    - Modify `frontend/extension/src/background.ts`
    - Include sources count in notification text
    - Include provider used in notification
    - _Requirements: FR8.3_

- [ ] 20. Checkpoint - Validate frontend integration
  - Run `cd frontend/web && npm run typecheck && npm run lint && npm run test && npm run build`
  - Run `cd frontend/extension && npm run typecheck && npm run lint && npm run test && npm run build`
  - Manually test Web UI: verify sources display, SIFT modals work, transparency metadata shows
  - Manually test extension: verify sources display in popup
  - Ensure all tests pass, ask the user if questions arise

- [ ] 21. Comprehensive testing and validation
  - [ ] 21.1 Run all property-based tests
    - Run all property tests with 100 iterations minimum
    - Verify all 23 properties pass
    - Fix any failing properties
    - _Requirements: All FR and NFR requirements_
  
  - [ ] 21.2 Run all unit tests
    - Run complete test suite for backend and frontend
    - Verify >80% code coverage for new modules
    - Fix any failing tests
    - _Requirements: NFR5.4_
  
  - [ ] 21.3 Run integration tests
    - Test end-to-end flow with demo mode
    - Test with real API keys (if available)
    - Test fallback chain (Bing → GDELT → empty)
    - Test cache hit/miss scenarios
    - _Requirements: FR2.3, FR2.4, FR4.1_
  
  - [ ] 21.4 Run validation gates
    - Run `npm run typecheck` (backend and frontend)
    - Run `npm run lint` (backend and frontend)
    - Run `npm run formatcheck` (backend and frontend)
    - Run `npm run test` (backend and frontend)
    - Run `npm run build` (backend and frontend)
    - Ensure all commands pass with zero errors
    - _Requirements: NFR5.1, NFR5.2, NFR5.3_

- [ ] 22. Documentation and final polish
  - [ ] 22.1 Update API documentation
    - Document new response fields: credible_sources, sift, grounding
    - Add deprecation warnings for sources and sift_guidance fields
    - Document environment variables
    - Add examples with grounding data
    - _Requirements: FR6.1, FR6.2, FR6.3_
  
  - [ ] 22.2 Update demo script
    - Add grounding demonstration to demo script
    - Show sources display in Web UI
    - Show SIFT modals with evidence
    - Show transparency metadata
    - _Requirements: FR7.1, FR8.1, FR8.2, FR8.3_
  
  - [ ] 22.3 Create grounding feature documentation
    - Create `backend/docs/grounding.md` with architecture overview
    - Document provider selection logic
    - Document normalization, deduplication, ranking algorithms
    - Document caching strategy
    - Document demo mode behavior
    - _Requirements: NFR6.1, NFR6.2, NFR6.3, NFR6.4_

- [ ] 23. Final checkpoint - Complete validation
  - Run all validation gates across backend and frontend
  - Run complete test suite with property tests
  - Test demo mode end-to-end
  - Test with real API keys (if available)
  - Verify backward compatibility with existing clients
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional property-based and unit tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and catch issues early
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All code must pass typecheck, lint, formatcheck, test, and build gates
- Demo mode support is built-in throughout for jury demonstrations without API keys
- The implementation follows a logical progression: environment → types → utilities → clients → services → integration → frontend → testing
- Backward compatibility is maintained throughout with deprecated fields for existing consumers
