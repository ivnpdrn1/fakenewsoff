/**
 * Mediastack News API Client
 *
 * Provides real-time news article retrieval from Mediastack API
 * https://mediastack.com/documentation
 */

import { getEnv } from '../utils/envValidation';

/**
 * Mediastack API response types
 */
export interface MediastackArticle {
  title: string;
  url: string;
  source: string;
  published_at: string;
  description: string;
  image?: string;
  category?: string;
  language?: string;
  country?: string;
}

export interface MediastackResponse {
  pagination: {
    limit: number;
    offset: number;
    count: number;
    total: number;
  };
  data: MediastackArticle[];
}

export interface MediastackSearchOptions {
  keywords: string;
  languages?: string;
  limit?: number;
  offset?: number;
  sort?: 'published_desc' | 'published_asc' | 'popularity';
}

/**
 * Mediastack API error
 */
export class MediastackError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'MediastackError';
  }
}

/**
 * Mediastack News API Client
 */
export class MediastackClient {
  private apiKey: string;
  private baseUrl = 'http://api.mediastack.com/v1';
  private timeout: number;

  constructor() {
    const env = getEnv();

    if (!env.MEDIASTACK_API_KEY) {
      throw new MediastackError(
        'MEDIASTACK_API_KEY environment variable is required',
        undefined,
        'MISSING_API_KEY'
      );
    }

    this.apiKey = env.MEDIASTACK_API_KEY;
    this.timeout = parseInt(env.MEDIASTACK_TIMEOUT_MS || '5000', 10);
  }

  /**
   * Search news articles by keywords
   *
   * @param options - Search options
   * @returns Promise resolving to Mediastack response
   * @throws MediastackError if request fails
   */
  async searchNews(options: MediastackSearchOptions): Promise<MediastackResponse> {
    const { keywords, languages = 'en', limit = 5, offset = 0, sort = 'published_desc' } = options;

    // Build query parameters
    const params = new URLSearchParams({
      access_key: this.apiKey,
      keywords: keywords,
      languages: languages,
      limit: limit.toString(),
      offset: offset.toString(),
      sort: sort,
    });

    const url = `${this.baseUrl}/news?${params.toString()}`;

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new MediastackError(
          errorData.error?.message || `Mediastack API returned ${response.status}`,
          response.status,
          errorData.error?.code
        );
      }

      const data: MediastackResponse = await response.json();

      // Validate response structure
      if (!data.data || !Array.isArray(data.data)) {
        throw new MediastackError(
          'Invalid response structure from Mediastack API',
          undefined,
          'INVALID_RESPONSE'
        );
      }

      return data;
    } catch (error) {
      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw new MediastackError(
          `Mediastack API request timed out after ${this.timeout}ms`,
          undefined,
          'TIMEOUT'
        );
      }

      // Handle network errors
      if (error instanceof Error && error.message.includes('fetch')) {
        throw new MediastackError(
          `Network error calling Mediastack API: ${error.message}`,
          undefined,
          'NETWORK_ERROR'
        );
      }

      // Re-throw MediastackError
      if (error instanceof MediastackError) {
        throw error;
      }

      // Unknown error
      throw new MediastackError(
        `Unexpected error calling Mediastack API: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Get health status of Mediastack API
   *
   * @returns Promise resolving to boolean indicating if API is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Make a minimal request to check API availability
      await this.searchNews({
        keywords: 'test',
        limit: 1,
      });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Extract domain from URL
 *
 * @param url - Full URL
 * @returns Domain name (e.g., "example.com")
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

/**
 * Validate URL format
 *
 * @param url - URL to validate
 * @returns True if URL is valid http/https URL
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}
