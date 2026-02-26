# Requirements Document: Phase UX Frontend + Browser Extension

## Introduction

This document specifies requirements for the user-facing frontend experience of FakeNewsOff, including a React web application and Chrome browser extension. The system enables jury members to visually experience the misinformation detection platform through an intuitive interface that connects to the existing backend API. The implementation must support both demo mode (no AWS credentials) and production mode, be demoable in 90 seconds, and pass all validation gates (typecheck, lint, formatcheck, test, build).

## Glossary

- **Web_UI**: React + Vite single-page application for analyzing text and URLs
- **Browser_Extension**: Chrome Manifest V3 extension for analyzing selected text or page content
- **API_Client**: Shared TypeScript module for communicating with the backend /analyze endpoint
- **Demo_Mode**: Backend mode that returns deterministic responses without AWS credentials
- **Backend_API**: Existing TypeScript backend with 258 passing tests and /analyze endpoint
- **SIFT_Framework**: Stop, Investigate, Find, Trace - media literacy framework for evaluating information
- **Status_Label**: Classification result (Supported, Disputed, Unverified, Manipulated, Biased framing)
- **Analysis_Response**: Backend response containing status label, confidence, sources, and guidance
- **Validation_Commands**: npm scripts for typecheck, lint, formatcheck, test, and build

## Requirements

### Requirement 1: Web UI Core Functionality

**User Story:** As a jury member, I want to analyze text or URLs through a web interface, so that I can see the misinformation detection system in action.

#### Acceptance Criteria

1. THE Web_UI SHALL provide a home page with a text input area for content analysis
2. THE Web_UI SHALL provide a URL input field for analyzing web content
3. WHEN the user clicks the "Analyze" button, THE Web_UI SHALL send the content to the Backend_API /analyze endpoint
4. WHEN the Backend_API returns a response, THE Web_UI SHALL display the results page with status label, confidence score, claims, evidence sources, and SIFT guidance
5. THE Web_UI SHALL display loading states during analysis with progress indicators

### Requirement 2: Web UI Demo Mode Support

**User Story:** As a jury presenter, I want to toggle demo mode in the UI, so that I can demonstrate the system without AWS credentials.

#### Acceptance Criteria

1. THE Web_UI SHALL provide a demo mode toggle control visible on the home page
2. WHEN demo mode is enabled, THE Web_UI SHALL send requests with a demo_mode flag to the Backend_API
3. THE Web_UI SHALL display a visual indicator when demo mode is active
4. WHEN demo mode is enabled, THE Backend_API SHALL return deterministic responses based on content keywords
5. THE Web_UI SHALL persist demo mode preference in browser localStorage

### Requirement 3: Web UI Results Display

**User Story:** As a user, I want to see comprehensive analysis results, so that I can understand the credibility assessment.

#### Acceptance Criteria

1. THE Web_UI SHALL display the Status_Label with appropriate visual styling (color-coded badges)
2. THE Web_UI SHALL display the confidence score as a percentage with a visual progress bar
3. THE Web_UI SHALL display up to 3 credible sources with title, snippet, URL, and credibility explanation
4. THE Web_UI SHALL display SIFT_Framework guidance with all four components (Stop, Investigate, Find, Trace)
5. THE Web_UI SHALL display the recommendation text prominently
6. WHEN media_risk is present, THE Web_UI SHALL display the risk level (low, medium, high) with appropriate styling
7. WHEN misinformation_type is present, THE Web_UI SHALL display the classification according to FirstDraft taxonomy

### Requirement 4: Web UI User Experience Features

**User Story:** As a user, I want convenient features for working with analysis results, so that I can easily share and export findings.

#### Acceptance Criteria

1. THE Web_UI SHALL provide a "Copy to Clipboard" button that copies the analysis summary
2. THE Web_UI SHALL provide an "Export JSON" button that downloads the complete Analysis_Response as a JSON file
3. THE Web_UI SHALL display empty state messaging when no analysis has been performed
4. THE Web_UI SHALL display error states with user-friendly messages when analysis fails
5. THE Web_UI SHALL provide a "New Analysis" button on the results page to return to the home page

