/**
 * Resilience Utilities
 * 
 * Provides timeout and retry mechanisms for outbound calls
 */

export interface TimeoutOptions {
  requestId?: string;
  opName?: string;
}

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
  retryOn?: (error: Error) => boolean;
  requestId?: string;
}

/**
 * Wrap a promise with timeout
 */
export async function withTimeout<T>(
  fn: Promise<T>,
  timeoutMs: number,
  options: TimeoutOptions = {}
): Promise<T> {
  const { requestId, opName = 'operation' } = options;
  
  return Promise.race([
    fn,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        const error = new Error(
          `${opName} timed out after ${timeoutMs}ms${requestId ? ` (request: ${requestId})` : ''}`
        );
        error.name = 'TimeoutError';
        reject(error);
      }, timeoutMs);
    })
  ]);
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    retries = 2,
    baseDelayMs = 200,
    maxDelayMs = 1500,
    jitter = true,
    retryOn = isRetryableError
  } = options;
  
  let lastError: Error;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry if not retryable or last attempt
      if (!retryOn(lastError) || attempt === retries) {
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt),
        maxDelayMs
      );
      
      // Add jitter
      const finalDelay = jitter
        ? delay * (0.5 + Math.random() * 0.5)
        : delay;
      
      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }
  }
  
  throw lastError!;
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Retry on timeouts
  if (error.name === 'TimeoutError' || message.includes('timeout')) {
    return true;
  }
  
  // Retry on rate limits
  if (message.includes('429') || message.includes('rate limit')) {
    return true;
  }
  
  // Retry on 5xx errors
  if (message.match(/5\d{2}/)) {
    return true;
  }
  
  // Retry on throttling
  if (message.includes('throttl')) {
    return true;
  }
  
  // Retry on network errors
  if (message.includes('network') || message.includes('econnreset')) {
    return true;
  }
  
  return false;
}

/**
 * Get timeout configuration from environment
 */
export function getTimeoutConfig() {
  return {
    request: parseInt(process.env.REQUEST_TIMEOUT_MS || '12000', 10),
    bedrock: parseInt(process.env.BEDROCK_TIMEOUT_MS || '15000', 10)
  };
}

/**
 * Get retry configuration from environment
 */
export function getRetryConfig() {
  const isDemoMode = process.env.DEMO_MODE === 'true';
  
  return {
    maxAttempts: isDemoMode ? 0 : parseInt(process.env.RETRY_MAX_ATTEMPTS || '2', 10),
    baseDelay: parseInt(process.env.RETRY_BASE_DELAY_MS || '200', 10),
    maxDelay: parseInt(process.env.RETRY_MAX_DELAY_MS || '1500', 10)
  };
}
