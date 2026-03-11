# Implementation Plan: Phase UX Frontend Extension

## Overview

This implementation plan delivers the complete end-to-end FakeNewsOff application by integrating the frontend with the already-deployed iterative evidence orchestration backend. The backend orchestration pipeline is operational in production with the feature flag enabled. This plan focuses on completing the frontend to provide users with trustworthy, explainable misinformation analysis through a clean, accessible interface.

The implementation uses TypeScript, React 18, and Zod for validation. All tasks build incrementally with validation checkpoints. The system supports both hackathon jury demonstrations (90-second demo flow) and production user flows with robust error handling.

## Tasks

- [x] 1. Enhance API client for orchestration integration
  - [x] 1.1 Update API client to handle orchestration metadata
    - Modify `frontend/shared/api/client.ts` to parse orchestration fields (enabled, passes_executed, source_classes, average_quality, contradictions_found)
    - Ensure backward compatibility with legacy responses lacking orchestration metadata
    - Add logging for orchestration status (enabled/disabled)
    - _Requirements: 1.2, 1.3, 1.4, 21.1, 21.2, 21.3_
  
  - [x] 1.2 Implement runtime configuration loading
    - Add `loadRuntimeConfig()` function to fetch /config.json on app initialization
    - Implement fallback chain: runtime config → environment variable → localhost
    - Update `getApiBaseUrl()` to use runtime config first
    - _Requirements: 20.1, 20.2, 20.3_
  
  - [x] 1.3 Add API health check functionality
    - Create `checkHealth()` function in API client
    - Return health status: healthy/degraded/unhealthy/unknown
    - Include grounding provider status when available
    - _Requirements: 26.1, 26.2, 26.3, 26.4_
  
  - [ ]* 1.4 Write property test for backward compatibility
    - **Property 2: Backward Compatible Response Handling**
    - **Validates: Requirements 1.3, 21.2, 21.3, 25.1, 25.2, 25.4**
    - Generate responses with and without orchestration metadata
    - Verify frontend handles both formats without errors
    - _Requirements: 1.3, 21.2, 21.3_


- [x] 2. Enhance ResultsCard component for orchestration display
  - [x] 2.1 Add orchestration metadata section
    - Create expandable section in ResultsCard for orchestration details
    - Display passes_executed with explanation (e.g., "2 passes: Initial retrieval + targeted refinement")
    - Display source_classes with explanation (e.g., "2 classes: news_media, fact_checker")
    - Display average_quality with explanation (e.g., "0.75: High quality evidence")
    - Display contradictions_found prominently when true
    - Only show section when orchestration.enabled === true
    - _Requirements: 1.2, 1.4, 16.1, 16.2, 16.3, 16.4, 16.5, 30.1, 30.2, 30.3, 30.4, 30.5_
  
  - [x] 2.2 Enhance confidence score display with context
    - Add contextual explanation based on score range (low <50%, medium 50-75%, high >75%)
    - Display warning for low confidence with suggestions
    - Show factors affecting confidence (evidence quality, source diversity, contradictions)
    - _Requirements: 4.2, 27.1, 27.2, 27.3, 27.4, 27.5_
  
  - [x] 2.3 Add export functionality
    - Implement "Copy to Clipboard" button that copies formatted summary (verdict, confidence, recommendation, sources)
    - Implement "Export JSON" button that downloads full response as valid JSON
    - Show visual feedback on successful export (e.g., "Copied!" message)
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5_
  
  - [ ]* 2.4 Write property test for orchestration metadata display
    - **Property 3: Orchestration Metadata Display**
    - **Validates: Requirements 1.2, 1.4, 16.1, 16.2, 16.3, 16.4, 16.5, 30.1, 30.2, 30.3, 30.4, 30.5**
    - Generate responses with various orchestration metadata values
    - Verify all fields display with appropriate explanations
    - _Requirements: 1.2, 16.1, 30.1_

