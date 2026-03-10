# Requirements Document

## Introduction

This specification defines the redesign of FakeNewsOff's truth-analysis pipeline to implement iterative evidence orchestration. The current system suffers from shallow retrieval that returns generic homepage links, broken pages, and over-relies on repeated domains without actively seeking contradictory evidence. This redesign transforms the pipeline into a multi-stage evidence orchestration algorithm that uses NOVA as a full reasoning and retrieval coordinator to produce jury-grade truth analysis with claim-specific, high-quality, diverse evidence.

The core principle is: optimize for "returning the strongest, most relevant, non-broken, claim-specific evidence" rather than "returning some sources."

## Glossary

- **Pipeline**: The complete truth-analysis system that processes claims and produces verdicts
- **NOVA**: The reasoning and retrieval coordinator service used for claim analysis
- **Evidence_Orchestrator**: The component that coordinates multi-stage evidence retrieval and quality filtering
- **Claim_Decomposer**: The component that splits claims into verifiable subclaims
- **Query_Generator**: The component that generates multiple search queries per claim
- **Evidence_Filter**: The component that rejects low-quality evidence candidates
- **Verdict_Synthesizer**: The component that produces final truth analysis with confidence levels
- **Primary_Source**: Official releases, statements, court documents, agency notices, or direct transcripts
- **Generic_Page**: Homepage, category page, tag page, latest news landing, or search page
- **Evidence_Score**: Numeric quality assessment across relevance, specificity, directness, freshness, authority, and other dimensions
- **Source_Diversity**: Requirement that final evidence includes multiple source classes
- **Contradiction_Search**: Active retrieval of disconfirming evidence
- **Retrieval_Pass**: One iteration of the evidence search and filtering loop
- **Subclaim**: A verifiable component of a claim (actor, action, object, place, time, certainty, causal relationship)

## Requirements

### Requirement 1: Claim Decomposition

**User Story:** As a truth analyst, I want claims decomposed into verifiable subclaims, so that I can assess each component independently and produce more accurate verdicts.

#### Acceptance Criteria

1. WHEN a claim is submitted, THE Claim_Decomposer SHALL extract actors from the claim
2. WHEN a claim is submitted, THE Claim_Decomposer SHALL extract actions from the claim
3. WHEN a claim is submitted, THE Claim_Decomposer SHALL extract objects from the claim
4. WHEN a claim is submitted, THE Claim_Decomposer SHALL extract place references from the claim
5. WHEN a claim is submitted, THE Claim_Decomposer SHALL extract time references from the claim
6. WHEN a claim is submitted, THE Claim_Decomposer SHALL extract certainty indicators from the claim
7. WHEN a claim is submitted, THE Claim_Decomposer SHALL extract causal relationships from the claim
8. THE Claim_Decomposer SHALL use NOVA as the reasoning engine for decomposition

### Requirement 2: Multi-Query Generation

**User Story:** As a truth analyst, I want multiple search queries generated per claim, so that I can retrieve evidence from different angles and avoid missing relevant sources.

#### Acceptance Criteria

1. WHEN subclaims are extracted, THE Query_Generator SHALL generate an exact claim query
2. WHEN subclaims are extracted, THE Query_Generator SHALL generate entity plus action queries
3. WHEN subclaims are extracted, THE Query_Generator SHALL generate date-sensitive queries for time-bound claims
4. WHEN subclaims are extracted, THE Query_Generator SHALL generate official confirmation queries
5. WHEN subclaims are extracted, THE Query_Generator SHALL generate contradiction or disproof queries
6. WHEN subclaims are extracted, THE Query_Generator SHALL generate primary source queries
7. WHEN subclaims are extracted, THE Query_Generator SHALL generate regional or local queries for location-specific claims
8. WHEN subclaims are extracted, THE Query_Generator SHALL generate fact-check organization queries
9. THE Query_Generator SHALL use NOVA as the reasoning engine for query generation

### Requirement 3: Multi-Source-Class Retrieval

**User Story:** As a truth analyst, I want evidence retrieved from diverse source classes, so that I can avoid over-reliance on repeated domains and obtain comprehensive coverage.

#### Acceptance Criteria

