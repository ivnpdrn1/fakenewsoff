# Requirements Document: Phase UX Frontend Extension

## Introduction

This document defines requirements for completing the FakeNewsOff production-ready end-to-end application for both Hackathon Jury demonstrations and real User usage. The backend iterative evidence orchestration pipeline is deployed and operational in production. The frontend components exist but require completion and polish to deliver a cohesive, trustworthy, and explainable user experience.

## Glossary

- **Orchestration_Pipeline**: Multi-stage iterative evidence retrieval system with claim decomposition, query generation, evidence filtering, source classification, and contradiction search
- **Legacy_Pipeline**: Original single-pass evidence retrieval system used for URL-based claims
- **Feature_Flag**: Environment variable ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED controlling pipeline routing
- **Claim_Evidence_Graph**: Visual representation showing relationships between claims and evidence sources with stance grouping
- **SIFT_Framework**: Stop, Investigate, Find, Trace - media literacy framework for evaluating information
- **Stance**: Classification of how a source relates to a claim (supports/contradicts/mentions/unclear)
- **Credibility_Tier**: Source trustworthiness classification (1=high, 2=medium, 3=low)
- **Evidence_Filtering**: Quality-based rejection of generic pages (homepage, category, search, tag pages)
- **Orchestration_Metadata**: Response fields indicating orchestration status (passes_executed, source_classes, average_quality, contradictions_found)
- **Demo_Claim**: Pre-configured claim with deterministic response for jury presentations
- **Verdict**: Final classification result (true/false/misleading/unverified/disputed)
- **Confidence_Score**: Numerical assessment (0-100) of verdict certainty
- **Rationale**: Explanation text describing reasoning behind verdict

## Requirements

### Requirement 1: Orchestration Pipeline Integration

**User Story:** As a developer, I want the frontend to correctly integrate with the deployed orchestration pipeline, so that users receive high-quality evidence-based analysis.

#### Acceptance Criteria

1. WHEN a text-only claim is submitted, THE Frontend SHALL send the request to the /analyze endpoint with proper payload structure
2. WHEN the backend returns orchestration metadata, THE Frontend SHALL parse and display orchestration-specific fields (passes_executed, source_classes, average_quality, contradictions_found)
3. THE Frontend SHALL maintain backward compatibility with legacy pipeline responses that lack orchestration metadata
4. WHEN orchestration metadata is present, THE Frontend SHALL indicate orchestration was used in the UI
5. THE Frontend SHALL handle both text-only claims (orchestration) and URL claims (legacy) without errors

### Requirement 2: Evidence Source Presentation

**User Story:** As a user, I want to see only usable evidence sources with clear stance indicators, so that I can understand how sources relate to the claim.

#### Acceptance Criteria

1. THE Frontend SHALL exclude generic pages (homepage, category, search, tag pages) from evidence display
2. WHEN a source has stance classification, THE Frontend SHALL display the stance (supports/contradicts/mentions/unclear) with visual distinction
3. WHEN a source has credibility tier, THE Frontend SHALL display the tier with appropriate visual indicator
4. WHEN a source has publish date, THE Frontend SHALL display the date in readable format
5. THE Frontend SHALL provide clickable links to original sources that open in new tabs
6. WHEN zero usable sources are found, THE Frontend SHALL display a clear empty state message explaining the situation
7. THE Frontend SHALL group sources by stance for easier comprehension

### Requirement 3: Claim Evidence Graph Visualization

**User Story:** As a user, I want to see a visual graph of claim-evidence relationships, so that I can quickly understand the evidence landscape.

#### Acceptance Criteria

1. THE Claim_Evidence_Graph SHALL use deterministic layout (no physics-based jitter)
2. THE Claim_Evidence_Graph SHALL group sources by stance (supports on right, contradicts on left, mentions/unclear on bottom)
3. WHEN a source node is clicked, THE Claim_Evidence_Graph SHALL open the source URL in a new tab
4. WHEN a source node is hovered, THE Claim_Evidence_Graph SHALL display a tooltip with source title, domain, and publish date
5. WHEN zero sources are available, THE Claim_Evidence_Graph SHALL display an empty state with center claim node only
6. WHEN many sources are available (>10), THE Claim_Evidence_Graph SHALL remain readable with appropriate spacing
7. THE Claim_Evidence_Graph SHALL be responsive and adapt to different screen sizes

