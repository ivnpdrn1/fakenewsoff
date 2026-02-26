# Implementation Plan: Phase UX Frontend + Browser Extension

## Overview

This implementation plan breaks down the Phase UX Frontend Extension feature into discrete coding tasks. The plan follows a logical progression: shared infrastructure → web UI → browser extension → integration → documentation. Each task builds on previous work, with validation checkpoints to ensure quality gates remain green.

The implementation uses TypeScript, React 18, Vite 5, and Zod for runtime validation. All code must pass typecheck, lint, formatcheck, test, and build commands. Demo mode support is built-in throughout, enabling 90-second jury demonstrations without AWS credentials.

## Tasks

- [x] 1. Set up project structure and shared infrastructure
  - Create `frontend/` directory with subdirectories: `web/`, `extension/`, `shared/`, `tests/`
  - Set up `frontend/shared/` with TypeScript configuration
  - Create `frontend/shared/api/`, `frontend/shared/schemas/`, `frontend/shared/utils/` directories
  - _Requirements: 28.1, 28.2, 28.3, 28.4_

- [x] 2. Implement shared API client module
  - [x] 2.1 Create Zod schemas and type definitions
    - Create `frontend/shared/schemas/index.ts` that re-exports backend Zod schemas
    - Define `ApiError` discriminated union type in `frontend/shared/utils/errors.ts`
    - Define `AnalyzeRequest` interface with text, url, title, demo_mode fields
    - _Requirements: 10.1, 10.3, 11.1_
  
  - [x] 2.2 Implement API client with timeout and retry logic
    - Create `frontend/shared/api/client.ts` with `analyzeContent()` function
    - Implement `fetchWithTimeout()` helper with AbortController
    - Add timeout configuration: 45s for production, 5s for demo mode
    - Implement retry logic: 2 retries for network errors, 1 retry for 500 errors
    - Return `Result<AnalysisResponse, ApiError>` discriminated union
    - _Requirements: 10.1, 10.2, 10.4, 10.5_
  
  - [x] 2.3 Add Zod response validation
    - Validate all Backend_API responses using `AnalysisResponseSchema.safeParse()`
    - Return typed validation errors with details array on failure
    - Validate status_label enum, confidence_score range, sources array length
    - _Requirements: 10.2, 11.2, 11.3, 11.4, 11.5_
  
  - [ ]* 2.4 Write unit tests for API client
    - Test valid response passes validation
    - Test invalid status_label fails validation
    - Test confidence score out of range fails validation
    - Test network error returns typed error
    - Test timeout returns typed error
    - Test 500 error triggers retry
    - _Requirements: 10.2, 10.3, 10.4_
  
  - [ ]* 2.5 Write property test for API response validation
    - **Property 1: API Response Validation**
    - **Validates: Requirements 10.2, 11.1, 11.2, 11.3, 11.4, 11.5**
    - Generate random valid/invalid AnalysisResponse objects
    - Verify valid responses pass validation, invalid responses return typed errors
    - _Requirements: 10.2, 11.2_

- [x] 3. Checkpoint - Validate shared module
  - Run `cd frontend/shared && npm run typecheck && npm run test`
  - Ensure all tests pass, ask the user if questions arise

- [x] 4. Set up Web UI project structure
  - [x] 4.1 Initialize Web UI with Vite and React
    - Create `frontend/web/` directory
    - Run `npm create vite@latest . -- --template react-ts`
    - Configure `vite.config.ts` with port 5173 and proxy to backend
    - Configure `tsconfig.json` with strict mode
    - Add dependencies: react-router-dom, zod, lodash.debounce
    - Add dev dependencies: vitest, @testing-library/react, @testing-library/user-event, fast-check
    - _Requirements: 22.1, 22.2, 22.3, 22.4_
  
  - [x] 4.2 Set up routing and error boundary
    - Create `src/App.tsx` with React Router and ErrorBoundary
    - Define routes: `/` (Home), `/results` (Results)
    - Implement ErrorBoundary class component with fallback UI
    - Create DemoModeContext for sharing demo mode state
    - _Requirements: 1.1, 4.3_
  
  - [x] 4.3 Create CSS modules structure
    - Set up CSS Modules configuration in Vite
    - Create global styles in `src/index.css` with CSS variables for colors
    - Define color scheme: green (Supported), red (Disputed), yellow (Unverified), darkred (Manipulated), orange (Biased framing)
    - _Requirements: 22.5, 3.1_

