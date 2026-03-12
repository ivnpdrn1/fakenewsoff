/**
 * Grounding Service
 *
 * Orchestrates real-time news grounding with provider fallback
 *
 * Validates: Requirements FR2.3, FR2.4, FR3.1-FR3.5, FR4.1, NFR2.3, NFR3.1, NFR3.2
 */

import { BingNewsClient, BingNewsError } from '../clients/bingNewsClient';
import { GDELTClient, GDELTError } from '../clients/gdeltClient';
import { GroundingBundle } from '../types/grounding';
import { extractQuery, normalizeQuery } from '../utils/queryExtractor';
import { getDemoGroundingBundle } from '../utils/demoGrounding';
import { getGroundingCache } from './groundingCache';
import { getGDELTThrottle } from './gdeltThrottle';
import {
  normalizeBingArticles,
  normalizeGDELTArticles,
  deduplicate,
  rankAndCap,
} from './sourceNormalizer';
import { logger } from '../utils/logger';
import { getEnv } from '../utils/envValidation';

/**
 * Grounding service with provider fallback
 */
export class GroundingService {
  private bingClient: BingNewsClient | null = null;
  private gdeltClient: GDELTClient;
  private cache = getGroundingCache();
  private maxResults: number;
  private enabled: boolean;
  private providerOrder: string[];

  constructor() {
    const env = getEnv();

    // Check if grounding is enabled (default: true in prod, false in demo)
    this.enabled = env.GROUNDING_ENABLED;

    // Parse provider order
    this.providerOrder = (env.GROUNDING_PROVIDER_ORDER || 'bing,gdelt')
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter((p) => p === 'bing' || p === 'gdelt');

    // Initialize Bing client only if API key is available
    try {
      this.bingClient = new BingNewsClient();
    } catch {
      // Bing client not available (no API key)
      this.bingClient = null;
    }

    // GDELT client always available (no auth required)
    this.gdeltClient = new GDELTClient();

    this.maxResults = parseInt(env.GROUNDING_MAX_RESULTS || '10', 10);
  }

  /**
   * Ground a headline with real-time news sources
   *
   * @param headline - Headline text to ground
   * @param url - Optional URL for context
   * @param requestId - Optional request ID for logging
   * @param demoMode - Optional demo mode flag
   * @returns Promise resolving to grounding bundle
   */
  async ground(
    headline: string,
    url?: string,
    requestId?: string,
    demoMode = false
  ): Promise<GroundingBundle> {
    const startTime = Date.now();

    // Demo mode: return deterministic bundle
    if (demoMode) {
      const bundle = getDemoGroundingBundle(headline);
      logger.info('Demo mode grounding', {
        event: 'grounding_demo_mode',
        requestId,
        sources_count: bundle.sources.length,
      });
      return bundle;
    }

    // Check if grounding is disabled
    if (!this.enabled) {
      logger.info('Grounding disabled', {
        event: 'grounding_disabled',
        requestId,
      });
      return {
        sources: [],
        providerUsed: 'none',
        query: '',
        latencyMs: Date.now() - startTime,
        errors: ['Grounding disabled by configuration'],
      };
    }

    // Apply typo-tolerant normalization in production mode
    let normalizedHeadline = headline;
    if (!demoMode) {
      const { normalizeClaimWithTypoTolerance } = await import('../utils/claimNormalizer');
      normalizedHeadline = normalizeClaimWithTypoTolerance(headline);
      
      if (normalizedHeadline !== headline.toLowerCase().trim()) {
        logger.info('Typo normalization applied', {
          event: 'typo_normalization_applied',
          requestId,
          original_length: headline.length,
          normalized_length: normalizedHeadline.length,
        });
      }
    }

    // Extract and normalize query
    const query = extractQuery(normalizedHeadline);
    const normalizedQuery = normalizeQuery(query);

    // Log grounding start with sanitized parameters
    logger.info('Grounding request started', {
      event: 'grounding_start',
      requestId,
      query_terms: normalizedQuery ? normalizedQuery.substring(0, 100) : '(empty)',
      provider_order: this.providerOrder,
      demo_mode: demoMode,
    });

    if (!normalizedQuery) {
      logger.warn('Empty query after normalization', {
        event: 'grounding_empty_query',
        requestId,
      });
      return {
        sources: [],
        providerUsed: 'none',
        query: '',
        latencyMs: Date.now() - startTime,
        errors: ['Empty query after normalization'],
      };
    }

    // Check cache
    const cached = this.cache.get(normalizedQuery);
    if (cached) {
      logger.info('Grounding cache hit', {
        event: 'grounding_cache_hit',
        requestId,
        query: normalizedQuery.substring(0, 100),
        sources_count: cached.sources.length,
      });
      return {
        ...cached,
        cacheHit: true,
      };
    }

    logger.info('Grounding cache miss', {
      event: 'grounding_cache_miss',
      requestId,
      query: normalizedQuery.substring(0, 100),
    });

    // Try providers with adaptive freshness
    const bundle = await this.tryProvidersWithAdaptiveFreshness(normalizedQuery, requestId, demoMode);

    // Store in cache
    this.cache.set(normalizedQuery, bundle);

    // Log final result with comprehensive metrics
    logger.info('Grounding request completed', {
      event: 'grounding_done',
      requestId,
      provider_used: bundle.providerUsed,
      total_latency_ms: bundle.latencyMs,
      sources_returned: bundle.sources.length,
      sources_raw: bundle.sourcesCountRaw || 0,
      attempted_providers: bundle.attemptedProviders || [],
      had_errors: (bundle.errors?.length || 0) > 0,
    });

    return {
      ...bundle,
      cacheHit: false,
    };
  }

