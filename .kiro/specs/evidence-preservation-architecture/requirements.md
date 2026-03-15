# Requirements Document

## Introduction

This feature implements a comprehensive "preserve evidence first" architecture across the entire orchestration pipeline to ensure evidence is NEVER lost when Bedrock model invocation fails at any stage. This is Phase 2 of the evidence filter fix, building on Phase 1's immediate bug fix (NOVA model selection and pass-through fallback in evidenceFilter).

The core principle: if evidence retrieval succeeds, that evidence must be preserved through response packaging even when downstream AI models fail. No model failure is allowed to zero out already-retrieved evidence.

## Glossary

- **Evidence_Orchestrator**: The component that coordinates evidence retrieval from multiple providers (mediastack, serper, bing)
- **Evidence_Filter**: The component that scores and filters retrieved evidence using AI models
- **Stance_Classifier**: The component that classifies evidence as supporting, refuting, or neutral
- **Verdict_Synthesizer**: The component that generates final verdicts from classified evidence
- **Contradiction_Searcher**: The component that identifies contradictions between evidence sources
- **Response_Packager**: The component that assembles final API responses with sources and metadata
- **Pass_Through_Mode**: Operational mode where a component preserves input evidence when AI model invocation fails
- **Degraded_State**: System state where evidence is preserved but enrichment metadata is missing due to model failures
- **Evidence_Preservation_Invariant**: The rule that if evidence exists before packaging, sources must not become empty unless explicit business rules removed them
- **Live_Sources**: Evidence sources that have been retrieved and are available for packaging
- **Bedrock_Model**: AWS Bedrock AI models (NOVA, Claude) used for evidence analysis

## Requirements

### Requirement 1: Evidence Preservation Rule

**User Story:** As a system operator, I want evidence to be preserved when AI models fail, so that users always see retrieved evidence even in degraded mode.

#### Acceptance Criteria

1. WHEN Evidence_Orchestrator retrieves evidence successfully AND Evidence_Filter model fails, THEN THE Response_Packager SHALL include the retrieved evidence with default metadata
2. WHEN Evidence_Orchestrator retrieves evidence successfully AND Stance_Classifier model fails, THEN THE Response_Packager SHALL include the retrieved evidence with neutral stance metadata
3. WHEN Evidence_Orchestrator retrieves evidence successfully AND Verdict_Synthesizer model fails, THEN THE Response_Packager SHALL include the retrieved evidence with a degraded verdict
4. WHEN Evidence_Orchestrator retrieves evidence successfully AND Contradiction_Searcher fails, THEN THE Response_Packager SHALL include the retrieved evidence without contradiction metadata
5. WHEN Evidence_Orchestrator retrieves evidence successfully AND any downstream Bedrock_Model fails, THEN THE Response_Packager SHALL NOT return empty sources

### Requirement 2: Pass-Through Contract

**User Story:** As a developer, I want a consistent pass-through contract across all AI-dependent stages, so that evidence preservation behavior is predictable and maintainable.

#### Acceptance Criteria

1. WHEN Evidence_Filter succeeds, THEN THE Evidence_Filter SHALL return enriched evidence with relevance scores
2. WHEN Evidence_Filter fails, THEN THE Evidence_Filter SHALL return original evidence with neutral scores (0.7) and continue processing
3. WHEN Stance_Classifier succeeds, THEN THE Stance_Classifier SHALL return evidence with stance classifications
4. WHEN Stance_Classifier fails, THEN THE Stance_Classifier SHALL return original evidence with neutral stance and continue processing
5. WHEN Verdict_Synthesizer succeeds, THEN THE Verdict_Synthesizer SHALL return synthesized verdict with evidence
6. WHEN Verdict_Synthesizer fails, THEN THE Verdict_Synthesizer SHALL return degraded verdict with preserved evidence
7. WHEN Contradiction_Searcher succeeds, THEN THE Contradiction_Searcher SHALL return evidence with contradiction metadata
8. WHEN Contradiction_Searcher fails, THEN THE Contradiction_Searcher SHALL return original evidence without contradiction metadata

### Requirement 3: Explicit Degraded-State Flags

**User Story:** As a system operator, I want explicit flags showing when pass-through preservation was used, so that I can monitor system health and debug issues.

#### Acceptance Criteria

1. THE Response_Packager SHALL include a `retrieval_status.degradedStages` array listing all stages that used pass-through mode
2. THE Response_Packager SHALL include a `retrieval_status.evidencePreserved` boolean indicating if evidence preservation was triggered
3. THE Response_Packager SHALL include a `retrieval_status.modelFailures` array with failure details for each failed model invocation
4. WHEN any AI-dependent stage uses Pass_Through_Mode, THEN THE stage SHALL log `fallback_used = true` in trace metadata
5. THE Response_Packager SHALL include degraded state flags in the API response without breaking existing API contracts

### Requirement 4: Response Packaging Invariant

**User Story:** As a developer, I want explicit logging of the evidence preservation invariant, so that I can detect and debug evidence loss bugs.

#### Acceptance Criteria

