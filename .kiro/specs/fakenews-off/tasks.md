# Tasks

## Phase 1: Backend Demo Mode Infrastructure

- [x] 1.1 Create demo evidence provider module
  - [x] 1.1.1 Create `backend/src/demo/demoEvidenceProvider.ts`
  - [x] 1.1.2 Implement in-memory evidence database with 3 claim types
  - [x] 1.1.3 Implement `generateClaimKey()` function for deterministic matching
  - [x] 1.1.4 Implement `getDemoEvidence()` function
  - [x] 1.1.5 Implement `hasDemoEvidence()` function

- [x] 1.2 Integrate demo mode into evidence retrieval
  - [x] 1.2.1 Update `backend/src/services/groundingService.ts` to check demo mode flag
  - [x] 1.2.2 Add conditional routing to demo evidence provider
  - [x] 1.2.3 Add latency simulation (50-100ms) for realism

- [x] 1.3 Update Lambda handler for demo mode detection
  - [x] 1.3.1 Update `backend/src/lambda.ts` to parse `demo_mode` field from request
  - [x] 1.3.2 Add environment variable check for `DEMO_MODE`
  - [x] 1.3.3 Pass demo mode flag through pipeline execution

- [x] 1.4 Ensure full pipeline execution in demo mode
  - [x] 1.4.1 Verify all 9 pipeline stages execute in demo mode
  - [x] 1.4.2 Verify explainable trace generation in demo mode
  - [x] 1.4.3 Verify response packaging matches production schema

## Phase 2: Frontend Example Claims Enhancement

- [x] 2.1 Update ExampleClaims component
  - [x] 2.1.1 Modify `onClaimClick` callback signature to accept `isDemoMode` parameter
  - [x] 2.1.2 Update click handler to pass `demo_mode: true`
  - [x] 2.1.3 Maintain existing auto-submit behavior

- [x] 2.2 Update API client
  - [x] 2.2.1 Add `demo_mode?: boolean` field to `AnalysisRequest` interface
  - [x] 2.2.2 Update `analyzeContent()` function to include demo_mode in request body

- [x] 2.3 Update Home page integration
  - [x] 2.3.1 Update `frontend/web/src/pages/Home.tsx` to handle demo mode parameter
  - [x] 2.3.2 Pass demo mode flag to API client when submitting

## Phase 3: Frontend Results Rendering

- [x] 3.1 Verify Evidence Graph rendering
  - [x] 3.1.1 Confirm `ClaimEvidenceGraph` component renders for supported claims
  - [x] 3.1.2 Confirm green color indicators for supported verdicts
  - [x] 3.1.3 Confirm red color indicators for disputed verdicts

- [x] 3.2 Verify Empty Evidence State rendering
  - [x] 3.2.1 Confirm `EmptyEvidenceState` component renders for unverified claims
  - [x] 3.2.2 Confirm yellow color indicators for unverified verdicts
  - [x] 3.2.3 Confirm evidence graph does NOT render when no sources

- [x] 3.3 Verify SIFT Panel rendering
  - [x] 3.3.1 Confirm SIFT panel displays for unverified claims
  - [x] 3.3.2 Confirm all 4 SIFT sections render (Stop, Investigate, Find, Trace)

## Phase 4: Testing

- [ ] 4.1 Write unit tests for demo evidence provider
  - [ ] 4.1.1 Test deterministic evidence for supported claim
  - [ ] 4.1.2 Test deterministic evidence for disputed claim
  - [ ] 4.1.3 Test empty evidence for unverified claim
  - [ ] 4.1.4 Test claim key generation

- [ ] 4.2 Write unit tests for frontend components
  - [ ] 4.2.1 Test ExampleClaims sets demo_mode=true on click
  - [ ] 4.2.2 Test ExampleClaims displays exactly 3 claims
  - [ ] 4.2.3 Test ExampleClaims auto-submits form

- [ ] 4.3 Write property-based tests
  - [ ] 4.3.1 Test demo evidence determinism property
  - [ ] 4.3.2 Test zero external API calls property
  - [ ] 4.3.3 Test full pipeline execution property

- [ ] 4.4 Write integration tests
  - [ ] 4.4.1 Test end-to-end supported claim flow
  - [ ] 4.4.2 Test end-to-end disputed claim flow
  - [ ] 4.4.3 Test end-to-end unverified claim flow
  - [ ] 4.4.4 Test performance (< 2 seconds)

## Phase 5: Validation and Documentation

- [ ] 5.1 Manual testing
  - [ ] 5.1.1 Test supported example: "The Eiffel Tower is located in Paris, France"
  - [ ] 5.1.2 Test disputed example: "The moon landing was faked in 1969"
  - [ ] 5.1.3 Test unverified example: "A new species was discovered yesterday"
  - [ ] 5.1.4 Verify all three complete in < 2 seconds
  - [ ] 5.1.5 Verify correct visual indicators (green/red/yellow)

- [ ] 5.2 Verify requirements compliance
  - [ ] 5.2.1 Verify Requirement 1: Automatic demo mode activation
  - [ ] 5.2.2 Verify Requirement 2: Deterministic evidence for supported claims
  - [ ] 5.2.3 Verify Requirement 3: Deterministic evidence for disputed claims
  - [ ] 5.2.4 Verify Requirement 4: Deterministic empty evidence for unverified claims
  - [ ] 5.2.5 Verify Requirement 5: Complete pipeline execution
  - [ ] 5.2.6 Verify Requirement 6: Evidence graph rendering
  - [ ] 5.2.7 Verify Requirement 7: Empty evidence state rendering
  - [ ] 5.2.8 Verify Requirement 8: SIFT framework guidance display
  - [ ] 5.2.9 Verify Requirement 9: Performance requirements
  - [ ] 5.2.10 Verify Requirement 10: Visual outcome differentiation
  - [ ] 5.2.11 Verify Requirement 11: Example claims interface
  - [ ] 5.2.12 Verify Requirement 12: Explainable AI trace visibility
  - [ ] 5.2.13 Verify Requirement 13: Reliability without external dependencies
  - [ ] 5.2.14 Verify Requirement 14: API contract consistency
  - [ ] 5.2.15 Verify Requirement 15: Demo mode configuration

- [ ] 5.3 Update documentation
  - [ ] 5.3.1 Update README with demo mode instructions
  - [ ] 5.3.2 Document demo mode environment variables
  - [ ] 5.3.3 Create hackathon demo script