  /**
   * Try providers in fallback chain
   */
  private async tryProviders(query: string, requestId?: string): Promise<GroundingBundle> {
    const startTime = Date.now();
    const errors: string[] = [];
    const attemptedProviders: string[] = [];

    // Try providers in configured order
    for (const provider of this.providerOrder) {
      if (provider === 'bing' && this.bingClient) {
        attemptedProviders.push('bing');
        const providerStartTime = Date.now();

        logger.info('Attempting Bing News provider', {
          event: 'provider_attempt',
          requestId,
          provider: 'bing',
          timeout_ms: this.bingClient ? 3500 : 0,
        });

        try {
          const articles = await this.bingClient.search(query);
          const rawCount = articles.length;
          const providerLatency = Date.now() - providerStartTime;

          if (articles.length > 0) {
            const normalized = normalizeBingArticles(articles);
            const deduplicated = deduplicate(normalized);
            const ranked = rankAndCap(deduplicated, query, this.maxResults);

            logger.info('Bing News provider succeeded', {
              event: 'provider_success',
              requestId,
              provider: 'bing',
              latency_ms: providerLatency,
              sources_raw: rawCount,
              sources_returned: ranked.length,
              cache_hit: false,
            });

            return {
              sources: ranked,
              providerUsed: 'bing',
              query,
              latencyMs: Date.now() - startTime,
              attemptedProviders,
              sourcesCountRaw: rawCount,
            };
          }

          // Bing returned zero results, try fallback
          logger.warn('Bing News returned zero results', {
            event: 'provider_failure',
            requestId,
            provider: 'bing',
            latency_ms: providerLatency,
            error_code: 'zero_results',
            error_category: 'no_data',
          });
        } catch (error) {
          const providerLatency = Date.now() - providerStartTime;
          const errorMessage =
            error instanceof BingNewsError ? error.message : 'Unknown Bing error';
          const errorCategory = error instanceof BingNewsError ? 'api_error' : 'unknown';

          errors.push(`Bing: ${errorMessage}`);

          logger.warn('Bing News provider failed', {
            event: 'provider_failure',
            requestId,
            provider: 'bing',
            latency_ms: providerLatency,
            error_code: errorMessage.substring(0, 100),
            error_category: errorCategory,
          });
        }
      }

      if (provider === 'gdelt') {
        attemptedProviders.push('gdelt');
        
        // Check throttle before attempting GDELT request
        const throttle = getGDELTThrottle();
        const throttleResult = throttle.canCallGdelt();
        
        if (!throttleResult.allowed) {
          logger.warn('GDELT throttled', {
            event: 'gdelt_throttled',
            requestId,
            wait_ms: throttleResult.waitMs,
          });
          
          errors.push(`GDELT: Throttled (wait ${throttleResult.waitMs}ms)`);
          continue; // Skip to next provider or return failure
        }

        const providerStartTime = Date.now();

        logger.info('Attempting GDELT provider', {
          event: 'provider_attempt',
          requestId,
          provider: 'gdelt',
          timeout_ms: 3500,
        });

        try {
          const articles = await this.gdeltClient.search(query);
          const rawCount = articles.length;
          const providerLatency = Date.now() - providerStartTime;
          
          // Record successful request
          throttle.recordRequest();

          if (articles.length > 0) {
            const normalized = normalizeGDELTArticles(articles);
            const deduplicated = deduplicate(normalized);
            const ranked = rankAndCap(deduplicated, query, this.maxResults);

            logger.info('GDELT provider succeeded', {
              event: 'provider_success',
              requestId,
              provider: 'gdelt',
              latency_ms: providerLatency,
              sources_raw: rawCount,
              sources_returned: ranked.length,
              cache_hit: false,
            });

            return {
              sources: ranked,
              providerUsed: 'gdelt',
              query,
              latencyMs: Date.now() - startTime,
              errors: errors.length > 0 ? errors : undefined,
              attemptedProviders,
              sourcesCountRaw: rawCount,
            };
          }

          // GDELT returned zero results
          logger.warn('GDELT returned zero results', {
            event: 'provider_failure',
            requestId,
            provider: 'gdelt',
            latency_ms: providerLatency,
            error_code: 'zero_results',
            error_category: 'no_data',
          });
        } catch (error) {
          const providerLatency = Date.now() - providerStartTime;
          const errorMessage = error instanceof GDELTError ? error.message : 'Unknown GDELT error';
          const errorCategory = error instanceof GDELTError ? 'api_error' : 'unknown';

          // Record failed request attempt
          throttle.recordRequest();

          errors.push(`GDELT: ${errorMessage}`);

          logger.warn('GDELT provider failed', {
            event: 'provider_failure',
            requestId,
            provider: 'gdelt',
            latency_ms: providerLatency,
            error_code: errorMessage.substring(0, 100),
            error_category: errorCategory,
          });
        }
      }
    }

    // All providers failed or returned zero results
    logger.warn('All grounding providers exhausted', {
      event: 'grounding_all_providers_failed',
      requestId,
      attempted_providers: attemptedProviders,
      error_count: errors.length,
    });

    return {
      sources: [],
      providerUsed: 'none',
      query,
      latencyMs: Date.now() - startTime,
      errors,
      attemptedProviders,
    };
  }