- [x] 5. Implement Web UI core components
  - [x] 5.1 Create InputForm component
    - Implement `src/components/InputForm.tsx` with text, URL, title inputs
    - Add form validation: text or URL required
    - Implement debounced validation (300ms) using lodash.debounce
    - Add loading state with disabled inputs during analysis
    - Add ARIA labels and semantic HTML (label, textarea, input, button)
    - _Requirements: 1.1, 1.2, 5.1, 5.2, 5.5, 25.5_
  
  - [x] 5.2 Create StatusBadge component
    - Implement `src/components/StatusBadge.tsx` with color-coded badges
    - Map status labels to colors: Supported (green), Disputed (red), Unverified (yellow), Manipulated (darkred), Biased framing (orange)
    - Use React.memo for performance
    - Add ARIA role="status" and aria-label
    - _Requirements: 3.1, 5.3_
  
  - [x] 5.3 Create ResultsCard component
    - Implement `src/components/ResultsCard.tsx` displaying full analysis
    - Render StatusBadge, confidence score with progress bar, recommendation
    - Conditionally render media_risk and misinformation_type when present
    - Render SourceList and SIFTPanel sub-components
    - Use semantic HTML: article, section, header
    - _Requirements: 1.4, 3.1, 3.2, 3.5, 3.6, 3.7, 5.5_
  
  - [x] 5.4 Create SourceList component
    - Implement `src/components/SourceList.tsx` displaying 0-3 sources
    - Render each source with title, snippet, URL, credibility explanation, domain
    - Open links in new tab with rel="noopener noreferrer"
    - Show empty state when sources array is empty
    - Use semantic list markup (ul, li)
    - _Requirements: 3.3, 5.5_
  
  - [x] 5.5 Create SIFTPanel component
    - Implement `src/components/SIFTPanel.tsx` parsing SIFT guidance string
    - Parse format: "Stop: ... Investigate: ... Find: ... Trace: ..."
    - Display four components with icons and visual separation
    - Use semantic headings (h3) for each SIFT component
    - _Requirements: 3.4, 5.5_
  
  - [x] 5.6 Create ErrorState component
    - Implement `src/components/ErrorState.tsx` with user-friendly error messages
    - Map ApiError types to messages: network, timeout, validation, server, unknown
    - Add optional "Retry" button when onRetry prop provided
    - Log detailed error to console for debugging
    - Use ARIA live region (aria-live="assertive")
    - _Requirements: 4.4, 24.1, 24.2, 24.3, 24.4, 24.5_

- [x] 6. Implement Web UI pages
  - [x] 6.1 Create Home page
    - Implement `src/pages/Home.tsx` with InputForm and demo mode toggle
    - Add demo mode toggle control persisting to localStorage
    - Display demo mode banner when active
    - Call API_Client.analyzeContent() on form submit
    - Navigate to /results with response on success
    - Display ErrorState on failure
    - _Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 2.5_
  
  - [x] 6.2 Create Results page
    - Implement `src/pages/Results.tsx` displaying ResultsCard
    - Receive AnalysisResponse from location.state
    - Add "Copy to Clipboard" button copying analysis summary
    - Add "Export JSON" button downloading response as JSON file
    - Add "New Analysis" button navigating back to home
    - Redirect to home if no response in state
    - _Requirements: 1.4, 4.1, 4.2, 4.5_
  
  - [ ]* 6.3 Write unit tests for Web UI components
    - Test InputForm renders and validates input
    - Test StatusBadge renders all five status labels with correct colors
    - Test ResultsCard renders all fields from AnalysisResponse
    - Test SourceList renders 0-3 sources correctly
    - Test SIFTPanel parses and displays SIFT guidance
    - Test ErrorState displays correct messages for each error type
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 24.1, 24.2, 24.3, 24.4_
  
  - [ ]* 6.4 Write property tests for Web UI rendering
    - **Property 4: Status Label Rendering** - Verify all StatusLabel values render with correct styling
    - **Property 5: Confidence Score Display** - Generate random scores 0-100, verify percentage and progress bar
    - **Property 6: Sources Rendering** - Generate random sources arrays (0-3 items), verify all fields rendered
    - **Property 7: Conditional Media Risk Display** - Generate responses with/without media_risk, verify conditional rendering
    - **Property 8: Conditional Misinformation Type Display** - Generate responses with/without misinformation_type, verify conditional rendering
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.6, 3.7**
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7_

