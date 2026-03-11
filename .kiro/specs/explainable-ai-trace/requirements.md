# Requirements Document

## Introduction

This document specifies requirements for adding an Explainable AI Trace to the FakeNewsOff NOVA verification pipeline. The trace provides transparent, step-by-step visibility into how NOVA processes claims while maintaining security by preventing exposure of internal prompts, chain-of-thought reasoning, secrets, or raw model deliberation. The trace supports production, degraded, and demo modes, integrates with evidence caching and provider throttling, and displays results in both API responses and the frontend UI.

## Glossary

- **NOVA_Pipeline**: The FakeNewsOff verification system that processes claims through evidence retrieval, credibility assessment, and verdict generation
- **Trace_Object**: A structured data object containing the complete execution history of a claim verification request
- **Trace_Step**: An individual stage in the NOVA_Pipeline with status, duration, and safe summary information
- **Safe_Summary**: A user-facing description of a Trace_Step that excludes internal prompts, reasoning chains, secrets, and raw model deliberation
- **Request_ID**: A unique identifier for each claim verification request
- **Operation_Mode**: The execution context of NOVA_Pipeline (production, degraded, or demo)
- **Evidence_Cache**: A temporary storage system for retrieved evidence with 10-minute TTL
- **Cache_Hit**: A successful retrieval of evidence from Evidence_Cache without external API calls
- **Cache_Miss**: A failed retrieval from Evidence_Cache requiring external evidence retrieval
- **Provider_Throttling**: Rate limiting applied to external API calls (GDELT 5-second minimum interval)
- **Degraded_Mode**: An operational state where NOVA_Pipeline operates with reduced functionality due to external service unavailability
- **Bedrock_Reasoning**: The AWS Bedrock Claude 3 Haiku model execution step that analyzes evidence and generates verdicts
- **Decision_Summary**: The final output of NOVA_Pipeline containing verdict, confidence score, and rationale
- **Trace_Panel**: A frontend UI component displaying the Trace_Object in a user-friendly format
- **API_Response**: The JSON payload returned by the /analyze endpoint
- **Internal_Prompt**: System instructions sent to AI models that must not be exposed to users
- **Chain_of_Thought**: The intermediate reasoning steps performed by AI models that must not be exposed to users
- **Secrets**: Credentials, API keys, and sensitive configuration values that must not be exposed to users

## Requirements

### Requirement 1: API Response Trace Structure

**User Story:** As a hackathon judge, I want to see how NOVA processed a claim, so that I can evaluate the system's transparency and methodology.

#### Acceptance Criteria

1. WHEN the /analyze endpoint returns a response, THE API_Response SHALL include a trace property containing a Trace_Object
2. THE Trace_Object SHALL include a request_id property matching the Request_ID
3. THE Trace_Object SHALL include a mode property indicating the Operation_Mode
4. THE Trace_Object SHALL include a provider property with value "aws_bedrock"
5. THE Trace_Object SHALL include a pipeline property with value "nova"
6. THE Trace_Object SHALL include a steps property containing an array of Trace_Step objects
7. THE Trace_Object SHALL include a decision_summary property containing the Decision_Summary

### Requirement 2: Pipeline Trace Step Sequence

**User Story:** As a user, I want to see the exact steps NOVA followed, so that I understand the verification process.

#### Acceptance Criteria

1. THE NOVA_Pipeline SHALL generate Trace_Step objects in the following order: Claim Intake, Claim Framing, Evidence Cache Check, Evidence Retrieval, Retrieval Status Evaluation, Source Screening, Credibility Assessment, Evidence Stance Classification, Bedrock Reasoning, Verdict Generation, Response Packaging
2. WHEN a Trace_Step is created, THE NOVA_Pipeline SHALL assign a unique step_id
3. WHEN a Trace_Step is created, THE NOVA_Pipeline SHALL assign a name matching the step sequence
4. WHEN a Trace_Step completes successfully, THE NOVA_Pipeline SHALL set status to "completed"
5. WHEN a Trace_Step fails, THE NOVA_Pipeline SHALL set status to "failed"
6. WHEN a Trace_Step is bypassed, THE NOVA_Pipeline SHALL set status to "skipped"
7. WHEN a Trace_Step is created, THE NOVA_Pipeline SHALL include a Safe_Summary
8. WHEN a Trace_Step completes, THE NOVA_Pipeline SHALL record duration_ms in milliseconds

