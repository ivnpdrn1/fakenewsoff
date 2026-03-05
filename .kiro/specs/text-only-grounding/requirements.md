# Requirements Document

## Introduction

This feature enables text-only fact-checking by automatically searching web and news providers to find credible sources that support, contradict, or mention user claims. When users provide only text (no URL), the system performs grounding searches and returns at least 3 sources when available, making the application useful for real-world fact-checking scenarios.

## Glossary

- **Grounding_Service**: Backend service responsible for searching external providers and normalizing source results
- **Query_Builder**: Component that generates search queries from user text using entity extraction and key phrases
- **Source_Normalizer**: Component that transforms provider-specific results into standardized NormalizedSource objects
- **Stance_Classifier**: Component that determines whether a source supports, contradicts, mentions, or has unclear relation to the claim
- **Provider**: External data source (Bing News Search, GDELT) that returns search results
- **NormalizedSource**: Standardized source object containing url, title, publisher, snippet, published_at, provider, score, stance, credibility_tier
- **Demo_Mode**: Operational mode that returns deterministic results for demonstration purposes
- **Results_Page**: Frontend UI component that displays analysis results and sources
- **Credibility_Tier**: Classification of source trustworthiness (e.g., tier 1, tier 2, tier 3)
- **Stance**: Relationship between source and claim (supports, contradicts, mentions, unclear)
- **Reason_Code**: Machine-readable code explaining why grounding failed (PROVIDER_EMPTY, QUERY_TOO_VAGUE, KEYS_MISSING)

## Requirements

### Requirement 1: Automatic Grounding Search Trigger

**User Story:** As a user, I want the system to automatically search for sources when I provide only text, so that I can fact-check claims without needing a URL.

#### Acceptance Criteria

1. WHEN a user submits a request with text and no URL, THE Grounding_Service SHALL initiate a grounding search automatically
2. THE Grounding_Service SHALL generate between 3 and 6 search queries from the request text
3. WHEN the request text contains temporal keywords, THE Query_Builder SHALL include recency hint queries
4. THE Query_Builder SHALL extract named entities and key phrases from the request text
5. THE Query_Builder SHALL include quoted phrases around the main claim in generated queries

### Requirement 2: Multi-Provider Source Retrieval

**User Story:** As a developer, I want the system to query multiple providers with fallback logic, so that source retrieval is resilient to individual provider failures.

#### Acceptance Criteria

1. WHEN executing a grounding search, THE Grounding_Service SHALL query Bing News Search with N=10 results per query
2. IF Bing News Search returns fewer than 3 results OR the API key is missing, THEN THE Grounding_Service SHALL query GDELT as fallback
3. THE Grounding_Service SHALL deduplicate results across multiple queries by canonicalized URL
4. THE Grounding_Service SHALL deduplicate results by title and publisher similarity
5. THE Source_Normalizer SHALL transform all provider-specific results into NormalizedSource objects

### Requirement 3: Minimum Source Count Guarantee

**User Story:** As a user, I want to receive at least 3 sources when available, so that I have sufficient information to evaluate the claim.

#### Acceptance Criteria

1. WHEN providers return 3 or more results, THE Grounding_Service SHALL return at least 3 NormalizedSource objects
2. THE Grounding_Service SHALL rank sources by relevance, credibility tier, recency, and domain diversity
3. THE Grounding_Service SHALL ensure domain diversity in the final source list
4. WHEN providers return fewer than 3 results from the same domain, THE Grounding_Service SHALL include those results rather than omit them
5. THE Grounding_Service SHALL return between 3 and 6 sources in the final result set

### Requirement 4: Source Metadata Completeness

**User Story:** As a user, I want each source to include comprehensive metadata, so that I can evaluate source credibility and relevance.

#### Acceptance Criteria

1. THE Source_Normalizer SHALL populate the url field for each NormalizedSource
2. THE Source_Normalizer SHALL populate the title field for each NormalizedSource
3. THE Source_Normalizer SHALL populate the publisher field for each NormalizedSource
4. THE Source_Normalizer SHALL populate the snippet field for each NormalizedSource
5. WHERE the provider supplies publication date, THE Source_Normalizer SHALL populate the published_at field
6. THE Source_Normalizer SHALL populate the provider field with the source provider name
7. THE Source_Normalizer SHALL populate the score field with the ranking score
8. THE Stance_Classifier SHALL populate the stance field with one of: supports, contradicts, mentions, unclear
9. THE Source_Normalizer SHALL populate the credibility_tier field

### Requirement 5: Stance Classification

**User Story:** As a user, I want to know whether each source supports or contradicts my claim, so that I can quickly assess the evidence.

#### Acceptance Criteria

1. WHEN classifying stance, THE Stance_Classifier SHALL first apply keyword-based heuristics using title and snippet
2. IF the heuristic classification is uncertain, THEN THE Stance_Classifier SHALL invoke the LLM summarizer with a stance classification prompt
3. THE Stance_Classifier SHALL assign one of four stance values: supports, contradicts, mentions, unclear
4. THE Stance_Classifier SHALL generate a justification of 1 sentence maximum for each stance classification
5. THE Stance_Classifier SHALL detect support keywords in title and snippet (claims, confirms, proves, supports)
6. THE Stance_Classifier SHALL detect contradiction keywords in title and snippet (false, debunked, denies, contradicts)

### Requirement 6: API Response Contract

**User Story:** As a frontend developer, I want a consistent API response structure, so that I can reliably display grounding results.

