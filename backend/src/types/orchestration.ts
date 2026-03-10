/**
 * Iterative Evidence Orchestration Types
 *
 * Type definitions for multi-stage evidence orchestration pipeline
 * that uses NOVA as a reasoning coordinator for claim decomposition,
 * query generation, evidence classification, and verdict synthesis.
 */

import { NormalizedSourceWithStance } from './grounding';

/**
 * Type of subclaim extracted from main claim
 */
export type SubclaimType =
  | 'actor' // Who is involved
  | 'action' // What happened
  | 'object' // What was affected
  | 'place' // Where it happened
  | 'time' // When it happened
  | 'certainty' // Certainty words (allegedly, confirmed, etc.)
  | 'causal' // Causal relationships
  | 'coordination'; // Joint/official/confirmed claims

/**
 * Individual subclaim extracted from main claim
 */
export interface Subclaim {
  /** Type of subclaim */
  type: SubclaimType;
  /** Text of the subclaim */
  text: string;
  /** Importance weight (0-1) */
  importance: number;
}

/**
 * Claim decomposition result from NOVA
 */
export interface ClaimDecomposition {
  /** Original claim */
  originalClaim: string;
  /** Extracted subclaims */
  subclaims: Subclaim[];
  /** Timestamp of decomposition */
  timestamp: string;
}

/**
 * Type of search query
 */
export type QueryType =
  | 'exact' // Exact claim query
  | 'entity_action' // Entity + action query
  | 'date_sensitive' // Date-sensitive query
  | 'official_confirmation' // Official confirmation query
  | 'contradiction' // Contradiction/disproof query
  | 'primary_source' // Primary source query
  | 'regional' // Regional/local reporting query
  | 'fact_check'; // Fact-check query

/**
 * Individual search query
 */
export interface Query {
  /** Type of query */
  type: QueryType;
  /** Query text */
  text: string;
  /** Target subclaim (if applicable) */
  targetSubclaim?: string;
  /** Priority (0-1, higher = more important) */
  priority: number;
}

/**
 * Set of queries for a retrieval pass
 */
export interface QuerySet {
  /** Queries to execute */
  queries: Query[];
  /** Pass number (1-based) */
  passNumber: number;
  /** Strategy description */
  strategy: string;
}

/**
 * Page type classification
 */
export type PageType =
  | 'article' // News article or blog post
  | 'official_statement' // Official government/org statement
  | 'press_release' // Press release
  | 'transcript' // Speech/interview transcript
  | 'fact_check' // Fact-check article
  | 'homepage' // Website homepage (REJECT)
  | 'category' // Category/section page (REJECT)
  | 'tag' // Tag page (REJECT)
  | 'search' // Search results page (REJECT)
  | 'unavailable' // 404 or broken (REJECT)
  | 'unknown'; // Unable to classify

/**
 * Source class for diversity enforcement
 */
export type SourceClass =
  | 'major_international' // Reuters, AP, BBC, etc.
  | 'official_government' // Government/ministry/military
  | 'international_org' // UN, WHO, etc.
  | 'regional_media' // Local/regional media
  | 'fact_checker' // Fact-checking organizations
  | 'primary_source' // Direct speech/transcript/press release
  | 'archival'; // Historical/archival sources

/**
 * Authority level for source credibility
 */
export type AuthorityLevel = 'high' | 'medium' | 'low';

/**
 * Classified source with metadata
 */
export interface ClassifiedSource extends NormalizedSourceWithStance {
  /** Source class */
  sourceClass: SourceClass;
  /** Authority level */
  authorityLevel: AuthorityLevel;
  /** Page type */
  pageType: PageType;
}

/**
 * Quality score dimensions for evidence
 */
export interface QualityScore {
  /** Claim relevance (0-1) */
  claimRelevance: number;
  /** Specificity (0-1) */
  specificity: number;
  /** Directness (0-1) */
  directness: number;
  /** Freshness (0-1) */
  freshness: number;
  /** Source authority (0-1) */
  sourceAuthority: number;
  /** Primary vs secondary weight (0-1, 1=primary) */
  primaryWeight: number;
  /** Contradiction value (0-1) */
  contradictionValue: number;
  /** Corroboration count (normalized 0-1) */
  corroborationCount: number;
  /** Accessibility/extractability (0-1) */
  accessibility: number;
  /** Geographic relevance (0-1) */
  geographicRelevance: number;
  /** Composite score (weighted average) */
  composite: number;
}

/**
 * Evidence candidate before filtering
 */
export interface EvidenceCandidate extends ClassifiedSource {
  /** Quality score */
  qualityScore: QualityScore;
  /** Query that retrieved this evidence */
  retrievedByQuery: string;
  /** Pass number that retrieved this evidence */
  retrievedInPass: number;
}

/**
 * Rejection reason for evidence
 */