### Requirement 3: Evidence Cache Trace Integration

**User Story:** As a developer, I want to see whether evidence came from cache or live retrieval, so that I can understand system performance.

#### Acceptance Criteria

1. WHEN a Cache_Hit occurs, THE Evidence Cache Check Trace_Step SHALL indicate cache hit in the Safe_Summary
2. WHEN a Cache_Miss occurs, THE Evidence Cache Check Trace_Step SHALL indicate cache miss in the Safe_Summary
3. WHEN cached evidence is used, THE Evidence Retrieval Trace_Step SHALL indicate cached evidence usage in the Safe_Summary
4. WHEN live evidence retrieval occurs, THE Evidence Retrieval Trace_Step SHALL indicate live retrieval in the Safe_Summary

### Requirement 4: Provider Throttling Trace Integration

**User Story:** As a system administrator, I want to see when throttling occurs, so that I can monitor API rate limiting.

#### Acceptance Criteria

1. WHEN Provider_Throttling is applied, THE Evidence Retrieval Trace_Step SHALL indicate throttling in the Safe_Summary
2. WHEN Provider_Throttling delays execution, THE Evidence Retrieval Trace_Step SHALL reflect the delay in duration_ms

### Requirement 5: Degraded Mode Trace Integration

**User Story:** As a user, I want to know when NOVA operates in degraded mode, so that I understand the reliability of results.

#### Acceptance Criteria

1. WHEN NOVA_Pipeline operates in Degraded_Mode, THE Trace_Object mode property SHALL indicate "degraded"
2. WHEN a Trace_Step operates with reduced functionality, THE Trace_Step Safe_Summary SHALL indicate degraded operation
3. WHEN external services are unavailable, THE affected Trace_Step SHALL set status to "failed" or "skipped"

### Requirement 6: Security and Privacy Protection

**User Story:** As a security engineer, I want to ensure no sensitive information is exposed, so that the system remains secure.

#### Acceptance Criteria

1. THE Safe_Summary SHALL exclude Internal_Prompt content
2. THE Safe_Summary SHALL exclude Chain_of_Thought reasoning
3. THE Safe_Summary SHALL exclude Secrets
4. THE Safe_Summary SHALL exclude raw model internal deliberation
5. WHEN Bedrock_Reasoning executes, THE Bedrock Reasoning Trace_Step SHALL indicate reasoning occurred without exposing Internal_Prompt or Chain_of_Thought

### Requirement 7: Bedrock Reasoning Trace Step

**User Story:** As a user, I want to see that AI reasoning occurred, so that I understand the verdict generation process.

#### Acceptance Criteria

1. WHEN Bedrock_Reasoning executes, THE NOVA_Pipeline SHALL create a Bedrock Reasoning Trace_Step
2. THE Bedrock Reasoning Trace_Step SHALL indicate the model used (Claude 3 Haiku)
3. THE Bedrock Reasoning Trace_Step SHALL indicate evidence analysis occurred
4. THE Bedrock Reasoning Trace_Step SHALL record execution duration_ms
5. THE Bedrock Reasoning Trace_Step Safe_Summary SHALL describe the reasoning purpose without exposing Internal_Prompt or Chain_of_Thought

### Requirement 8: Frontend Trace Panel Display

**User Story:** As a user, I want to see a visual representation of the trace, so that I can easily understand the verification process.

#### Acceptance Criteria