### Requirement 4: Verdict Explanation

**User Story:** As a user, I want clear explanation of the verdict, so that I understand why the system reached its conclusion.

#### Acceptance Criteria

1. THE Frontend SHALL display the verdict classification prominently with color coding
2. THE Frontend SHALL display the confidence score with visual progress bar
3. THE Frontend SHALL display the rationale text explaining the reasoning
4. WHEN contradicting evidence exists, THE Frontend SHALL highlight contradicting sources separately
5. WHEN evidence is weak, THE Frontend SHALL explain uncertainty clearly
6. THE Frontend SHALL show key supporting evidence with justification

### Requirement 5: SIFT Framework Guidance

**User Story:** As a user, I want actionable SIFT guidance, so that I can verify information independently.

#### Acceptance Criteria

1. THE Frontend SHALL display SIFT framework steps (Stop, Investigate, Find, Trace) with clear explanations
2. WHEN SIFT details are available in response, THE Frontend SHALL display structured SIFT guidance with evidence URLs
3. THE Frontend SHALL provide clickable evidence URLs within SIFT guidance
4. THE Frontend SHALL explain what each SIFT step means in context of the claim
5. WHEN SIFT details are unavailable, THE Frontend SHALL display fallback SIFT guidance text

### Requirement 6: Landing Page Experience

**User Story:** As a new user, I want a clear and trustworthy landing page, so that I understand what the application does and feel confident using it.

#### Acceptance Criteria

1. THE Landing_Page SHALL display a clear value proposition explaining the application purpose
2. THE Landing_Page SHALL provide a prominent claim input interface accepting text or URL
3. THE Landing_Page SHALL display example claims that users can click to analyze
4. THE Landing_Page SHALL use clean, modern, trustworthy visual design
5. THE Landing_Page SHALL be responsive and work on desktop, tablet, and mobile devices

### Requirement 7: Claim Input Interface

**User Story:** As a user, I want to easily submit claims for analysis, so that I can get results quickly.

#### Acceptance Criteria

1. THE Input_Form SHALL accept text-only claims (minimum 10 characters)
2. THE Input_Form SHALL accept URL claims with optional text
3. WHEN input is invalid, THE Input_Form SHALL display clear error messages
4. WHEN input is valid, THE Input_Form SHALL enable the submit button
5. THE Input_Form SHALL provide placeholder text with examples
6. THE Input_Form SHALL support keyboard shortcuts (Enter to submit)

### Requirement 8: Loading States

**User Story:** As a user, I want to see progress during analysis, so that I know the system is working.

#### Acceptance Criteria

1. WHEN analysis starts, THE Frontend SHALL display a loading spinner
2. WHEN orchestration is running, THE Frontend SHALL display progress indication (e.g., "Analyzing claim...", "Retrieving evidence...")
3. THE Frontend SHALL display estimated time remaining when available
4. THE Frontend SHALL prevent duplicate submissions while analysis is in progress
5. WHEN analysis takes longer than expected (>30s), THE Frontend SHALL display a message indicating the system is still working

### Requirement 9: Error States

**User Story:** As a user, I want clear error messages when something goes wrong, so that I know what to do next.

#### Acceptance Criteria

1. WHEN the API returns an error, THE Frontend SHALL display a user-friendly error message
2. WHEN the API times out, THE Frontend SHALL display a timeout message with retry option
3. WHEN network fails, THE Frontend SHALL display a network error message with retry option
4. WHEN validation fails, THE Frontend SHALL display specific validation errors
5. THE Frontend SHALL provide a "Try Again" button for recoverable errors
6. THE Frontend SHALL log errors to console for debugging without exposing sensitive data

