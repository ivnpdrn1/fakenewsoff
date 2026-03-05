/**
 * GDELT Document API Client
 *
 * Client for GDELT Document API with timeout and retry logic
 *
 * Validates: Requirements FR2.2, FR2.4, NFR2.1, NFR2.2
 */

import fetch from 'node-fetch';
import { GDELTArticle, GDELTSearchOptions } from '../types/grounding';
import { getEnv } from '../utils/envValidation';
import { logger } from '../utils/logger';

/**
 * GDELT API error
 */
export class GDELTError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'GDELTError';
  }
}

/**
 * GDELT Document API client
 */
export class GDELTClient {
  private readonly endpoint: string;
  private readonly timeout: number;

  constructor() {
    const env = getEnv();
    this.endpoint = env.GDELT_DOC_ENDPOINT || 'https://api.gdeltproject.org/api/v2/doc/doc';
    this.timeout = parseInt(env.GROUNDING_TIMEOUT_MS || '3500', 10);
  }

  /**
   * Search GDELT Document API for articles matching query
   *
   * @param query - Search query string
   * @param options - Search options (maxrecords, timespan, mode)
   * @returns Promise resolving to array of news articles
   * @throws GDELTError on API errors (with retry logic)
   */
  async search(query: string, options?: GDELTSearchOptions): Promise<GDELTArticle[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const params = new URLSearchParams({
      query: query.trim(),
      maxrecords: String(options?.maxrecords ?? 10),
      timespan: options?.timespan ?? '7d',
      mode: options?.mode ?? 'artlist',
      format: options?.format ?? 'json',
    });

    const url = `${this.endpoint}?${params.toString()}`;

    logger.debug('GDELT API request', {
      event: 'gdelt_request',
      query: query.substring(0, 100),
      maxrecords: options?.maxrecords ?? 10,
      timespan: options?.timespan ?? '7d',
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
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          logger.warn('GDELT API error response', {
            event: 'gdelt_error',
            status: response.status,
            attempt: attempt + 1,
            max_attempts: maxAttempts,
          });
          throw new GDELTError(
            `GDELT API error: ${response.status} ${response.statusText} - ${errorText}`,
            response.status
          );
        }

        const data = (await response.json()) as { articles?: GDELTArticle[] };

        if (!data.articles || !Array.isArray(data.articles)) {
          logger.warn('GDELT API returned no articles', {
            event: 'gdelt_no_results',
            query: query.substring(0, 100),
          });
          return [];
        }

        logger.debug('GDELT API success', {
          event: 'gdelt_success',
          results_count: data.articles.length,
          attempt: attempt + 1,
        });

        return data.articles;
      } catch (error) {
        const isLastAttempt = attempt === maxAttempts - 1;

        // Handle abort (timeout)
        if (error instanceof Error && error.name === 'AbortError') {
          logger.warn('GDELT API timeout', {
            event: 'gdelt_timeout',
            timeout_ms: this.timeout,
            attempt: attempt + 1,
            max_attempts: maxAttempts,
            will_retry: !isLastAttempt,
          });
          if (isLastAttempt) {
            throw new GDELTError(`GDELT API timeout after ${this.timeout}ms`, undefined, error);
          }
          // Retry on timeout
          await this.delay(delays[attempt]);
          continue;
        }

        // Handle network errors
        if (error instanceof Error) {
          logger.warn('GDELT API network error', {
            event: 'gdelt_network_error',
            error_message: error.message,
            attempt: attempt + 1,
            max_attempts: maxAttempts,
            will_retry: !isLastAttempt,
          });
          if (isLastAttempt) {
            throw new GDELTError(`GDELT API network error: ${error.message}`, undefined, error);
          }
          // Retry on network error
          await this.delay(delays[attempt]);
          continue;
        }

        // Unknown error
        logger.error('GDELT API unknown error', {
          event: 'gdelt_unknown_error',
          attempt: attempt + 1,
        });
        throw new GDELTError(
          'GDELT API unknown error',
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