1. WHEN an API_Response contains a Trace_Object, THE frontend SHALL display a Trace_Panel
2. THE Trace_Panel SHALL display the title "How NOVA Reached This Result"
3. THE Trace_Panel SHALL display each Trace_Step in sequence order
4. WHEN a Trace_Step has status "completed", THE Trace_Panel SHALL display a checkmark icon (✓)
5. WHEN a Trace_Step has status "failed", THE Trace_Panel SHALL display a failure icon (✕)
6. WHEN a Trace_Step has status "skipped" or indicates Degraded_Mode, THE Trace_Panel SHALL display a warning icon (⚠)
7. THE Trace_Panel SHALL display the duration_ms for each Trace_Step
8. THE Trace_Panel SHALL display the Safe_Summary for each Trace_Step
9. THE Trace_Panel SHALL display the Decision_Summary

### Requirement 9: Production Compatibility

**User Story:** As a system operator, I want the trace to work in all operational modes, so that transparency is consistent.

#### Acceptance Criteria

1. WHEN NOVA_Pipeline operates with live evidence retrieval, THE Trace_Object SHALL accurately reflect live retrieval
2. WHEN NOVA_Pipeline operates with cached evidence, THE Trace_Object SHALL accurately reflect cache usage
3. WHEN NOVA_Pipeline operates in Degraded_Mode, THE Trace_Object SHALL accurately reflect degraded operation
4. WHEN NOVA_Pipeline uses multi-provider fallback, THE Trace_Object SHALL indicate the active provider

### Requirement 10: Trace Completeness and Accuracy

**User Story:** As a developer, I want the trace to accurately represent execution, so that I can debug issues.

#### Acceptance Criteria

1. THE Trace_Object SHALL include all executed Trace_Step objects
2. THE Trace_Object SHALL maintain Trace_Step sequence order
3. WHEN a Trace_Step is skipped, THE Trace_Object SHALL include the skipped Trace_Step with status "skipped"
4. THE sum of all Trace_Step duration_ms values SHALL approximate the total request processing time within 10% tolerance
5. THE Decision_Summary SHALL match the verdict, confidence, and rationale in the API_Response

### Requirement 11: Parser and Serializer Requirements

**User Story:** As a developer, I want to ensure trace data is correctly serialized and parsed, so that frontend and backend communicate reliably.

#### Acceptance Criteria

1. WHEN the NOVA_Pipeline generates a Trace_Object, THE Trace_Serializer SHALL serialize it to JSON format
2. WHEN the frontend receives a Trace_Object, THE Trace_Parser SHALL parse it from JSON format
3. THE Trace_Serializer SHALL produce valid JSON conforming to the Trace_Object schema
4. THE Trace_Parser SHALL validate incoming JSON against the Trace_Object schema
5. FOR ALL valid Trace_Object instances, parsing then serializing then parsing SHALL produce an equivalent object (round-trip property)
6. WHEN the Trace_Parser encounters invalid JSON, THE Trace_Parser SHALL return a descriptive error
7. WHEN the Trace_Parser encounters a schema violation, THE Trace_Parser SHALL return a descriptive error

### Requirement 12: Testing Coverage

**User Story:** As a quality assurance engineer, I want comprehensive tests, so that the trace feature is reliable.

#### Acceptance Criteria

1. THE backend test suite SHALL verify Trace_Object structure matches the schema
2. THE backend test suite SHALL verify Trace_Step sequence order is correct
3. THE backend test suite SHALL verify Cache_Hit and Cache_Miss scenarios produce correct trace output
4. THE backend test suite SHALL verify Degraded_Mode scenarios produce correct trace output
5. THE backend test suite SHALL verify no Secrets, Internal_Prompt, or Chain_of_Thought content appears in Safe_Summary
6. THE frontend test suite SHALL verify Trace_Panel renders correctly
7. THE frontend test suite SHALL verify status icons display correctly for completed, failed, and skipped states
8. THE frontend test suite SHALL verify duration_ms displays correctly
9. THE frontend test suite SHALL verify graceful degradation when Trace_Object is missing or malformed
10. THE integration test suite SHALL verify round-trip property for Trace_Object serialization and parsing

