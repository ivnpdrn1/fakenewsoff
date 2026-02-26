/**
 * API Client Module
 * 
 * Production-grade API client for communicating with the backend /analyze endpoint.
 * Provides timeout, retry logic, and runtime validation with Zod.
 * Works in both browser and extension contexts.
 * 
 * Validates: Requirements 10.1-10.5, 26.1-26.5
 */

import { AnalysisResponseSchema, type AnalysisResponse } from '../schemas/index.js';
import type { Result, ApiError } from '../utils/errors.js';
import {
  createNetworkError,
  createTimeoutError,
  createValidationError,
  createServerError,
  createUnknownError
} from '../utils/errors.js';

// ============================================================================
// Configuration
// ============================================================================

/**
 * API configuration
 */
const API_CONFIG = {
  baseUrl: typeof window !== 'undefined' 
    ? (window.location.hostname === 'localhost' ? 'http://localhost:3000' : '')
    : 'http://localhost:3000',
  endpoints: {
    analyze: '/analyze'
  },
  timeouts: {
    production: 45000, // 45 seconds for production (AWS Bedrock can take 20-40s)
    demo: 5000         // 5 seconds for demo mode (responds in ~1.5s)
  },
  retry: {
    maxRetries: 2,           // 2 retries for network errors
    serverErrorRetries: 1,   // 1 retry for 500 errors
    initialDelay: 1000,      // 1 second initial delay
    backoffMultiplier: 2     // Exponential backoff
  }
} as const;

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Parameters for analyzeContent function
 */
export interface AnalyzeContentParams {
  text: string;
  url?: string;
  title?: string;
  demoMode?: boolean;
}

/**
 * Request payload for /analyze endpoint
 */
interface AnalyzeRequest {
  text: string;
  url?: string;
  title?: string;
  demo_mode?: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Delay execution for specified milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout support
 * 
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds
 * @returns Fetch response
 * @throws Error if timeout occurs
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

/**
 * Determine if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Network errors are retryable
    if (error.message.includes('fetch') || 
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED')) {
      return true;
    }
  }
  return false;
}

/**
 * Determine if HTTP status code is retryable
 */
function isRetryableStatusCode(statusCode: number): boolean {
  // Retry on 500-level errors (server errors)
  return statusCode >= 500 && statusCode < 600;
}

// ============================================================================
// Core API Client Function
// ============================================================================

/**
 * Analyze content using the backend API
 * 
 * This is the main API client function used by both web UI and browser extension.
 * It handles:
 * - Request payload construction
 * - Timeout management (45s production, 5s demo)
 * - Retry logic with exponential backoff
 * - Runtime validation with Zod
 * - Typed error handling
 * 
 * @param params - Analysis parameters
 * @returns Result with AnalysisResponse or ApiError
 * 
 * @example
 * ```typescript
 * const result = await analyzeContent({
 *   text: 'This is fake news',
 *   demoMode: true
 * });
 * 
 * if (result.success) {
 *   console.log('Status:', result.data.status_label);
 * } else {
 *   console.error('Error:', result.error.message);
 * }
 * ```
 */
export async function analyzeContent(
  params: AnalyzeContentParams
): Promise<Result<AnalysisResponse, ApiError>> {
  // Validate input
  if (!params.text || params.text.trim().length === 0) {
    return {
      success: false,
      error: createValidationError('Text is required', ['text: must not be empty'])
    };
  }

  // Construct request payload
  const payload: AnalyzeRequest = {
    text: params.text,
    ...(params.url && { url: params.url }),
    ...(params.title && { title: params.title }),
    ...(params.demoMode !== undefined && { demo_mode: params.demoMode })
  };

  // Determine timeout based on demo mode
  const timeout = params.demoMode 
    ? API_CONFIG.timeouts.demo 
    : API_CONFIG.timeouts.production;

  // Determine max retries
  const maxRetries = API_CONFIG.retry.maxRetries;

  // Attempt request with retries
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Calculate delay for retry attempts
      if (attempt > 0) {
        const delayMs = API_CONFIG.retry.initialDelay * 
          Math.pow(API_CONFIG.retry.backoffMultiplier, attempt - 1);
        console.log(`Retrying request (attempt ${attempt + 1}/${maxRetries + 1}) after ${delayMs}ms...`);
        await delay(delayMs);
      }

      // Make request with timeout
      const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.analyze}`;
      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        },
        timeout
      );

      // Handle non-OK responses
      if (!response.ok) {
        const statusCode = response.status;
        
        // Try to get error message from response
        let errorMessage = `Server returned ${statusCode}`;
        try {
          const errorData = await response.json() as { error?: string };
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Ignore JSON parse errors
        }

        // Retry on 500-level errors
        if (isRetryableStatusCode(statusCode) && attempt < API_CONFIG.retry.serverErrorRetries) {
          console.log(`Server error ${statusCode}, will retry...`);
          continue;
        }

        return {
          success: false,
          error: createServerError(statusCode, errorMessage)
        };
      }

      // Parse response JSON
      const data = await response.json();

      // Validate response with Zod
      const validation = AnalysisResponseSchema.safeParse(data);

      if (!validation.success) {
        const details = validation.error.issues.map(issue => {
          const path = issue.path.join('.');
          return `${path}: ${issue.message}`;
        });

        console.error('Response validation failed:', details);

        return {
          success: false,
          error: createValidationError(
            'Invalid response from server',
            details
          )
        };
      }

      // Success!
      return {
        success: true,
        data: validation.data
      };

    } catch (error) {
      // Handle timeout errors
      if (error instanceof Error && error.message === 'Request timeout') {
        // Don't retry on timeout
        return {
          success: false,
          error: createTimeoutError(
            `Request timed out after ${timeout}ms`
          )
        };
      }

      // Handle network errors
      if (isRetryableError(error) && attempt < maxRetries) {
        console.log(`Network error, will retry...`);
        continue;
      }

      // Last attempt or non-retryable error
      if (error instanceof Error) {
        return {
          success: false,
          error: createNetworkError(
            error.message || 'Network request failed',
            error
          )
        };
      }

      // Unknown error
      return {
        success: false,
        error: createUnknownError(
          'An unexpected error occurred'
        )
      };
    }
  }

  // Should never reach here, but TypeScript needs it
  return {
    success: false,
    error: createUnknownError('Maximum retries exceeded')
  };
}

/**
 * Get API configuration (for testing/debugging)
 */
export function getApiConfig() {
  return API_CONFIG;
}