### Requirement 10: API Integration Resilience

**User Story:** As a developer, I want robust API integration, so that the frontend handles backend failures gracefully.

#### Acceptance Criteria

1. THE API_Client SHALL implement timeout protection (45s for production, 5s for demo)
2. THE API_Client SHALL implement retry logic with exponential backoff for network errors
3. THE API_Client SHALL validate responses with Zod schemas before processing
4. WHEN orchestration fails and backend falls back to legacy, THE Frontend SHALL handle the response without errors
5. THE API_Client SHALL handle both orchestration and legacy response formats

### Requirement 11: Jury Demo Flow

**User Story:** As a hackathon judge, I want to see a deterministic 90-second demo, so that I can evaluate the system capabilities consistently.

#### Acceptance Criteria

1. THE Frontend SHALL support demo mode with pre-configured example claims
2. WHEN a demo claim is analyzed, THE Frontend SHALL display results within 5 seconds
3. THE Frontend SHALL provide at least 3 example claims demonstrating different capabilities (supported claim, disputed claim, contradicting evidence)
4. THE Claim_Evidence_Graph SHALL be visible and readable in demo mode
5. THE Frontend SHALL display orchestration metadata when available in demo mode
6. THE Frontend SHALL show source credibility tiers in demo mode

### Requirement 12: Production User Flow

**User Story:** As a real user, I want reliable analysis with clear feedback, so that I can trust the results.

#### Acceptance Criteria

1. WHEN analysis completes successfully, THE Frontend SHALL display results within 45 seconds
2. WHEN evidence is weak, THE Frontend SHALL explain why and suggest improvements (e.g., "Try providing a URL for better results")
3. WHEN no sources are found, THE Frontend SHALL display an empty state with guidance
4. THE Frontend SHALL cache results to improve response time for repeated claims
5. THE Frontend SHALL provide export options (copy to clipboard, export JSON)

### Requirement 13: Responsive Design

**User Story:** As a mobile user, I want the application to work on my device, so that I can verify claims on the go.

#### Acceptance Criteria

1. THE Frontend SHALL be responsive and adapt to screen sizes from 320px to 2560px width
2. THE Claim_Evidence_Graph SHALL be readable on mobile devices with appropriate scaling
3. THE Input_Form SHALL be usable on touch devices
4. THE Results_Page SHALL be scrollable and readable on mobile devices
5. THE Frontend SHALL use appropriate font sizes and touch targets for mobile (minimum 44px touch targets)

### Requirement 14: Contradiction Handling

**User Story:** As a user, I want to see contradicting evidence clearly, so that I can make informed judgments.

#### Acceptance Criteria

1. WHEN contradicting sources exist, THE Frontend SHALL display them in a separate section
2. THE Claim_Evidence_Graph SHALL position contradicting sources on the left side with red visual indicators
3. THE Frontend SHALL explain what contradicting evidence means
4. WHEN orchestration finds contradictions, THE Frontend SHALL indicate this in the orchestration metadata display
5. THE Frontend SHALL prioritize contradicting evidence in the results display

### Requirement 15: Source Credibility Display

**User Story:** As a user, I want to see source credibility indicators, so that I can assess source trustworthiness.

#### Acceptance Criteria

1. WHEN a source has credibility tier 1 (high), THE Frontend SHALL display a high credibility indicator (e.g., green badge)
2. WHEN a source has credibility tier 2 (medium), THE Frontend SHALL display a medium credibility indicator (e.g., yellow badge)
3. WHEN a source has credibility tier 3 (low), THE Frontend SHALL display a low credibility indicator (e.g., gray badge)
4. THE Frontend SHALL explain what each credibility tier means
5. THE Frontend SHALL sort sources by credibility tier when displaying

### Requirement 16: Orchestration Transparency

**User Story:** As a user, I want to know when orchestration was used, so that I understand the analysis quality.

#### Acceptance Criteria

