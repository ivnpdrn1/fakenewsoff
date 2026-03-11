/**
 * ErrorState Component
 *
 * Displays user-friendly error messages with optional retry functionality.
 * Maps ApiError types to appropriate messages and logs details to console.
 * Shows contextual suggestions after 2+ failed attempts to help users recover.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 18.2, 29.1, 29.2, 29.4
 */

import React from 'react';
import type { ApiError } from '../../../shared/utils/errors.js';
import './ErrorState.css';

interface ErrorStateProps {
  error: ApiError;
  onRetry?: () => void;
  onCancel?: () => void;
  preservedInput?: string;
  retryCount?: number;
}

/**
 * Map error types to user-friendly messages
 */
function getErrorMessage(error: ApiError): string {
  switch (error.type) {
    case 'network':
      return 'Unable to connect to the analysis service. Please check your internet connection and try again.';
    case 'timeout':
      return 'The analysis request timed out. This might be due to high server load or network issues. Please try again.';
    case 'validation':
      return 'The server returned an invalid response. This might be a temporary issue. Please try again.';
    case 'server':
      if (error.statusCode >= 500) {
        return 'The server encountered an error while processing your request. Please try again in a moment.';
      }
      return 'Your request could not be processed. Please check your input and try again.';
    case 'unknown':
      return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Get contextual suggestions for repeated failures
 */
function getSuggestions(error: ApiError, retryCount: number): string[] {
  // Only show suggestions after 2+ failed attempts
  if (retryCount < 2) {
    return [];
  }

  const suggestions: string[] = [];

  switch (error.type) {
    case 'network':
      suggestions.push('Check your internet connection');
      suggestions.push('Try again later when your connection is stable');
      suggestions.push('Contact your network administrator if the issue persists');
      break;
    
    case 'timeout':
      suggestions.push('Try a different claim (shorter or more specific)');
      suggestions.push('Try again later when server load is lower');
      suggestions.push('Check if your internet connection is stable');
      break;
    
    case 'server':
      suggestions.push('Try a different claim');
      suggestions.push('Try again in a few minutes');
      suggestions.push('The service may be experiencing high load');
      break;
    
    case 'validation':
      suggestions.push('Try a different claim');
      suggestions.push('Check if the claim text is properly formatted');
      suggestions.push('Try providing a URL instead of just text');
      break;
    
    case 'unknown':
      suggestions.push('Try a different claim');
      suggestions.push('Try again later');
      suggestions.push('Clear your browser cache and try again');
      break;
  }

  return suggestions;
}

/**
 * Determine if an error is recoverable (should show retry button)
 */
function isRecoverableError(error: ApiError): boolean {
  switch (error.type) {
    case 'network':
    case 'timeout':
      return true;
    case 'server':
      // Only 5xx errors are recoverable
      return error.statusCode >= 500;
    case 'validation':
    case 'unknown':
      // Validation errors are not recoverable (bad response format)
      // Unknown errors might be recoverable, but safer to not retry automatically
      return false;
  }
}

/**
 * Log error to console without exposing sensitive data
 */
function logErrorSafely(error: ApiError): void {
  const safeError: Record<string, unknown> = {
    type: error.type,
    message: error.message,
    timestamp: new Date().toISOString(),
  };

  // Add type-specific fields without sensitive data
  switch (error.type) {
    case 'server':
      safeError.statusCode = error.statusCode;
      break;
    case 'validation':
      // Log validation details but not the full response
      safeError.detailsCount = error.details.length;
      break;
    case 'network':
      // Don't log originalError as it might contain sensitive data
      break;
  }

  console.error('[ErrorState] Error occurred:', safeError);
}

/**
 * Error display component with user-friendly messages
 *
 * Features:
 * - Maps all error types to user-friendly messages
 * - Shows "Try Again" button for recoverable errors
 * - Preserves user input for retry
 * - Shows "Cancel" button to return to home
 * - Logs errors to console without exposing sensitive data
 * - ARIA live region for screen readers
 * - Shows contextual suggestions after 2+ failed attempts
 */
const ErrorState: React.FC<ErrorStateProps> = ({ 
  error, 
  onRetry, 
  onCancel,
  preservedInput,
  retryCount = 0
}) => {
  // Log error safely on mount and when error changes
  React.useEffect(() => {
    logErrorSafely(error);
  }, [error]);

  const message = getErrorMessage(error);
  const isRecoverable = isRecoverableError(error);
  const suggestions = getSuggestions(error, retryCount);

  return (
    <div className="error-state" role="alert" aria-live="assertive">
      <div className="error-icon">⚠️</div>
      <h2 className="error-title">Something Went Wrong</h2>
      <p className="error-message">{message}</p>

      {error.type === 'validation' &&
        error.details &&
        error.details.length > 0 && (
          <details className="error-details">
            <summary>Technical Details</summary>
            <ul>
              {error.details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          </details>
        )}

      {suggestions.length > 0 && (
        <div className="error-suggestions">
          <h3 className="error-suggestions-title">Suggestions:</h3>
          <ul className="error-suggestions-list">
            {suggestions.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="error-actions">
        {isRecoverable && onRetry && (
          <button
            className="error-retry-button"
            onClick={onRetry}
            aria-label="Try again"
          >
            Try Again
          </button>
        )}
        
        {onCancel && (
          <button
            className="error-cancel-button"
            onClick={onCancel}
            aria-label="Cancel and return to home"
          >
            Cancel
          </button>
        )}
      </div>

      {preservedInput && (
        <p className="error-preserved-input-notice">
          Your input has been preserved and will be used when you retry.
        </p>
      )}
    </div>
  );
};

export default ErrorState;
