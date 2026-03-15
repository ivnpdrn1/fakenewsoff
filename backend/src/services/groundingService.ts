/**
 * Grounding Service
 *
 * Orchestrates real-time news grounding with provider fallback
 *
 * Validates: Requirements FR2.3, FR2.4, FR3.1-FR3.5, FR4.1, NFR2.3, NFR3.1, NFR3.2
 */

import { BingNewsClient, BingNewsError } from '../clients/bingNewsClient';
import { BingWebClient, BingWebSearchError } from '../clients/bingWebClient';
import { GDELTClient, GDELTError } from '../clients/gdeltClient';
import { MediastackClient, MediastackError } from '../clients/mediastackClient';
import { SerperClient, SerperError } from '../clients/serperClient';
import { GroundingBundle } from '../types/grounding';
import { extractQuery, normalizeQuery } from '../utils/queryExtractor';
import { getDemoGroundingBundle } from '../utils/demoGrounding';
import { getGroundingCache } from './groundingCache';
import { getGDELTThrottle } from './gdeltThrottle';
import {
  normalizeBingArticles,
  normalizeGDELTArticles,
  normalizeBingWebResults,
  normalizeMediastackArticles,
  normalizeSerperArticles,
  deduplicate,
  rankAndCap,
} from './sourceNormalizer';
import { logger } from '../utils/logger';
import { getEnv } from '../utils/envValidation';
import { detectHistoricalClaim, getSuggestedFreshnessStrategies } from '../utils/historicalClaimDetector';

/**
 * Grounding service with provider fallback
 */
export class GroundingService {
  private bingClient: BingNewsClient | null = null;
  private bingWebClient: BingWebClient | null = null;
  private mediastackClient: MediastackClient | null = null;
  private serperClient: SerperClient | null = null;
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
    this.providerOrder = (env.GROUNDING_PROVIDER_ORDER || 'mediastack,gdelt,serper')
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter((p) => p === 'bing' || p === 'gdelt' || p === 'mediastack' || p === 'serper');

    logger.info('Initializing GroundingService', {
      event: 'grounding_service_init',
      enabled: this.enabled,
      provider_order_configured: this.providerOrder,
    });

    // Initialize Bing News client only if API key is available
    try {
      this.bingClient = new BingNewsClient();
      logger.info('Bing News client initialized', {
        event: 'provider_init_success',
        provider: 'bing',
      });
    } catch {
      // Bing client not available (no API key)
      this.bingClient = null;
      logger.info('Bing News client not available (no API key)', {
        event: 'provider_init_skipped',
        provider: 'bing',
        reason: 'missing_api_key',
      });
    }

    // Initialize Bing Web Search client only if API key is available
    try {
      this.bingWebClient = new BingWebClient();
      logger.info('Bing Web Search client initialized', {
        event: 'provider_init_success',
        provider: 'bing_web',
      });
    } catch {
      // Bing Web client not available (no API key)
      this.bingWebClient = null;
      logger.info('Bing Web Search client not available (no API key)', {
        event: 'provider_init_skipped',
        provider: 'bing_web',
        reason: 'missing_api_key',
      });
    }

    // Initialize Mediastack client only if API key is available
    try {
      this.mediastackClient = new MediastackClient();
      logger.info('Mediastack client initialized', {
        event: 'provider_init_success',
        provider: 'mediastack',
      });
    } catch {
      // Mediastack client not available (no API key)
      this.mediastackClient = null;
      logger.info('Mediastack client not available (no API key)', {
        event: 'provider_init_skipped',
        provider: 'mediastack',
        reason: 'missing_api_key',
      });
    }

    // Initialize Serper client only if API key is available
    // Log environment variable presence (boolean only, never print secret)
    const serperEnvPresent = !!env.SERPER_API_KEY;
    logger.info('Serper environment check', {
      event: 'SERPER_ENV_PRESENT',
      serper_api_key_present: serperEnvPresent,
    });

    try {
      this.serperClient = new SerperClient();
      logger.info('Serper client initialized', {
        event: 'SERPER_CLIENT_INITIALIZED',
        provider: 'serper',
      });
    } catch (error) {
      // Serper client not available (no API key or initialization error)
      this.serperClient = null;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.info('Serper client not available', {
        event: 'SERPER_CLIENT_NOT_INITIALIZED',
        provider: 'serper',
        reason: serperEnvPresent ? 'initialization_error' : 'missing_api_key',
        error_message: errorMessage,
      });
    }

    // GDELT client always available (no auth required)
    this.gdeltClient = new GDELTClient();
    logger.info('GDELT client initialized', {
      event: 'provider_init_success',
      provider: 'gdelt',
    });

    this.maxResults = parseInt(env.GROUNDING_MAX_RESULTS || '10', 10);

    // Log final provider availability
    const availableProviders = [];
    if (this.mediastackClient) availableProviders.push('mediastack');
    if (this.bingClient) availableProviders.push('bing');
    if (this.bingWebClient) availableProviders.push('bing_web');
    if (this.serperClient) availableProviders.push('serper');
    availableProviders.push('gdelt'); // Always available

    logger.info('GroundingService initialization complete', {
      event: 'grounding_service_ready',
      enabled: this.enabled,
      provider_order_configured: this.providerOrder,
      providers_available: availableProviders,
      max_results: this.maxResults,
    });
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
    let lastProviderFailure: {
      provider: string;
      query: string;
      reason: string;
      latency: number;
      raw_count: number;
      normalized_count: number;
      accepted_count: number;
      http_status?: number;
      error_message: string;
    } | undefined;

    // Log provider client initialization status before attempting providers
    logger.info('Provider client status before provider loop', {
      event: 'PROVIDER_CLIENT_STATUS',
      requestId,
      mediastack_initialized: !!this.mediastackClient,
      gdelt_initialized: !!this.gdeltClient,
      serper_initialized: !!this.serperClient,
      bing_initialized: !!this.bingClient,
      bing_web_initialized: !!this.bingWebClient,
    });

