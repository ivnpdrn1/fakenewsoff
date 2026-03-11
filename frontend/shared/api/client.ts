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
 * Runtime configuration loaded from /config.json
 */
let runtimeConfig: { apiBaseUrl?: string } | null = null;
let configLoadPromise: Promise<void> | null = null;

/**
 * Load runtime configuration from /config.json
 * This allows CloudFront deployments to use runtime config instead of build-time env vars
 */
async function loadRuntimeConfig(): Promise<void> {
  if (runtimeConfig !== null) {
    return; // Already loaded
  }

  try {
    const response = await fetch('/config.json');
    if (response.ok) {
      runtimeConfig = await response.json();
      console.log('[API Client] Loaded runtime config:', runtimeConfig);
    } else {
      console.warn('[API Client] Failed to load /config.json, using fallback');
      runtimeConfig = {};
    }
  } catch (error) {
    console.warn('[API Client] Error loading /config.json:', error);
    runtimeConfig = {};
  }
}

/**
 * Get API base URL from runtime config, environment, or fallback to localhost
 */
function getApiBaseUrl(): string {
  // 1. Try runtime config (loaded from /config.json)
  if (runtimeConfig?.apiBaseUrl) {
    return runtimeConfig.apiBaseUrl;
  }

  // 2. Check if running in Vite environment
  if (typeof import.meta !== 'undefined' && 'env' in import.meta) {
    const viteEnv = import.meta as any;
    if (viteEnv.env?.VITE_API_BASE_URL) {
      return viteEnv.env.VITE_API_BASE_URL;
    }
  }
  
  // 3. Fallback to localhost for development
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3000';
  }
  
  // 4. Final fallback - use production API URL
  // This ensures we never return an empty string which would cause URL construction errors
  return 'https://fnd9pknygc.execute-api.us-east-1.amazonaws.com';
}

/**
 * Initialize API client (load runtime config)
 * Call this once at app startup
 */
export async function initializeApiClient(): Promise<void> {
  if (configLoadPromise === null) {
    configLoadPromise = loadRuntimeConfig();
  }
  await configLoadPromise;
}

/**
 * API configuration
 */
