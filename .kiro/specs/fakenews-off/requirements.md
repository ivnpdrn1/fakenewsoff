# Requirements Document

## Introduction

This specification defines the deterministic hackathon demo feature for FakeNewsOff's "Try an Example" section. The feature ensures reliable demonstration of system capabilities during hackathon judging by providing deterministic evidence responses for example claims, eliminating dependency on external API availability. The system must demonstrate three core verification outcomes (Supported, Disputed, Unverified) with full pipeline execution including evidence retrieval, credibility assessment, stance classification, explainable AI reasoning, claim evidence graph rendering, and SIFT framework guidance.

## Glossary

- **Example_Claim**: Pre-defined claim text displayed in the "Try an Example" section
- **Demo_Mode**: System configuration that returns deterministic evidence instead of calling external APIs
- **Example_Claims_Component**: React component that displays clickable example claims
- **Evidence_Graph**: Visual representation of claim-evidence relationships
- **Empty_Evidence_State**: UI state displayed when no evidence sources are available
- **SIFT_Panel**: UI component displaying SIFT Framework guidance
- **Verification_Pipeline**: Complete claim verification process from intake to verdict
- **Demo_Evidence_Provider**: Backend service that returns deterministic evidence for demo mode
- **Frontend_Client**: React application that submits claims and displays results
- **Backend_API**: AWS Lambda function that processes verification requests
- **Supported_Verdict**: Verification outcome indicating claim is backed by credible evidence
- **Disputed_Verdict**: Verification outcome indicating claim is contradicted by credible evidence
- **Unverified_Verdict**: Verification outcome indicating insufficient evidence to verify claim
- **Evidence_Source**: Credible source with URL, title, snippet, and justification
- **Explainable_Trace**: Step-by-step record of verification pipeline execution
- **Response_Time**: Duration from claim submission to result display

## Requirements

### Requirement 1: Automatic Demo Mode Activation

**User Story:** As a hackathon judge, I want example claims to automatically use demo mode, so that I see reliable results even if external APIs are unavailable.

#### Acceptance Criteria

1. WHEN a user clicks an Example_Claim, THE Example_Claims_Component SHALL set demo_mode to true in the request payload
2. WHEN the Backend_API receives a request with demo_mode set to true, THE Backend_API SHALL bypass external evidence retrieval APIs
3. WHEN the Backend_API operates in Demo_Mode, THE Backend_API SHALL use the Demo_Evidence_Provider for evidence sources
4. THE Backend_API SHALL execute the complete Verification_Pipeline regardless of demo_mode setting

### Requirement 2: Deterministic Evidence for Supported Claims

**User Story:** As a hackathon judge, I want the supported example to always show supporting evidence, so that I can see how the system handles verified claims.

#### Acceptance Criteria

1. WHEN the Backend_API receives the claim "The Eiffel Tower is located in Paris, France" with demo_mode true, THE Demo_Evidence_Provider SHALL return at least 2 Evidence_Sources from distinct domains
2. WHEN the Demo_Evidence_Provider returns sources for a supported claim, THE Demo_Evidence_Provider SHALL include Evidence_Sources with stance "supports"
3. WHEN the Backend_API processes a supported example claim, THE Backend_API SHALL return a Supported_Verdict
4. WHEN the Backend_API processes a supported example claim, THE Backend_API SHALL return a confidence score between 80 and 95
5. THE Demo_Evidence_Provider SHALL return identical evidence for identical supported claims (deterministic property)

### Requirement 3: Deterministic Evidence for Disputed Claims

**User Story:** As a hackathon judge, I want the disputed example to always show contradicting evidence, so that I can see how the system handles debunked claims.

#### Acceptance Criteria

1. WHEN the Backend_API receives the claim "The moon landing was faked in 1969" with demo_mode true, THE Demo_Evidence_Provider SHALL return at least 2 Evidence_Sources from distinct domains
2. WHEN the Demo_Evidence_Provider returns sources for a disputed claim, THE Demo_Evidence_Provider SHALL include Evidence_Sources with stance "contradicts"
3. WHEN the Backend_API processes a disputed example claim, THE Backend_API SHALL return a Disputed_Verdict
4. WHEN the Backend_API processes a disputed example claim, THE Backend_API SHALL return a confidence score between 70 and 90
5. THE Demo_Evidence_Provider SHALL return identical evidence for identical disputed claims (deterministic property)

### Requirement 4: Deterministic Empty Evidence for Unverified Claims

**User Story:** As a hackathon judge, I want the unverified example to always show no evidence, so that I can see how the system handles unverifiable claims.

#### Acceptance Criteria

