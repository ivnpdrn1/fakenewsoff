/**
 * ErrorState Component Tests
 *
 * Tests for error display, retry functionality, input preservation, and contextual suggestions.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 18.2, 29.1, 29.2, 29.4
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorState from './ErrorState.js';
import type { ApiError } from '../../../shared/utils/errors.js';

describe('ErrorState Component', () => {
  describe('Error Message Display', () => {
    it('displays user-friendly message for network errors', () => {
      const error: ApiError = {
        type: 'network',
        message: 'Network failed',
      };

      render(<ErrorState error={error} />);

      expect(
        screen.getByText(/unable to connect to the analysis service/i)
      ).toBeInTheDocument();
    });

    it('displays user-friendly message for timeout errors', () => {
      const error: ApiError = {
        type: 'timeout',
        message: 'Request timed out',
      };

      render(<ErrorState error={error} />);

      expect(
        screen.getByText(/the analysis request timed out/i)
      ).toBeInTheDocument();
    });

    it('displays user-friendly message for validation errors', () => {
      const error: ApiError = {
        type: 'validation',
        message: 'Invalid response',
        details: ['field: required'],
      };

      render(<ErrorState error={error} />);

      expect(
        screen.getByText(/the server returned an invalid response/i)
      ).toBeInTheDocument();
    });

    it('displays user-friendly message for server 5xx errors', () => {
      const error: ApiError = {
        type: 'server',
        statusCode: 500,
        message: 'Internal server error',
      };

      render(<ErrorState error={error} />);

      expect(
        screen.getByText(/the server encountered an error/i)
      ).toBeInTheDocument();
    });

    it('displays user-friendly message for server 4xx errors', () => {
      const error: ApiError = {
        type: 'server',
        statusCode: 400,
        message: 'Bad request',
      };

      render(<ErrorState error={error} />);

      expect(
        screen.getByText(/your request could not be processed/i)
      ).toBeInTheDocument();
    });

    it('displays user-friendly message for unknown errors', () => {
      const error: ApiError = {
        type: 'unknown',
        message: 'Something went wrong',
      };

      render(<ErrorState error={error} />);

      expect(
        screen.getByText(/an unexpected error occurred/i)
      ).toBeInTheDocument();
    });
  });

  describe('Retry Button Display', () => {
    it('shows retry button for network errors', () => {
      const error: ApiError = {
        type: 'network',
        message: 'Network failed',
      };
      const onRetry = vi.fn();

      render(<ErrorState error={error} onRetry={onRetry} />);

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('shows retry button for timeout errors', () => {
      const error: ApiError = {
        type: 'timeout',
        message: 'Request timed out',
      };
      const onRetry = vi.fn();

      render(<ErrorState error={error} onRetry={onRetry} />);

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('shows retry button for server 5xx errors', () => {
      const error: ApiError = {
        type: 'server',
        statusCode: 500,
        message: 'Internal server error',
      };
      const onRetry = vi.fn();

      render(<ErrorState error={error} onRetry={onRetry} />);

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('does not show retry button for validation errors', () => {
      const error: ApiError = {
        type: 'validation',
        message: 'Invalid response',
        details: [],
      };
      const onRetry = vi.fn();

      render(<ErrorState error={error} onRetry={onRetry} />);

      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });

    it('does not show retry button for server 4xx errors', () => {
      const error: ApiError = {
        type: 'server',
        statusCode: 400,
        message: 'Bad request',
      };
      const onRetry = vi.fn();

      render(<ErrorState error={error} onRetry={onRetry} />);

      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });

    it('does not show retry button for unknown errors', () => {
      const error: ApiError = {
        type: 'unknown',
        message: 'Something went wrong',
      };
      const onRetry = vi.fn();

      render(<ErrorState error={error} onRetry={onRetry} />);

      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });
  });

  describe('Cancel Button', () => {
    it('shows cancel button when onCancel is provided', () => {
      const error: ApiError = {
        type: 'network',
        message: 'Network failed',
      };
      const onCancel = vi.fn();

      render(<ErrorState error={error} onCancel={onCancel} />);

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const error: ApiError = {
        type: 'network',
        message: 'Network failed',
      };
      const onCancel = vi.fn();

      render(<ErrorState error={error} onCancel={onCancel} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Retry Functionality', () => {
    it('calls onRetry when retry button is clicked', async () => {
      const user = userEvent.setup();
      const error: ApiError = {
        type: 'network',
        message: 'Network failed',
      };
      const onRetry = vi.fn();

      render(<ErrorState error={error} onRetry={onRetry} />);

      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('Input Preservation', () => {
    it('shows preservation notice when preservedInput is provided', () => {
      const error: ApiError = {
        type: 'network',
        message: 'Network failed',
      };

      render(<ErrorState error={error} preservedInput="test claim" />);

      expect(
        screen.getByText(/your input has been preserved/i)
      ).toBeInTheDocument();
    });

    it('does not show preservation notice when preservedInput is not provided', () => {
      const error: ApiError = {
        type: 'network',
        message: 'Network failed',
      };

      render(<ErrorState error={error} />);

      expect(
        screen.queryByText(/your input has been preserved/i)
      ).not.toBeInTheDocument();
    });
  });

  describe('Validation Error Details', () => {
    it('shows technical details for validation errors', () => {
      const error: ApiError = {
        type: 'validation',
        message: 'Invalid response',
        details: ['field1: required', 'field2: invalid format'],
      };

      render(<ErrorState error={error} />);

      // Details should be in a collapsible section
      const details = screen.getByText('Technical Details');
      expect(details).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has role="alert" for screen readers', () => {
      const error: ApiError = {
        type: 'network',
        message: 'Network failed',
      };

      const { container } = render(<ErrorState error={error} />);

      const alert = container.querySelector('[role="alert"]');
      expect(alert).toBeInTheDocument();
    });

    it('has aria-live="assertive" for immediate announcement', () => {
      const error: ApiError = {
        type: 'network',
        message: 'Network failed',
      };

      const { container } = render(<ErrorState error={error} />);

      const liveRegion = container.querySelector('[aria-live="assertive"]');
      expect(liveRegion).toBeInTheDocument();
    });

    it('has aria-label on retry button', () => {
      const error: ApiError = {
        type: 'network',
        message: 'Network failed',
      };
      const onRetry = vi.fn();

      render(<ErrorState error={error} onRetry={onRetry} />);

      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toHaveAttribute('aria-label');
    });

    it('has aria-label on cancel button', () => {
      const error: ApiError = {
        type: 'network',
        message: 'Network failed',
      };
      const onCancel = vi.fn();

      render(<ErrorState error={error} onCancel={onCancel} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toHaveAttribute('aria-label');
    });
  });

  describe('Error Logging', () => {
    it('logs error to console without sensitive data', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const error: ApiError = {
        type: 'network',
        message: 'Network failed',
        originalError: { sensitiveData: 'should not be logged' },
      };

      render(<ErrorState error={error} />);

      expect(consoleSpy).toHaveBeenCalled();
      const loggedData = consoleSpy.mock.calls[0][1];
      
      // Should log type and message
      expect(loggedData).toHaveProperty('type', 'network');
      expect(loggedData).toHaveProperty('message');
      expect(loggedData).toHaveProperty('timestamp');
      
      // Should NOT log originalError (sensitive data)
      expect(loggedData).not.toHaveProperty('originalError');
      expect(loggedData).not.toHaveProperty('sensitiveData');

      consoleSpy.mockRestore();
    });

    it('logs server error with status code but not full response', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const error: ApiError = {
        type: 'server',
        statusCode: 500,
        message: 'Internal server error',
      };

      render(<ErrorState error={error} />);

      expect(consoleSpy).toHaveBeenCalled();
      const loggedData = consoleSpy.mock.calls[0][1];
      
      // Should log status code
      expect(loggedData).toHaveProperty('statusCode', 500);
      
      // Should log type and message
      expect(loggedData).toHaveProperty('type', 'server');
      expect(loggedData).toHaveProperty('message');

      consoleSpy.mockRestore();
    });

    it('logs validation error with details count but not full details', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const error: ApiError = {
        type: 'validation',
        message: 'Invalid response',
        details: ['field1: required', 'field2: invalid'],
      };

      render(<ErrorState error={error} />);

      expect(consoleSpy).toHaveBeenCalled();
      const loggedData = consoleSpy.mock.calls[0][1];
      
      // Should log details count
      expect(loggedData).toHaveProperty('detailsCount', 2);
      
      // Should NOT log full details array (might contain sensitive data)
      expect(loggedData).not.toHaveProperty('details');

      consoleSpy.mockRestore();
    });
  });

  describe('Retry Count and Suggestions', () => {
    it('does not show suggestions on first failure (retryCount=0)', () => {
      const error: ApiError = {
        type: 'network',
        message: 'Network failed',
      };

      render(<ErrorState error={error} retryCount={0} />);

      expect(screen.queryByText(/suggestions:/i)).not.toBeInTheDocument();
    });

    it('does not show suggestions on second failure (retryCount=1)', () => {
      const error: ApiError = {
        type: 'network',
        message: 'Network failed',
      };

      render(<ErrorState error={error} retryCount={1} />);

      expect(screen.queryByText(/suggestions:/i)).not.toBeInTheDocument();
    });

    it('shows suggestions after 2+ failures (retryCount=2)', () => {
      const error: ApiError = {
        type: 'network',
        message: 'Network failed',
      };

      render(<ErrorState error={error} retryCount={2} />);

      expect(screen.getByText(/suggestions:/i)).toBeInTheDocument();
    });

    it('shows network-specific suggestions for network errors', () => {
      const error: ApiError = {
        type: 'network',
        message: 'Network failed',
      };

      render(<ErrorState error={error} retryCount={2} />);

      // Check for suggestions section
      expect(screen.getByText(/suggestions:/i)).toBeInTheDocument();
      
      // Check for specific suggestions in the list (not in error message)
      const suggestionsList = screen.getByRole('list');
      expect(suggestionsList).toHaveTextContent('Check your internet connection');
      expect(suggestionsList).toHaveTextContent('Try again later when your connection is stable');
    });

    it('shows timeout-specific suggestions for timeout errors', () => {
      const error: ApiError = {
        type: 'timeout',
        message: 'Request timed out',
      };

      render(<ErrorState error={error} retryCount={2} />);

      expect(screen.getByText(/try a different claim/i)).toBeInTheDocument();
      expect(screen.getByText(/try again later when server load is lower/i)).toBeInTheDocument();
    });

    it('shows server-specific suggestions for server errors', () => {
      const error: ApiError = {
        type: 'server',
        statusCode: 500,
        message: 'Internal server error',
      };

      render(<ErrorState error={error} retryCount={2} />);

      expect(screen.getByText(/try a different claim/i)).toBeInTheDocument();
      expect(screen.getByText(/try again in a few minutes/i)).toBeInTheDocument();
    });

    it('shows validation-specific suggestions for validation errors', () => {
      const error: ApiError = {
        type: 'validation',
        message: 'Invalid response',
        details: [],
      };

      render(<ErrorState error={error} retryCount={2} />);

      expect(screen.getByText(/try a different claim/i)).toBeInTheDocument();
      expect(screen.getByText(/try providing a url instead of just text/i)).toBeInTheDocument();
    });

    it('shows generic suggestions for unknown errors', () => {
      const error: ApiError = {
        type: 'unknown',
        message: 'Something went wrong',
      };

      render(<ErrorState error={error} retryCount={3} />);

      expect(screen.getByText(/try a different claim/i)).toBeInTheDocument();
      expect(screen.getByText(/clear your browser cache and try again/i)).toBeInTheDocument();
    });

    it('shows suggestions with higher retry counts', () => {
      const error: ApiError = {
        type: 'network',
        message: 'Network failed',
      };

      render(<ErrorState error={error} retryCount={5} />);

      expect(screen.getByText(/suggestions:/i)).toBeInTheDocument();
      
      // Check for specific suggestions in the list
      const suggestionsList = screen.getByRole('list');
      expect(suggestionsList).toHaveTextContent('Check your internet connection');
    });
  });
});