#### Acceptance Criteria

1. WHEN a text-only request is processed, THE API SHALL return a sources array in the response
2. THE API SHALL populate the grounding.queries array with the queries that were executed
3. THE API SHALL populate the grounding.provider_used array with the providers that were queried
4. THE API SHALL populate the grounding.sources_count field with the number of sources returned
5. THE API SHALL populate the grounding.cache_hit field indicating whether results were cached
6. WHEN no sources are found, THE API SHALL populate the grounding.reason_codes array with applicable codes
7. THE API SHALL include PROVIDER_EMPTY in reason_codes when providers return zero results
8. THE API SHALL include QUERY_TOO_VAGUE in reason_codes when query generation produces low-quality queries
9. THE API SHALL include KEYS_MISSING in reason_codes when required API keys are not configured

### Requirement 7: Zero Results Handling

**User Story:** As a user, I want to understand why no sources were found, so that I can refine my query or understand the limitation.

#### Acceptance Criteria

1. WHEN providers return zero results, THE Grounding_Service SHALL return an empty sources array
2. WHEN providers return zero results, THE Grounding_Service SHALL populate the grounding.queries array with attempted queries
3. WHEN providers return zero results, THE Grounding_Service SHALL populate the grounding.reason_codes array with at least one reason code
4. THE API SHALL return HTTP 200 status even when zero sources are found
5. THE Grounding_Service SHALL log the reason for zero results at INFO level

### Requirement 8: Demo Mode Determinism

**User Story:** As a demonstrator, I want demo mode to always return 3 sources, so that demonstrations are consistent and never show empty results.

#### Acceptance Criteria

1. WHEN the system operates in Demo_Mode, THE Grounding_Service SHALL return exactly 3 deterministic sources
2. WHEN the system operates in Demo_Mode, THE Grounding_Service SHALL return sources with varied stance values
3. WHEN the system operates in Demo_Mode, THE Grounding_Service SHALL return sources with realistic metadata
4. THE Demo_Mode SHALL generate sources that are consistent for the same input text
5. THE Demo_Mode SHALL bypass external provider calls

### Requirement 9: Frontend Source Display

**User Story:** As a user, I want to see sources displayed with clear metadata and stance indicators, so that I can quickly evaluate the evidence.

#### Acceptance Criteria

1. WHEN sources are available, THE Results_Page SHALL render a SourceCard for each source
2. THE SourceCard SHALL display the title as a clickable link to the source URL
3. THE SourceCard SHALL display the publisher name
4. WHERE published_at is available, THE SourceCard SHALL display the publication date
5. THE SourceCard SHALL display the snippet text
6. THE SourceCard SHALL display a stance badge with the stance value
7. THE SourceCard SHALL display a provider tag indicating the data source
8. THE SourceCard SHALL use distinct visual styling for each stance value (supports, contradicts, mentions, unclear)

### Requirement 10: Frontend Zero Results Display

**User Story:** As a user, I want to see helpful information when no sources are found, so that I understand what happened and can take action.

#### Acceptance Criteria

1. WHEN the sources array is empty, THE Results_Page SHALL display the message "No credible sources found"
2. WHEN the sources array is empty, THE Results_Page SHALL display a "Queries attempted" section
3. THE Results_Page SHALL render each query from grounding.queries in the "Queries attempted" section
4. WHEN reason_codes are present, THE Results_Page SHALL display a "Why" section explaining the reason codes
5. THE Results_Page SHALL translate reason codes into user-friendly explanations

### Requirement 11: Test Coverage

**User Story:** As a developer, I want comprehensive test coverage for text-only grounding, so that the feature is reliable and maintainable.

#### Acceptance Criteria

1. THE test suite SHALL include a unit test verifying that text-only requests trigger query generation
2. THE test suite SHALL include a unit test verifying that text-only requests trigger provider calls with mocked providers
3. THE test suite SHALL include a unit test verifying that the system returns at least 3 sources when providers return 3 or more results
4. THE test suite SHALL include a unit test verifying that the system returns queries and reason_codes when providers return zero results
5. THE test suite SHALL include a unit test verifying that Demo_Mode always returns exactly 3 deterministic sources
6. THE test suite SHALL include a unit test verifying source deduplication by URL
7. THE test suite SHALL include a unit test verifying source deduplication by title and publisher similarity

### Requirement 12: Quality Gates

**User Story:** As a developer, I want all code quality gates to pass, so that the codebase remains maintainable and production-ready.

#### Acceptance Criteria

1. THE codebase SHALL pass TypeScript type checking without errors
2. THE codebase SHALL pass linting without errors
3. THE codebase SHALL pass code formatting checks
4. THE test suite SHALL pass all tests without failures
5. THE codebase SHALL build successfully without errors

### Requirement 13: Parser and Pretty Printer for Query Extraction

**User Story:** As a developer, I want to parse user text into structured query objects and format them back, so that query generation is testable and maintainable.

#### Acceptance Criteria

1. WHEN user text is provided, THE Query_Builder SHALL parse it into a structured QueryRequest object
2. THE Query_Builder SHALL extract named entities from the text
3. THE Query_Builder SHALL extract key phrases from the text
4. THE Query_Builder SHALL identify temporal keywords in the text
5. THE Query_Builder SHALL format QueryRequest objects back into search query strings
6. FOR ALL valid QueryRequest objects, parsing then formatting then parsing SHALL produce an equivalent object