export type RejectionReason =
  | 'BROKEN_PAGE'
  | 'HOMEPAGE_ONLY'
  | 'CATEGORY_PAGE'
  | 'TAG_PAGE'
  | 'SEARCH_PAGE'
  | 'LOW_RELEVANCE'
  | 'DUPLICATE'
  | 'STALE'
  | 'INSUFFICIENT_CONTENT'
  | 'UNRELATED'
  | 'TOO_VAGUE';

/**
 * Filtered evidence that passed quality checks
 */
export interface FilteredEvidence extends EvidenceCandidate {
  /** Whether this evidence passed filtering */
  passed: boolean;
  /** Rejection reason if not passed */
  rejectionReason?: RejectionReason;
}

/**
 * Evidence bucket for verdict synthesis
 */
export interface EvidenceBucket {
  /** Strong supporting evidence */
  supporting: FilteredEvidence[];
  /** Strong contradicting evidence */
  contradicting: FilteredEvidence[];
  /** Context/background evidence */
  context: FilteredEvidence[];
  /** Rejected candidates (for debugging) */
  rejected: FilteredEvidence[];
}

/**
 * Contradiction search result
 */
export interface ContradictionResult {
  /** Contradictory evidence found */
  evidence: FilteredEvidence[];
  /** Contradiction queries executed */
  queries: string[];
  /** Whether contradictions were found */
  foundContradictions: boolean;
}

/**
 * Verdict classification
 */
export type VerdictClassification =
  | 'true'
  | 'false'
  | 'misleading'
  | 'partially_true'
  | 'unverified';

/**
 * Final verdict from synthesis
 */
export interface Verdict {
  /** Verdict classification */
  classification: VerdictClassification;
  /** Confidence (0-1) */
  confidence: number;
  /** Supported subclaims */
  supportedSubclaims: string[];
  /** Unsupported subclaims */
  unsupportedSubclaims: string[];
  /** Contradictory evidence summary */
  contradictorySummary: string;
  /** Unresolved uncertainties */
  unresolvedUncertainties: string[];
  /** Best evidence list */
  bestEvidence: FilteredEvidence[];
  /** Rationale for verdict */
  rationale: string;
}

/**
 * Retrieval pass configuration
 */
export interface RetrievalPass {
  /** Pass number (1-based) */
  passNumber: number;
  /** Queries for this pass */
  queries: Query[];
  /** Strategy description */
  strategy: string;
  /** Evidence retrieved in this pass */
  evidenceRetrieved: EvidenceCandidate[];
  /** Quality threshold for this pass */
  qualityThreshold: number;
}

/**
 * Orchestration configuration
 */
export interface OrchestrationConfig {
  /** Minimum evidence score to accept */
  minEvidenceScore: number;
  /** Minimum source diversity (classes required) */
  minSourceDiversity: number;
  /** Maximum retrieval passes */
  maxRetrievalPasses: number;
  /** Require primary source when available */
  requirePrimarySourceWhenAvailable: boolean;
  /** Reject generic pages */
  rejectGenericPages: boolean;
  /** Contradiction search required */
  contradictionSearchRequired: boolean;
  /** Maximum NOVA calls per analysis */
  maxNovaCalls: number;
  /** Maximum tokens per NOVA call */
  maxTokensPerCall: number;
}

/**
 * Pipeline state for iterative refinement
 */
export interface PipelineState {
  /** Current pass number */
  currentPass: number;
  /** Evidence collected so far */
  collectedEvidence: EvidenceCandidate[];
  /** Source classes represented */
  sourceClassesRepresented: Set<SourceClass>;
  /** Average quality score */
  averageQualityScore: number;
  /** Whether quality threshold met */
  qualityThresholdMet: boolean;
  /** Whether to continue iterating */
  shouldContinue: boolean;
}

/**
 * Pipeline log entry
 */
export interface PipelineLog {
  /** Stage name */
  stage: string;
  /** Timestamp */
  timestamp: string;
  /** Log message */
  message: string;
  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * Pipeline metrics
 */
export interface PipelineMetrics {
  /** Total latency in milliseconds */
  totalLatencyMs: number;
  /** NOVA calls made */
  novaCallsMade: number;
  /** NOVA tokens used */
  novaTokensUsed: number;
  /** Grounding calls made */
  groundingCallsMade: number;
  /** Total sources retrieved */
  totalSourcesRetrieved: number;
  /** Sources after filtering */
  sourcesAfterFiltering: number;
  /** Passes executed */
  passesExecuted: number;
  /** Source classes represented */
  sourceClassesCount: number;
  /** Average quality score */
  averageQualityScore: number;
}

/**
 * Complete orchestration result
 */
export interface OrchestrationResult {
  /** Original claim */
  claim: string;
  /** Claim decomposition */
  decomposition: ClaimDecomposition;
  /** Final verdict */
  verdict: Verdict;
  /** Evidence buckets */
  evidenceBuckets: EvidenceBucket;
  /** Contradiction result */
  contradictionResult: ContradictionResult;
  /** Pipeline metrics */
  metrics: PipelineMetrics;
  /** Pipeline logs */
  logs: PipelineLog[];
  /** Configuration used */
  config: OrchestrationConfig;
}