    // Try providers in configured order
    for (const provider of this.providerOrder) {
      if (provider === 'mediastack') {
        if (!this.mediastackClient) {
          logger.info('Skipping Mediastack provider (client not initialized)', {
            event: 'provider_attempt_skipped',
            requestId,
            provider: 'mediastack',
            reason: 'client_not_initialized',
          });
          
          // Track as failure even when skipped
          attemptedProviders.push('mediastack');
          lastProviderFailure = {
            provider: 'mediastack',
            query,
            reason: 'client_not_initialized',
            latency: 0,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            error_message: 'Mediastack client not initialized (API key not configured)',
          };
          continue;
        }

        // Check cooldown before attempting provider call
        const cooldown = this.getProviderCooldown('mediastack');
        if (cooldown) {
          const remainingMs = cooldown.until - Date.now();
          logger.info('Skipping Mediastack provider (cooldown active)', {
            event: 'provider_attempt_skipped',
            requestId,
            provider: 'mediastack',
            reason: 'cooldown_active',
            cooldown_reason: cooldown.reason,
            remaining_ms: remainingMs,
          });
          
          // Track as failure when on cooldown
          attemptedProviders.push('mediastack');
          lastProviderFailure = {
            provider: 'mediastack',
            query,
            reason: cooldown.reason,
            latency: 0,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            error_message: `Provider on cooldown (${cooldown.reason}, ${Math.ceil(remainingMs / 1000)}s remaining)`,
          };
          continue;
        }

        attemptedProviders.push('mediastack');
        const providerStartTime = Date.now();

        logger.info('Attempting Mediastack provider', {
          event: 'provider_attempt_start',
          requestId,
          provider: 'mediastack',
          timeout_ms: 5000,
        });

        try {
          const response = await this.mediastackClient.searchNews({
            keywords: query,
            languages: 'en',
            limit: this.maxResults,
            sort: 'published_desc',
          });
          const rawCount = response.data.length;
          const providerLatency = Date.now() - providerStartTime;

          // Log raw result stage
          logger.info('Mediastack raw result received', {
            event: 'provider_raw_result',
            requestId,
            provider: 'mediastack',
            query: query.substring(0, 100),
            raw_result_count: rawCount,
            latency_ms: providerLatency,
          });

          if (response.data.length > 0) {
            const normalized = normalizeMediastackArticles(response.data);
            
            // Log normalization stage
            logger.info('Mediastack normalization complete', {
              event: 'provider_normalized_result',
              requestId,
              provider: 'mediastack',
              normalized_count: normalized.length,
              normalization_dropped: rawCount - normalized.length,
            });

            const deduplicated = deduplicate(normalized);
            const ranked = rankAndCap(deduplicated, query, this.maxResults);

            // Log filter stage
            logger.info('Mediastack filtering complete', {
              event: 'provider_filter_result',
              requestId,
              provider: 'mediastack',
              accepted_count: ranked.length,
              filter_dropped: deduplicated.length - ranked.length,
            });

            logger.info('Mediastack provider succeeded', {
              event: 'provider_success',
              requestId,
              provider: 'mediastack',
              latency_ms: providerLatency,
              sources_raw: rawCount,
              sources_normalized: normalized.length,
              sources_deduplicated: deduplicated.length,
              sources_returned: ranked.length,
              cache_hit: false,
            });

            // Log sample normalized source for debugging
            if (normalized.length > 0) {
              logger.info('Sample Mediastack normalized source', {
                event: 'sample_normalized_source',
                requestId,
                provider: 'mediastack',
                sample: {
                  url: normalized[0].url,
                  title: normalized[0].title,
                  domain: normalized[0].domain,
                  has_snippet: !!normalized[0].snippet,
                  has_publish_date: !!normalized[0].publishDate,
                },
              });
            }

            return {
              sources: ranked,
              providerUsed: 'mediastack',
              query,
              latencyMs: Date.now() - startTime,
              attemptedProviders,
              sourcesCountRaw: rawCount,
            };
          }

          // Mediastack returned zero results, try fallback
          logger.warn('Mediastack returned zero results', {
            event: 'provider_attempt_failed',
            requestId,
            provider: 'mediastack',
            query: query.substring(0, 100),
            failure_reason: 'zero_raw_results',
            latency_ms: providerLatency,
            raw_result_count: 0,
            normalized_count: 0,
            accepted_count: 0,
          });

          // Track failure details
          lastProviderFailure = {
            provider: 'mediastack',
            query,
            reason: 'zero_raw_results',
            latency: providerLatency,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            error_message: 'Provider returned zero results',
          };
        } catch (error) {
          const providerLatency = Date.now() - providerStartTime;
          const errorMessage =
            error instanceof MediastackError ? error.message : 'Unknown Mediastack error';
          const isTimeout = errorMessage.toLowerCase().includes('timeout');
          const isUnauthorized = errorMessage.toLowerCase().includes('unauthorized') || errorMessage.toLowerCase().includes('401');
          const isForbidden = errorMessage.toLowerCase().includes('forbidden') || errorMessage.toLowerCase().includes('403');
          const isRateLimit = errorMessage.toLowerCase().includes('rate limit') || errorMessage.toLowerCase().includes('429') || errorMessage.toLowerCase().includes('too many requests');
          const isQuota = errorMessage.toLowerCase().includes('quota exceeded') || errorMessage.toLowerCase().includes('subscription limit');
          const isThrottled = errorMessage.toLowerCase().includes('throttled') || errorMessage.toLowerCase().includes('slow down');

          let failureReason = 'provider_exception';
          if (isTimeout) failureReason = 'timeout';
          else if (isUnauthorized) failureReason = 'unauthorized';
          else if (isForbidden) failureReason = 'forbidden';
          else if (isRateLimit) failureReason = 'rate_limit';
          else if (isQuota) failureReason = 'quota_exceeded';
          else if (isThrottled) failureReason = 'throttled';

          // Set cooldown for rate-limit, quota, or throttling errors
          if (isRateLimit || isQuota || isThrottled) {
            // Use 2-5 minute cooldown based on error type
            const cooldownMs = isRateLimit ? 5 * 60 * 1000 : 2 * 60 * 1000; // 5 min for rate-limit, 2 min for quota/throttle
            this.setProviderCooldown('mediastack', failureReason, cooldownMs);
          }

          errors.push(`Mediastack: ${errorMessage}`);

          // Extract HTTP status if available
          let httpStatus: number | undefined;
          if (error instanceof MediastackError && 'statusCode' in error) {
            httpStatus = (error as any).statusCode;
          } else if (errorMessage.includes('429')) {
            httpStatus = 429;
          } else if (errorMessage.includes('401')) {
            httpStatus = 401;
          } else if (errorMessage.includes('403')) {
            httpStatus = 403;
          }

          // Track failure details
          lastProviderFailure = {
            provider: 'mediastack',
            query,
            reason: failureReason,
            latency: providerLatency,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            http_status: httpStatus,
            error_message: errorMessage,
          };

          logger.warn('Mediastack provider failed', {
            event: 'provider_attempt_failed',
            requestId,
            provider: 'mediastack',
            query: query.substring(0, 100),
            failure_reason: failureReason,
            latency_ms: providerLatency,
            timeout_ms: isTimeout ? 5000 : undefined,
            raw_result_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            error_message: errorMessage.substring(0, 200),
          });
        }
      }

      if (provider === 'bing') {
        if (!this.bingClient) {
          logger.info('Skipping Bing News provider (client not initialized)', {
            event: 'provider_attempt_skipped',
            requestId,
            provider: 'bing',
            reason: 'client_not_initialized',
          });
          
          // Track as failure even when skipped
          attemptedProviders.push('bing');
          lastProviderFailure = {
            provider: 'bing',
            query,
            reason: 'client_not_initialized',
            latency: 0,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            error_message: 'Bing News client not initialized (API key not configured)',
          };
          continue;
        }

        // Check cooldown before attempting provider call
        const cooldown = this.getProviderCooldown('bing');
        if (cooldown) {
          const remainingMs = cooldown.until - Date.now();
          logger.info('Skipping Bing News provider (cooldown active)', {
            event: 'provider_attempt_skipped',
            requestId,
            provider: 'bing',
            reason: 'cooldown_active',
            cooldown_reason: cooldown.reason,
            remaining_ms: remainingMs,
          });
          
          // Track as failure when on cooldown
          attemptedProviders.push('bing');
          lastProviderFailure = {
            provider: 'bing',
            query,
            reason: cooldown.reason,
            latency: 0,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            error_message: `Provider on cooldown (${cooldown.reason}, ${Math.ceil(remainingMs / 1000)}s remaining)`,
          };
          continue;
        }

        attemptedProviders.push('bing');
        const providerStartTime = Date.now();

        logger.info('Attempting Bing News provider', {
          event: 'provider_attempt_start',
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

          // Track failure details
          lastProviderFailure = {
            provider: 'bing',
            query,
            reason: 'zero_results',
            latency: providerLatency,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            error_message: 'Provider returned zero results',
          };
        } catch (error) {
          const providerLatency = Date.now() - providerStartTime;
          const errorMessage =
            error instanceof BingNewsError ? error.message : 'Unknown Bing error';
          const errorCategory = error instanceof BingNewsError ? 'api_error' : 'unknown';
          
          // Check for rate-limit, quota, or throttling errors
          const isRateLimit = errorMessage.toLowerCase().includes('rate limit') || errorMessage.toLowerCase().includes('429') || errorMessage.toLowerCase().includes('too many requests');
          const isQuota = errorMessage.toLowerCase().includes('quota exceeded') || errorMessage.toLowerCase().includes('subscription limit');
          const isThrottled = errorMessage.toLowerCase().includes('throttled') || errorMessage.toLowerCase().includes('slow down');

          // Set cooldown for rate-limit, quota, or throttling errors
          if (isRateLimit || isQuota || isThrottled) {
            const cooldownMs = isRateLimit ? 5 * 60 * 1000 : 2 * 60 * 1000;
            const reason = isRateLimit ? 'rate_limit' : isQuota ? 'quota_exceeded' : 'throttled';
            this.setProviderCooldown('bing', reason, cooldownMs);
          }

          errors.push(`Bing: ${errorMessage}`);

          // Extract HTTP status if available
          let httpStatus: number | undefined;
          if (error instanceof BingNewsError && 'statusCode' in error) {
            httpStatus = (error as any).statusCode;
          } else if (errorMessage.includes('429')) {
            httpStatus = 429;
          }

          // Determine failure reason
          let failureReason = 'provider_exception';
          if (isRateLimit) failureReason = 'rate_limit';
          else if (isQuota) failureReason = 'quota_exceeded';
          else if (isThrottled) failureReason = 'throttled';

          // Track failure details
          lastProviderFailure = {
            provider: 'bing',
            query,
            reason: failureReason,
            latency: providerLatency,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            http_status: httpStatus,
            error_message: errorMessage,
          };

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
        // Check cooldown before attempting provider call
        const cooldown = this.getProviderCooldown('gdelt');
        if (cooldown) {
          const remainingMs = cooldown.until - Date.now();
          logger.info('Skipping GDELT provider (cooldown active)', {
            event: 'provider_attempt_skipped',
            requestId,
            provider: 'gdelt',
            reason: 'cooldown_active',
            cooldown_reason: cooldown.reason,
            remaining_ms: remainingMs,
          });
          
          // Track as failure when on cooldown
          attemptedProviders.push('gdelt');
          lastProviderFailure = {
            provider: 'gdelt',
            query,
            reason: cooldown.reason,
            latency: 0,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            error_message: `Provider on cooldown (${cooldown.reason}, ${Math.ceil(remainingMs / 1000)}s remaining)`,
          };
          continue;
        }

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

          // Track failure details
          lastProviderFailure = {
            provider: 'gdelt',
            query,
            reason: 'zero_results',
            latency: providerLatency,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            error_message: 'Provider returned zero results',
          };
        } catch (error) {
          const providerLatency = Date.now() - providerStartTime;
          const errorMessage = error instanceof GDELTError ? error.message : 'Unknown GDELT error';
          const errorCategory = error instanceof GDELTError ? 'api_error' : 'unknown';

          // Record failed request attempt
          throttle.recordRequest();

          // Check for rate-limit, quota, or throttling errors
          const isRateLimit = errorMessage.toLowerCase().includes('rate limit') || errorMessage.toLowerCase().includes('429') || errorMessage.toLowerCase().includes('too many requests');
          const isQuota = errorMessage.toLowerCase().includes('quota exceeded') || errorMessage.toLowerCase().includes('subscription limit');
          const isThrottled = errorMessage.toLowerCase().includes('throttled') || errorMessage.toLowerCase().includes('slow down');

          // Set cooldown for rate-limit, quota, or throttling errors
          if (isRateLimit || isQuota || isThrottled) {
            const cooldownMs = isRateLimit ? 5 * 60 * 1000 : 2 * 60 * 1000;
            const reason = isRateLimit ? 'rate_limit' : isQuota ? 'quota_exceeded' : 'throttled';
            this.setProviderCooldown('gdelt', reason, cooldownMs);
          }

          errors.push(`GDELT: ${errorMessage}`);

          // Extract HTTP status if available
          let httpStatus: number | undefined;
          if (error instanceof GDELTError && 'statusCode' in error) {
            httpStatus = (error as any).statusCode;
          } else if (errorMessage.includes('429')) {
            httpStatus = 429;
          }

          // Determine failure reason
          let failureReason = 'provider_exception';
          if (isRateLimit) failureReason = 'rate_limit';
          else if (isQuota) failureReason = 'quota_exceeded';
          else if (isThrottled) failureReason = 'throttled';

          // Track failure details
          lastProviderFailure = {
            provider: 'gdelt',
            query,
            reason: failureReason,
            latency: providerLatency,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            http_status: httpStatus,
            error_message: errorMessage,
          };

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

      if (provider === 'serper') {
        if (!this.serperClient) {
          logger.info('Skipping Serper provider (client not initialized)', {
            event: 'provider_attempt_skipped',
            requestId,
            provider: 'serper',
            reason: 'client_not_initialized',
          });
          
          // Track as failure even when skipped
          attemptedProviders.push('serper');
          lastProviderFailure = {
            provider: 'serper',
            query,
            reason: 'client_not_initialized',
            latency: 0,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            error_message: 'Serper client not initialized (API key not configured)',
          };
          continue;
        }

        // Check cooldown before attempting provider call
        const cooldown = this.getProviderCooldown('serper');
        if (cooldown) {
          const remainingMs = cooldown.until - Date.now();
          logger.info('Skipping Serper provider (cooldown active)', {
            event: 'provider_attempt_skipped',
            requestId,
            provider: 'serper',
            reason: 'cooldown_active',
            cooldown_reason: cooldown.reason,
            remaining_ms: remainingMs,
          });
          
          // Track as failure when on cooldown
          attemptedProviders.push('serper');
          lastProviderFailure = {
            provider: 'serper',
            query,
            reason: cooldown.reason,
            latency: 0,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            error_message: `Provider on cooldown (${cooldown.reason}, ${Math.ceil(remainingMs / 1000)}s remaining)`,
          };
          continue;
        }

        attemptedProviders.push('serper');
        const providerStartTime = Date.now();

        logger.info('Attempting Serper provider', {
          event: 'provider_attempt_start',
          requestId,
          provider: 'serper',
          timeout_ms: 5000,
        });

        try {
          const response = await this.serperClient.searchNews({
            q: query,
            num: this.maxResults,
          });
          const rawCount = response.news.length;
          const providerLatency = Date.now() - providerStartTime;

          // Log raw result stage
          logger.info('Serper raw result received', {
            event: 'provider_raw_result',
            requestId,
            provider: 'serper',
            query: query.substring(0, 100),
            raw_result_count: rawCount,
            latency_ms: providerLatency,
          });

          if (response.news.length > 0) {
            const normalized = normalizeSerperArticles(response.news);
            
            // Log normalization stage
            logger.info('Serper normalization complete', {
              event: 'provider_normalized_result',
              requestId,
              provider: 'serper',
              normalized_count: normalized.length,
              normalization_dropped: rawCount - normalized.length,
            });

            const deduplicated = deduplicate(normalized);
            const ranked = rankAndCap(deduplicated, query, this.maxResults);

            // Log filter stage
            logger.info('Serper filtering complete', {
              event: 'provider_filter_result',
              requestId,
              provider: 'serper',
              accepted_count: ranked.length,
              filter_dropped: deduplicated.length - ranked.length,
            });

            logger.info('Serper provider succeeded', {
              event: 'provider_success',
              requestId,
              provider: 'serper',
              latency_ms: providerLatency,
              sources_raw: rawCount,
              sources_normalized: normalized.length,
              sources_deduplicated: deduplicated.length,
              sources_returned: ranked.length,
              cache_hit: false,
            });

            // Log sample normalized source for debugging
            if (normalized.length > 0) {
              logger.info('Sample Serper normalized source', {
                event: 'sample_normalized_source',
                requestId,
                provider: 'serper',
                sample: {
                  url: normalized[0].url,
                  title: normalized[0].title,
                  domain: normalized[0].domain,
                  has_snippet: !!normalized[0].snippet,
                  has_publish_date: !!normalized[0].publishDate,
                },
              });
            }

            return {
              sources: ranked,
              providerUsed: 'serper',
              query,
              latencyMs: Date.now() - startTime,
              attemptedProviders,
              sourcesCountRaw: rawCount,
            };
          }

          // Serper returned zero results
          logger.warn('Serper returned zero results', {
            event: 'provider_attempt_failed',
            requestId,
            provider: 'serper',
            query: query.substring(0, 100),
            failure_reason: 'zero_raw_results',
            latency_ms: providerLatency,
            raw_result_count: 0,
            normalized_count: 0,
            accepted_count: 0,
          });

          // Track failure details
          lastProviderFailure = {
            provider: 'serper',
            query,
            reason: 'zero_raw_results',
            latency: providerLatency,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            error_message: 'Provider returned zero results',
          };
        } catch (error) {
          const providerLatency = Date.now() - providerStartTime;
          const errorMessage =
            error instanceof SerperError ? error.message : 'Unknown Serper error';
          const isTimeout = errorMessage.toLowerCase().includes('timeout');
          const isUnauthorized = errorMessage.toLowerCase().includes('unauthorized') || errorMessage.toLowerCase().includes('401');
          const isForbidden = errorMessage.toLowerCase().includes('forbidden') || errorMessage.toLowerCase().includes('403');
          const isRateLimit = errorMessage.toLowerCase().includes('rate limit') || errorMessage.toLowerCase().includes('429') || errorMessage.toLowerCase().includes('too many requests');
          const isQuota = errorMessage.toLowerCase().includes('quota exceeded') || errorMessage.toLowerCase().includes('subscription limit');
          const isThrottled = errorMessage.toLowerCase().includes('throttled') || errorMessage.toLowerCase().includes('slow down');

          let failureReason = 'provider_exception';
          if (isTimeout) failureReason = 'timeout';
          else if (isUnauthorized) failureReason = 'unauthorized';
          else if (isForbidden) failureReason = 'forbidden';
          else if (isRateLimit) failureReason = 'rate_limit';
          else if (isQuota) failureReason = 'quota_exceeded';
          else if (isThrottled) failureReason = 'throttled';

          // Set cooldown for rate-limit, quota, or throttling errors
          if (isRateLimit || isQuota || isThrottled) {
            const cooldownMs = isRateLimit ? 5 * 60 * 1000 : 2 * 60 * 1000;
            this.setProviderCooldown('serper', failureReason, cooldownMs);
          }

          errors.push(`Serper: ${errorMessage}`);

          // Extract HTTP status if available
          let httpStatus: number | undefined;
          if (error instanceof SerperError && 'statusCode' in error) {
            httpStatus = (error as any).statusCode;
          } else if (errorMessage.includes('429')) {
            httpStatus = 429;
          } else if (errorMessage.includes('401')) {
            httpStatus = 401;
          } else if (errorMessage.includes('403')) {
            httpStatus = 403;
          }

          // Track failure details
          lastProviderFailure = {
            provider: 'serper',
            query,
            reason: failureReason,
            latency: providerLatency,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            http_status: httpStatus,
            error_message: errorMessage,
          };

          logger.warn('Serper provider failed', {
            event: 'provider_attempt_failed',
            requestId,
            provider: 'serper',
            query: query.substring(0, 100),
            failure_reason: failureReason,
            latency_ms: providerLatency,
            timeout_ms: isTimeout ? 5000 : undefined,
            raw_result_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            error_message: errorMessage.substring(0, 200),
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

    // DIAGNOSTIC: Log provider failure details before return
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      service: 'groundingService',
      event: 'PROVIDER_FINAL_DECISION',
      query: query.substring(0, 50),
      all_providers_failed: true,
      attempted_providers: attemptedProviders,
      has_failure_details: !!lastProviderFailure,
      last_failure_provider: lastProviderFailure?.provider,
      last_failure_reason: lastProviderFailure?.reason,
    }));

    return {
      sources: [],
      providerUsed: 'none',
      query,
      latencyMs: Date.now() - startTime,
      errors,
      attemptedProviders,
      providerFailureDetails: lastProviderFailure,
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
    let lastProviderFailure: {
      provider: string;
      query: string;
      reason: string;
      latency: number;
      raw_count: number;
      normalized_count: number;
      accepted_count: number;
      http_status?: number;
      error_message: string;
    } | undefined;

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
      if (provider === 'mediastack') {
        if (!this.mediastackClient) {
          logger.info('Skipping Mediastack provider (client not initialized)', {
            event: 'provider_attempt_skipped',
            requestId,
            provider: 'mediastack',
            freshness: freshness,
            reason: 'client_not_initialized',
          });
          
          // Track as failure even when skipped
          attemptedProviders.push('mediastack');
          lastProviderFailure = {
            provider: 'mediastack',
            query,
            reason: 'client_not_initialized',
            latency: 0,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            error_message: 'Mediastack client not initialized (API key not configured)',
          };
          continue;
        }

        // Check cooldown before attempting provider call
        const cooldown = this.getProviderCooldown('mediastack');
        if (cooldown) {
          const remainingMs = cooldown.until - Date.now();
          logger.info('Skipping Mediastack provider (cooldown active)', {
            event: 'provider_attempt_skipped',
            requestId,
            provider: 'mediastack',
            freshness: freshness,
            reason: 'cooldown_active',
            cooldown_reason: cooldown.reason,
            remaining_ms: remainingMs,
          });
          
          // Track as failure when on cooldown
          attemptedProviders.push('mediastack');
          lastProviderFailure = {
            provider: 'mediastack',
            query,
            reason: cooldown.reason,
            latency: 0,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            error_message: `Provider on cooldown (${cooldown.reason}, ${Math.ceil(remainingMs / 1000)}s remaining)`,
          };
          continue;
        }

        attemptedProviders.push('mediastack');
        const providerStartTime = Date.now();

        logger.info('Attempting Mediastack provider with freshness', {
          event: 'provider_attempt_start',
          requestId,
          provider: 'mediastack',
          freshness: freshness,
        });

        try {
          // Mediastack doesn't have explicit freshness parameters, but we can use it for all freshness levels
          const response = await this.mediastackClient.searchNews({
            keywords: query,
            languages: 'en',
            limit: this.maxResults,
            sort: 'published_desc',
          });
          const rawCount = response.data.length;
          const providerLatency = Date.now() - providerStartTime;

          if (response.data.length > 0) {
            const normalized = normalizeMediastackArticles(response.data);
            const deduplicated = deduplicate(normalized);
            const ranked = rankAndCap(deduplicated, query, this.maxResults);

            logger.info('Mediastack provider succeeded with freshness', {
              event: 'provider_success',
              requestId,
              provider: 'mediastack',
              freshness: freshness,
              latency_ms: providerLatency,
              sources_raw: rawCount,
              sources_normalized: normalized.length,
              sources_deduplicated: deduplicated.length,
              sources_returned: ranked.length,
            });

            // Log sample normalized source for debugging
            if (normalized.length > 0) {
              logger.info('Sample Mediastack normalized source (with freshness)', {
                event: 'sample_normalized_source',
                requestId,
                provider: 'mediastack',
                freshness: freshness,
                sample: {
                  url: normalized[0].url,
                  title: normalized[0].title,
                  domain: normalized[0].domain,
                  has_snippet: !!normalized[0].snippet,
                  has_publish_date: !!normalized[0].publishDate,
                },
              });
            }

            return {
              sources: ranked,
              providerUsed: 'mediastack',
              query,
              latencyMs: Date.now() - startTime,
              attemptedProviders,
              sourcesCountRaw: rawCount,
            };
          }

          logger.warn('Mediastack returned zero results with freshness', {
            event: 'provider_failure',
            requestId,
            provider: 'mediastack',
            freshness: freshness,
            latency_ms: providerLatency,
          });
        } catch (error) {
          const providerLatency = Date.now() - providerStartTime;
          const errorMessage =
            error instanceof MediastackError ? error.message : 'Unknown Mediastack error';
          
          // Check for rate-limit, quota, or throttling errors
          const isRateLimit = errorMessage.toLowerCase().includes('rate limit') || errorMessage.toLowerCase().includes('429') || errorMessage.toLowerCase().includes('too many requests');
          const isQuota = errorMessage.toLowerCase().includes('quota exceeded') || errorMessage.toLowerCase().includes('subscription limit');
          const isThrottled = errorMessage.toLowerCase().includes('throttled') || errorMessage.toLowerCase().includes('slow down');

          // Set cooldown for rate-limit, quota, or throttling errors
          if (isRateLimit || isQuota || isThrottled) {
            const cooldownMs = isRateLimit ? 5 * 60 * 1000 : 2 * 60 * 1000;
            const reason = isRateLimit ? 'rate_limit' : isQuota ? 'quota_exceeded' : 'throttled';
            this.setProviderCooldown('mediastack', reason, cooldownMs);
          }
          
          errors.push(`Mediastack (${freshness}): ${errorMessage}`);

          logger.warn('Mediastack provider failed with freshness', {
            event: 'provider_failure',
            requestId,
            provider: 'mediastack',
            freshness: freshness,
            latency_ms: providerLatency,
            error: errorMessage.substring(0, 100),
          });
        }
      }

      if (provider === 'bing') {
        if (!this.bingClient) {
          logger.info('Skipping Bing News provider (client not initialized)', {
            event: 'provider_attempt_skipped',
            requestId,
            provider: 'bing',
            freshness: freshness,
            reason: 'client_not_initialized',
          });
          
          // Track as failure even when skipped
          attemptedProviders.push('bing');
          lastProviderFailure = {
            provider: 'bing',
            query,
            reason: 'client_not_initialized',
            latency: 0,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            error_message: 'Bing News client not initialized (API key not configured)',
          };
          continue;
        }

        // Check cooldown before attempting provider call
        const cooldown = this.getProviderCooldown('bing');
        if (cooldown) {
          const remainingMs = cooldown.until - Date.now();
          logger.info('Skipping Bing News provider (cooldown active)', {
            event: 'provider_attempt_skipped',
            requestId,
            provider: 'bing',
            freshness: freshness,
            reason: 'cooldown_active',
            cooldown_reason: cooldown.reason,
            remaining_ms: remainingMs,
          });
          
          // Track as failure when on cooldown
          attemptedProviders.push('bing');
          lastProviderFailure = {
            provider: 'bing',
            query,
            reason: cooldown.reason,
            latency: 0,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            error_message: `Provider on cooldown (${cooldown.reason}, ${Math.ceil(remainingMs / 1000)}s remaining)`,
          };
          continue;
        }

        attemptedProviders.push('bing');
        const providerStartTime = Date.now();

        logger.info('Attempting Bing News provider with freshness', {
          event: 'provider_attempt_start',
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
          
          // Check for rate-limit, quota, or throttling errors
          const isRateLimit = errorMessage.toLowerCase().includes('rate limit') || errorMessage.toLowerCase().includes('429') || errorMessage.toLowerCase().includes('too many requests');
          const isQuota = errorMessage.toLowerCase().includes('quota exceeded') || errorMessage.toLowerCase().includes('subscription limit');
          const isThrottled = errorMessage.toLowerCase().includes('throttled') || errorMessage.toLowerCase().includes('slow down');

          // Set cooldown for rate-limit, quota, or throttling errors
          if (isRateLimit || isQuota || isThrottled) {
            const cooldownMs = isRateLimit ? 5 * 60 * 1000 : 2 * 60 * 1000;
            const reason = isRateLimit ? 'rate_limit' : isQuota ? 'quota_exceeded' : 'throttled';
            this.setProviderCooldown('bing', reason, cooldownMs);
          }
          
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
        // Check cooldown before attempting provider call
        const cooldown = this.getProviderCooldown('gdelt');
        if (cooldown) {
          const remainingMs = cooldown.until - Date.now();
          logger.info('Skipping GDELT provider (cooldown active)', {
            event: 'provider_attempt_skipped',
            requestId,
            provider: 'gdelt',
            freshness: freshness,
            reason: 'cooldown_active',
            cooldown_reason: cooldown.reason,
            remaining_ms: remainingMs,
          });
          
          // Track as failure when on cooldown
          attemptedProviders.push('gdelt');
          lastProviderFailure = {
            provider: 'gdelt',
            query,
            reason: cooldown.reason,
            latency: 0,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            error_message: `Provider on cooldown (${cooldown.reason}, ${Math.ceil(remainingMs / 1000)}s remaining)`,
          };
          continue;
        }

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

          // Check for rate-limit, quota, or throttling errors
          const isRateLimit = errorMessage.toLowerCase().includes('rate limit') || errorMessage.toLowerCase().includes('429') || errorMessage.toLowerCase().includes('too many requests');
          const isQuota = errorMessage.toLowerCase().includes('quota exceeded') || errorMessage.toLowerCase().includes('subscription limit');
          const isThrottled = errorMessage.toLowerCase().includes('throttled') || errorMessage.toLowerCase().includes('slow down');

          // Set cooldown for rate-limit, quota, or throttling errors
          if (isRateLimit || isQuota || isThrottled) {
            const cooldownMs = isRateLimit ? 5 * 60 * 1000 : 2 * 60 * 1000;
            const reason = isRateLimit ? 'rate_limit' : isQuota ? 'quota_exceeded' : 'throttled';
            this.setProviderCooldown('gdelt', reason, cooldownMs);
          }

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

      if (provider === 'serper') {
        if (!this.serperClient) {
          logger.info('Skipping Serper provider (client not initialized)', {
            event: 'provider_attempt_skipped',
            requestId,
            provider: 'serper',
            freshness: freshness,
            reason: 'client_not_initialized',
          });
          
          // Track as failure even when skipped
          attemptedProviders.push('serper');
          lastProviderFailure = {
            provider: 'serper',
            query,
            reason: 'client_not_initialized',
            latency: 0,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            error_message: 'Serper client not initialized (API key not configured)',
          };
          continue;
        }

        // Check cooldown before attempting provider call
        const cooldown = this.getProviderCooldown('serper');
        if (cooldown) {
          const remainingMs = cooldown.until - Date.now();
          logger.info('Skipping Serper provider (cooldown active)', {
            event: 'provider_attempt_skipped',
            requestId,
            provider: 'serper',
            freshness: freshness,
            reason: 'cooldown_active',
            cooldown_reason: cooldown.reason,
            remaining_ms: remainingMs,
          });
          
          // Track as failure when on cooldown
          attemptedProviders.push('serper');
          lastProviderFailure = {
            provider: 'serper',
            query,
            reason: cooldown.reason,
            latency: 0,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            error_message: `Provider on cooldown (${cooldown.reason}, ${Math.ceil(remainingMs / 1000)}s remaining)`,
          };
          continue;
        }

        attemptedProviders.push('serper');
        const providerStartTime = Date.now();

        // Map freshness to Serper tbs parameter
        let serperTbs: string | undefined;
        if (freshness === '7d') {
          serperTbs = 'qdr:w'; // Past week
        } else if (freshness === '30d') {
          serperTbs = 'qdr:m'; // Past month
        } else if (freshness === '1y') {
          serperTbs = 'qdr:y'; // Past year
        }
        // For 'web' freshness, don't set tbs (all time)

        logger.info('Attempting Serper provider with freshness', {
          event: 'provider_attempt_start',
          requestId,
          provider: 'serper',
          freshness: freshness,
          tbs: serperTbs,
        });

        try {
          const response = await this.serperClient.searchNews({
            q: query,
            num: this.maxResults,
            tbs: serperTbs,
          });
          const rawCount = response.news.length;
          const providerLatency = Date.now() - providerStartTime;

          // Log raw result stage
          logger.info('Serper raw result received with freshness', {
            event: 'provider_raw_result',
            requestId,
            provider: 'serper',
            freshness: freshness,
            query: query.substring(0, 100),
            raw_result_count: rawCount,
            latency_ms: providerLatency,
          });

          if (response.news.length > 0) {
            const normalized = normalizeSerperArticles(response.news);
            
            // Log normalization stage
            logger.info('Serper normalization complete with freshness', {
              event: 'provider_normalized_result',
              requestId,
              provider: 'serper',
              freshness: freshness,
              normalized_count: normalized.length,
              normalization_dropped: rawCount - normalized.length,
            });

            const deduplicated = deduplicate(normalized);
            const ranked = rankAndCap(deduplicated, query, this.maxResults);

            // Log filter stage
            logger.info('Serper filtering complete with freshness', {
              event: 'provider_filter_result',
              requestId,
              provider: 'serper',
              freshness: freshness,
              accepted_count: ranked.length,
              filter_dropped: deduplicated.length - ranked.length,
            });

            logger.info('Serper provider succeeded with freshness', {
              event: 'provider_success',
              requestId,
              provider: 'serper',
              freshness: freshness,
              latency_ms: providerLatency,
              sources_raw: rawCount,
              sources_normalized: normalized.length,
              sources_deduplicated: deduplicated.length,
              sources_returned: ranked.length,
            });

            // Log sample normalized source for debugging
            if (normalized.length > 0) {
              logger.info('Sample Serper normalized source (with freshness)', {
                event: 'sample_normalized_source',
                requestId,
                provider: 'serper',
                freshness: freshness,
                sample: {
                  url: normalized[0].url,
                  title: normalized[0].title,
                  domain: normalized[0].domain,
                  has_snippet: !!normalized[0].snippet,
                  has_publish_date: !!normalized[0].publishDate,
                },
              });
            }

            return {
              sources: ranked,
              providerUsed: 'serper',
              query,
              latencyMs: Date.now() - startTime,
              attemptedProviders,
              sourcesCountRaw: rawCount,
            };
          }

          // Serper returned zero results
          logger.warn('Serper returned zero results with freshness', {
            event: 'provider_failure',
            requestId,
            provider: 'serper',
            freshness: freshness,
            latency_ms: providerLatency,
          });

          // Track failure details
          lastProviderFailure = {
            provider: 'serper',
            query,
            reason: 'zero_raw_results',
            latency: providerLatency,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            error_message: 'Provider returned zero results',
          };
        } catch (error) {
          const providerLatency = Date.now() - providerStartTime;
          const errorMessage =
            error instanceof SerperError ? error.message : 'Unknown Serper error';
          const isTimeout = errorMessage.toLowerCase().includes('timeout');
          const isUnauthorized = errorMessage.toLowerCase().includes('unauthorized') || errorMessage.toLowerCase().includes('401');
          const isForbidden = errorMessage.toLowerCase().includes('forbidden') || errorMessage.toLowerCase().includes('403');
          const isRateLimit = errorMessage.toLowerCase().includes('rate limit') || errorMessage.toLowerCase().includes('429') || errorMessage.toLowerCase().includes('too many requests');
          const isQuota = errorMessage.toLowerCase().includes('quota exceeded') || errorMessage.toLowerCase().includes('subscription limit');
          const isThrottled = errorMessage.toLowerCase().includes('throttled') || errorMessage.toLowerCase().includes('slow down');

          let failureReason = 'provider_exception';
          if (isTimeout) failureReason = 'timeout';
          else if (isUnauthorized) failureReason = 'unauthorized';
          else if (isForbidden) failureReason = 'forbidden';
          else if (isRateLimit) failureReason = 'rate_limit';
          else if (isQuota) failureReason = 'quota_exceeded';
          else if (isThrottled) failureReason = 'throttled';

          // Set cooldown for rate-limit, quota, or throttling errors
          if (isRateLimit || isQuota || isThrottled) {
            const cooldownMs = isRateLimit ? 5 * 60 * 1000 : 2 * 60 * 1000;
            this.setProviderCooldown('serper', failureReason, cooldownMs);
          }

          errors.push(`Serper (${freshness}): ${errorMessage}`);

          // Extract HTTP status if available
          let httpStatus: number | undefined;
          if (error instanceof SerperError && 'statusCode' in error) {
            httpStatus = (error as any).statusCode;
          } else if (errorMessage.includes('429')) {
            httpStatus = 429;
          } else if (errorMessage.includes('401')) {
            httpStatus = 401;
          } else if (errorMessage.includes('403')) {
            httpStatus = 403;
          }

          // Track failure details
          lastProviderFailure = {
            provider: 'serper',
            query,
            reason: failureReason,
            latency: providerLatency,
            raw_count: 0,
            normalized_count: 0,
            accepted_count: 0,
            http_status: httpStatus,
            error_message: errorMessage,
          };

          logger.warn('Serper provider failed with freshness', {
            event: 'provider_failure',
            requestId,
            provider: 'serper',
            freshness: freshness,
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
      providerFailureDetails: lastProviderFailure,
    };
  }

  /**
   * Try web search as fallback for historical claims
   * 
   * @param query - Search query
   * @param requestId - Optional request ID for logging
   * @returns Promise resolving to grounding bundle
   */
  private async tryWebSearch(query: string, requestId?: string): Promise<GroundingBundle> {
    const startTime = Date.now();
    const errors: string[] = [];

    if (!this.bingWebClient) {
      logger.warn('Web search not available', {
        event: 'web_search_unavailable',
        requestId,
      });
      return {
        sources: [],
        providerUsed: 'none',
        query,
        latencyMs: Date.now() - startTime,
        errors: ['Web search client not configured'],
        attemptedProviders: ['web'],
        retrievalMode: 'web_knowledge',
      };
    }

    logger.info('Attempting web search fallback', {
      event: 'web_search_attempt',
      requestId,
      retrieval_mode: 'web_knowledge',
    });

    try {
      const results = await this.bingWebClient.search(query);
      const rawCount = results.length;
      const providerLatency = Date.now() - startTime;

      if (results.length > 0) {
        const normalized = normalizeBingWebResults(results);
        const deduplicated = deduplicate(normalized);
        const ranked = rankAndCap(deduplicated, query, this.maxResults);

        logger.info('Web search succeeded', {
          event: 'web_search_success',
          requestId,
          latency_ms: providerLatency,
          sources_raw: rawCount,
          sources_returned: ranked.length,
          retrieval_mode: 'web_knowledge',
        });

        return {
          sources: ranked,
          providerUsed: 'bing_web',
          query,
          latencyMs: Date.now() - startTime,
          attemptedProviders: ['web'],
          sourcesCountRaw: rawCount,
          retrievalMode: 'web_knowledge',
        };
      }

      logger.warn('Web search returned zero results', {
        event: 'web_search_zero_results',
        requestId,
        latency_ms: providerLatency,
      });
    } catch (error) {
      const providerLatency = Date.now() - startTime;
      const errorMessage =
        error instanceof BingWebSearchError ? error.message : 'Unknown web search error';

      // Check for rate-limit, quota, or throttling errors
      const isRateLimit = errorMessage.toLowerCase().includes('rate limit') || errorMessage.toLowerCase().includes('429') || errorMessage.toLowerCase().includes('too many requests');
      const isQuota = errorMessage.toLowerCase().includes('quota exceeded') || errorMessage.toLowerCase().includes('subscription limit');
      const isThrottled = errorMessage.toLowerCase().includes('throttled') || errorMessage.toLowerCase().includes('slow down');

      // Set cooldown for rate-limit, quota, or throttling errors
      if (isRateLimit || isQuota || isThrottled) {
        const cooldownMs = isRateLimit ? 5 * 60 * 1000 : 2 * 60 * 1000;
        const reason = isRateLimit ? 'rate_limit' : isQuota ? 'quota_exceeded' : 'throttled';
        this.setProviderCooldown('bing_web', reason, cooldownMs);
      }

      errors.push(`Web: ${errorMessage}`);

      logger.warn('Web search failed', {
        event: 'web_search_failure',
        requestId,
        latency_ms: providerLatency,
        error: errorMessage.substring(0, 100),
      });
    }

    return {
      sources: [],
      providerUsed: 'none',
      query,
      latencyMs: Date.now() - startTime,
      errors,
      attemptedProviders: ['web'],
      retrievalMode: 'web_knowledge',
    };
  }

  /**
   * Try providers with adaptive freshness strategy
   * Cascades through broader time windows (7d → 30d → 1y) and web search when initial attempts fail
   * Uses historical claim detection to determine optimal retrieval strategy
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
    const errors: string[] = [];
    let lastProviderFailure: {
      provider: string;
      query: string;
      reason: string;
      latency: number;
      raw_count: number;
      normalized_count: number;
      accepted_count: number;
      http_status?: number;
      error_message: string;
    } | undefined;

    // Demo mode: skip adaptive freshness, use original behavior
    if (demoMode) {
      logger.info('Demo mode: skipping adaptive freshness', {
        event: 'adaptive_freshness_skip_demo',
        requestId,
      });
      return this.tryProviders(query, requestId);
    }

    // Detect if claim is historical to determine retrieval strategy
    const historicalDetection = detectHistoricalClaim(query);
    const strategies = getSuggestedFreshnessStrategies(query);

    logger.info('Starting adaptive freshness cascade with historical detection', {
      event: 'adaptive_freshness_start',
      requestId,
      is_historical: historicalDetection.isHistorical,
      confidence: historicalDetection.confidence,
      retrieval_mode: historicalDetection.retrievalMode,
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

      let bundle: GroundingBundle;

      // Handle web search strategy
      if (strategy === 'web') {
        bundle = await this.tryWebSearch(query, requestId);
      } else {
        bundle = await this.tryProvidersWithFreshness(query, strategy, requestId);
        
        // Add retrieval mode metadata based on strategy
        bundle.retrievalMode = strategy === '7d' ? 'news_recent' : 'news_historical';
      }

      if (bundle.sources.length > 0) {
        logger.info('Adaptive freshness succeeded', {
          event: 'adaptive_freshness_success',
          requestId,
          strategy,
          retry_count: i,
          sources_found: bundle.sources.length,
          retrieval_mode: bundle.retrievalMode,
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
      
      // Track last provider failure
      if (bundle.providerFailureDetails) {
        lastProviderFailure = bundle.providerFailureDetails;
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
      attemptedProviders: ['bing', 'gdelt', 'web'],
      retrievalMode: historicalDetection.retrievalMode,
      providerFailureDetails: lastProviderFailure,
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
      mediastack_configured: this.mediastackClient !== null,
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

    // Provider cooldown tracking
    private providerCooldowns: Map<string, { until: number; reason: string }> = new Map();

    // Short-term rate-limit cache (2-5 minute TTL)
    private rateLimitCache: Map<string, { timestamp: number; reason: string; ttlMs: number }> = new Map();

    /**
     * Get provider cooldown status
     *
     * @param provider - Provider name to check
     * @returns Cooldown info if active, undefined otherwise
     */
    getProviderCooldown(provider: string): { until: number; reason: string } | undefined {
      const cooldown = this.providerCooldowns.get(provider);

      if (!cooldown) {
        return undefined;
      }

      // Check if cooldown has expired
      if (Date.now() >= cooldown.until) {
        this.providerCooldowns.delete(provider);
        return undefined;
      }

      return cooldown;
    }

    /**
     * Set provider cooldown
     *
     * @param provider - Provider name to set cooldown for
     * @param reason - Reason for cooldown (e.g., "rate_limit", "quota_exceeded")
     * @param durationMs - Cooldown duration in milliseconds
     */
    setProviderCooldown(provider: string, reason: string, durationMs: number): void {
      const until = Date.now() + durationMs;
      this.providerCooldowns.set(provider, { until, reason });

      logger.info('Provider cooldown set', {
        event: 'provider_cooldown_set',
        provider,
        reason,
        duration_ms: durationMs,
        until_timestamp: until,
      });
    }

    /**
     * Get cached rate-limit error for provider
     *
     * @param provider - Provider name to check
     * @returns Cached rate-limit info if active, undefined otherwise
     */
    getRateLimitCached(provider: string): { timestamp: number; reason: string } | undefined {
      const cached = this.rateLimitCache.get(provider);

      if (!cached) {
        return undefined;
      }

      // Check if cache entry has expired
      const age = Date.now() - cached.timestamp;
      if (age >= cached.ttlMs) {
        this.rateLimitCache.delete(provider);
        return undefined;
      }

      return {
        timestamp: cached.timestamp,
        reason: cached.reason,
      };
    }

    /**
     * Set rate-limit cache entry for provider
     *
     * @param provider - Provider name to cache rate-limit for
     * @param reason - Reason for rate-limit (e.g., "rate_limit", "quota_exceeded")
     * @param ttlMs - Cache TTL in milliseconds (default: 2-5 minutes)
     */
    setRateLimitCache(provider: string, reason: string, ttlMs: number = 180000): void {
      const timestamp = Date.now();
      this.rateLimitCache.set(provider, { timestamp, reason, ttlMs });

      logger.info('Rate-limit cache entry set', {
        event: 'rate_limit_cache_set',
        provider,
        reason,
        ttl_ms: ttlMs,
        timestamp,
      });
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

/**
 * Get provider cooldown status (for orchestrator use)
 * 
 * @param provider - Provider name to check
 * @returns Cooldown info if active, undefined otherwise
 */
export function getProviderCooldown(provider: string): { until: number; reason: string } | undefined {
  const service = getGroundingService();
  return service.getProviderCooldown(provider);
}

/**
 * Set provider cooldown (for orchestrator use)
 * 
 * @param provider - Provider name to set cooldown for
 * @param reason - Reason for cooldown (e.g., "rate_limit", "quota_exceeded")
 * @param durationMs - Cooldown duration in milliseconds
 */
export function setProviderCooldown(provider: string, reason: string, durationMs: number): void {
  const service = getGroundingService();
  service.setProviderCooldown(provider, reason, durationMs);
}

/**
 * Get cached rate-limit error for provider (for orchestrator use)
 * 
 * @param provider - Provider name to check
 * @returns Cached rate-limit info if active, undefined otherwise
 */
export function getRateLimitCached(provider: string): { timestamp: number; reason: string } | undefined {
  const service = getGroundingService();
  return service.getRateLimitCached(provider);
}

import type { TextGroundingBundle, NormalizedSourceWithStance, ReasonCode, SingleQueryGroundingResult } from '../types/grounding';
import { generateQueries } from '../utils/queryBuilder';
import { classifyStance } from './stanceClassifier';
import { assignCredibilityTier, deduplicateByTitleSimilarity } from './sourceNormalizer';

/**
 * Ground a single query without multi-query generation (for orchestrator use)
 * 
 * This function is designed for the orchestrator which generates its own queries.
 * It executes a single query directly without generating additional query variants.
 * 
 * @param query - Single search query to execute
 * @param requestId - Optional request ID for logging
 * @param demoMode - Optional demo mode flag
 * @returns Promise resolving to single query grounding result
 */
export async function groundSingleQuery(
  query: string,
  requestId?: string,
  demoMode = false
): Promise<SingleQueryGroundingResult> {
  const startTime = Date.now();

  logger.info('Single query grounding start', {
    event: 'single_query_grounding_start',
    requestId,
    query: query.substring(0, 100),
    demo_mode: demoMode,
  });

  // Demo mode: return deterministic bundle
  if (demoMode) {
    const { getDemoTextGroundingBundle } = await import('../utils/demoGrounding');
    const bundle = getDemoTextGroundingBundle(query);
    
    const sourcesWithStance: NormalizedSourceWithStance[] = bundle.sources.map(s => ({
      ...s,
      stance: 'mentions' as const,
      provider: 'demo' as const,
      credibilityTier: 2 as const,
    }));

    logger.info('Demo mode single query grounding', {
      event: 'single_query_grounding_demo_mode',
      requestId,
      sources_count: sourcesWithStance.length,
    });

    return {
      sources: sourcesWithStance,
      provider: 'demo',
      latencyMs: Date.now() - startTime,
      cacheHit: false,
    };
  }

  // Get grounding service instance
  const service = getGroundingService();

  // Check if grounding is enabled
  if (!service['enabled']) {
    logger.info('Single query grounding disabled', {
      event: 'single_query_grounding_disabled',
      requestId,
    });
    return {
      sources: [],
      provider: 'none',
      latencyMs: Date.now() - startTime,
      cacheHit: false,
      errors: ['Grounding disabled by configuration'],
    };
  }

  // Execute single query
  const result = await service.ground(query, undefined, requestId, false);

  logger.info('Single query grounding complete', {
    event: 'single_query_grounding_complete',
    requestId,
    query: query.substring(0, 100),
    provider_used: result.providerUsed,
    sources_count: result.sources.length,
    cache_hit: result.cacheHit,
    latency_ms: Date.now() - startTime,
  });

  // Convert to sources with stance
  const sourcesWithStance: NormalizedSourceWithStance[] = result.sources.map(source => ({
    ...source,
    stance: 'mentions' as const,
    stanceJustification: undefined,
    provider: result.providerUsed,
    credibilityTier: assignCredibilityTier(source.domain),
  }));

  return {
    sources: sourcesWithStance,
    provider: result.providerUsed,
    latencyMs: Date.now() - startTime,
    cacheHit: result.cacheHit || false,
    errors: result.errors,
    sourcesCountRaw: result.sourcesCountRaw,
  };
}

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

  // Check claim cache before executing queries
  const { getCachedClaimResult } = await import('./groundingCache');
  const cachedResult = getCachedClaimResult(text);
  if (cachedResult) {
    logger.info('Claim cache hit', {
      event: 'claim_cache_hit',
      requestId,
      sources_count: cachedResult.sources.length,
      cached_latency_ms: cachedResult.latencyMs,
    });
    return {
      ...cachedResult,
      cacheHit: true,
      latencyMs: Date.now() - startTime,
    };
  }

  logger.info('Claim cache miss', {
    event: 'claim_cache_miss',
    requestId,
  });

  // Generate queries from text
  const queryResult = generateQueries(text);
  const queries = queryResult.queries;

  logger.info('Query generation complete', {
    event: 'query_generation_complete',
    requestId,
    queries_generated: queries.length,
    queries: queries,
    has_recency_hint: queryResult.metadata.hasRecencyHint,
    entities_extracted: queryResult.metadata.entitiesExtracted,
    key_phrases_extracted: queryResult.metadata.keyPhrasesExtracted,
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

  // Log each query result
  queryResults.forEach((result, index) => {
    logger.info('Query result received', {
      event: 'query_result_received',
      requestId,
      query_index: index,
      query: queries[index],
      provider_used: result.providerUsed,
      sources_count: result.sources.length,
      cache_hit: result.cacheHit,
      had_errors: (result.errors?.length || 0) > 0,
    });
  });

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
    if (!service['mediastackClient'] && !service['bingClient'] && !service['gdeltClient']) {
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
      errors: errors.length > 0 ? errors : undefined,
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

  logger.info('URL deduplication complete', {
    event: 'url_deduplication_complete',
    requestId,
    sources_before: allSources.length,
    sources_after: uniqueByUrl.length,
    duplicates_removed: allSources.length - uniqueByUrl.length,
  });

  // Deduplicate by title similarity
  const deduplicated = deduplicateByTitleSimilarity(uniqueByUrl, 0.8);

  logger.info('Title deduplication complete', {
    event: 'title_deduplication_complete',
    requestId,
    sources_before: uniqueByUrl.length,
    sources_after: deduplicated.length,
    duplicates_removed: uniqueByUrl.length - deduplicated.length,
  });

  // Classify stance for each source
  const sourcesWithStance: NormalizedSourceWithStance[] = deduplicated.map((source) => {
    const stanceResult = classifyStance(text, source.title, source.snippet, source.domain);
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

  logger.info('Stance classification complete', {
    event: 'stance_classification_complete',
    requestId,
    sources_classified: sourcesWithStance.length,
    stance_distribution: {
      supports: sourcesWithStance.filter((s) => s.stance === 'supports').length,
      contradicts: sourcesWithStance.filter((s) => s.stance === 'contradicts').length,
      mentions: sourcesWithStance.filter((s) => s.stance === 'mentions').length,
      unclear: sourcesWithStance.filter((s) => s.stance === 'unclear').length,
    },
  });

  // Rank by combined score (relevance + credibility + recency + diversity)
  const ranked = rankSourcesWithStance(sourcesWithStance, text);

  logger.info('Ranking complete', {
    event: 'ranking_complete',
    requestId,
    sources_ranked: ranked.length,
    top_3_scores: ranked.slice(0, 3).map(s => s.score),
  });

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
    providers_used: Array.from(providersUsed),
  });

  // Log sample source for debugging
  if (finalSources.length > 0) {
    logger.info('Sample final source', {
      event: 'sample_final_source',
      requestId,
      sample: {
        url: finalSources[0].url,
        title: finalSources[0].title,
        domain: finalSources[0].domain,
        provider: finalSources[0].provider,
        stance: finalSources[0].stance,
        score: finalSources[0].score,
        credibilityTier: finalSources[0].credibilityTier,
      },
    });
  }

  // Store result in claim cache
  const result: TextGroundingBundle = {
    sources: finalSources,
    queries,
    providerUsed: Array.from(providersUsed),
    sourcesCount: finalSources.length,
    cacheHit: false,
    latencyMs: Date.now() - startTime,
  };

  const { setCachedClaimResult } = await import('./groundingCache');
  setCachedClaimResult(text, result);

  return result;
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