1. WHEN the Backend_API receives the claim "A new species was discovered yesterday" with demo_mode true, THE Demo_Evidence_Provider SHALL return an empty evidence list
2. WHEN the Backend_API processes an unverified example claim, THE Backend_API SHALL return an Unverified_Verdict
3. WHEN the Backend_API processes an unverified example claim, THE Backend_API SHALL return a confidence score between 20 and 40
4. THE Demo_Evidence_Provider SHALL return an empty list for identical unverified claims (deterministic property)

### Requirement 5: Complete Pipeline Execution

**User Story:** As a hackathon judge, I want to see the full verification process, so that I understand how the system analyzes claims.

#### Acceptance Criteria

1. WHEN the Backend_API processes an example claim in Demo_Mode, THE Backend_API SHALL execute Claim Intake
2. WHEN the Backend_API processes an example claim in Demo_Mode, THE Backend_API SHALL execute Claim Framing
3. WHEN the Backend_API processes an example claim in Demo_Mode, THE Backend_API SHALL execute Evidence Retrieval using Demo_Evidence_Provider
4. WHEN the Backend_API processes an example claim in Demo_Mode, THE Backend_API SHALL execute Source Screening
5. WHEN the Backend_API processes an example claim in Demo_Mode, THE Backend_API SHALL execute Credibility Assessment
6. WHEN the Backend_API processes an example claim in Demo_Mode, THE Backend_API SHALL execute Evidence Stance Classification
7. WHEN the Backend_API processes an example claim in Demo_Mode, THE Backend_API SHALL execute Bedrock Reasoning
8. WHEN the Backend_API processes an example claim in Demo_Mode, THE Backend_API SHALL execute Verdict Generation
9. WHEN the Backend_API processes an example claim in Demo_Mode, THE Backend_API SHALL execute Response Packaging
10. WHEN the Backend_API completes pipeline execution, THE Backend_API SHALL include an Explainable_Trace in the response

### Requirement 6: Evidence Graph Rendering

**User Story:** As a hackathon judge, I want to see the evidence graph for supported and disputed claims, so that I can understand the evidence relationships.

#### Acceptance Criteria

1. WHEN the Frontend_Client receives a response with at least 1 Evidence_Source, THE Frontend_Client SHALL render the Evidence_Graph component
2. WHEN the Evidence_Graph renders, THE Evidence_Graph SHALL display the claim node
3. WHEN the Evidence_Graph renders, THE Evidence_Graph SHALL display evidence source nodes
4. WHEN the Evidence_Graph renders, THE Evidence_Graph SHALL display edges connecting claim to evidence sources
5. WHEN the Evidence_Graph renders for a Supported_Verdict, THE Evidence_Graph SHALL use green visual indicators
6. WHEN the Evidence_Graph renders for a Disputed_Verdict, THE Evidence_Graph SHALL use red visual indicators

### Requirement 7: Empty Evidence State Rendering

**User Story:** As a hackathon judge, I want to see appropriate messaging when no evidence is found, so that I understand the system handles unverifiable claims gracefully.

#### Acceptance Criteria

1. WHEN the Frontend_Client receives a response with an empty evidence list, THE Frontend_Client SHALL render the Empty_Evidence_State component
2. WHEN the Empty_Evidence_State renders, THE Empty_Evidence_State SHALL display a message indicating no evidence was found
3. WHEN the Empty_Evidence_State renders, THE Empty_Evidence_State SHALL use yellow visual indicators
4. THE Empty_Evidence_State SHALL NOT render the Evidence_Graph component

### Requirement 8: SIFT Framework Guidance Display

**User Story:** As a hackathon judge, I want to see SIFT framework guidance for unverified claims, so that I understand the educational value of the system.

#### Acceptance Criteria

1. WHEN the Frontend_Client receives an Unverified_Verdict, THE Frontend_Client SHALL render the SIFT_Panel component
2. WHEN the SIFT_Panel renders, THE SIFT_Panel SHALL display Stop guidance
3. WHEN the SIFT_Panel renders, THE SIFT_Panel SHALL display Investigate guidance
4. WHEN the SIFT_Panel renders, THE SIFT_Panel SHALL display Find guidance
5. WHEN the SIFT_Panel renders, THE SIFT_Panel SHALL display Trace guidance

### Requirement 9: Performance Requirements

**User Story:** As a hackathon judge, I want example analysis to complete quickly, so that the demo flows smoothly during presentations.

#### Acceptance Criteria

1. WHEN the Backend_API processes an example claim in Demo_Mode, THE Backend_API SHALL complete within 2000 milliseconds
2. WHEN the Frontend_Client submits an example claim, THE Frontend_Client SHALL display results within 2500 milliseconds
3. THE Demo_Evidence_Provider SHALL return evidence within 100 milliseconds

