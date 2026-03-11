# Requirements Document

## Introduction

This document specifies requirements for transforming FakeNewsOff from a demo-reliable application into a production-reliable misinformation verification system. The system must reliably retrieve and evaluate external evidence even when news APIs return incomplete or inconsistent results, supporting multiple retrieval strategies, claim normalization, and transparent explanation of evidence outcomes.

## Glossary

- **Evidence_Retrieval_System**: The subsystem responsible for fetching external evidence from news APIs and other sources
- **Claim_Normalizer**: The component that extracts structured information from raw claim text
- **Retrieval_Strategy**: A specific method for querying external evidence sources
- **Evidence_Source**: An external article or document retrieved as potential corroboration
- **Verdict_Engine**: The component that determines the final classification based on evidence
- **Retrieval_Provider**: An external API or service that supplies evidence sources
- **Reason_Code**: A machine-readable identifier explaining why a specific verdict was reached
- **Demo_Mode**: The existing demonstration mode using synthetic data
- **Production_Mode**: The operational mode using real-time API queries
- **Canonical_URL**: The normalized, deduplicated form of a web address
- **Evidence_Score**: A structured assessment of an evidence source's quality and relevance
- **Retrieval_Metadata**: Diagnostic information about the evidence retrieval process
- **Normalized_Claim**: A structured representation of a claim with extracted entities, events, time, and location

## Requirements

### Requirement 1: Multiple Input Type Support

**User Story:** As a user, I want to submit claims in various formats, so that I can verify information regardless of how I encountered it.

#### Acceptance Criteria

1. WHEN raw claim text is provided, THE Evidence_Retrieval_System SHALL process it as a verification request
2. WHEN news headline text is provided, THE Evidence_Retrieval_System SHALL process it as a verification request
3. WHEN article body text is provided, THE Evidence_Retrieval_System SHALL process it as a verification request
4. WHEN an article URL is provided, THE Evidence_Retrieval_System SHALL process it as a verification request
5. THE Evidence_Retrieval_System SHALL identify the input type before processing

### Requirement 2: Claim Normalization

**User Story:** As a developer, I want claims to be normalized before retrieval, so that search queries are more effective and consistent.

#### Acceptance Criteria

1. WHEN a claim is received, THE Claim_Normalizer SHALL extract named entities from the claim
2. WHEN a claim is received, THE Claim_Normalizer SHALL identify the primary event or action
3. WHEN a claim is received, THE Claim_Normalizer SHALL extract temporal context
4. WHEN a claim is received, THE Claim_Normalizer SHALL extract location context
5. WHEN normalization completes, THE Claim_Normalizer SHALL generate at least one normalized search query
6. THE Claim_Normalizer SHALL produce a Normalized_Claim structure containing all extracted components

### Requirement 3: Multi-Strategy Evidence Retrieval

**User Story:** As a system operator, I want multiple retrieval strategies to be attempted sequentially, so that evidence can be found even when initial queries fail.

#### Acceptance Criteria

1. WHERE a URL is provided, THE Evidence_Retrieval_System SHALL attempt direct URL analysis as the first Retrieval_Strategy
2. WHEN direct URL analysis completes or is skipped, THE Evidence_Retrieval_System SHALL attempt exact headline search as the next Retrieval_Strategy
3. WHEN exact headline search completes, THE Evidence_Retrieval_System SHALL attempt normalized claim search as the next Retrieval_Strategy
4. WHEN normalized claim search completes, THE Evidence_Retrieval_System SHALL attempt entity plus event search as the next Retrieval_Strategy
5. WHEN entity plus event search completes, THE Evidence_Retrieval_System SHALL attempt time-expanded search as the next Retrieval_Strategy
6. WHEN time-expanded search completes, THE Evidence_Retrieval_System SHALL attempt source-specific search for reputable news domains
7. THE Evidence_Retrieval_System SHALL execute Retrieval_Strategy attempts in the specified order
8. WHEN sufficient evidence is found, THE Evidence_Retrieval_System SHALL terminate further Retrieval_Strategy attempts

### Requirement 4: Query Reformulation

**User Story:** As a system operator, I want alternative queries to be generated when initial retrieval fails, so that evidence discovery is maximized.

#### Acceptance Criteria

1. WHEN a Retrieval_Strategy returns zero Evidence_Source results, THE Evidence_Retrieval_System SHALL generate alternative queries from the Normalized_Claim
2. WHEN alternative queries are generated, THE Evidence_Retrieval_System SHALL attempt retrieval using each alternative query
3. THE Evidence_Retrieval_System SHALL generate at least two alternative queries per failed Retrieval_Strategy

### Requirement 5: Evidence Deduplication

**User Story:** As a developer, I want duplicate evidence sources to be removed, so that verdict determination is based on unique information.

#### Acceptance Criteria

1. WHEN multiple Evidence_Source items are retrieved, THE Evidence_Retrieval_System SHALL deduplicate by Canonical_URL
2. WHEN multiple Evidence_Source items are retrieved, THE Evidence_Retrieval_System SHALL deduplicate by title similarity exceeding 85 percent
3. WHEN multiple Evidence_Source items are retrieved, THE Evidence_Retrieval_System SHALL deduplicate by domain when titles match exactly
4. THE Evidence_Retrieval_System SHALL retain the Evidence_Source with the highest credibility score among duplicates