- [x] 3. Enhance SourceList component for stance and credibility
  - [x] 3.1 Implement stance-based grouping
    - Group sources by stance (supports/contradicts/mentions/unclear)
    - Display supporting sources first with green indicators
    - Display contradicting sources second with red indicators (prominent)
    - Display contextual sources last with blue/gray indicators
    - _Requirements: 2.2, 2.7, 14.1, 14.2, 14.5_
  
  - [x] 3.2 Add credibility tier badges
    - Display tier 1 (high) with green badge
    - Display tier 2 (medium) with yellow badge
    - Display tier 3 (low) with gray badge
    - Add tooltip explaining what each tier means
    - Sort sources by credibility tier within each stance group
    - _Requirements: 2.3, 15.1, 15.2, 15.3, 15.4, 15.5_
  
  - [x] 3.3 Implement evidence quality filtering
    - Exclude generic pages from display (homepage, category, search, tag pages)
    - Show empty state with guidance when zero usable sources found
    - Suggest providing URL for better results in empty state
    - _Requirements: 2.1, 2.6, 17.1, 17.2, 17.3, 17.4_
  
  - [ ]* 3.4 Write property tests for source display
    - **Property 4: Source Stance Grouping**
    - **Validates: Requirements 2.2, 2.7, 3.2, 14.1, 14.2**
    - **Property 5: Credibility Tier Display**
    - **Validates: Requirements 2.3, 15.1, 15.2, 15.3**
    - **Property 24: Source Credibility Sorting**
    - **Validates: Requirements 15.5**
    - Generate random source sets with various stances and tiers
    - Verify grouping, visual indicators, and sorting
    - _Requirements: 2.2, 2.3, 15.5_


- [x] 4. Enhance ClaimEvidenceGraph component
  - [x] 4.1 Implement deterministic SVG layout
    - Replace any physics-based layout with fixed positioning
    - Center claim node at (400, 250) with radius 50px
    - Position supporting sources on right (x=600) with green color
    - Position contradicting sources on left (x=200) with red color
    - Position mentions/unclear sources on bottom (y=420) with blue/gray color
    - Ensure consistent layout across renders (no jitter)
    - _Requirements: 3.1, 3.2_
  
  - [x] 4.2 Add interactive features
    - Make source nodes clickable to open URL in new tab
    - Add hover tooltips showing title, domain, publish date, credibility tier
    - Ensure tooltips are accessible (ARIA labels)
    - _Requirements: 3.3, 3.4, 19.5_
  
  - [x] 4.3 Implement responsive scaling
    - Scale graph appropriately for viewports 320px-2560px
    - Adjust node sizes and spacing for mobile (<768px)
    - Ensure graph remains readable on all screen sizes
    - _Requirements: 3.7, 13.1, 13.2_
  
  - [x] 4.4 Handle edge cases
    - Display empty state with center claim node only when zero sources
    - Limit display to top 10 sources when >10 sources available
    - Prioritize contradicting sources in display (safety-first)
    - Show message "Showing top 10 of {total} sources" when limited
    - _Requirements: 2.6, 3.5, 3.6_
  
  - [ ]* 4.5 Write property tests for graph layout
    - **Property 7: Graph Layout Determinism**
    - **Validates: Requirements 3.1**
    - **Property 8: Graph Responsive Scaling**
    - **Validates: Requirements 3.7, 13.1, 13.2**
    - Generate same source set multiple times, verify identical layout
    - Generate various viewport sizes, verify readable scaling
    - _Requirements: 3.1, 3.7_