### Requirement 10: Visual Outcome Differentiation

**User Story:** As a hackathon judge, I want to quickly distinguish between different verification outcomes, so that I can understand results at a glance.

#### Acceptance Criteria

1. WHEN the Frontend_Client displays a Supported_Verdict, THE Frontend_Client SHALL use green color indicators
2. WHEN the Frontend_Client displays a Disputed_Verdict, THE Frontend_Client SHALL use red color indicators
3. WHEN the Frontend_Client displays an Unverified_Verdict, THE Frontend_Client SHALL use yellow color indicators
4. WHEN the Frontend_Client displays verdict results, THE Frontend_Client SHALL include a text label indicating the verdict type
5. WHEN the Frontend_Client displays verdict results, THE Frontend_Client SHALL include an icon representing the verdict type

### Requirement 11: Example Claims Interface

**User Story:** As a hackathon judge, I want to easily select example claims, so that I can quickly demonstrate different system capabilities.

#### Acceptance Criteria

1. THE Example_Claims_Component SHALL display exactly 3 Example_Claims
2. THE Example_Claims_Component SHALL display one supported Example_Claim with text "The Eiffel Tower is located in Paris, France"
3. THE Example_Claims_Component SHALL display one disputed Example_Claim with text "The moon landing was faked in 1969"
4. THE Example_Claims_Component SHALL display one unverified Example_Claim with text "A new species was discovered yesterday"
5. WHEN a user clicks an Example_Claim, THE Example_Claims_Component SHALL populate the input form with the claim text
6. WHEN a user clicks an Example_Claim, THE Example_Claims_Component SHALL trigger form submission automatically
7. THE Example_Claims_Component SHALL be keyboard accessible with Enter and Space key support

### Requirement 12: Explainable AI Trace Visibility

**User Story:** As a hackathon judge, I want to see the complete verification trace, so that I can understand the AI reasoning process.

#### Acceptance Criteria

1. WHEN the Backend_API completes verification in Demo_Mode, THE Backend_API SHALL include an Explainable_Trace in the response
2. WHEN the Explainable_Trace is included, THE Explainable_Trace SHALL contain step records for each pipeline stage
3. WHEN the Explainable_Trace is included, THE Explainable_Trace SHALL contain timing information for each step
4. WHEN the Explainable_Trace is included, THE Explainable_Trace SHALL contain a decision summary with verdict and rationale
5. WHEN the Frontend_Client receives an Explainable_Trace, THE Frontend_Client SHALL display the trace in the results view

### Requirement 13: Reliability Without External Dependencies

**User Story:** As a hackathon organizer, I want the demo to work without internet connectivity to external APIs, so that network issues don't disrupt judging.

#### Acceptance Criteria

1. WHEN the Backend_API operates in Demo_Mode, THE Backend_API SHALL NOT make HTTP requests to Bing Search API
2. WHEN the Backend_API operates in Demo_Mode, THE Backend_API SHALL NOT make HTTP requests to GDELT API
3. WHEN the Backend_API operates in Demo_Mode, THE Backend_API SHALL NOT make HTTP requests to any external evidence provider
4. WHEN external APIs are unavailable, THE Backend_API SHALL still return successful responses for example claims in Demo_Mode
5. THE Demo_Evidence_Provider SHALL use only in-memory data structures for evidence storage

### Requirement 14: API Contract Consistency

**User Story:** As a developer, I want demo mode responses to match production response schemas, so that the frontend handles both modes identically.

#### Acceptance Criteria

1. WHEN the Demo_Evidence_Provider returns evidence, THE Demo_Evidence_Provider SHALL format Evidence_Sources with url, title, snippet, why, and domain fields
2. WHEN the Backend_API returns a demo response, THE Backend_API SHALL include all fields required by the production API contract
3. WHEN the Backend_API returns a demo response, THE Backend_API SHALL use the same JSON schema as production responses
4. FOR ALL valid demo responses, serializing then parsing SHALL produce an equivalent object (round-trip property)

### Requirement 15: Demo Mode Configuration

**User Story:** As a developer, I want to control demo mode behavior, so that I can test and configure the feature appropriately.

#### Acceptance Criteria

1. WHEN the Backend_API receives a request with demo_mode field set to true, THE Backend_API SHALL enable Demo_Mode
2. WHEN the Backend_API receives a request with demo_mode field set to false, THE Backend_API SHALL use production evidence retrieval
3. WHEN the Backend_API receives a request without a demo_mode field, THE Backend_API SHALL use production evidence retrieval
4. WHERE the DEMO_MODE environment variable is set to "true", THE Backend_API SHALL enable Demo_Mode for all requests
5. THE Backend_API SHALL log demo mode status for each request