  /**
   * Try providers with specific freshness parameters
   * 
   * @param query - Search query
   * @param freshness - Freshness strategy ('7d', '30d', '1y')
   * @param requestId - Optional request ID for logging
   * @returns Promise resolving to grounding bundle
   */
  private async tryProvidersWithFreshness(
    query: string,
    freshness: '7d' | '30d' | '1y',
    requestId?: string
  ): Promise<GroundingBundle> {
    const startTime = Date.now();
    const errors: string[] = [];
    const attemptedProviders: string[] = [];

    // Map freshness strategy to provider-specific parameters
    const bingFreshnessMap: Record<string, 'Day' | 'Week' | 'Month'> = {
      '7d': 'Week',
      '30d': 'Month',
      '1y': 'Month', // Bing doesn't have 'Year', use 'Month' as best approximation
    };

    const gdeltTimespanMap: Record<string, string> = {
      '7d': '7d',
      '30d': '30d',
      '1y': '365d',
    };

    const bingFreshness = bingFreshnessMap[freshness];
    const gdeltTimespan = gdeltTimespanMap[freshness];

    logger.info('Trying providers with freshness strategy', {
      event: 'adaptive_freshness_attempt',
      requestId,
      freshness_strategy: freshness,
      bing_freshness: bingFreshness,
      gdelt_timespan: gdeltTimespan,
    });

    // Try providers in configured order
    for (const provider of this.providerOrder) {
      if (provider === 'bing' && this.bingClient) {
        attemptedProviders.push('bing');
        const providerStartTime = Date.now();

        logger.info('Attempting Bing News provider with freshness', {
          event: 'provider_attempt',
          requestId,
          provider: 'bing',
          freshness: bingFreshness,
        });

        try {
          const articles = await this.bingClient.search(query, { freshness: bingFreshness });
          const rawCount = articles.length;
          const providerLatency = Date.now() - providerStartTime;

          if (articles.length > 0) {
            const normalized = normalizeBingArticles(articles);
            const deduplicated = deduplicate(normalized);
            const ranked = rankAndCap(deduplicated, query, this.maxResults);

            logger.info('Bing News provider succeeded with freshness', {
              event: 'provider_success',
              requestId,
              provider: 'bing',
              freshness: bingFreshness,
              latency_ms: providerLatency,
              sources_raw: rawCount,
              sources_returned: ranked.length,
            });

            return {
              sources: ranked,
              providerUsed: 'bing',
              query,
              latencyMs: Date.now() - startTime,
              attemptedProviders,
              sourcesCountRaw: rawCount,
            };
          }

          logger.warn('Bing News returned zero results with freshness', {
            event: 'provider_failure',
            requestId,
            provider: 'bing',
            freshness: bingFreshness,
            latency_ms: providerLatency,
          });
        } catch (error) {
          const providerLatency = Date.now() - providerStartTime;
          const errorMessage =
            error instanceof BingNewsError ? error.message : 'Unknown Bing error';
          errors.push(`Bing (${freshness}): ${errorMessage}`);

          logger.warn('Bing News provider failed with freshness', {
            event: 'provider_failure',
            requestId,
            provider: 'bing',
            freshness: bingFreshness,
            latency_ms: providerLatency,
            error: errorMessage.substring(0, 100),
          });
        }
      }

      if (provider === 'gdelt') {
        attemptedProviders.push('gdelt');

        // Check throttle before attempting GDELT request
        const throttle = getGDELTThrottle();
        const throttleResult = throttle.canCallGdelt();

        if (!throttleResult.allowed) {
          logger.warn('GDELT throttled', {
            event: 'gdelt_throttled',
            requestId,
            wait_ms: throttleResult.waitMs,
          });

          errors.push(`GDELT (${freshness}): Throttled (wait ${throttleResult.waitMs}ms)`);
          continue;
        }

        const providerStartTime = Date.now();

        logger.info('Attempting GDELT provider with timespan', {
          event: 'provider_attempt',
          requestId,
          provider: 'gdelt',
          timespan: gdeltTimespan,
        });

        try {
          const articles = await this.gdeltClient.search(query, { timespan: gdeltTimespan });
          const rawCount = articles.length;
          const providerLatency = Date.now() - providerStartTime;

          // Record successful request
          throttle.recordRequest();

          if (articles.length > 0) {
            const normalized = normalizeGDELTArticles(articles);
            const deduplicated = deduplicate(normalized);
            const ranked = rankAndCap(deduplicated, query, this.maxResults);

            logger.info('GDELT provider succeeded with timespan', {
              event: 'provider_success',
              requestId,
              provider: 'gdelt',
              timespan: gdeltTimespan,
              latency_ms: providerLatency,
              sources_raw: rawCount,
              sources_returned: ranked.length,
            });

            return {
              sources: ranked,
              providerUsed: 'gdelt',
              query,
              latencyMs: Date.now() - startTime,
              errors: errors.length > 0 ? errors : undefined,
              attemptedProviders,
              sourcesCountRaw: rawCount,
            };
          }

          logger.warn('GDELT returned zero results with timespan', {
            event: 'provider_failure',
            requestId,
            provider: 'gdelt',
            timespan: gdeltTimespan,
            latency_ms: providerLatency,
          });
        } catch (error) {
          const providerLatency = Date.now() - providerStartTime;
          const errorMessage = error instanceof GDELTError ? error.message : 'Unknown GDELT error';

          // Record failed request attempt
          throttle.recordRequest();

          errors.push(`GDELT (${freshness}): ${errorMessage}`);

          logger.warn('GDELT provider failed with timespan', {
            event: 'provider_failure',
            requestId,
            provider: 'gdelt',
            timespan: gdeltTimespan,
            latency_ms: providerLatency,
            error: errorMessage.substring(0, 100),
          });
        }
      }
    }

    // All providers failed or returned zero results for this freshness level
    return {
      sources: [],
      providerUsed: 'none',
      query,
      latencyMs: Date.now() - startTime,
      errors,
      attemptedProviders,
    };
  }