1. WHEN orchestration metadata is present, THE Frontend SHALL display an "Orchestration Used" indicator
2. THE Frontend SHALL display the number of passes executed (1-3)
3. THE Frontend SHALL display the number of source classes found (diversity metric)
4. THE Frontend SHALL display the average quality score
5. WHEN contradictions were found, THE Frontend SHALL indicate this clearly

### Requirement 17: Empty State Handling

**User Story:** As a user, I want helpful guidance when no results are found, so that I know what to do next.

#### Acceptance Criteria

1. WHEN zero sources are found, THE Frontend SHALL display an empty state message
2. THE Empty_State SHALL suggest providing a URL for better results
3. THE Empty_State SHALL explain why no sources were found (e.g., "Query too vague", "No recent news")
4. THE Empty_State SHALL provide a "Try Again" button
5. THE Claim_Evidence_Graph SHALL display an empty state with center claim node only

### Requirement 18: Performance Monitoring

**User Story:** As a developer, I want to monitor frontend performance, so that I can identify and fix issues.

#### Acceptance Criteria

1. THE Frontend SHALL log API request latency to console
2. THE Frontend SHALL log API errors with request IDs
3. THE Frontend SHALL log orchestration metadata when available
4. THE Frontend SHALL track and log cache hit/miss status
5. THE Frontend SHALL provide a health check indicator showing API status

### Requirement 19: Accessibility Compliance

**User Story:** As a user with disabilities, I want the application to be accessible, so that I can use it effectively.

#### Acceptance Criteria

1. THE Frontend SHALL use semantic HTML elements (header, main, article, section)
2. THE Frontend SHALL provide ARIA labels for interactive elements
3. THE Frontend SHALL support keyboard navigation for all interactive elements
4. THE Frontend SHALL provide sufficient color contrast (WCAG AA minimum)
5. THE Claim_Evidence_Graph SHALL provide text alternatives for visual information (tooltips, labels)
6. THE Frontend SHALL support screen readers with appropriate ARIA attributes

### Requirement 20: Deployment Stability

**User Story:** As a developer, I want stable deployments, so that users experience zero downtime.

#### Acceptance Criteria

1. THE Frontend SHALL use runtime configuration (/config.json) for API base URL
2. THE Frontend SHALL support CloudFront deployment with runtime config
3. THE Frontend SHALL handle API base URL changes without rebuild
4. THE Frontend SHALL provide fallback behavior when API is unavailable
5. THE Frontend SHALL display API status indicator showing backend health

### Requirement 21: Feature Flag Awareness

**User Story:** As a developer, I want the frontend to respect feature flags, so that I can control orchestration rollout.

#### Acceptance Criteria

1. THE Frontend SHALL handle responses with orchestration metadata when flag is enabled
2. THE Frontend SHALL handle responses without orchestration metadata when flag is disabled
3. THE Frontend SHALL not crash when orchestration metadata is missing
4. THE Frontend SHALL display appropriate UI based on orchestration availability
5. THE Frontend SHALL log orchestration status for debugging

### Requirement 22: Browser Extension Compatibility

**User Story:** As a browser extension user, I want the same analysis capabilities, so that I can verify claims in context.

#### Acceptance Criteria

1. THE API_Client SHALL work in both web and extension contexts
2. THE API_Client SHALL use the same timeout and retry logic in both contexts
3. THE API_Client SHALL validate responses consistently in both contexts
4. THE Extension SHALL display results in a compact popup format
5. THE Extension SHALL provide a "View Full Results" link to the web application

### Requirement 23: Result Export

**User Story:** As a user, I want to export analysis results, so that I can share or save them.

#### Acceptance Criteria

1. THE Frontend SHALL provide a "Copy to Clipboard" button that copies a formatted summary
2. THE Frontend SHALL provide an "Export JSON" button that downloads the full response
3. THE Copied_Summary SHALL include verdict, confidence, recommendation, and sources
4. THE Exported_JSON SHALL be valid JSON with proper formatting
5. THE Frontend SHALL provide visual feedback when export succeeds (e.g., "Copied!" message)

