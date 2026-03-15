/**
 * Real-time News Grounding Types
 *
 * Type definitions for news grounding service, API clients, and data models
 */

/**
 * Provider type for news grounding
 */
export type GroundingProvider = 'bing' | 'gdelt' | 'mediastack' | 'serper' | 'none' | 'demo' | 'bing_web';

/**
 * Freshness strategy for adaptive retrieval
 */
export type FreshnessStrategy = '7d' | '30d' | '1y' | 'web';

/**
 * Retrieval mode for evidence gathering
 */
export type RetrievalMode = 'news_recent' | 'news_historical' | 'web_knowledge';

/**
 * Normalized news source with metadata
 */
export interface NormalizedSource {
  /** Normalized URL (no tracking params) */
  url: string;
  /** Article title */
  title: string;
  /** Article snippet/description */
  snippet: string;
  /** ISO8601 publish date */
  publishDate: string;
  /** Registrable domain (eTLD+1 format) */
  domain: string;
  /** Ranking score (0-1) */
  score: number;
}

/**
 * Grounding bundle with sources and metadata
 */
export interface GroundingBundle {
  /** Normalized, deduplicated, ranked sources */
  sources: NormalizedSource[];
  /** Which provider was used */
  providerUsed: GroundingProvider;
  /** Normalized query used for search */
  query: string;
  /** Total grounding latency in milliseconds */
  latencyMs: number;
  /** Any errors encountered (non-fatal) */
  errors?: string[];
  /** Providers attempted before success/failure */
  attemptedProviders?: string[];
  /** Raw source count before filtering */
  sourcesCountRaw?: number;
  /** Whether result came from cache */
  cacheHit?: boolean;
  /** Retrieval mode used (news_recent, news_historical, web_knowledge) */
  retrievalMode?: RetrievalMode;
  /** Provider failure details for debugging and monitoring */
  providerFailureDetails?: {
    provider: string;
    query: string;
    reason: string;
    latency: number;
    raw_count: number;
    normalized_count: number;
    accepted_count: number;
    http_status?: number;
    error_message: string;
  };
}

/**
 * Bing News API article response
 */
export interface BingNewsArticle {
  /** Article title */
  name: string;
  /** Article URL */
  url: string;
  /** Article snippet */
  description: string;
  /** ISO8601 date published */
  datePublished: string;
  /** Publisher info */
  provider: Array<{ name: string }>;
}

/**
 * Bing News API search options
 */
export interface BingSearchOptions {
  /** Max results (default: 10) */
  count?: number;
  /** Recency filter (default: 'Week') */
  freshness?: 'Day' | 'Week' | 'Month';
  /** Market code (default: 'en-US') */
  market?: string;
  /** Safe search (default: 'Moderate') */
  safeSearch?: 'Off' | 'Moderate' | 'Strict';
}

/**
 * GDELT Document API article response
 */
export interface GDELTArticle {
  /** Article URL */
  url: string;
  /** Article title */
  title: string;
  /** Date seen (YYYYMMDDHHMMSS format) */
  seendate: string;
  /** Publisher domain */
  domain: string;
  /** Language code */
  language: string;
}

/**
 * GDELT Document API search options
 */
export interface GDELTSearchOptions {
  /** Max results (default: 10) */
  maxrecords?: number;
  /** Time range (default: '7d' for 7 days) */
  timespan?: string;
  /** Mode (default: 'artlist') */
  mode?: 'artlist';
  /** Format (default: 'json') */
  format?: 'json';
}

/**
 * Evidence source for NOVA synthesis output
 */
export interface EvidenceSource {
  /** Source URL */
  url: string;
  /** Article title */
  title: string;
  /** Article snippet */
  snippet: string;
  /** Why this source is credible */
  why: string;
  /** Publisher domain */
  domain: string;
}

/**
 * SIFT step details
 */
export interface SIFTStep {
  /** Step summary (1-2 sentences) */
  summary: string;
  /** Evidence URLs (0-3 per step) */
  evidence_urls: string[];
}