- [x] 5. Enhance InputForm component
  - [x] 5.1 Improve validation and error messages
    - Display clear error for input <10 characters
    - Show inline validation errors as user types
    - Provide placeholder text with examples
    - _Requirements: 7.1, 7.3, 7.4, 7.5_
  
  - [x] 5.2 Add loading state improvements
    - Display loading spinner immediately on submit
    - Show progress indication during analysis (e.g., "Analyzing claim...", "Retrieving evidence...")
    - Display message after 30s: "Analysis taking longer than expected. Please wait..."
    - Prevent duplicate submissions while analysis in progress
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [x] 5.3 Add keyboard shortcuts
    - Support Enter key to submit form
    - Ensure Tab navigation works correctly
    - Add visible focus indicators
    - _Requirements: 7.6, 19.3_
  
  - [ ]* 5.4 Write property tests for input validation
    - **Property 13: Input Validation**
    - **Validates: Requirements 7.1, 7.3, 7.4**
    - **Property 14: Duplicate Submission Prevention**
    - **Validates: Requirements 8.4**
    - Generate various input lengths, verify validation behavior
    - Simulate rapid submissions, verify prevention
    - _Requirements: 7.1, 8.4_


- [x] 6. Enhance error handling and recovery
  - [x] 6.1 Improve ErrorState component
    - Map all error types to user-friendly messages (network/timeout/validation/server/unknown)
    - Display "Try Again" button for recoverable errors
    - Preserve user input on error for retry
    - Add "Cancel" button to return to home
    - Log errors to console without exposing sensitive data
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 18.2_
  
  - [x] 6.2 Implement retry logic with exponential backoff
    - Retry network errors up to 2 times with exponential backoff (1s, 2s)
    - Retry server 500 errors once
    - Do not retry validation or client 4xx errors
    - Limit automatic retries to prevent infinite loops
    - _Requirements: 10.2, 29.3, 29.5_
  
  - [x] 6.3 Add error recovery UI
    - Preserve user input when error occurs
    - Provide "Try Again" button that resubmits with same input
    - Suggest alternative actions on repeated failures (e.g., "Try a different claim")
    - _Requirements: 29.1, 29.2, 29.4_
  
  - [ ]* 6.4 Write property tests for error handling
    - **Property 16: Error Message Display**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**
    - **Property 17: Retry Button for Recoverable Errors**
    - **Validates: Requirements 9.5, 29.1, 29.2**
    - **Property 18: Error Logging Without Sensitive Data**
    - **Validates: Requirements 9.6, 18.2**
    - **Property 20: Retry with Exponential Backoff**
    - **Validates: Requirements 10.2, 29.5**
    - **Property 34: Input Preservation on Error**
    - **Validates: Requirements 29.1, 29.2**
    - Generate various error types, verify messages and retry behavior
    - _Requirements: 9.1, 9.5, 10.2, 29.1_

- [x] 7. Polish Landing page experience
  - [x] 7.1 Enhance hero section
    - Display clear value proposition explaining application purpose
    - Use clean, modern, trustworthy visual design
    - Add prominent claim input interface
    - _Requirements: 6.1, 6.2_
  
  - [x] 7.2 Add example claims component
    - Display at least 3 example claims demonstrating different capabilities
    - Example 1: Supported claim (shows orchestration success)
    - Example 2: Disputed claim (shows contradiction detection)
    - Example 3: Unverified claim (shows empty state handling)
    - Make examples clickable to auto-fill input
    - _Requirements: 6.3, 11.3_
  
  - [x] 7.3 Add ApiStatus component
    - Display backend health indicator (green/yellow/red)
    - Check API health on page load
    - Show grounding provider status when available
    - Add "Check Status" button for manual refresh
    - Display warning when API is unhealthy
    - _Requirements: 20.5, 26.1, 26.2, 26.3, 26.4, 26.5_
  
  - [x] 7.4 Ensure responsive design
    - Verify layout works on desktop, tablet, and mobile (320px-2560px)
    - Use appropriate font sizes and touch targets for mobile (minimum 44px)
    - Test on multiple devices and browsers
    - _Requirements: 6.4, 13.1, 13.3, 13.4, 13.5_