1. WHEN queries are generated, THE Evidence_Orchestrator SHALL retrieve from major international reporting sources
2. WHEN queries are generated, THE Evidence_Orchestrator SHALL retrieve from official government sources
3. WHEN queries are generated, THE Evidence_Orchestrator SHALL retrieve from official military sources
4. WHEN queries are generated, THE Evidence_Orchestrator SHALL retrieve from embassy sources
5. WHEN queries are generated, THE Evidence_Orchestrator SHALL retrieve from press office sources
6. WHEN queries are generated, THE Evidence_Orchestrator SHALL retrieve from international organization sources
7. WHEN queries are generated, THE Evidence_Orchestrator SHALL retrieve from local media sources
8. WHEN queries are generated, THE Evidence_Orchestrator SHALL retrieve from regional media sources
9. WHEN queries are generated, THE Evidence_Orchestrator SHALL retrieve from fact-checking organization sources
10. WHEN queries are generated, THE Evidence_Orchestrator SHALL retrieve from direct speech sources
11. WHEN queries are generated, THE Evidence_Orchestrator SHALL retrieve from transcript sources
12. WHEN queries are generated, THE Evidence_Orchestrator SHALL retrieve from archival sources

### Requirement 4: Evidence Quality Filtering

**User Story:** As a truth analyst, I want low-quality evidence candidates rejected, so that I only see claim-specific, accessible, relevant evidence.

#### Acceptance Criteria

1. WHEN evidence candidates are retrieved, THE Evidence_Filter SHALL reject homepage-only pages
2. WHEN evidence candidates are retrieved, THE Evidence_Filter SHALL reject category pages
3. WHEN evidence candidates are retrieved, THE Evidence_Filter SHALL reject tag pages
4. WHEN evidence candidates are retrieved, THE Evidence_Filter SHALL reject latest news landing pages
5. WHEN evidence candidates are retrieved, THE Evidence_Filter SHALL reject search pages
6. WHEN evidence candidates are retrieved, THE Evidence_Filter SHALL reject 404 pages
7. WHEN evidence candidates are retrieved, THE Evidence_Filter SHALL reject unavailable pages
8. WHEN evidence candidates are retrieved, THE Evidence_Filter SHALL reject unrelated content pages
9. WHEN evidence candidates are retrieved, THE Evidence_Filter SHALL reject duplicate content pages
10. WHEN evidence candidates are retrieved, THE Evidence_Filter SHALL reject pages that are too vague
11. THE Evidence_Filter SHALL use NOVA as the reasoning engine for classification

### Requirement 5: Primary Source Prioritization

**User Story:** As a truth analyst, I want primary sources prioritized for official events, so that I can rely on authoritative evidence rather than secondary reporting.

#### Acceptance Criteria

1. WHEN a claim involves military action, THE Evidence_Orchestrator SHALL prioritize official releases
2. WHEN a claim involves official decisions, THE Evidence_Orchestrator SHALL prioritize official statements
3. WHEN a claim involves sanctions, THE Evidence_Orchestrator SHALL prioritize agency notices
4. WHEN a claim involves elections, THE Evidence_Orchestrator SHALL prioritize official results
5. WHEN a claim involves treaties, THE Evidence_Orchestrator SHALL prioritize treaty documents
6. WHEN a claim involves arrests, THE Evidence_Orchestrator SHALL prioritize law enforcement statements
7. WHEN a claim involves public health, THE Evidence_Orchestrator SHALL prioritize health agency notices
8. WHEN a claim involves corporate announcements, THE Evidence_Orchestrator SHALL prioritize company press releases
9. WHEN a claim involves legal rulings, THE Evidence_Orchestrator SHALL prioritize court documents
10. WHEN a claim involves government action, THE Evidence_Orchestrator SHALL prioritize ministry pages
11. WHEN a claim involves government action, THE Evidence_Orchestrator SHALL prioritize department pages
12. WHEN a claim involves public statements, THE Evidence_Orchestrator SHALL prioritize full transcripts

### Requirement 6: Contradiction-First Safety Check

**User Story:** As a truth analyst, I want disconfirming evidence actively searched, so that I can identify misleading or false claims rather than only confirming evidence.

#### Acceptance Criteria

1. THE Evidence_Orchestrator SHALL execute an evidence_for retrieval stage
2. THE Evidence_Orchestrator SHALL execute an evidence_against retrieval stage
3. THE Evidence_Orchestrator SHALL execute an evidence_unclear retrieval stage
4. WHEN contradictory evidence is found, THE Verdict_Synthesizer SHALL include it in the final analysis
5. THE Evidence_Orchestrator SHALL use NOVA as the reasoning engine for contradiction analysis