- [x] 7. Implement Web UI accessibility features
  - [x] 7.1 Add keyboard navigation support
    - Ensure all interactive elements are focusable via Tab
    - Implement logical tab order (top to bottom, left to right)
    - Add visible focus indicators with custom CSS
    - Test keyboard-only navigation through entire UI
    - _Requirements: 5.1, 5.4_
  
  - [ ]* 7.2 Write accessibility validation tests
    - **Property 10: Keyboard Navigation** - Verify all interactive elements are focusable and show focus indicators
    - **Property 11: ARIA Label Completeness** - Verify all inputs/buttons have ARIA labels or visible text
    - **Property 12: Semantic HTML Usage** - Verify correct HTML elements used (button, input, main, article)
    - **Validates: Requirements 5.1, 5.2, 5.4, 5.5**
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

- [x] 8. Add Web UI validation commands
  - Create `frontend/web/package.json` scripts: typecheck, lint, formatcheck, test, build
  - Configure ESLint with TypeScript and React rules
  - Configure Prettier with consistent formatting
  - Configure Vitest with React Testing Library
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [x] 9. Checkpoint - Validate Web UI
  - Run `cd frontend/web && npm run typecheck && npm run lint && npm run formatcheck && npm run test && npm run build`
  - Ensure all validation commands pass with zero errors
  - Manually test Web UI in browser: start dev server, test demo mode, verify all five status labels
  - Ensure all tests pass, ask the user if questions arise

- [ ] 10. Set up Browser Extension project structure
  - [ ] 10.1 Initialize extension with Vite
    - Create `frontend/extension/` directory
    - Initialize package.json with TypeScript, Vite, React dependencies
    - Configure `vite.config.ts` for extension build with multiple entry points
    - Configure rollup to output popup.js, content-script.js, background.js as IIFE format
    - _Requirements: 23.1, 23.4_
  
  - [ ] 10.2 Create manifest.json
    - Create `frontend/extension/public/manifest.json` with Manifest V3
    - Set permissions: activeTab, scripting, storage, contextMenus, notifications
    - Configure action with default_popup and icons
    - Configure background service worker
    - Configure content_scripts with matches: ["<all_urls>"], run_at: "document_idle"
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 18.4_
  
  - [ ] 10.3 Create extension icons
    - Create placeholder icons: icon-16.png, icon-48.png, icon-128.png
    - Place icons in `frontend/extension/public/`
    - Reference icons in manifest.json
    - _Requirements: 18.5_