- [x] 8. Implement verdict and confidence display enhancements
  - [x] 8.1 Enhance StatusBadge component
    - Ensure color coding for all verdict types (true=green, false=red, misleading=orange, partially_true=yellow, unverified=gray)
    - Add icons for each verdict type (✓, ✗, ⚠, ◐, ?)
    - Include description text (e.g., "Evidence strongly supports this claim")
    - _Requirements: 4.1_
  
  - [x] 8.2 Enhance confidence visualization
    - Display confidence score with progress bar matching percentage
    - Add contextual messaging based on score range
    - Show warning for low confidence (<50%) with uncertainty explanation
    - Indicate moderate certainty for medium confidence (50-75%)
    - Indicate strong certainty for high confidence (>75%)
    - _Requirements: 4.2, 4.5_
  
  - [x] 8.3 Add rationale display
    - Display rationale text prominently
    - Format rationale for readability (paragraphs, line breaks)
    - _Requirements: 4.3_
  
  - [ ]* 8.4 Write property tests for verdict display
    - **Property 9: Verdict Color Coding**
    - **Validates: Requirements 4.1**
    - **Property 10: Confidence Bar Width**
    - **Validates: Requirements 4.2**
    - **Property 11: Confidence Context Messaging**
    - **Validates: Requirements 4.5, 27.1, 27.2, 27.3, 27.4**
    - Generate various verdicts and confidence scores, verify display
    - _Requirements: 4.1, 4.2, 4.5_

- [x] 9. Enhance contradiction handling
  - [x] 9.1 Highlight contradicting evidence
    - Display contradicting sources in separate prominent section
    - Use red visual indicators for contradicting sources
    - Position contradicting sources on left side of graph
    - _Requirements: 4.4, 14.1, 14.2, 14.3_
  
  - [x] 9.2 Add contradiction warnings
    - Display warning when contradictions found: "⚠️ Contradicting Evidence Found"
    - Explain what contradicting evidence means
    - Suggest reviewing contradicting sources carefully before sharing
    - _Requirements: 14.4, 14.5_
  
  - [x] 9.3 Show orchestration contradiction detection
    - Indicate when orchestration found contradictions in metadata display
    - Explain safety-first contradiction check
    - _Requirements: 16.5, 30.5_
  
  - [ ]* 9.4 Write property test for contradiction highlighting
    - **Property 12: Contradiction Highlighting**
    - **Validates: Requirements 4.4, 14.2, 14.4, 14.5**
    - Generate responses with contradicting sources
    - Verify prominent display and warnings
    - _Requirements: 4.4, 14.2_


- [x] 10. Enhance SIFT guidance display
  - [x] 10.1 Improve SIFTPanel component
    - Display all four SIFT steps (Stop, Investigate, Find, Trace) with clear explanations
    - Show structured SIFT guidance when available in response
    - Provide clickable evidence URLs within SIFT guidance
    - Explain what each SIFT step means in context of the claim
    - Display fallback SIFT guidance when unavailable
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 10.2 Add visual design improvements
    - Use icons for each SIFT step
    - Add visual separation between steps
    - Ensure readability and accessibility
    - _Requirements: 5.1_