### Requirement 7: Iterative Retrieval Loop

**User Story:** As a truth analyst, I want the system to refine searches across multiple passes, so that I can obtain better evidence than first-pass generic results.

#### Acceptance Criteria

1. THE Evidence_Orchestrator SHALL execute a first retrieval pass with broad searches
2. WHEN the first pass completes, THE Evidence_Orchestrator SHALL execute a second retrieval pass using strongest entities
3. WHEN the first pass completes, THE Evidence_Orchestrator SHALL execute a second retrieval pass using dates
4. WHEN the first pass completes, THE Evidence_Orchestrator SHALL execute a second retrieval pass targeting source gaps
5. WHEN the second pass completes, THE Evidence_Orchestrator SHALL execute a third retrieval pass for contradiction search
6. WHEN the second pass completes, THE Evidence_Orchestrator SHALL execute a third retrieval pass for primary-source search
7. WHEN the second pass completes, THE Evidence_Orchestrator SHALL execute a third retrieval pass for regional confirmation
8. WHEN evidence quality threshold is reached, THE Evidence_Orchestrator SHALL stop retrieval
9. WHEN maximum passes are reached, THE Evidence_Orchestrator SHALL stop retrieval
10. WHEN repeated retrieval yields no better evidence, THE Evidence_Orchestrator SHALL stop retrieval

### Requirement 8: Evidence Scoring

**User Story:** As a truth analyst, I want evidence scored across multiple dimensions, so that I can rank and select the highest-quality sources.

#### Acceptance Criteria

1. WHEN evidence is retrieved, THE Evidence_Filter SHALL score claim relevance
2. WHEN evidence is retrieved, THE Evidence_Filter SHALL score specificity
3. WHEN evidence is retrieved, THE Evidence_Filter SHALL score directness
4. WHEN evidence is retrieved, THE Evidence_Filter SHALL score freshness
5. WHEN evidence is retrieved, THE Evidence_Filter SHALL score source authority
6. WHEN evidence is retrieved, THE Evidence_Filter SHALL score primary versus secondary weight
7. WHEN evidence is retrieved, THE Evidence_Filter SHALL score contradiction value
8. WHEN evidence is retrieved, THE Evidence_Filter SHALL score corroboration count
9. WHEN evidence is retrieved, THE Evidence_Filter SHALL score accessibility
10. WHEN evidence is retrieved, THE Evidence_Filter SHALL score extractability
11. WHEN evidence is retrieved, THE Evidence_Filter SHALL score geographic relevance
12. THE Evidence_Filter SHALL use NOVA as the reasoning engine for scoring

### Requirement 9: Source Diversity Rule

**User Story:** As a truth analyst, I want the final evidence set to include diverse source types, so that I can avoid echo chambers and obtain balanced analysis.

#### Acceptance Criteria

1. WHEN primary sources are available, THE Evidence_Orchestrator SHALL include at least one primary source in the final evidence set
2. WHEN primary sources are available, THE Evidence_Orchestrator SHALL include at least one official source in the final evidence set
3. THE Evidence_Orchestrator SHALL include at least one major independent reporting source in the final evidence set
4. WHEN contradiction sources are available, THE Evidence_Orchestrator SHALL include at least one contradiction source in the final evidence set
5. WHEN nuance sources are available, THE Evidence_Orchestrator SHALL include at least one nuance source in the final evidence set
6. WHEN claims involve local events, THE Evidence_Orchestrator SHALL include at least one geographically relevant source in the final evidence set

### Requirement 10: Verdict Synthesis

**User Story:** As a truth analyst, I want comprehensive verdict output with confidence and rationale, so that I can understand the reasoning and trust the analysis.

#### Acceptance Criteria

1. WHEN evidence collection completes, THE Verdict_Synthesizer SHALL return a verdict classification
2. WHEN evidence collection completes, THE Verdict_Synthesizer SHALL return a confidence level
3. WHEN evidence collection completes, THE Verdict_Synthesizer SHALL return supported subclaims
4. WHEN evidence collection completes, THE Verdict_Synthesizer SHALL return unsupported subclaims
5. WHEN evidence collection completes, THE Verdict_Synthesizer SHALL return a contradictory evidence summary
6. WHEN evidence collection completes, THE Verdict_Synthesizer SHALL return unresolved uncertainties
7. WHEN evidence collection completes, THE Verdict_Synthesizer SHALL return a best evidence list
8. WHEN evidence collection completes, THE Verdict_Synthesizer SHALL return rejection reasons for weaker evidence
9. THE Verdict_Synthesizer SHALL use NOVA as the reasoning engine for synthesis