### Requirement 5: Web UI Accessibility

**User Story:** As a user with accessibility needs, I want the interface to be accessible, so that I can use the system effectively.

#### Acceptance Criteria

1. THE Web_UI SHALL support full keyboard navigation for all interactive elements
2. THE Web_UI SHALL provide ARIA labels for all form inputs and buttons
3. THE Web_UI SHALL maintain WCAG AA contrast ratios for all text and interactive elements
4. THE Web_UI SHALL provide focus indicators for keyboard navigation
5. THE Web_UI SHALL use semantic HTML elements (button, input, main, article) appropriately

### Requirement 6: Browser Extension Core Functionality

**User Story:** As a user browsing the web, I want to analyze selected text or page content via a browser extension, so that I can quickly check information credibility.

#### Acceptance Criteria

1. THE Browser_Extension SHALL provide a popup interface accessible via the extension icon
2. THE Browser_Extension SHALL capture selected text from the active tab when the popup is opened
3. WHEN no text is selected, THE Browser_Extension SHALL capture a snippet from the page (first 500 characters)
4. WHEN the user clicks "Analyze" in the popup, THE Browser_Extension SHALL send the content to the Backend_API /analyze endpoint
5. THE Browser_Extension SHALL display analysis results in the popup with status label, confidence, and summary

### Requirement 7: Browser Extension Permissions and Security

**User Story:** As a security-conscious user, I want the extension to request minimal permissions, so that my privacy is protected.

#### Acceptance Criteria

1. THE Browser_Extension SHALL request only activeTab permission for accessing page content
2. THE Browser_Extension SHALL request scripting permission for content script injection
3. THE Browser_Extension SHALL request storage permission for saving preferences
4. THE Browser_Extension SHALL NOT request broad host permissions or access to all websites
5. THE Browser_Extension SHALL use Chrome Manifest V3 specification

### Requirement 8: Browser Extension Results and Navigation

**User Story:** As an extension user, I want to see results quickly and access detailed analysis, so that I can make informed decisions about content credibility.

#### Acceptance Criteria

1. THE Browser_Extension SHALL display the Status_Label and confidence score in the popup
2. THE Browser_Extension SHALL display a truncated recommendation (first 200 characters)
3. THE Browser_Extension SHALL provide a "View Full Analysis" button that opens the Web_UI with the complete results
4. THE Browser_Extension SHALL pass the request_id to the Web_UI for retrieving cached results
5. THE Browser_Extension SHALL display loading and error states in the popup

### Requirement 9: Browser Extension Context Menu Integration

**User Story:** As a user, I want to analyze selected text via right-click context menu, so that I can quickly check information without opening the popup.

#### Acceptance Criteria

1. WHERE the user has selected text, THE Browser_Extension SHALL display a "Analyze with FakeNewsOff" context menu item
2. WHEN the context menu item is clicked, THE Browser_Extension SHALL send the selected text to the Backend_API
3. THE Browser_Extension SHALL display a notification with the Status_Label and confidence score
4. THE Browser_Extension SHALL provide a link in the notification to view full results in the Web_UI

### Requirement 10: Shared API Client Module

**User Story:** As a developer, I want a typed API client module, so that both the Web_UI and Browser_Extension can reliably communicate with the Backend_API.

#### Acceptance Criteria

1. THE API_Client SHALL export a typed `analyzeContent()` function that accepts text, URL, title, and demo_mode parameters
2. THE API_Client SHALL validate Backend_API responses using Zod schemas from the backend
3. THE API_Client SHALL return typed Analysis_Response objects or typed error objects
4. THE API_Client SHALL handle network errors, timeouts, and invalid responses gracefully
5. THE API_Client SHALL be usable in both browser and extension contexts