1. THE Response_Packager SHALL log `LIVE_SOURCES_BEFORE_PACKAGING` count before packaging evidence
2. THE Response_Packager SHALL log `LIVE_SOURCES_AFTER_PACKAGING` count after packaging evidence
3. THE Response_Packager SHALL log `EVIDENCE_PRESERVATION_INVARIANT` status (PASS or FAIL)
4. IF `LIVE_SOURCES_BEFORE_PACKAGING` is greater than 0 AND `LIVE_SOURCES_AFTER_PACKAGING` equals 0, THEN THE Response_Packager SHALL log an ERROR with invariant violation details
5. THE Response_Packager SHALL preserve evidence through packaging unless explicit deduplication or business rules remove sources

### Requirement 5: Evidence Filter Policy Change

**User Story:** As a system operator, I want the evidence filter to prioritize retrieval success over model scoring, so that evidence is never rejected solely due to model failures.

#### Acceptance Criteria

1. WHEN Evidence_Orchestrator retrieves evidence successfully AND Evidence_Filter model fails, THEN THE Evidence_Filter SHALL preserve candidate evidence with default metadata
2. THE Evidence_Filter SHALL NOT reject evidence solely because the Bedrock_Model invocation failed
3. WHEN Evidence_Filter model fails, THEN THE Evidence_Filter SHALL assign neutral relevance scores (0.7) to preserved evidence
4. THE Evidence_Filter SHALL log pass-through mode activation with model failure details
5. THE Evidence_Filter SHALL follow the policy: retrieval success takes precedence over model scoring

### Requirement 6: Verdict Degradation Behavior

**User Story:** As an end user, I want to see evidence even when verdict synthesis fails, so that I can still evaluate the claim manually.

#### Acceptance Criteria

1. WHEN Verdict_Synthesizer model fails, THEN THE Verdict_Synthesizer SHALL preserve all Live_Sources
2. WHEN Verdict_Synthesizer model fails, THEN THE Verdict_Synthesizer SHALL return a degraded verdict message
3. WHEN Verdict_Synthesizer model fails, THEN THE Response_Packager SHALL include graphable evidence in the response
4. WHEN Verdict_Synthesizer model fails, THEN THE Response_Packager SHALL preserve `text_grounding.sources` array
5. WHEN Verdict_Synthesizer model fails, THEN THE Response_Packager SHALL preserve `retrieval_status` provider fields

### Requirement 7: Evidence Preservation Tests

**User Story:** As a developer, I want comprehensive tests for evidence preservation, so that I can verify the architecture works correctly across all failure scenarios.

#### Acceptance Criteria

1. THE test suite SHALL verify that WHEN a provider returns 6 sources AND Evidence_Filter model fails, THEN the final response contains 6 or dedup-preserved sources
2. THE test suite SHALL verify that WHEN a provider returns 3 sources AND Verdict_Synthesizer fails, THEN the final response contains the 3 sources
3. THE test suite SHALL verify that WHEN a provider returns evidence AND Contradiction_Searcher fails, THEN the final response contains the evidence
4. THE test suite SHALL verify that WHEN `LIVE_SOURCES_BEFORE_PACKAGING` is greater than 0, THEN `LIVE_SOURCES_AFTER_PACKAGING` is greater than 0
5. THE test suite SHALL include property-based tests verifying the Evidence_Preservation_Invariant across random failure scenarios

### Requirement 8: Backward Compatibility Constraints

**User Story:** As a system operator, I want evidence preservation to be additive, so that existing functionality is not disrupted.

#### Acceptance Criteria

1. THE implementation SHALL NOT change provider ordering logic
2. THE implementation SHALL NOT change freshness strategy logic
3. THE implementation SHALL NOT change query expansion logic
4. THE implementation SHALL NOT change caching behavior
5. THE implementation SHALL only add new fields to API responses, not modify or remove existing fields
6. THE implementation SHALL maintain compatibility with existing client code

### Requirement 9: Parser and Pretty Printer for Degraded State

**User Story:** As a developer, I want to parse and format degraded state metadata, so that I can process and display it consistently.

#### Acceptance Criteria

1. THE Degraded_State_Parser SHALL parse `retrieval_status.degradedStages` arrays from API responses
2. THE Degraded_State_Parser SHALL parse `retrieval_status.modelFailures` arrays from API responses
3. THE Degraded_State_Pretty_Printer SHALL format degraded state metadata into human-readable strings
4. FOR ALL valid degraded state objects, parsing then printing then parsing SHALL produce an equivalent object (round-trip property)
5. THE Degraded_State_Parser SHALL return descriptive errors for invalid degraded state metadata

### Requirement 10: Orchestration Pipeline Invariant Enforcement

**User Story:** As a system architect, I want the orchestration pipeline to enforce evidence preservation at every stage boundary, so that evidence cannot be lost between stages.

#### Acceptance Criteria

1. THE Iterative_Orchestration_Pipeline SHALL verify evidence count before each AI-dependent stage
2. THE Iterative_Orchestration_Pipeline SHALL verify evidence count after each AI-dependent stage
3. IF evidence count decreases AND no explicit business rule caused the decrease, THEN THE Iterative_Orchestration_Pipeline SHALL log a WARNING with stage details
4. THE Iterative_Orchestration_Pipeline SHALL include stage-by-stage evidence counts in trace metadata
5. THE Iterative_Orchestration_Pipeline SHALL enforce that evidence count never reaches zero after successful retrieval unless all evidence was explicitly filtered by business rules