const API_CONFIG = {
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
  // Ensure runtime config is loaded
  await initializeApiClient();

  // Log resolved API base URL for debugging
  const resolvedBaseUrl = getApiBaseUrl();
  console.log('[API Client] Using API base URL:', resolvedBaseUrl);

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
      const url = `${getApiBaseUrl()}${API_CONFIG.endpoints.analyze}`;
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

      // Check content-type to guard against HTML responses
      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      // Handle non-OK responses
      if (!response.ok) {
        const statusCode = response.status;
        
        // Try to get error message from response
        let errorMessage = `Server returned ${statusCode}`;
        
        try {
          if (isJson) {
            const errorData = await response.json() as { error?: string };
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          } else {
            // Non-JSON error response (likely HTML)
            const textResponse = await response.text();
            const snippet = textResponse.substring(0, 120);
            console.error('[API Client] Non-JSON error response:', {
              status: statusCode,
              contentType,
              snippet
            });
            errorMessage = `Server returned ${statusCode} with non-JSON response (${contentType})`;
          }
        } catch {
          // Ignore parse errors
        }

        // Retry on 500-level errors (once)
        // serverErrorRetries=1 means 1 retry (2 total attempts: initial + 1 retry)
        if (isRetryableStatusCode(statusCode) && 
            attempt <= API_CONFIG.retry.serverErrorRetries) {
          console.log(`Server error ${statusCode}, will retry (attempt ${attempt + 1}/${API_CONFIG.retry.serverErrorRetries + 1})...`);
          continue;
        }

        return {
          success: false,
          error: createServerError(statusCode, errorMessage)
        };
      }

      // Guard against HTML responses (API misconfiguration)
      if (!isJson) {
        const textResponse = await response.text();
        const snippet = textResponse.substring(0, 120);
        console.error('[API Client] API misconfigured - received HTML instead of JSON:', {
          url,
          status: response.status,
          contentType,
          snippet
        });

        return {
          success: false,
          error: createValidationError(
            'API misconfigured: server returned HTML instead of JSON. Check apiBaseUrl configuration.',
            [`Content-Type: ${contentType}`, `Response snippet: ${snippet}`]
          )
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

      // Log orchestration status for debugging
      const analysisResponse = validation.data;
      if (analysisResponse.orchestration) {
        console.log('[API Client] Orchestration metadata:', {
          enabled: analysisResponse.orchestration.enabled,
          passes_executed: analysisResponse.orchestration.passes_executed,
          source_classes: analysisResponse.orchestration.source_classes,
          average_quality: analysisResponse.orchestration.average_quality,
          contradictions_found: analysisResponse.orchestration.contradictions_found
        });
      } else {
        console.log('[API Client] Orchestration metadata not present (legacy pipeline or feature flag disabled)');
      }

      // Success!
      return {
        success: true,
        data: analysisResponse
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
  return {
    ...API_CONFIG,
    baseUrl: getApiBaseUrl()
  };
}

// ============================================================================
// Health Check Functions
// ============================================================================

/**
 * Health check response
 */
export interface HealthResponse {
  status: string;
  demo_mode?: boolean;
  timestamp?: string;
}

/**
 * Grounding health response
 */
export interface GroundingHealthResponse {
  ok: boolean;
  bing_configured: boolean;
  gdelt_configured: boolean;
  timeout_ms: number;
  cache_ttl_seconds: number;
  provider_enabled: boolean;
  provider_order: string[];
}

/**
 * Check backend health
 */
export async function checkHealth(): Promise<Result<HealthResponse, ApiError>> {
  await initializeApiClient();
  const baseUrl = getApiBaseUrl();

  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/health`,
      { method: 'GET' },
      5000
    );

    if (!response.ok) {
      return {
        success: false,
        error: createServerError(response.status, `Health check failed: ${response.status}`)
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    if (error instanceof Error && error.message === 'Request timeout') {
      return {
        success: false,
        error: createTimeoutError('Health check timed out')
      };
    }
    return {
      success: false,
      error: createNetworkError(
        error instanceof Error ? error.message : 'Health check failed'
      )
    };
  }
}

/**
 * Check grounding health
 */
export async function checkGroundingHealth(): Promise<
  Result<GroundingHealthResponse, ApiError>
> {
  await initializeApiClient();
  const baseUrl = getApiBaseUrl();

  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/health/grounding`,
      { method: 'GET' },
      5000
    );

    if (!response.ok) {
      return {
        success: false,
        error: createServerError(
          response.status,
          `Grounding health check failed: ${response.status}`
        )
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    if (error instanceof Error && error.message === 'Request timeout') {
      return {
        success: false,
        error: createTimeoutError('Grounding health check timed out')
      };
    }
    return {
      success: false,
      error: createNetworkError(
        error instanceof Error ? error.message : 'Grounding health check failed'
      )
    };
  }
}

// ============================================================================
// Comprehensive Health Check
// ============================================================================

/**
 * Health status types
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Comprehensive health check result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  message: string;
  backend: {
    available: boolean;
    demoMode?: boolean;
  };
  grounding?: {
    enabled: boolean;
    providers: {
      bing: boolean;
      gdelt: boolean;
    };
    providerOrder: string[];
  };
}

/**
 * Perform comprehensive health check
 * 
 * Checks both backend health and grounding provider status.
 * Returns a standardized health status:
 * - healthy: Backend is up and grounding is properly configured
 * - degraded: Backend is up but grounding has issues
 * - unhealthy: Backend is down or unreachable
 * - unknown: Unable to determine health status
 * 
 * @returns Comprehensive health check result
 * 
 * @example
 * ```typescript
 * const health = await checkApiHealth();
 * console.log('Status:', health.status); // 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
 * console.log('Message:', health.message);
 * if (health.grounding) {
 *   console.log('Grounding enabled:', health.grounding.enabled);
 *   console.log('Bing configured:', health.grounding.providers.bing);
 * }
 * ```
 */
export async function checkApiHealth(): Promise<HealthCheckResult> {
  // Check basic backend health
  const healthResult = await checkHealth();
  
  if (!healthResult.success) {
    // Backend is unreachable or unhealthy
    return {
      status: 'unhealthy',
      message: `Backend unreachable: ${healthResult.error.message}`,
      backend: {
        available: false
      }
    };
  }

  // Backend is up
  const backendHealthy = healthResult.data.status === 'ok';
  
  // Check grounding health
  const groundingResult = await checkGroundingHealth();
  
  if (!groundingResult.success) {
    // Backend is up but grounding check failed
    // This could be because the endpoint doesn't exist (old backend)
    // or because grounding is not configured
    return {
      status: backendHealthy ? 'degraded' : 'unhealthy',
      message: backendHealthy 
        ? 'Backend is healthy but grounding status unknown'
        : 'Backend health check passed but status is not ok',
      backend: {
        available: true,
        demoMode: healthResult.data.demo_mode
      }
    };
  }

  // Both checks succeeded
  const groundingHealthy = groundingResult.data.ok;
  const groundingEnabled = groundingResult.data.provider_enabled;
  const bingConfigured = groundingResult.data.bing_configured;
  const gdeltConfigured = groundingResult.data.gdelt_configured;

  // Determine overall status
  let status: HealthStatus;
  let message: string;

  if (backendHealthy && groundingHealthy) {
    status = 'healthy';
    message = 'All systems operational';
  } else if (backendHealthy && groundingEnabled) {
    // Backend is up and grounding is enabled, but not fully healthy
    status = 'degraded';
    if (!bingConfigured && !gdeltConfigured) {
      message = 'Backend is healthy but no grounding providers are configured';
    } else if (!bingConfigured) {
      message = 'Backend is healthy but Bing grounding is not configured';
    } else if (!gdeltConfigured) {
      message = 'Backend is healthy but GDELT grounding is not configured';
    } else {
      message = 'Backend is healthy but grounding has issues';
    }
  } else if (backendHealthy && !groundingEnabled) {
    status = 'degraded';
    message = 'Backend is healthy but grounding is disabled';
  } else {
    status = 'unhealthy';
    message = 'Backend health check failed';
  }

  return {
    status,
    message,
    backend: {
      available: true,
      demoMode: healthResult.data.demo_mode
    },
    grounding: {
      enabled: groundingEnabled,
      providers: {
        bing: bingConfigured,
        gdelt: gdeltConfigured
      },
      providerOrder: groundingResult.data.provider_order
    }
  };
}