/**
 * SIFT details with all four steps
 */
export interface SIFTDetails {
  /** Stop: Initial assessment */
  stop: SIFTStep;
  /** Investigate: What to investigate */
  investigate: SIFTStep;
  /** Find: Where to find better coverage */
  find: SIFTStep;
  /** Trace: Trace to original source */
  trace: SIFTStep & {
    /** Earliest source URL if identifiable */
    earliest_source?: string;
  };
}

/**
 * Grounding metadata for API response
 */
export interface GroundingMetadata {
  /** Which provider was used */
  providerUsed: GroundingProvider;
  /** Number of sources found */
  sources_count: number;
  /** Grounding latency in milliseconds */
  latencyMs: number;
  /** Any errors encountered */
  errors?: string[];
  /** Providers attempted before success/failure */
  attemptedProviders?: string[];
  /** Raw source count before filtering */
  sourcesCountRaw?: number;
  /** Source count after filtering */
  sourcesCountReturned?: number;
  /** Whether result came from cache */
  cacheHit?: boolean;
}

/**
 * Stance classification for source vs claim
 */
export type Stance = 'supports' | 'contradicts' | 'mentions' | 'unclear';

/**
 * Reason codes for zero results
 */
export type ReasonCode = 
  | 'PROVIDER_EMPTY'      // Providers returned zero results
  | 'QUERY_TOO_VAGUE'     // Query was too vague to search effectively
  | 'KEYS_MISSING'        // Search provider API keys are not configured
  | 'TIMEOUT'             // Provider timed out
  | 'ERROR';              // Generic error occurred

/**
 * Normalized source with stance classification
 */
export interface NormalizedSourceWithStance extends NormalizedSource {
  /** Stance of source relative to claim */
  stance: Stance;
  /** Brief justification for stance (max 1 sentence) */
  stanceJustification?: string;
  /** Provider that returned this source */
  provider: GroundingProvider;
  /** Credibility tier (1=highest, 3=lowest) */
  credibilityTier: 1 | 2 | 3;
}

/**
 * Text-only grounding bundle with stance-classified sources
 */
export interface TextGroundingBundle {
  /** Stance-classified sources */
  sources: NormalizedSourceWithStance[];
  /** Search queries generated and executed */
  queries: string[];
  /** Providers used for search */
  providerUsed: GroundingProvider[];
  /** Total source count across all queries */
  sourcesCount: number;
  /** Whether result came from cache */
  cacheHit: boolean;
  /** Total grounding latency in milliseconds */
  latencyMs: number;
  /** Reason codes if zero results */
  reasonCodes?: ReasonCode[];
  /** Any errors encountered (non-fatal) */
  errors?: string[];
  /** Freshness strategy used (for adaptive retrieval) */
  freshnessStrategy?: FreshnessStrategy;
  /** Number of retries performed (for adaptive retrieval) */
  retryCount?: number;
  /** Whether typo normalization was applied */
  typoNormalizationApplied?: boolean;
  /** Retrieval mode used (news_recent, news_historical, web_knowledge) */
  retrievalMode?: RetrievalMode;
}

/**
 * Adaptive freshness configuration options
 */
export interface AdaptiveFreshnessOptions {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Total timeout budget in milliseconds */
  timeoutBudgetMs: number;
  /** Freshness strategies to try in order */
  strategies: FreshnessStrategy[];
}

/**
 * Single query grounding result (for orchestrator use)
 */
export interface SingleQueryGroundingResult {
  /** Normalized sources with provider and stance info */
  sources: NormalizedSourceWithStance[];
  /** Provider that returned results */
  provider: GroundingProvider;
  /** Grounding latency in milliseconds */
  latencyMs: number;
  /** Whether result came from cache */
  cacheHit: boolean;
  /** Any errors encountered */
  errors?: string[];
  /** Raw source count before filtering */
  sourcesCountRaw?: number;
}
