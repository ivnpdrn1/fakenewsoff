/**
 * Bing Web Search API Client
 *
 * Client for Bing Web Search API for fallback when news APIs return zero results
 * Used for historical claims and knowledge retrieval
 */

import fetch from 'node-fetch';
import { getEnv } from '../utils/envValidation';
import { logger } from '../utils/logger';

/**
 * Bing Web Search result
 */
export interface BingWebResult {
  /** Result title */
  name: string;
  /** Result URL */
  url: string;
  /** Result snippet */
  snippet: string;
  /** Date last crawled (ISO8601) */
  dateLastCrawled?: string;
  /** Display URL */
  displayUrl?: string;
}

/**
 * Bing Web Search options
 */
export interface BingWebSearchOptions {
  /** Max results (default: 10) */
  count?: number;
  /** Market code (default: 'en-US') */
  market?: string;
  /** Safe search (default: 'Moderate') */
  safeSearch?: 'Off' | 'Moderate' | 'Strict';
  /** Freshness filter (optional) */
  freshness?: 'Day' | 'Week' | 'Month' | 'Year';
}

/**
 * Bing Web Search API error
 */
export class BingWebSearchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'BingWebSearchError';
  }
}

/**
 * Bing Web Search API client
 */
export class BingWebClient {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor() {
    const env = getEnv();
    this.endpoint = 'https://api.bing.microsoft.com/v7.0/search';
    this.apiKey = env.BING_NEWS_KEY || ''; // Reuse Bing News API key
    this.timeout = parseInt(env.GROUNDING_TIMEOUT_MS || '3500', 10);

    if (!this.apiKey) {
      throw new BingWebSearchError('BING_NEWS_KEY not configured (required for web search)');
    }
  }

  /**
   * Search Bing Web Search API for web pages matching query
   *
   * @param query - Search query string
   * @param options - Search options
   * @returns Promise resolving to array of web results
   * @throws BingWebSearchError on API errors
   */
  async search(query: string, options?: BingWebSearchOptions): Promise<BingWebResult[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const params = new URLSearchParams({
      q: query.trim(),
      count: String(options?.count ?? 10),
      mkt: options?.market ?? 'en-US',
      safeSearch: options?.safeSearch ?? 'Moderate',
    });

    // Add freshness filter if specified
    if (options?.freshness) {
      params.append('freshness', options.freshness);
    }

    const url = `${this.endpoint}?${params.toString()}`;

    logger.debug('Bing Web Search API request', {
      event: 'bing_web_request',
      query: query.substring(0, 100),
      count: options?.count ?? 10,
      freshness: options?.freshness || 'none',
    });

    // Retry with exponential backoff: 2 attempts, 200ms/400ms delays
    const maxAttempts = 2;
    const delays = [200, 400];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey,
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          logger.warn('Bing Web Search API error response', {
            event: 'bing_web_error',
            status: response.status,
            attempt: attempt + 1,
            max_attempts: maxAttempts,
          });
          throw new BingWebSearchError(
            `Bing Web Search API error: ${response.status} ${response.statusText} - ${errorText}`,
            response.status
          );
        }

        const data = (await response.json()) as { webPages?: { value?: BingWebResult[] } };

        if (!data.webPages?.value || !Array.isArray(data.webPages.value)) {
          logger.warn('Bing Web Search API returned no results', {
            event: 'bing_web_no_results',
            query: query.substring(0, 100),
          });
          return [];
        }

        logger.debug('Bing Web Search API success', {
          event: 'bing_web_success',
          results_count: data.webPages.value.length,
          attempt: attempt + 1,
        });

        return data.webPages.value;
      } catch (error) {
        const isLastAttempt = attempt === maxAttempts - 1;

        // Handle abort (timeout)
        if (error instanceof Error && error.name === 'AbortError') {
          logger.warn('Bing Web Search API timeout', {
            event: 'bing_web_timeout',
            timeout_ms: this.timeout,
            attempt: attempt + 1,
            max_attempts: maxAttempts,
            will_retry: !isLastAttempt,
          });
          if (isLastAttempt) {
            throw new BingWebSearchError(
              `Bing Web Search API timeout after ${this.timeout}ms`,
              undefined,
              error
            );
          }
          // Retry on timeout
          await this.delay(delays[attempt]);
          continue;
        }

        // Handle network errors
        if (error instanceof Error) {
          logger.warn('Bing Web Search API network error', {
            event: 'bing_web_network_error',
            error_message: error.message,
            attempt: attempt + 1,
            max_attempts: maxAttempts,
            will_retry: !isLastAttempt,
          });
          if (isLastAttempt) {
            throw new BingWebSearchError(
              `Bing Web Search API network error: ${error.message}`,
              undefined,
              error
            );
          }
          // Retry on network error
          await this.delay(delays[attempt]);
          continue;
        }

        // Unknown error
        logger.error('Bing Web Search API unknown error', {
          event: 'bing_web_unknown_error',
          attempt: attempt + 1,
        });
        throw new BingWebSearchError(
          'Bing Web Search API unknown error',
          undefined,
          error instanceof Error ? error : undefined
        );
      }
    }

    // Should never reach here
    return [];
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
