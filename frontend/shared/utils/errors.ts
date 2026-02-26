/**
 * API Error Type Definitions
 * 
 * Discriminated union types for API error handling.
 * Enables type-safe error handling in UI components.
 * 
 * Validates: Requirements 10.3, 10.4, 24.1-24.5
 */

/**
 * Discriminated union for API errors
 * 
 * Each error type has a unique 'type' field for type narrowing
 */
export type ApiError =
  | { type: 'network'; message: string; originalError?: unknown }
  | { type: 'timeout'; message: string }
  | { type: 'validation'; message: string; details: string[] }
  | { type: 'server'; statusCode: number; message: string }
  | { type: 'unknown'; message: string };

/**
 * Result type for API operations
 * 
 * Discriminated union that represents either success or failure
 */
export type Result<T, E> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Get user-friendly error message for display
 * 
 * @param error - API error object
 * @returns User-friendly error message
 */
export function getUserFriendlyErrorMessage(error: ApiError): string {
  switch (error.type) {
    case 'network':
      return 'Unable to connect to analysis service. Please check your internet connection.';
    case 'timeout':
      return 'Request timed out. Please try again.';
    case 'validation':
      return 'Received invalid response from server. Please try again.';
    case 'server':
      return `Analysis failed (${error.statusCode}). Please try again.`;
    case 'unknown':
      return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Create a network error
 */
export function createNetworkError(message: string, originalError?: unknown): ApiError {
  return { type: 'network', message, originalError };
}

/**
 * Create a timeout error
 */
export function createTimeoutError(message: string): ApiError {
  return { type: 'timeout', message };
}

/**
 * Create a validation error
 */
export function createValidationError(message: string, details: string[]): ApiError {
  return { type: 'validation', message, details };
}

/**
 * Create a server error
 */
export function createServerError(statusCode: number, message: string): ApiError {
  return { type: 'server', statusCode, message };
}

/**
 * Create an unknown error
 */
export function createUnknownError(message: string): ApiError {
  return { type: 'unknown', message };
}