- [ ] 11. Implement Browser Extension components
  - [ ] 11.1 Create content script
    - Implement `frontend/extension/src/content-script.ts`
    - Listen for GET_SELECTION messages from popup
    - Return window.getSelection().toString() when text is selected
    - Fallback to first 500 chars from document.body.innerText when no selection
    - Handle edge cases: iframes, shadow DOM, dynamic content
    - _Requirements: 6.2, 6.3_
  
  - [ ] 11.2 Create background service worker
    - Implement `frontend/extension/src/background.ts`
    - Register context menu item on install: "Analyze with FakeNewsOff"
    - Listen for context menu clicks with selected text
    - Call API_Client.analyzeContent() with demo mode from storage
    - Display notification with status label and confidence
    - Handle notification click to open Web UI with request_id
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [ ] 11.3 Create popup UI
    - Implement `frontend/extension/src/popup.tsx` with React
    - Request selected text from content script on mount
    - Display text input and "Analyze" button
    - Call API_Client.analyzeContent() on button click
    - Display results: StatusBadge, confidence, truncated recommendation (200 chars)
    - Add "View Full Analysis" button opening Web UI with request_id
    - Display loading and error states
    - Load demo mode preference from chrome.storage.local
    - _Requirements: 6.1, 6.4, 6.5, 8.1, 8.2, 8.3, 8.5_
  
  - [ ]* 11.4 Write unit tests for extension components
    - Test content script captures selected text
    - Test content script falls back to page snippet when no selection
    - Test background worker registers context menu
    - Test popup requests text from content script
    - Test popup displays analysis results
    - Mock Chrome APIs with jest.mock()
    - _Requirements: 6.2, 6.3, 9.1_
  
  - [ ]* 11.5 Write property tests for extension functionality
    - **Property 13: Extension Text Capture** - Generate random text selections, verify content script captures correctly
    - **Property 14: Extension Popup Results Display** - Generate random AnalysisResponse objects, verify popup displays all fields with truncation
    - **Property 15: Extension request_id Propagation** - Generate random request_ids, verify they're included in Web UI URL
    - **Property 16: Context Menu Analysis** - Generate random text selections, verify context menu triggers API call and notification
    - **Validates: Requirements 6.2, 6.5, 8.1, 8.2, 8.4, 9.1, 9.2, 9.3**
    - _Requirements: 6.2, 6.5, 8.4, 9.1, 9.2, 9.3_

- [ ] 12. Add Browser Extension validation commands
  - Create `frontend/extension/package.json` scripts: typecheck, lint, test, build
  - Configure ESLint with TypeScript rules
  - Configure Vitest for extension tests
  - Ensure build outputs valid extension package in dist/
  - _Requirements: 18.1, 18.2, 18.3_

- [ ] 13. Checkpoint - Validate Browser Extension
  - Run `cd frontend/extension && npm run typecheck && npm run lint && npm run test && npm run build`
  - Ensure all validation commands pass with zero errors
  - Manually test extension: load unpacked, test popup, test context menu, verify demo mode
  - Ensure all tests pass, ask the user if questions arise

- [-] 14. Implement integration and demo infrastructure
  - [x] 14.1 Create root-level demo command
    - Create root `package.json` with `npm run demo` script
    - Use concurrently to start backend and frontend simultaneously
    - Set DEMO_MODE=true for backend
    - Display instructions for loading extension
    - Add health check verification for backend and frontend
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_
  
  - [-] 14.2 Write smoke test for UI-Backend integration
    - Create `frontend/tests/smoke.test.ts`
    - Test API client can call backend in demo mode
    - Test all five status labels return valid responses
    - Test response validation succeeds for all status labels
    - Test error responses are handled correctly
    - Run with DEMO_MODE=true, no AWS credentials required
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_
  
  - [ ]* 14.3 Write property tests for demo mode and error handling
    - **Property 2: Demo Mode Request Flag** - Generate random content with demo mode enabled, verify demo_mode flag in requests
    - **Property 3: Demo Mode Persistence** - Toggle demo mode multiple times, verify localStorage persistence and restoration
    - **Property 9: Error Handling Completeness** - Generate all ApiError types, verify user-friendly messages and console logging
    - **Property 17: API Client Error Type Discrimination** - Simulate different error conditions, verify correct error types returned
    - **Property 18: Debounce Input Validation** - Simulate rapid input changes, verify validation called at most once per 300ms
    - **Validates: Requirements 2.2, 2.5, 4.4, 10.3, 10.4, 24.5, 25.5**
    - _Requirements: 2.2, 2.5, 4.4, 10.3, 10.4, 24.5, 25.5_