  /**
   * Try providers with adaptive freshness strategy
   * Cascades through broader time windows (7d → 30d → 1y) when initial attempts fail
   * 
   * @param query - Search query
   * @param requestId - Optional request ID for logging
   * @param demoMode - Whether demo mode is active (skips adaptive freshness)
   * @returns Promise resolving to grounding bundle with freshness metadata
   */
  private async tryProvidersWithAdaptiveFreshness(
    query: string,
    requestId?: string,
    demoMode = false
  ): Promise<GroundingBundle> {
    const startTime = Date.now();
    const timeoutBudget = 5000; // 5 second total budget
    const strategies: Array<'7d' | '30d' | '1y'> = ['7d', '30d', '1y'];
    const errors: string[] = [];

    // Demo mode: skip adaptive freshness, use original behavior
    if (demoMode) {
      logger.info('Demo mode: skipping adaptive freshness', {
        event: 'adaptive_freshness_skip_demo',
        requestId,
      });
      return this.tryProviders(query, requestId);
    }

    logger.info('Starting adaptive freshness cascade', {
      event: 'adaptive_freshness_start',
      requestId,
      strategies,
      timeout_budget_ms: timeoutBudget,
    });

    // Try each freshness strategy in order
    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];
      const elapsedTime = Date.now() - startTime;