### Requirement 6: Evidence Scoring

**User Story:** As a developer, I want each evidence source to receive a structured score, so that verdict determination is based on quantifiable metrics.

#### Acceptance Criteria

1. WHEN an Evidence_Source is retrieved, THE Evidence_Retrieval_System SHALL assign a credibility score between 0 and 1
2. WHEN an Evidence_Source is retrieved, THE Evidence_Retrieval_System SHALL assign a relevance score between 0 and 1
3. WHEN an Evidence_Source is retrieved, THE Evidence_Retrieval_System SHALL assign a freshness score between 0 and 1
4. WHEN an Evidence_Source is retrieved, THE Evidence_Retrieval_System SHALL assign a stance score between negative 1 and positive 1
5. WHEN an Evidence_Source is retrieved, THE Evidence_Retrieval_System SHALL assign an entity overlap score between 0 and 1
6. THE Evidence_Retrieval_System SHALL combine individual scores into a composite Evidence_Score structure

### Requirement 7: URL Analysis Path

**User Story:** As a user, I want to submit article URLs for verification, so that I can check whether external corroboration exists for the article's claims.

#### Acceptance Criteria

1. WHEN a URL is submitted, THE Evidence_Retrieval_System SHALL parse the article content
2. WHEN article parsing completes, THE Evidence_Retrieval_System SHALL extract claims from the article
3. WHEN claims are extracted, THE Evidence_Retrieval_System SHALL search for external corroboration
4. WHEN corroboration search completes, THE Verdict_Engine SHALL determine whether corroborating Evidence_Source items exist
5. THE Evidence_Retrieval_System SHALL return both the article analysis and corroboration results

### Requirement 8: Transparent Verdict Logic

**User Story:** As a user, I want to understand how verdicts are determined, so that I can trust the system's conclusions.

#### Acceptance Criteria

1. THE Verdict_Engine SHALL classify results as Supported, Disputed, Unverified, or Manipulated
2. WHEN Evidence_Score values indicate strong corroboration, THE Verdict_Engine SHALL classify the result as Supported
3. WHEN Evidence_Score values indicate conflicting information, THE Verdict_Engine SHALL classify the result as Disputed
4. WHEN insufficient evidence is found, THE Verdict_Engine SHALL classify the result as Unverified
5. WHEN evidence indicates content manipulation, THE Verdict_Engine SHALL classify the result as Manipulated
6. THE Verdict_Engine SHALL base classification on Evidence_Score thresholds and not solely on retrieval success

### Requirement 9: Reason Code Generation

**User Story:** As a developer, I want machine-readable reason codes for all verdicts, so that I can programmatically understand and debug system behavior.

#### Acceptance Criteria

1. WHEN a verdict is determined, THE Verdict_Engine SHALL include at least one Reason_Code
2. WHEN no evidence is found, THE Verdict_Engine SHALL include the Reason_Code NO_EVIDENCE_FOUND
3. WHEN only one Evidence_Source is found, THE Verdict_Engine SHALL include the Reason_Code SINGLE_SOURCE_ONLY
4. WHEN a Retrieval_Provider times out, THE Verdict_Engine SHALL include the Reason_Code PROVIDER_TIMEOUT
5. WHEN evidence relevance scores are below 0.3, THE Verdict_Engine SHALL include the Reason_Code LOW_RELEVANCE_EVIDENCE
6. WHEN evidence stance scores conflict, THE Verdict_Engine SHALL include the Reason_Code CONFLICTING_REPORTS
7. THE Verdict_Engine SHALL include all applicable Reason_Code values in the response

### Requirement 10: Retrieval Transparency

**User Story:** As a developer, I want detailed retrieval metadata, so that I can diagnose and improve evidence retrieval performance.

#### Acceptance Criteria

1. WHEN evidence retrieval completes, THE Evidence_Retrieval_System SHALL record all queries attempted
2. WHEN evidence retrieval completes, THE Evidence_Retrieval_System SHALL record all Retrieval_Provider instances used
3. WHEN evidence retrieval completes, THE Evidence_Retrieval_System SHALL record the total number of Evidence_Source items retrieved
4. WHEN evidence retrieval completes, THE Evidence_Retrieval_System SHALL record which Evidence_Source items were used in the final verdict
5. THE Evidence_Retrieval_System SHALL include Retrieval_Metadata in the analysis response

### Requirement 11: Robust Fallback Behavior

**User Story:** As a system operator, I want the system to continue functioning when individual providers fail, so that partial failures do not prevent analysis.

#### Acceptance Criteria

1. WHEN a Retrieval_Provider returns an error, THE Evidence_Retrieval_System SHALL log the error
2. WHEN a Retrieval_Provider returns an error, THE Evidence_Retrieval_System SHALL continue retrieval using remaining Retrieval_Provider instances
3. WHEN a Retrieval_Provider times out, THE Evidence_Retrieval_System SHALL continue retrieval using remaining Retrieval_Provider instances
4. THE Evidence_Retrieval_System SHALL complete analysis even when one or more Retrieval_Provider instances fail