### Requirement 24: Smoke Test Coverage

**User Story:** As a developer, I want comprehensive smoke tests, so that I can verify the frontend works end-to-end.

#### Acceptance Criteria

1. THE Smoke_Tests SHALL verify claim input and submission
2. THE Smoke_Tests SHALL verify results display with orchestration metadata
3. THE Smoke_Tests SHALL verify Claim_Evidence_Graph rendering
4. THE Smoke_Tests SHALL verify error handling and retry logic
5. THE Smoke_Tests SHALL verify responsive design on multiple screen sizes

### Requirement 25: Rollback Safety

**User Story:** As a developer, I want safe rollback capability, so that I can revert changes if issues occur.

#### Acceptance Criteria

1. THE Frontend SHALL maintain full backward compatibility with legacy responses
2. WHEN orchestration is disabled, THE Frontend SHALL continue working with legacy pipeline
3. THE Frontend SHALL not require rebuild when feature flag changes
4. THE Frontend SHALL handle missing orchestration metadata gracefully
5. THE Frontend SHALL log warnings when expected fields are missing

### Requirement 26: API Health Monitoring

**User Story:** As a user, I want to know if the API is healthy, so that I understand if issues are on my end or the backend.

#### Acceptance Criteria

1. THE Frontend SHALL display an API status indicator (green/yellow/red)
2. THE Frontend SHALL check API health on page load
3. WHEN API is unhealthy, THE Frontend SHALL display a warning message
4. THE Frontend SHALL provide a "Check Status" button to manually verify API health
5. THE Frontend SHALL display grounding provider status when available

### Requirement 27: Verdict Confidence Context

**User Story:** As a user, I want to understand what confidence scores mean, so that I can interpret results correctly.

#### Acceptance Criteria

1. THE Frontend SHALL display confidence score with contextual explanation (e.g., "High confidence: 85%")
2. WHEN confidence is low (<50%), THE Frontend SHALL display a warning about uncertainty
3. WHEN confidence is medium (50-75%), THE Frontend SHALL indicate moderate certainty
4. WHEN confidence is high (>75%), THE Frontend SHALL indicate strong certainty
5. THE Frontend SHALL explain factors affecting confidence (evidence quality, source diversity, contradictions)

### Requirement 28: Progressive Enhancement

**User Story:** As a user with a slow connection, I want the application to work with degraded features, so that I can still get results.

#### Acceptance Criteria

1. THE Frontend SHALL load core functionality first (input form, basic results)
2. THE Frontend SHALL load Claim_Evidence_Graph as an enhancement
3. WHEN JavaScript fails, THE Frontend SHALL display a message indicating JavaScript is required
4. THE Frontend SHALL optimize asset loading with code splitting
5. THE Frontend SHALL provide loading skeletons for slow-loading components

### Requirement 29: Error Recovery

**User Story:** As a user, I want to recover from errors easily, so that I don't lose my work.

#### Acceptance Criteria

1. WHEN an error occurs, THE Frontend SHALL preserve the user's input
2. THE Frontend SHALL provide a "Try Again" button that resubmits with the same input
3. WHEN retry succeeds, THE Frontend SHALL display results normally
4. WHEN retry fails, THE Frontend SHALL suggest alternative actions (e.g., "Try a different claim")
5. THE Frontend SHALL limit automatic retries to prevent infinite loops

### Requirement 30: Orchestration Metadata Display

**User Story:** As a power user, I want to see orchestration details, so that I can understand the analysis depth.

#### Acceptance Criteria

1. WHEN orchestration metadata is present, THE Frontend SHALL display it in an expandable section
2. THE Frontend SHALL display passes executed with explanation (e.g., "2 passes: Initial retrieval + targeted refinement")
3. THE Frontend SHALL display source classes found with explanation (e.g., "2 classes: news_media, fact_checker")
4. THE Frontend SHALL display average quality score with explanation (e.g., "0.75: High quality evidence")
5. WHEN contradictions were found, THE Frontend SHALL display this prominently with explanation
