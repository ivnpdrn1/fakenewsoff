/**
 * Serper.dev News API Client
 *
 * Provides real-time news article retrieval from Serper.dev Google News API
 * https://serper.dev/docs
 */

import { getEnv } from '../utils/envValidation';

/**
 * Serper API response types
 */
export interface SerperNewsArticle {
  title: string;
  link: string;
  snippet: string;
  date: string;
  source: string;
  imageUrl?: string;
  position?: number;
}

export interface SerperNewsResponse {
  news: SerperNewsArticle[];
  searchParameters?: {
    q: string;
    type: string;
    engine: string;
  };
}

export interface SerperSearchOptions {
  q: string;
  num?: number;
  tbs?: string; // Time-based search (e.g., "qdr:d" for past day, "qdr:w" for past week)
  location?: string;
}

/**
 * Serper API error
 */
export class SerperError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'SerperError';
  }
}

/**
 * Serper News API Client
 */
export class SerperClient {
  private apiKey: string;
  private baseUrl = 'https://google.serper.dev';
  private timeout: number;

  constructor() {
    const env = getEnv();

    // Check for API key presence - handle both undefined and empty string
    const apiKey = env.SERPER_API_KEY?.trim();
    if (!apiKey) {
      throw new SerperError(
        'SERPER_API_KEY environment variable is required',
        undefined,
        'MISSING_API_KEY'
      );
    }

    this.apiKey = apiKey;
    this.timeout = parseInt(env.SERPER_TIMEOUT_MS || '5000', 10);
  }

  /**
   * Search news articles by query
   *
   * @param options - Search options
   * @returns Promise resolving to Serper response
   * @throws SerperError if request fails
   */
  async searchNews(options: SerperSearchOptions): Promise<SerperNewsResponse> {
    const { q, num = 10, tbs, location } = options;

    // Build request body
    const body: Record<string, unknown> = {
      q,
      num,
    };

    if (tbs) {
      body.tbs = tbs;
    }

    if (location) {
      body.location = location;
    }

    const url = `${this.baseUrl}/news`;

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      clearTimeout(timeoutId);

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Check for specific error types
        if (response.status === 401) {
          throw new SerperError(
            'Unauthorized: Invalid Serper API key',
            401,
            'UNAUTHORIZED'
          );
        }
        
        if (response.status === 403) {
          throw new SerperError(
            'Forbidden: Serper API access denied',
            403,
            'FORBIDDEN'
          );
        }
        
        if (response.status === 429) {
          throw new SerperError(
            'Rate limit exceeded for Serper API',
            429,
            'RATE_LIMIT'
          );
        }

        throw new SerperError(
          errorData.message || `Serper API returned ${response.status}`,
          response.status,
          errorData.code || 'API_ERROR'
        );
      }

      const data: SerperNewsResponse = await response.json();

      // Validate response structure
      if (!data.news || !Array.isArray(data.news)) {
        throw new SerperError(
          'Invalid response structure from Serper API',
          undefined,
          'INVALID_RESPONSE'
        );
      }

      return data;
    } catch (error) {
      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw new SerperError(
          `Serper API request timed out after ${this.timeout}ms`,
          undefined,
          'TIMEOUT'
        );
      }

      // Handle network errors
      if (error instanceof Error && error.message.includes('fetch')) {
        throw new SerperError(
          `Network error calling Serper API: ${error.message}`,
          undefined,
          'NETWORK_ERROR'
        );
      }

      // Re-throw SerperError
      if (error instanceof SerperError) {
        throw error;
      }

      // Unknown error
      throw new SerperError(
        `Unexpected error calling Serper API: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        'UNKNOWN_ERROR'
      );
    }
  }

  /**
   * Get health status of Serper API
   *
   * @returns Promise resolving to boolean indicating if API is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Make a minimal request to check API availability
      await this.searchNews({
        q: 'test',
        num: 1,
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