### Requirement 12: API Response Extension

**User Story:** As a frontend developer, I want extended response fields, so that I can display detailed analysis information to users.

#### Acceptance Criteria

1. WHEN an analysis completes, THE Evidence_Retrieval_System SHALL include the Normalized_Claim in the response
2. WHEN an analysis completes, THE Evidence_Retrieval_System SHALL include retrieval attempts in the response
3. WHEN an analysis completes, THE Evidence_Retrieval_System SHALL include an evidence summary in the response
4. WHEN an analysis completes, THE Evidence_Retrieval_System SHALL include Reason_Code values in the response
5. THE Evidence_Retrieval_System SHALL maintain backward compatibility with existing response fields

### Requirement 13: Demo Mode Compatibility

**User Story:** As a developer, I want Demo Mode to remain functional, so that demonstrations and testing can continue without API dependencies.

#### Acceptance Criteria

1. WHERE Demo_Mode is enabled, THE Evidence_Retrieval_System SHALL use synthetic data sources
2. WHERE Demo_Mode is enabled, THE Evidence_Retrieval_System SHALL not invoke external Retrieval_Provider instances
3. WHERE Production_Mode is enabled, THE Evidence_Retrieval_System SHALL use real-time API queries
4. THE Evidence_Retrieval_System SHALL support switching between Demo_Mode and Production_Mode without code changes

### Requirement 14: Latency Budget Compliance

**User Story:** As a user, I want analysis to complete within a reasonable time, so that the system is practical for real-world use.

#### Acceptance Criteria

1. THE Evidence_Retrieval_System SHALL complete evidence retrieval within a configurable latency budget
2. WHEN the latency budget is exceeded, THE Evidence_Retrieval_System SHALL terminate further Retrieval_Strategy attempts
3. WHEN the latency budget is exceeded, THE Evidence_Retrieval_System SHALL return results based on evidence collected before timeout
4. THE Evidence_Retrieval_System SHALL default to a latency budget of 10 seconds

### Requirement 15: Structured Observability

**User Story:** As a system operator, I want structured logs for all retrieval steps, so that I can monitor and debug production issues.

#### Acceptance Criteria

1. WHEN a Retrieval_Strategy is attempted, THE Evidence_Retrieval_System SHALL emit a structured log entry
2. WHEN a Retrieval_Provider is invoked, THE Evidence_Retrieval_System SHALL emit a structured log entry
3. WHEN evidence deduplication occurs, THE Evidence_Retrieval_System SHALL emit a structured log entry
4. WHEN a verdict is determined, THE Verdict_Engine SHALL emit a structured log entry
5. THE Evidence_Retrieval_System SHALL include timestamps, request identifiers, and component names in all log entries

### Requirement 16: Provider Adapter Architecture

**User Story:** As a developer, I want retrieval providers to be pluggable, so that new evidence sources can be added without modifying core logic.

#### Acceptance Criteria

1. THE Evidence_Retrieval_System SHALL define a standard Retrieval_Provider interface
2. WHEN a new evidence source is needed, THE Evidence_Retrieval_System SHALL support adding a new Retrieval_Provider implementation without modifying existing providers
3. THE Evidence_Retrieval_System SHALL load Retrieval_Provider instances through a registry or configuration
4. THE Evidence_Retrieval_System SHALL invoke all registered Retrieval_Provider instances during evidence retrieval

### Requirement 17: Validation Gate Compliance

**User Story:** As a developer, I want all new code to pass existing quality gates, so that system reliability is maintained.

#### Acceptance Criteria

1. THE Evidence_Retrieval_System SHALL pass TypeScript type checking
2. THE Evidence_Retrieval_System SHALL pass linting rules
3. THE Evidence_Retrieval_System SHALL pass all existing unit tests
4. THE Evidence_Retrieval_System SHALL pass all existing integration tests
5. THE Evidence_Retrieval_System SHALL build successfully without errors

### Requirement 18: Parser and Pretty Printer for Normalized Claims

**User Story:** As a developer, I want to serialize and deserialize normalized claims, so that they can be cached, logged, and transmitted reliably.

#### Acceptance Criteria

1. WHEN a Normalized_Claim is created, THE Claim_Normalizer SHALL serialize it to JSON format
2. WHEN a JSON representation is provided, THE Claim_Normalizer SHALL parse it into a Normalized_Claim structure
3. THE Claim_Normalizer SHALL provide a pretty printer that formats Normalized_Claim structures into human-readable JSON
4. FOR ALL valid Normalized_Claim structures, parsing the JSON output then pretty printing then parsing again SHALL produce an equivalent Normalized_Claim structure (round-trip property)
5. WHEN an invalid JSON representation is provided, THE Claim_Normalizer SHALL return a descriptive error

## Notes

This requirements document follows EARS patterns and INCOSE quality rules to ensure clarity, testability, and completeness. Each requirement includes explicit acceptance criteria that can be verified through testing. The document emphasizes production reliability, observability, and maintainability while preserving existing Demo Mode functionality.