### Requirement 11: No Broken Links as Credible Sources

**User Story:** As a truth analyst, I want unavailable pages excluded from final evidence, so that I only see accessible, verifiable sources.

#### Acceptance Criteria

1. WHEN a page returns 404 status, THE Evidence_Filter SHALL exclude it from final evidence
2. WHEN a page is unavailable, THE Evidence_Filter SHALL exclude it from final evidence
3. WHEN a page fails to load, THE Evidence_Filter SHALL exclude it from final evidence

### Requirement 12: User-Facing Results Improvement

**User Story:** As an end user, I want evidence categorized by type and quality, so that I can quickly understand the strength and nature of the analysis.

#### Acceptance Criteria

1. WHEN results are displayed, THE Pipeline SHALL distinguish strong supporting evidence
2. WHEN results are displayed, THE Pipeline SHALL distinguish strong contradicting evidence
3. WHEN results are displayed, THE Pipeline SHALL distinguish context or background sources
4. WHEN results are displayed, THE Pipeline SHALL distinguish rejected candidates
5. WHEN results are displayed, THE Pipeline SHALL distinguish primary sources
6. WHEN results are displayed, THE Pipeline SHALL distinguish remaining unknowns

### Requirement 13: Debug and Observability

**User Story:** As a system operator, I want structured logs for each pipeline stage, so that I can debug issues and understand system behavior.

#### Acceptance Criteria

1. WHEN claim decomposition occurs, THE Pipeline SHALL log the extracted subclaims
2. WHEN queries are generated, THE Pipeline SHALL log the generated queries
3. WHEN evidence is retrieved, THE Pipeline SHALL log the retrieved candidates
4. WHEN evidence is rejected, THE Pipeline SHALL log the rejection reason
5. WHEN evidence is kept, THE Pipeline SHALL log the final kept evidence
6. WHEN contradiction search completes, THE Pipeline SHALL log the contradiction search results
7. WHEN verdict is produced, THE Pipeline SHALL log the verdict rationale

### Requirement 14: Configurable Policy

**User Story:** As a system administrator, I want configurable thresholds and policies, so that I can tune the system for different use cases and quality requirements.

#### Acceptance Criteria

1. THE Pipeline SHALL support configuration of minimum evidence score threshold
2. THE Pipeline SHALL support configuration of minimum source diversity threshold
3. THE Pipeline SHALL support configuration of maximum retrieval passes
4. THE Pipeline SHALL support configuration of require primary source when available policy
5. THE Pipeline SHALL support configuration of reject generic pages policy
6. THE Pipeline SHALL support configuration of contradiction search required policy

### Requirement 15: NOVA Usage Model

**User Story:** As a system architect, I want NOVA used as a coordinator for reasoning tasks, so that the system produces intelligent analysis within infrastructure limits.

#### Acceptance Criteria

1. THE Pipeline SHALL use NOVA for claim decomposition
2. THE Pipeline SHALL use NOVA for query generation
3. THE Pipeline SHALL use NOVA for evidence classification
4. THE Pipeline SHALL use NOVA for contradiction analysis
5. THE Pipeline SHALL use NOVA for verdict synthesis
6. THE Pipeline SHALL operate within configured infrastructure limits for NOVA usage

### Requirement 16: Round-Trip Evidence Verification

**User Story:** As a truth analyst, I want evidence content verified against the claim, so that I can ensure retrieved pages actually support or contradict the claim rather than just matching keywords.

#### Acceptance Criteria

1. WHEN evidence is retrieved, THE Evidence_Filter SHALL extract the relevant content from the page
2. WHEN content is extracted, THE Evidence_Filter SHALL verify the content addresses the claim
3. WHEN content is extracted, THE Evidence_Filter SHALL verify the content is not just keyword matching
4. FOR ALL evidence in the final set, verifying the evidence supports the verdict then re-analyzing the claim SHALL produce a consistent verdict
5. THE Evidence_Filter SHALL use NOVA as the reasoning engine for content verification