- [x] 11. Implement accessibility compliance
  - [x] 11.1 Ensure semantic HTML structure
    - Use semantic elements (header, main, article, section, nav) throughout
    - Replace generic divs with appropriate semantic elements
    - _Requirements: 19.1_
  
  - [x] 11.2 Add ARIA labels and attributes
    - Add ARIA labels for all interactive elements (buttons, links, inputs)
    - Add ARIA live regions for dynamic content (loading, errors)
    - Add ARIA attributes for graph tooltips
    - _Requirements: 19.2, 19.6_
  
  - [x] 11.3 Ensure keyboard navigation
    - Verify all interactive elements are focusable via Tab
    - Add visible focus indicators with custom CSS
    - Test keyboard-only navigation through entire UI
    - Support Enter/Space for activation
    - _Requirements: 19.3_
  
  - [x] 11.4 Verify color contrast
    - Check all text elements meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
    - Adjust colors if needed to meet contrast requirements
    - _Requirements: 19.4_
  
  - [x] 11.5 Add text alternatives for graph
    - Provide tooltips with full information for graph nodes
    - Add ARIA labels for graph elements
    - Ensure screen reader users can access graph information
    - _Requirements: 19.5_
  
  - [ ]* 11.6 Write property tests for accessibility
    - **Property 26: Semantic HTML Structure**
    - **Validates: Requirements 19.1**
    - **Property 27: ARIA Labels for Interactive Elements**
    - **Validates: Requirements 19.2, 19.6**
    - **Property 28: Keyboard Navigation**
    - **Validates: Requirements 19.3**
    - **Property 29: Color Contrast Compliance**
    - **Validates: Requirements 19.4**
    - Verify semantic HTML, ARIA labels, keyboard access, color contrast
    - _Requirements: 19.1, 19.2, 19.3, 19.4_


- [x] 12. Implement demo mode for jury presentations
  - [x] 12.1 Add demo mode indicators
    - Display subtle demo mode indicator when active (e.g., "🎭 Demo Mode - Using pre-configured responses")
    - Show demo mode toggle on landing page
    - Persist demo mode preference to localStorage
    - _Requirements: 11.1, 11.2_
  
  - [x] 12.2 Ensure demo mode timeout
    - Use 5-second timeout for demo mode requests (vs 45s production)
    - Display results within 5 seconds for demo claims
    - _Requirements: 11.2, 22.1_
  
  - [x] 12.3 Verify example claims work in demo mode
    - Test all 3 example claims in demo mode
    - Verify deterministic responses
    - Ensure graph is visible and readable
    - Verify orchestration metadata displays
    - _Requirements: 11.3, 11.4, 11.5, 11.6_
  
  - [ ]* 12.4 Write property test for demo mode
    - **Property 22: Demo Mode Latency**
    - **Validates: Requirements 11.2**
    - Generate demo mode requests, verify <5s response time
    - _Requirements: 11.2_

- [x] 13. Implement production user flow enhancements
  - [x] 13.1 Add weak evidence handling
    - Display warning when confidence_score < 50
    - Suggest providing URL for better results
    - Suggest rephrasing claim to be more specific
    - Suggest checking if claim is too recent for news coverage
    - _Requirements: 12.2, 12.3_
  
  - [x] 13.2 Enhance empty state handling
    - Display clear empty state when zero sources found
    - Explain possible reasons (too vague, too recent, not newsworthy)
    - Suggest providing URL, making claim more specific, checking if factual vs opinion
    - _Requirements: 2.6, 17.1, 17.2, 17.3, 17.4, 17.5_
  
  - [x] 13.3 Add result caching indication
    - Display cache hit status when available
    - Show "Results from cache" indicator for cached responses
    - _Requirements: 12.4_
  
  - [x] 13.4 Ensure production timeout
    - Use 45-second timeout for production requests
    - Display results within 45 seconds
    - Show progress message after 30 seconds
    - _Requirements: 12.1, 8.5_


- [x] 14. Implement progressive enhancement and performance
  - [x] 14.1 Add loading skeletons
    - Display loading skeletons for slow-loading components
    - Show skeleton for ResultsCard while loading
    - Show skeleton for ClaimEvidenceGraph while rendering
    - _Requirements: 28.5_
  
  - [x] 14.2 Optimize asset loading
    - Implement code splitting for routes
    - Lazy load ClaimEvidenceGraph component
    - Optimize bundle size
    - _Requirements: 28.4_
  
  - [x] 14.3 Add JavaScript fallback
    - Display message when JavaScript is disabled: "JavaScript is required"
    - Ensure core HTML structure is accessible without JS
    - _Requirements: 28.3_
  
  - [ ]* 14.4 Write property test for progressive enhancement
    - **Property 35: Loading Skeleton Display**
    - **Validates: Requirements 28.5**
    - Verify loading skeletons display for slow components
    - _Requirements: 28.5_