      // Check if we're approaching timeout budget
      if (elapsedTime >= timeoutBudget) {
        logger.warn('Adaptive freshness timeout budget exceeded', {
          event: 'adaptive_freshness_timeout',
          requestId,
          elapsed_ms: elapsedTime,
          budget_ms: timeoutBudget,
          strategies_tried: i,
        });
        break;
      }

      logger.info('Trying freshness strategy', {
        event: 'adaptive_freshness_retry',
        requestId,
        strategy,
        retry_count: i,
        elapsed_ms: elapsedTime,
      });

      const bundle = await this.tryProvidersWithFreshness(query, strategy, requestId);

      if (bundle.sources.length > 0) {
        logger.info('Adaptive freshness succeeded', {
          event: 'adaptive_freshness_success',
          requestId,
          strategy,
          retry_count: i,
          sources_found: bundle.sources.length,
          total_elapsed_ms: Date.now() - startTime,
        });

        return {
          ...bundle,
          latencyMs: Date.now() - startTime,
        };
      }

      // Collect errors from this attempt
      if (bundle.errors) {
        errors.push(...bundle.errors);
      }

      logger.info('Freshness strategy returned zero results', {
        event: 'adaptive_freshness_strategy_failed',
        requestId,
        strategy,
        retry_count: i,
      });
    }

    // All strategies exhausted
    logger.warn('All adaptive freshness strategies exhausted', {
      event: 'adaptive_freshness_exhausted',
      requestId,
      strategies_tried: strategies.length,
      total_elapsed_ms: Date.now() - startTime,
    });

    return {
      sources: [],
      providerUsed: 'none',
      query,
      latencyMs: Date.now() - startTime,
      errors: errors.length > 0 ? errors : ['All freshness strategies returned zero results'],
      attemptedProviders: ['bing', 'gdelt'],
    };
  }

  /**
   * Get grounding health status
   *
   * @returns Health status object
   */
  getHealthStatus() {
    const env = getEnv();
    const throttle = getGDELTThrottle();
    
    return {
      ok: this.enabled,
      demo_mode: env.DEMO_MODE,
      bing_configured: this.bingClient !== null,
      gdelt_configured: true, // Always available
      timeout_ms: parseInt(env.GROUNDING_TIMEOUT_MS || '3500', 10),
      cache_ttl_seconds: parseInt(env.GROUNDING_CACHE_TTL_SECONDS || '900', 10),
      provider_enabled: this.enabled,
      provider_order: this.providerOrder,
      retrieval: {
        provider: this.providerOrder[0] || 'gdelt',
        cache_enabled: true,
        cache_ttl_ms: parseInt(env.EVIDENCE_CACHE_TTL_MS || '600000', 10),
        gdelt_min_interval_ms: throttle.getMinInterval(),
      },
    };
  }

  /**
   * Run self-test with real grounding query
   *
   * @param testQuery - Query to test with
   * @returns Self-test results
   */
  async runSelfTest(testQuery = 'breaking news'): Promise<{
    providerUsed: string;
    resultsCountRaw: number;
    resultsCountAfterFilter: number;
    topDomains: string[];
    latencyMs: number;
    errors: string[];
    attemptedProviders: string[];
  }> {
    const bundle = await this.ground(testQuery, undefined, 'selftest', false);

    return {
      providerUsed: bundle.providerUsed,
      resultsCountRaw: bundle.sourcesCountRaw || 0,
      resultsCountAfterFilter: bundle.sources.length,
      topDomains: bundle.sources.slice(0, 5).map((s) => s.domain),
      latencyMs: bundle.latencyMs,
      errors: bundle.errors || [],
      attemptedProviders: bundle.attemptedProviders || [],
    };
  }
}

