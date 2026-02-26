/**
 * ErrorState Component
 *
 * Displays user-friendly error messages with optional retry functionality.
 * Maps ApiError types to appropriate messages and logs details to console.
 *
 * Validates: Requirements 4.4, 24.1-24.5
 */

import React from 'react';
import type { ApiError } from '../../../shared/utils/errors.js';
import { getUserFriendlyErrorMessage } from '../../../shared/utils/errors.js';
import './ErrorState.css';

interface ErrorStateProps {
  error: ApiError;
  onRetry?: () => void;
}

/**
 * Error display component with user-friendly messages
 *
 * Features:
 * - Maps error types to user-friendly messages
 * - Logs detailed errors to console for debugging
 * - Optional retry button
 * - ARIA live region for screen readers
 */
const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => {
  // Log detailed error to console for debugging
  React.useEffect(() => {
    console.error('ErrorState:', error);
  }, [error]);

  const message = getUserFriendlyErrorMessage(error);

  return (
    <div className="error-state" role="alert" aria-live="assertive">
      <div className="error-icon">⚠️</div>
      <h2 className="error-title">Error</h2>
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

      {onRetry && (
        <button
          className="error-retry-button"
          onClick={onRetry}
          aria-label="Retry analysis"
        >
          Retry
        </button>
      )}
    </div>
  );
};

export default ErrorState;