- [x] 15. Implement observability and monitoring
  - [x] 15.1 Add structured logging
    - Log API requests with latency, status, sources count, orchestration status, cache hit
    - Log API errors with error type, message, status code, retryable flag
    - Use structured JSON format for all logs
    - Do not log sensitive data (API keys, full request bodies, PII)
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_
  
  - [x] 15.2 Add performance tracking
    - Track API request latency (p50, p95, p99)
    - Track API error rate by type
    - Track cache hit rate
    - Track orchestration usage rate
    - Log to console for development
    - _Requirements: 18.1_
  
  - [ ]* 15.3 Write property test for structured logging
    - **Property 25: Structured Logging**
    - **Validates: Requirements 18.1, 18.3, 18.4, 21.5**
    - Verify all API requests/responses log structured data
    - _Requirements: 18.1, 18.3_


- [x] 16. Checkpoint - Frontend component validation
  - Run `cd frontend/web && npm run typecheck && npm run lint && npm run test`
  - Verify all components render correctly
  - Test orchestration metadata display with sample responses
  - Test error handling with various error types
  - Ensure all tests pass, ask the user if questions arise

- [x] 17. Enhance browser extension integration
  - [x] 17.1 Update extension API client
    - Ensure extension uses same API client as web app
    - Use same timeout and retry logic
    - Validate responses consistently
    - _Requirements: 22.1, 22.2, 22.3_
  
  - [x] 17.2 Enhance extension popup UI
    - Display results in compact popup format
    - Show StatusBadge, confidence, truncated recommendation
    - Add "View Full Results" link to web application
    - _Requirements: 22.4, 22.5_
  
  - [x] 17.3 Test extension compatibility
    - Verify extension works with orchestration responses
    - Test demo mode in extension
    - Verify error handling in extension context
    - _Requirements: 22.1, 22.2_

- [x] 18. Implement deployment configuration
  - [x] 18.1 Create runtime config file
    - Create `frontend/web/public/config.json` with apiBaseUrl
    - Set production API URL: https://fnd9pknygc.execute-api.us-east-1.amazonaws.com
    - _Requirements: 20.1, 20.2_
  
  - [x] 18.2 Update build configuration
    - Ensure Vite build includes config.json in output
    - Configure CloudFront to serve config.json without caching
    - _Requirements: 20.2, 20.3_
  
  - [x] 18.3 Add deployment scripts
    - Create or update `scripts/deploy-web.ps1` for frontend deployment
    - Include steps: build, upload to S3, invalidate CloudFront cache
    - Verify config.json loads correctly after deployment
    - _Requirements: 20.1, 20.4_
  
  - [ ]* 18.4 Write property test for runtime configuration
    - **Property 30: Runtime Configuration Loading**
    - **Validates: Requirements 20.1, 20.2, 20.3**
    - Verify config loading with various scenarios (present, missing, invalid)
    - _Requirements: 20.1, 20.2_