### Requirement 11: API Client Response Validation

**User Story:** As a developer, I want API responses to be validated at runtime, so that type errors are caught before reaching the UI.

#### Acceptance Criteria

1. THE API_Client SHALL use Zod schemas to validate all Backend_API responses
2. WHEN the Backend_API returns invalid data, THE API_Client SHALL return a typed error with validation details
3. THE API_Client SHALL validate that status_label is one of the five valid values
4. THE API_Client SHALL validate that confidence_score is between 0 and 100
5. THE API_Client SHALL validate that sources array contains 0-3 items with required fields

### Requirement 12: CORS Configuration Documentation

**User Story:** As a developer, I want CORS configuration documented, so that I can configure the backend to accept requests from the frontend.

#### Acceptance Criteria

1. THE documentation SHALL specify required CORS headers for the Backend_API
2. THE documentation SHALL list allowed origins for Web_UI (http://localhost:5173 for development)
3. THE documentation SHALL list allowed origins for Browser_Extension (chrome-extension://* pattern)
4. THE documentation SHALL specify allowed methods (POST, OPTIONS)
5. THE documentation SHALL specify allowed headers (Content-Type, Authorization)

### Requirement 13: Demo Command and Scripts

**User Story:** As a jury presenter, I want a single command to start the demo, so that I can quickly set up for presentations.

#### Acceptance Criteria

1. THE project SHALL provide an `npm run demo` command that starts both backend and frontend
2. THE demo command SHALL set DEMO_MODE=true environment variable for the backend
3. THE demo command SHALL start the Web_UI development server on port 5173
4. THE demo command SHALL display instructions for loading the Browser_Extension
5. THE demo command SHALL verify that all services are running before completing

### Requirement 14: User Demo Documentation

**User Story:** As a jury presenter, I want demo scripts with timing, so that I can deliver effective 90-second and 3-minute demonstrations.

#### Acceptance Criteria

1. THE project SHALL provide docs/USER_DEMO.md with step-by-step demo scripts
2. THE documentation SHALL include a 90-second demo script with exact timing for each step
3. THE documentation SHALL include a 3-minute detailed walkthrough script
4. THE documentation SHALL include screenshots or ASCII diagrams of key UI states
5. THE documentation SHALL include troubleshooting steps for common demo issues

### Requirement 15: Browser Extension Installation Guide

**User Story:** As a jury member, I want clear installation instructions for the extension, so that I can load it for testing.

#### Acceptance Criteria

1. THE documentation SHALL provide a 5-step installation guide for loading the unpacked extension
2. THE documentation SHALL include screenshots of the Chrome extensions page
3. THE documentation SHALL specify enabling "Developer mode" as the first step
4. THE documentation SHALL explain how to verify the extension is loaded correctly
5. THE documentation SHALL include troubleshooting for common installation issues

### Requirement 16: Main README Integration

**User Story:** As a repository visitor, I want the main README to reference the user demo, so that I can quickly find demo instructions.

#### Acceptance Criteria

1. THE main README.md SHALL include a "User Demo" section with links to USER_DEMO.md
2. THE main README.md SHALL include a quick start command for running the demo
3. THE main README.md SHALL include a brief description of the Web_UI and Browser_Extension
4. THE main README.md SHALL include links to the extension installation guide
5. THE main README.md SHALL maintain existing backend documentation links

### Requirement 17: Validation Command Compliance

**User Story:** As a developer, I want all validation commands to pass, so that code quality is maintained.

#### Acceptance Criteria

1. THE Web_UI SHALL pass `npm run typecheck` with zero TypeScript errors
2. THE Web_UI SHALL pass `npm run lint` with zero ESLint errors
3. THE Web_UI SHALL pass `npm run formatcheck` with zero Prettier violations
4. THE Web_UI SHALL pass `npm run test` with all tests passing
5. THE Web_UI SHALL pass `npm run build` producing production-ready artifacts

### Requirement 18: Browser Extension Validation

**User Story:** As a developer, I want the extension to pass validation, so that it can be published to the Chrome Web Store.

#### Acceptance Criteria

1. THE Browser_Extension SHALL pass `npm run typecheck` with zero TypeScript errors
2. THE Browser_Extension SHALL pass `npm run lint` with zero ESLint errors
3. THE Browser_Extension SHALL pass `npm run build` producing a valid extension package
4. THE Browser_Extension SHALL include a valid manifest.json conforming to Manifest V3
5. THE Browser_Extension SHALL include all required icons (16x16, 48x48, 128x128)

### Requirement 19: Smoke Test for UI-Backend Integration

**User Story:** As a developer, I want an automated smoke test for the UI-backend flow, so that integration issues are caught early.

#### Acceptance Criteria

1. THE project SHALL include at least one smoke test that validates UI → Backend_API → UI flow
2. THE smoke test SHALL verify that the API_Client can successfully call the Backend_API in demo mode
3. THE smoke test SHALL verify that Analysis_Response validation succeeds for all five Status_Label types
4. THE smoke test SHALL verify that error responses are handled correctly
5. THE smoke test SHALL run in CI without requiring AWS credentials

### Requirement 20: No Secrets in Repository

**User Story:** As a security-conscious developer, I want to ensure no secrets are committed, so that the repository remains secure.

#### Acceptance Criteria

1. THE project SHALL include .env.example files with placeholder values
2. THE .gitignore SHALL exclude .env files from version control
3. THE project SHALL NOT contain hardcoded API keys, tokens, or credentials
4. THE documentation SHALL explain how to configure environment variables for local development
5. THE CI pipeline SHALL verify no secrets are present using automated scanning

### Requirement 21: CI Pipeline Integration

**User Story:** As a developer, I want CI to validate frontend changes, so that quality gates are enforced automatically.

#### Acceptance Criteria

1. THE CI pipeline SHALL run all Validation_Commands for the Web_UI
2. THE CI pipeline SHALL run all Validation_Commands for the Browser_Extension
3. THE CI pipeline SHALL fail if any validation command fails
4. THE CI pipeline SHALL run smoke tests for UI-backend integration
5. THE CI pipeline SHALL remain green after Phase UX implementation

### Requirement 22: Web UI Technology Stack

**User Story:** As a developer, I want the Web_UI to use modern, maintainable technologies, so that development is efficient.

#### Acceptance Criteria

1. THE Web_UI SHALL use React 18+ for component architecture
2. THE Web_UI SHALL use Vite 5+ for build tooling and development server
3. THE Web_UI SHALL use TypeScript 5+ for type safety
4. THE Web_UI SHALL use Zod for runtime validation
5. THE Web_UI SHALL use a minimal CSS approach (CSS modules or Tailwind) without heavy UI frameworks

### Requirement 23: Browser Extension Technology Stack

**User Story:** As a developer, I want the Browser_Extension to use compatible technologies, so that code can be shared with the Web_UI.

#### Acceptance Criteria

1. THE Browser_Extension SHALL use TypeScript 5+ for all source files
2. THE Browser_Extension SHALL use the same Zod schemas as the Web_UI for validation
3. THE Browser_Extension SHALL use the same API_Client module as the Web_UI
4. THE Browser_Extension SHALL use a bundler (Vite or Rollup) to produce extension artifacts
5. THE Browser_Extension SHALL minimize bundle size to reduce extension load time

### Requirement 24: Error Handling and User Feedback

**User Story:** As a user, I want clear error messages when analysis fails, so that I understand what went wrong.

#### Acceptance Criteria

1. WHEN the Backend_API is unreachable, THE Web_UI SHALL display "Unable to connect to analysis service"
2. WHEN the Backend_API returns a 500 error, THE Web_UI SHALL display "Analysis failed, please try again"
3. WHEN the Backend_API returns invalid data, THE Web_UI SHALL display "Received invalid response from server"
4. WHEN network timeout occurs, THE Web_UI SHALL display "Request timed out, please try again"
5. THE Web_UI SHALL log detailed error information to the browser console for debugging

### Requirement 25: Performance and Responsiveness

**User Story:** As a user, I want the UI to be responsive and performant, so that the experience is smooth.

#### Acceptance Criteria

1. THE Web_UI SHALL render the home page in under 1 second on modern browsers
2. THE Web_UI SHALL display loading states within 100ms of user interaction
3. THE Web_UI SHALL be responsive on screen sizes from 320px to 2560px width
4. THE Browser_Extension popup SHALL load in under 500ms
5. THE Web_UI SHALL debounce input validation to avoid excessive re-renders

### Requirement 26: Backend API Endpoint Specification

**User Story:** As a frontend developer, I want the backend API endpoint formally specified, so that I can implement the API_Client correctly.

#### Acceptance Criteria

1. THE Backend_API SHALL expose a POST /analyze endpoint accepting JSON payloads
2. THE /analyze endpoint SHALL accept text (required), url (optional), title (optional), and demo_mode (optional) fields
3. THE /analyze endpoint SHALL return Analysis_Response JSON conforming to the AnalysisResponseSchema
4. THE /analyze endpoint SHALL return 200 status code for successful analysis
5. THE /analyze endpoint SHALL return 400 status code for invalid requests with error details

### Requirement 27: Demo Mode Content Keyword Detection

**User Story:** As a demo presenter, I want the system to return appropriate demo responses based on content keywords, so that demos are contextually relevant.

#### Acceptance Criteria

1. WHEN demo mode is enabled AND content contains "fake" or "manipulated", THE Backend_API SHALL return a "Manipulated" Status_Label
2. WHEN demo mode is enabled AND content contains "disputed" or "false", THE Backend_API SHALL return a "Disputed" Status_Label
3. WHEN demo mode is enabled AND content contains "bias" or "framing", THE Backend_API SHALL return a "Biased framing" Status_Label
4. WHEN demo mode is enabled AND content contains "verified" or "confirmed", THE Backend_API SHALL return a "Supported" Status_Label
5. WHEN demo mode is enabled AND content contains no keywords, THE Backend_API SHALL return an "Unverified" Status_Label

### Requirement 28: Project Structure and Organization

**User Story:** As a developer, I want a clear project structure, so that code is easy to navigate and maintain.

#### Acceptance Criteria

1. THE project SHALL organize frontend code in a `frontend/` directory at repository root
2. THE frontend/ directory SHALL contain separate subdirectories for `web/` and `extension/`
3. THE project SHALL organize shared code in `frontend/shared/` directory
4. THE API_Client SHALL be located in `frontend/shared/api/` directory
5. THE project SHALL maintain backend code in the existing `backend/` directory

### Requirement 29: Development Workflow Documentation

**User Story:** As a new developer, I want clear development workflow documentation, so that I can contribute effectively.

#### Acceptance Criteria

1. THE documentation SHALL explain how to start the backend in demo mode
2. THE documentation SHALL explain how to start the Web_UI development server
3. THE documentation SHALL explain how to build the Browser_Extension for testing
4. THE documentation SHALL explain how to run tests for frontend components
5. THE documentation SHALL explain the validation command workflow before committing code

### Requirement 30: Hackathon Jury Readiness

**User Story:** As a hackathon participant, I want the system to be jury-ready, so that we can deliver an impressive demonstration.

#### Acceptance Criteria

1. THE system SHALL be demoable in 90 seconds with the provided demo script
2. THE system SHALL work reliably in demo mode without AWS credentials
3. THE system SHALL be visually impressive with polished UI and smooth interactions
4. THE system SHALL demonstrate all five Status_Label types through keyword-based demo responses
5. THE system SHALL have zero critical bugs that would disrupt a jury presentation
