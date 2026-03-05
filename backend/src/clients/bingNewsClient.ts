/**
 * Bing News API Client
 *
 * Client for Bing News Search API with timeout and retry logic
 *
 * Validates: Requirements FR2.1, FR2.4, NFR2.1, NFR2.2
 */

import fetch from 'node-fetch';
import { BingNewsArticle, BingSearchOptions } from '../types/grounding';
import { getEnv } from '../utils/envValidation';
import { logger } from '../utils/logger';

/**
 * Bing News API error
 */
export class BingNewsError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'BingNewsError';
  }
}

/**
 * Bing News API client
 */
export class BingNewsClient {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor() {
    const env = getEnv();
    this.endpoint = env.BING_NEWS_ENDPOINT || 'https://api.bing.microsoft.com/v7.0/news/search';
    this.apiKey = env.BING_NEWS_KEY || '';
    this.timeout = parseInt(env.GROUNDING_TIMEOUT_MS || '3500', 10);

    if (!this.apiKey) {
      throw new BingNewsError('BING_NEWS_KEY not configured');
    }
  }

  /**
   * Search Bing News API for articles matching query
   *
   * @param query - Search query string
   * @param options - Search options (count, freshness, market)
   * @returns Promise resolving to array of news articles
   * @throws BingNewsError on API errors (with retry logic)
   */
  async search(query: string, options?: BingSearchOptions): Promise<BingNewsArticle[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const params = new URLSearchParams({
      q: query.trim(),
      count: String(options?.count ?? 10),
      freshness: options?.freshness ?? 'Week',
      mkt: options?.market ?? 'en-US',
      safeSearch: options?.safeSearch ?? 'Moderate',
    });

    const url = `${this.endpoint}?${params.toString()}`;

    logger.debug('Bing News API request', {
      event: 'bing_request',
      query: query.substring(0, 100),
      count: options?.count ?? 10,
      freshness: options?.freshness ?? 'Week',
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
          logger.warn('Bing News API error response', {
            event: 'bing_error',
            status: response.status,
            attempt: attempt + 1,
            max_attempts: maxAttempts,
          });
          throw new BingNewsError(
            `Bing News API error: ${response.status} ${response.statusText} - ${errorText}`,
            response.status
          );
        }

        const data = (await response.json()) as { value?: BingNewsArticle[] };

        if (!data.value || !Array.isArray(data.value)) {
          logger.warn('Bing News API returned no articles', {
            event: 'bing_no_results',
            query: query.substring(0, 100),
          });
          return [];
        }

        logger.debug('Bing News API success', {
          event: 'bing_success',
          results_count: data.value.length,
          attempt: attempt + 1,
        });

        return data.value;
      } catch (error) {
        const isLastAttempt = attempt === maxAttempts - 1;

        // Handle abort (timeout)
        if (error instanceof Error && error.name === 'AbortError') {
          logger.warn('Bing News API timeout', {
            event: 'bing_timeout',
            timeout_ms: this.timeout,
            attempt: attempt + 1,
            max_attempts: maxAttempts,
            will_retry: !isLastAttempt,
          });
          if (isLastAttempt) {
            throw new BingNewsError(
              `Bing News API timeout after ${this.timeout}ms`,
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
          logger.warn('Bing News API network error', {
            event: 'bing_network_error',
            error_message: error.message,
            attempt: attempt + 1,
            max_attempts: maxAttempts,
            will_retry: !isLastAttempt,
          });
          if (isLastAttempt) {
            throw new BingNewsError(
              `Bing News API network error: ${error.message}`,
              undefined,
              error
            );
          }
          // Retry on network error
          await this.delay(delays[attempt]);
          continue;
        }

        // Unknown error
        logger.error('Bing News API unknown error', {
          event: 'bing_unknown_error',
          attempt: attempt + 1,
        });
        throw new BingNewsError(
          'Bing News API unknown error',
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