- [x] 19. Implement comprehensive testing
  - [x] 19.1 Write unit tests for new features
    - Test orchestration metadata parsing and display
    - Test stance-based source grouping
    - Test credibility tier display
    - Test contradiction highlighting
    - Test export functionality (copy, JSON)
    - Test API health check
    - _Requirements: 1.2, 2.2, 2.3, 4.4, 23.1, 26.1_
  
  - [x] 19.2 Write integration tests
    - Test complete user journey: landing → input → results
    - Test demo mode flow with example claims
    - Test error recovery flow
    - Test export and retry functionality
    - _Requirements: 11.3, 29.1, 23.1_
  
  - [x] 19.3 Update smoke tests
    - Update `frontend/tests/smoke.test.ts` to verify orchestration integration
    - Test API client handles orchestration responses
    - Test backward compatibility with legacy responses
    - Test error handling for all error types
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5_
  
  - [ ]* 19.4 Write remaining property tests
    - **Property 1: API Request Construction**
    - **Validates: Requirements 1.1, 7.1, 7.2**
    - **Property 6: Date Formatting**
    - **Validates: Requirements 2.4**
    - **Property 15: Timeout Messaging**
    - **Validates: Requirements 8.5**
    - **Property 19: API Client Timeout**
    - **Validates: Requirements 10.1**
    - **Property 21: Response Schema Validation**
    - **Validates: Requirements 10.3**
    - **Property 23: Responsive Touch Targets**
    - **Validates: Requirements 13.3, 13.5**
    - **Property 31: API Health Check on Load**
    - **Validates: Requirements 26.2, 26.3**
    - **Property 32: Export Summary Content**
    - **Validates: Requirements 23.3**
    - **Property 33: Export JSON Validity**
    - **Validates: Requirements 23.4**
    - Generate various inputs and verify behavior
    - _Requirements: 1.1, 2.4, 8.5, 10.1, 10.3, 13.3, 23.3, 23.4, 26.2_

- [x] 20. Checkpoint - Testing validation
  - Run all tests: `npm run test` in frontend/web and frontend/tests
  - Verify all unit tests pass
  - Verify all property tests pass
  - Verify smoke tests pass
  - Check test coverage meets 80% minimum
  - Ensure all tests pass, ask the user if questions arise


- [x] 21. Create documentation
  - [x] 21.1 Create APP_USER_FLOW.md
    - Document complete user journey from landing to results
    - Include screenshots or descriptions of key UI states
    - Document error states and recovery flows
    - Document export functionality
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  
  - [x] 21.2 Create JURY_DEMO_FLOW.md
    - Document 90-second demo script with exact timing
    - Include 3 example claims demonstrating different capabilities
    - Document what to show at each step (orchestration metadata, graph, contradictions)
    - Add troubleshooting steps for demo issues
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
  
  - [x] 21.3 Create APP_RELEASE_SUMMARY.md
    - Document all features implemented in this release
    - List orchestration integration features
    - List UI enhancements (stance grouping, credibility tiers, graph improvements)
    - List accessibility improvements
    - Document known limitations
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 3.1, 19.1_
  
  - [x] 21.4 Update main README.md
    - Add section on orchestration integration
    - Add link to APP_USER_FLOW.md
    - Add link to JURY_DEMO_FLOW.md
    - Update deployment instructions
    - Document runtime configuration
    - _Requirements: 20.1, 20.2_

- [x] 22. Perform end-to-end validation
  - [x] 22.1 Test complete user flows
    - Test landing page → claim input → results display
    - Test all 3 example claims
    - Test error scenarios (network failure, timeout, invalid input)
    - Test export functionality (copy, JSON)
    - Test retry functionality
    - _Requirements: 12.1, 12.2, 12.3, 23.1, 29.1_
  
  - [x] 22.2 Test orchestration integration
    - Submit text-only claim and verify orchestration metadata displays
    - Verify passes_executed, source_classes, average_quality, contradictions_found all display
    - Test with URL claim and verify legacy pipeline works
    - Test backward compatibility with responses lacking orchestration metadata
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 22.3 Test responsive design
    - Test on desktop (1920x1080, 1366x768)
    - Test on tablet (768x1024)
    - Test on mobile (375x667, 414x896)
    - Verify graph scales appropriately
    - Verify touch targets are at least 44px on mobile
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_
  
  - [x] 22.4 Test accessibility
    - Test keyboard-only navigation through entire UI
    - Test with screen reader (NVDA or JAWS)
    - Verify all interactive elements have ARIA labels
    - Verify color contrast meets WCAG AA
    - Verify focus indicators are visible
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_
  
  - [x] 22.5 Test browser compatibility
    - Test on Chrome 90+
    - Test on Firefox 88+
    - Test on Safari 14+
    - Test on Edge 90+
    - Verify no critical bugs on any browser
    - _Requirements: 13.1_


