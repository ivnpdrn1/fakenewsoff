/**
 * InputForm Component Tests
 *
 * Tests validation behavior for Task 5.1:
 * - Display clear error for input <10 characters
 * - Show inline validation errors as user types
 * - Provide placeholder text with examples
 *
 * Tests loading state improvements for Task 5.2:
 * - Display loading spinner immediately on submit
 * - Show progress indication during analysis
 * - Display timeout message after 30 seconds
 * - Prevent duplicate submissions while loading
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import InputForm from './InputForm';

describe('InputForm', () => {
  describe('Validation - Task 5.1', () => {
    it('displays error for text input less than 10 characters', async () => {
      const onSubmit = vi.fn();
      render(<InputForm onSubmit={onSubmit} loading={false} demoMode={false} />);

      const textInput = screen.getByLabelText('Text to analyze');
      
      // Type a character first to mark as touched
      fireEvent.change(textInput, { target: { value: 's' } });
      
      // Then type less than 10 characters
      fireEvent.change(textInput, { target: { value: 'short' } });
      
      // Wait for debounced validation (300ms)
      await waitFor(
        () => {
          expect(screen.getByText('Text must be at least 10 characters')).toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });

    it('does not show error for text input with 10 or more characters', async () => {
      const onSubmit = vi.fn();
      render(<InputForm onSubmit={onSubmit} loading={false} demoMode={false} />);

      const textInput = screen.getByLabelText('Text to analyze');
      
      // Type 10 or more characters
      fireEvent.change(textInput, { target: { value: 'This is a valid claim text' } });
      
      // Wait for debounced validation
      await waitFor(
        () => {
          expect(screen.queryByText('Text must be at least 10 characters')).not.toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });

    it('shows inline validation errors as user types', async () => {
      const onSubmit = vi.fn();
      render(<InputForm onSubmit={onSubmit} loading={false} demoMode={false} />);

      const textInput = screen.getByLabelText('Text to analyze');
      
      // Start typing (marks field as touched)
      fireEvent.change(textInput, { target: { value: 'a' } });
      
      // Continue typing less than 10 characters
      fireEvent.change(textInput, { target: { value: 'short' } });
      
      // Wait for debounced validation
      await waitFor(
        () => {
          expect(screen.getByText('Text must be at least 10 characters')).toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });

    it('provides placeholder text with examples', () => {
      const onSubmit = vi.fn();
      render(<InputForm onSubmit={onSubmit} loading={false} demoMode={false} />);

      const textInput = screen.getByLabelText('Text to analyze');
      
      // Check placeholder includes minimum character requirement and examples
      expect(textInput).toHaveAttribute('placeholder');
      const placeholder = textInput.getAttribute('placeholder') || '';
      expect(placeholder).toContain('minimum 10 characters');
      expect(placeholder).toContain('Example:');
    });

    it('allows submission with valid text (10+ characters)', async () => {
      const onSubmit = vi.fn();
      render(<InputForm onSubmit={onSubmit} loading={false} demoMode={false} />);

      const textInput = screen.getByLabelText('Text to analyze');
      const submitButton = screen.getByRole('button', { name: /analyze/i });
      
      // Type valid text
      fireEvent.change(textInput, { target: { value: 'This is a valid claim with enough characters' } });
      
      // Wait for validation
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      }, { timeout: 500 });
      
      // Submit
      fireEvent.click(submitButton);
      
      expect(onSubmit).toHaveBeenCalledWith(
        'This is a valid claim with enough characters',
        undefined,
        undefined
      );
    });

    it('allows submission with URL even if text is less than 10 characters', async () => {
      const onSubmit = vi.fn();
      render(<InputForm onSubmit={onSubmit} loading={false} demoMode={false} />);

      const textInput = screen.getByLabelText('Text to analyze');
      const urlInput = screen.getByLabelText('URL to analyze');
      const submitButton = screen.getByRole('button', { name: /analyze/i });
      
      // Type short text
      fireEvent.change(textInput, { target: { value: 'short' } });
      
      // Type valid URL
      fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
      
      // Wait for validation
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      }, { timeout: 500 });
      
      // Should not show error because URL is provided
      expect(screen.queryByText('Text must be at least 10 characters')).not.toBeInTheDocument();
    });

    it('displays error when neither text nor URL is provided', async () => {
      const onSubmit = vi.fn();
      render(<InputForm onSubmit={onSubmit} loading={false} demoMode={false} />);

      const textInput = screen.getByLabelText('Text to analyze');
      const submitButton = screen.getByRole('button', { name: /analyze/i });
      
      // Touch the field
      fireEvent.change(textInput, { target: { value: 'a' } });
      fireEvent.change(textInput, { target: { value: '' } });
      
      // Wait for validation
      await waitFor(
        () => {
          expect(screen.getByText('Please provide either text or a URL to analyze')).toBeInTheDocument();
        },
        { timeout: 500 }
      );
      
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Loading State Improvements - Task 5.2', () => {
    it('displays loading spinner immediately on submit', () => {
      const onSubmit = vi.fn();
      render(<InputForm onSubmit={onSubmit} loading={true} demoMode={false} />);

      const submitButton = screen.getByRole('button');
      
      // Check spinner is present
      const spinner = submitButton.querySelector('.spinner');
      expect(spinner).toBeInTheDocument();
      
      // Check button shows loading state
      expect(submitButton).toHaveTextContent('Analyzing claim...');
    });

    it('shows progress indication during analysis', () => {
      vi.useFakeTimers();
      const onSubmit = vi.fn();
      const { rerender } = render(
        <InputForm onSubmit={onSubmit} loading={false} demoMode={false} />
      );

      // Start loading
      act(() => {
        rerender(<InputForm onSubmit={onSubmit} loading={true} demoMode={false} />);
      });
      
      // Initial message
      expect(screen.getByText('Analyzing claim...')).toBeInTheDocument();
      
      // Advance time by 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      
      // Should show next message
      expect(screen.getByText('Retrieving evidence...')).toBeInTheDocument();
      
      // Advance time by another 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      
      // Should show third message
      expect(screen.getByText('Evaluating sources...')).toBeInTheDocument();
      
      vi.useRealTimers();
    });

    it('displays timeout message after 30 seconds', () => {
      vi.useFakeTimers();
      const onSubmit = vi.fn();
      const { rerender } = render(
        <InputForm onSubmit={onSubmit} loading={false} demoMode={false} />
      );

      // Start loading
      act(() => {
        rerender(<InputForm onSubmit={onSubmit} loading={true} demoMode={false} />);
      });
      
      // Timeout message should not be visible initially
      expect(screen.queryByText(/Analysis taking longer than expected/i)).not.toBeInTheDocument();
      
      // Advance time by 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000);
      });
      
      // Timeout message should now be visible
      expect(screen.getByText(/Analysis taking longer than expected. Please wait.../i)).toBeInTheDocument();
      
      vi.useRealTimers();
    });

    it('prevents duplicate submissions while analysis in progress', () => {
      const onSubmit = vi.fn();
      render(<InputForm onSubmit={onSubmit} loading={true} demoMode={false} />);

      const submitButton = screen.getByRole('button');
      
      // Button should be disabled during loading
      expect(submitButton).toBeDisabled();
      
      // Attempt to click (should not trigger onSubmit)
      fireEvent.click(submitButton);
      
      // onSubmit should not be called
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('resets loading state when loading completes', () => {
      vi.useFakeTimers();
      const onSubmit = vi.fn();
      const { rerender } = render(
        <InputForm onSubmit={onSubmit} loading={true} demoMode={false} />
      );

      // Advance time to show timeout message
      act(() => {
        vi.advanceTimersByTime(30000);
      });
      
      expect(screen.getByText(/Analysis taking longer than expected/i)).toBeInTheDocument();
      
      // Stop loading
      act(() => {
        rerender(<InputForm onSubmit={onSubmit} loading={false} demoMode={false} />);
      });
      
      // Timeout message should be gone
      expect(screen.queryByText(/Analysis taking longer than expected/i)).not.toBeInTheDocument();
      
      // Button should show default text
      expect(screen.getByRole('button', { name: /analyze content/i })).toBeInTheDocument();
      
      vi.useRealTimers();
    });

    it('has accessible ARIA attributes for loading state', () => {
      const onSubmit = vi.fn();
      render(<InputForm onSubmit={onSubmit} loading={true} demoMode={false} />);

      const submitButton = screen.getByRole('button');
      
      // Check ARIA label updates with loading message
      expect(submitButton).toHaveAttribute('aria-label', 'Analyzing claim...');
      
      // Check ARIA live region
      expect(submitButton).toHaveAttribute('aria-live', 'polite');
    });
  });
});