// Singleton instance
let serviceInstance: GroundingService | null = null;

/**
 * Get singleton grounding service instance
 *
 * @returns Grounding service instance
 */
export function getGroundingService(): GroundingService {
  if (!serviceInstance) {
    serviceInstance = new GroundingService();
  }
  return serviceInstance;
}

/**
 * Reset service instance (for testing)
 */
export function resetGroundingService(): void {
  serviceInstance = null;
}

import type { TextGroundingBundle, NormalizedSourceWithStance, ReasonCode } from '../types/grounding';
import { generateQueries } from '../utils/queryBuilder';
import { classifyStance } from './stanceClassifier';
import { assignCredibilityTier, deduplicateByTitleSimilarity } from './sourceNormalizer';

/**
 * Ground text-only claim with multi-query search and stance classification
 * 
 * @param text - User's claim text
 * @param requestId - Optional request ID for logging
 * @param demoMode - Optional demo mode flag
 * @returns Promise resolving to text grounding bundle
 */
export async function groundTextOnly(
  text: string,
  requestId?: string,
  demoMode = false
): Promise<TextGroundingBundle> {
  const startTime = Date.now();

  // Demo mode: return deterministic bundle
  if (demoMode) {
    const { getDemoTextGroundingBundle } = await import('../utils/demoGrounding');
    const bundle = getDemoTextGroundingBundle(text);
    logger.info('Demo mode text grounding', {
      event: 'text_grounding_demo_mode',
      requestId,
      sources_count: bundle.sources.length,
    });
    return bundle;
  }

  // Generate queries from text
  const queryResult = generateQueries(text);
  const queries = queryResult.queries;

  logger.info('Text grounding started', {
    event: 'text_grounding_start',
    requestId,
    queries_generated: queries.length,
    has_recency_hint: queryResult.metadata.hasRecencyHint,
  });

  // Get grounding service instance
  const service = getGroundingService();

  // Check if grounding is enabled
  if (!service['enabled']) {
    logger.info('Text grounding disabled', {
      event: 'text_grounding_disabled',
      requestId,
    });
    return {
      sources: [],
      queries,
      providerUsed: ['none'],
      sourcesCount: 0,
      cacheHit: false,
      latencyMs: Date.now() - startTime,
      reasonCodes: ['KEYS_MISSING'],
      errors: ['Grounding disabled by configuration'],
    };
  }

  // Execute all queries in parallel
  const queryPromises = queries.map((query) =>
    service.ground(query, undefined, requestId, false)
  );

  const queryResults = await Promise.all(queryPromises);

  // Aggregate sources from all queries
  const allSources = queryResults.flatMap((result) => result.sources);
  const providersUsed = new Set(queryResults.map((result) => result.providerUsed));

  logger.info('Text grounding queries completed', {
    event: 'text_grounding_queries_done',
    requestId,
    queries_executed: queries.length,
    sources_raw: allSources.length,
    providers_used: Array.from(providersUsed),
  });

  // Check for zero results
  if (allSources.length === 0) {
    const reasonCodes: ReasonCode[] = [];
    const errors: string[] = [];

    // Determine reason codes
    if (!service['bingClient'] && !service['gdeltClient']) {
      reasonCodes.push('KEYS_MISSING');
    } else if (queryResults.every((r) => r.errors && r.errors.length > 0)) {
      reasonCodes.push('ERROR');
      errors.push(...queryResults.flatMap((r) => r.errors || []));
    } else {
      reasonCodes.push('PROVIDER_EMPTY');
    }

    logger.warn('Text grounding returned zero results', {
      event: 'text_grounding_zero_results',
      requestId,
      reason_codes: reasonCodes,
    });

    return {
      sources: [],
      queries,
      providerUsed: Array.from(providersUsed),
      sourcesCount: 0,
      cacheHit: false,
      latencyMs: Date.now() - startTime,
      reasonCodes,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // Deduplicate by URL
  const seenUrls = new Set<string>();
  const uniqueByUrl = allSources.filter((source) => {
    if (seenUrls.has(source.url)) {
      return false;
    }
    seenUrls.add(source.url);
    return true;
  });

  // Deduplicate by title similarity
  const deduplicated = deduplicateByTitleSimilarity(uniqueByUrl, 0.8);

  logger.info('Text grounding deduplication complete', {
    event: 'text_grounding_dedup_done',
    requestId,
    sources_before: allSources.length,
    sources_after: deduplicated.length,
  });

  // Classify stance for each source
  const sourcesWithStance: NormalizedSourceWithStance[] = deduplicated.map((source) => {
    const stanceResult = classifyStance(text, source.title, source.snippet);
    const credibilityTier = assignCredibilityTier(source.domain);

    return {
      ...source,
      stance: stanceResult.stance,
      stanceJustification: stanceResult.justification,
      provider: queryResults.find((r) => r.sources.some((s) => s.url === source.url))
        ?.providerUsed || 'none',
      credibilityTier,
    };
  });

  // Rank by combined score (relevance + credibility + recency + diversity)
  const ranked = rankSourcesWithStance(sourcesWithStance, text);

  // Cap at 6 sources, ensure at least 3 if available
  const finalSources = ranked.slice(0, Math.max(3, Math.min(6, ranked.length)));

  logger.info('Text grounding completed', {
    event: 'text_grounding_done',
    requestId,
    sources_returned: finalSources.length,
    latency_ms: Date.now() - startTime,
    stance_distribution: {
      supports: finalSources.filter((s) => s.stance === 'supports').length,
      contradicts: finalSources.filter((s) => s.stance === 'contradicts').length,
      mentions: finalSources.filter((s) => s.stance === 'mentions').length,
      unclear: finalSources.filter((s) => s.stance === 'unclear').length,
    },
  });

  return {
    sources: finalSources,
    queries,
    providerUsed: Array.from(providersUsed),
    sourcesCount: finalSources.length,
    cacheHit: false,
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Rank sources with stance by combined score
 * 
 * Score = 0.3 * relevance + 0.3 * credibility + 0.2 * recency + 0.2 * diversity
 */
function rankSourcesWithStance(
  sources: NormalizedSourceWithStance[],
  _text: string
): NormalizedSourceWithStance[] {
  // Calculate domain counts for diversity scoring
  const domainCounts = new Map<string, number>();
  for (const source of sources) {
    domainCounts.set(source.domain, (domainCounts.get(source.domain) || 0) + 1);
  }

  // Score each source
  const scored = sources.map((source) => {
    // Relevance score (already in source.score)
    const relevanceScore = source.score;

    // Credibility score (tier 1 = 1.0, tier 2 = 0.7, tier 3 = 0.4)
    const credibilityScore =
      source.credibilityTier === 1 ? 1.0 : source.credibilityTier === 2 ? 0.7 : 0.4;

    // Recency score (already calculated in source.score components)
    const recencyScore = calculateRecencyScore(source.publishDate);

    // Diversity score (penalize domains with many sources)
    const domainCount = domainCounts.get(source.domain) || 1;
    const diversityScore = 1.0 / domainCount;

    // Combined score
    const combinedScore =
      0.3 * relevanceScore +
      0.3 * credibilityScore +
      0.2 * recencyScore +
      0.2 * diversityScore;

    return {
      ...source,
      score: combinedScore,
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored;
}

function calculateRecencyScore(publishDate: string): number {
  try {
    const published = new Date(publishDate);
    const now = new Date();
    const ageInDays = (now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24);

    // For recent articles (< 30 days): linear decay
    if (ageInDays < 30) {
      return Math.max(0, 1.0 - ageInDays / 30);
    }

    // For historical articles (30-365 days): floor score of 0.3
    if (ageInDays < 365) {
      return 0.3;
    }

    // For very old articles (> 365 days): floor score of 0.2
    return 0.2;
  } catch {
    return 0.5; // Default for invalid dates
  }
}
