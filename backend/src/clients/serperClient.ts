/**
 * Serper.dev News API Client
 *
 * Provides real-time news article retrieval from Serper.dev Google News API
 * https://serper.dev/docs
 */

import { getEnv } from '../utils/envValidation';
import https from 'https';

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
  /**
   * Search news articles by query (using native https module as fallback)
   *
   * @param options - Search options
   * @returns Promise resolving to Serper response
   * @throws SerperError if request fails
   */
  async searchNewsWithHttps(options: SerperSearchOptions): Promise<SerperNewsResponse> {
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

    const bodyString = JSON.stringify(body);

    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: 'google.serper.dev',
        port: 443,
        path: '/news',
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyString),
        },
        timeout: this.timeout,
      };

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'serperClient',
        event: 'SERPER_HTTPS_REQUEST_START',
        hostname: requestOptions.hostname,
        path: requestOptions.path,
        method: requestOptions.method,
        timeout_ms: this.timeout,
      }));

      const req = https.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            service: 'serperClient',
            event: 'SERPER_HTTPS_RESPONSE_RECEIVED',
            status: res.statusCode,
            status_message: res.statusMessage,
          }));

          if (res.statusCode === 200) {
            try {
              const parsed: SerperNewsResponse = JSON.parse(data);
              if (!parsed.news || !Array.isArray(parsed.news)) {
                reject(new SerperError(
                  'Invalid response structure from Serper API',
                  undefined,
                  'INVALID_RESPONSE'
                ));
              } else {
                resolve(parsed);
              }
            } catch (error) {
              reject(new SerperError(
                'Failed to parse Serper API response',
                undefined,
                'PARSE_ERROR'
              ));
            }
          } else if (res.statusCode === 401) {
            reject(new SerperError(
              'Unauthorized: Invalid Serper API key',
              401,
              'UNAUTHORIZED'
            ));
          } else if (res.statusCode === 403) {
            reject(new SerperError(
              'Forbidden: Serper API access denied',
              403,
              'FORBIDDEN'
            ));
          } else if (res.statusCode === 429) {
            reject(new SerperError(
              'Rate limit exceeded for Serper API',
              429,
              'RATE_LIMIT'
            ));
          } else {
            reject(new SerperError(
              `Serper API returned ${res.statusCode}: ${data}`,
              res.statusCode,
              'API_ERROR'
            ));
          }
        });
      });

      req.on('error', (error) => {
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          service: 'serperClient',
          event: 'SERPER_HTTPS_ERROR',
          error_message: error.message,
          error_code: (error as any).code,
          error_errno: (error as any).errno,
          error_syscall: (error as any).syscall,
        }));

        reject(new SerperError(
          `Network error calling Serper API: ${error.message}`,
          undefined,
          'NETWORK_ERROR'
        ));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new SerperError(
          `Serper API request timed out after ${this.timeout}ms`,
          undefined,
          'TIMEOUT'
        ));
      });

      req.write(bodyString);
      req.end();
    });
  }

  async searchNews(options: SerperSearchOptions): Promise<SerperNewsResponse> {
    const { q, num = 10, tbs, location } = options;

    // Try fetch first, fall back to https module if fetch fails
    try {
      return await this.searchNewsWithFetch(options);
    } catch (fetchError) {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'WARN',
        service: 'serperClient',
        event: 'SERPER_FETCH_FAILED_TRYING_HTTPS',
        fetch_error: fetchError instanceof Error ? fetchError.message : 'Unknown',
      }));

      // Fall back to https module
      return await this.searchNewsWithHttps(options);
    }
  }

  /**
   * Search news articles by query (using fetch)
   *
   * @param options - Search options
   * @returns Promise resolving to Serper response
   * @throws SerperError if request fails
   */
  private async searchNewsWithFetch(options: SerperSearchOptions): Promise<SerperNewsResponse> {
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

    // DIAGNOSTIC: Log request details
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      service: 'serperClient',
      event: 'SERPER_REQUEST_START',
      url,
      method: 'POST',
      timeout_ms: this.timeout,
      query_length: q.length,
      has_api_key: !!this.apiKey,
      api_key_length: this.apiKey.length,
    }));

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const requestStartTime = Date.now();

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

      const requestLatency = Date.now() - requestStartTime;

      // DIAGNOSTIC: Log response details
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'serperClient',
        event: 'SERPER_RESPONSE_RECEIVED',
        status: response.status,
        status_text: response.statusText,
        latency_ms: requestLatency,
        ok: response.ok,
      }));

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // DIAGNOSTIC: Log error response
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          service: 'serperClient',
          event: 'SERPER_ERROR_RESPONSE',
          status: response.status,
          error_data: errorData,
        }));
        
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

      // DIAGNOSTIC: Log successful response
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'serperClient',
        event: 'SERPER_SUCCESS',
        news_count: data.news?.length || 0,
      }));

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
      // DIAGNOSTIC: Log detailed error information
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        service: 'serperClient',
        event: 'SERPER_REQUEST_FAILED',
        error_name: error instanceof Error ? error.name : 'Unknown',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        error_code: error instanceof SerperError ? error.code : undefined,
        error_stack: error instanceof Error ? error.stack : undefined,
        is_abort_error: error instanceof Error && error.name === 'AbortError',
        is_fetch_error: error instanceof Error && error.message.includes('fetch'),
        is_serper_error: error instanceof SerperError,
      }));

      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw new SerperError(
          `Serper API request timed out after ${this.timeout}ms`,
          undefined,
          'TIMEOUT'
        );
      }

      // Handle network errors with more detail
      if (error instanceof Error && error.message.includes('fetch')) {
        // Extract more details from the error
        const errorDetails = {
          message: error.message,
          cause: (error as any).cause,
          code: (error as any).code,
          errno: (error as any).errno,
          syscall: (error as any).syscall,
        };

        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          service: 'serperClient',
          event: 'SERPER_NETWORK_ERROR_DETAILS',
          ...errorDetails,
        }));

        throw new SerperError(
          `Network error calling Serper API: ${error.message}${errorDetails.cause ? ` (cause: ${errorDetails.cause})` : ''}`,
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