- [x] 23. Perform jury demo dry run
  - [x] 23.1 Practice 90-second demo
    - Follow JURY_DEMO_FLOW.md script exactly
    - Time each step to ensure 90-second total
    - Verify all 3 example claims work in demo mode
    - Verify orchestration metadata displays
    - Verify graph is visible and readable
    - Practice explaining key features (orchestration, contradictions, SIFT)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
  
  - [x] 23.2 Identify and fix demo issues
    - Note any issues during dry run
    - Fix critical bugs that would break demo
    - Optimize demo mode response time if needed
    - Ensure demo mode indicator is visible but not distracting
    - _Requirements: 11.2_
  
  - [x] 23.3 Prepare backup plan
    - Document fallback steps if demo fails
    - Prepare screenshots of expected results
    - Have example responses ready to show
    - _Requirements: 11.1_

- [x] 24. Deploy to production
  - [x] 24.1 Build frontend for production
    - Run `cd frontend/web && npm run build`
    - Verify build completes without errors
    - Check bundle size is reasonable (<2MB)
    - _Requirements: 20.1_
  
  - [x] 24.2 Deploy frontend to S3 and CloudFront
    - Run deployment script: `scripts/deploy-web.ps1`
    - Upload build artifacts to S3
    - Update config.json with production API URL
    - Invalidate CloudFront cache
    - _Requirements: 20.1, 20.2, 20.3, 20.4_
  
  - [x] 24.3 Verify deployment
    - Access production URL and verify app loads
    - Verify config.json loads with correct API URL
    - Test API integration with production backend
    - Submit test claim and verify results display
    - Verify orchestration metadata displays
    - _Requirements: 20.1, 20.2, 20.5_
  
  - [x] 24.4 Verify backend is operational
    - Check backend Lambda function is deployed
    - Verify feature flag ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED=true
    - Test API endpoint directly: POST /analyze
    - Verify orchestration pipeline is working
    - _Requirements: 1.1, 1.2_
  
  - [x] 24.5 Test live application
    - Test complete user flow on production
    - Test all 3 example claims
    - Test error handling
    - Test responsive design on real devices
    - Verify no console errors
    - _Requirements: 12.1, 13.1_


- [x] 25. Final checkpoint - Production readiness
  - Verify all validation commands pass (typecheck, lint, test, build)
  - Verify all tests pass (unit, property, integration, smoke)
  - Verify deployment is successful and app is live
  - Verify backend orchestration is operational
  - Perform final 90-second demo dry run
  - Verify all documentation is complete
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional property-based tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and catch issues early
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The backend orchestration pipeline is already deployed and operational - do not modify backend
- Focus is on completing the frontend to integrate with existing backend
- All code must pass typecheck, lint, and test gates
- Demo mode support enables 90-second jury demonstrations
- Accessibility compliance (WCAG AA) is required for all interactive elements
- Responsive design must work on viewports from 320px to 2560px
- Runtime configuration via /config.json enables zero-downtime deployments

## Implementation Strategy

This plan follows a logical progression:

1. **API Integration** (Tasks 1-2): Enhance API client to handle orchestration metadata and runtime configuration
2. **Component Enhancement** (Tasks 3-11): Improve all UI components for orchestration display, stance grouping, credibility tiers, graph improvements, error handling, and accessibility
3. **User Experience** (Tasks 12-15): Implement demo mode, production user flows, progressive enhancement, and observability
4. **Validation** (Tasks 16-20): Comprehensive testing at component, integration, and end-to-end levels
5. **Documentation** (Task 21): Create user flow, demo script, and release documentation
6. **End-to-End Testing** (Tasks 22-23): Validate complete system and practice demo
7. **Deployment** (Tasks 24-25): Deploy to production and verify operational readiness

Each phase builds on the previous, with validation checkpoints to ensure quality gates remain green throughout implementation.