- [ ] 15. Checkpoint - Validate integration
  - Run smoke test: `npm run test:smoke`
  - Run full demo: `npm run demo`
  - Verify backend starts on port 3000, frontend on port 5173
  - Test complete flow: Web UI → Backend → Results
  - Test extension flow: Context menu → Notification → Web UI
  - Ensure all tests pass, ask the user if questions arise

- [ ] 16. Create documentation
  - [ ] 16.1 Create USER_DEMO.md
    - Create `docs/USER_DEMO.md` with 90-second demo script
    - Include exact timing for each step (15s per status label)
    - Add 3-minute detailed walkthrough script
    - Include troubleshooting steps for common issues
    - Add ASCII diagrams or descriptions of key UI states
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  
  - [ ] 16.2 Create extension installation guide
    - Create `frontend/extension/README.md` with 5-step installation guide
    - Include instructions for enabling Developer mode
    - Add verification steps for loaded extension
    - Include troubleshooting for common installation issues
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_
  
  - [ ] 16.3 Create development workflow documentation
    - Create `frontend/README.md` with development instructions
    - Document how to start backend in demo mode
    - Document how to start Web UI development server
    - Document how to build extension for testing
    - Document validation command workflow
    - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5_
  
  - [ ] 16.4 Update main README.md
    - Add "User Demo" section with link to USER_DEMO.md
    - Add quick start command: `npm run demo`
    - Add brief description of Web UI and Browser Extension
    - Add link to extension installation guide
    - Maintain existing backend documentation links
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_
  
  - [ ] 16.5 Document CORS configuration
    - Create `docs/CORS_CONFIGURATION.md` or add section to backend README
    - Specify required CORS headers for Backend_API
    - List allowed origins: http://localhost:5173, chrome-extension://*
    - List allowed methods: POST, OPTIONS
    - List allowed headers: Content-Type, Authorization
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 17. Security and quality checks
  - [ ] 17.1 Verify no secrets in repository
    - Create `.env.example` files with placeholder values
    - Verify .gitignore excludes .env files
    - Scan codebase for hardcoded API keys, tokens, credentials
    - Document environment variable configuration in README
    - _Requirements: 20.1, 20.2, 20.3, 20.4_
  
  - [ ] 17.2 Set up CI pipeline for frontend
    - Create or update `.github/workflows/ci.yml`
    - Add job for Web UI: typecheck, lint, formatcheck, test, build
    - Add job for Browser Extension: typecheck, lint, test, build
    - Add job for smoke tests with DEMO_MODE=true
    - Ensure CI fails if any validation command fails
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5_

- [ ] 18. Final validation and polish
  - [ ] 18.1 Run complete validation suite
    - Run all validation commands for shared, web, and extension
    - Run smoke tests
    - Run property-based tests
    - Verify CI pipeline is green
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 18.1, 18.2, 18.3, 21.5_
  
  - [ ] 18.2 Perform 90-second demo dry run
    - Follow USER_DEMO.md 90-second script exactly
    - Verify all five status labels can be demonstrated
    - Test demo mode toggle and visual indicator
    - Test extension popup and context menu
    - Verify no critical bugs during demo
    - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5_
  
  - [ ] 18.3 Polish UI and UX
    - Verify color-coded status badges are visually distinct
    - Verify loading states appear within 100ms
    - Verify error messages are user-friendly
    - Verify responsive design on mobile and desktop
    - Verify accessibility: keyboard navigation, ARIA labels, focus indicators
    - _Requirements: 3.1, 25.1, 25.2, 25.3, 5.1, 5.2, 5.4_

- [ ] 19. Final checkpoint - Complete validation
  - Run `npm run demo` and verify complete system works
  - Run all validation commands across all packages
  - Verify CI pipeline is green
  - Perform final 90-second demo dry run
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional property-based and unit tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and catch issues early
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All code must pass typecheck, lint, formatcheck, test, and build gates
- Demo mode support is built-in throughout for 90-second jury demonstrations
- The implementation follows a logical progression: shared → web → extension → integration → docs
