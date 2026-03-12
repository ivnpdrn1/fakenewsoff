/**
 * InputForm Component
 *
 * Input form for text and URL analysis with validation and debouncing.
 * Supports text input, URL input, and optional title field.
 *
 * Validates: Requirements 1.1, 1.2, 5.1, 5.2, 5.5, 8.1, 8.2, 8.3, 8.4, 8.5, 25.5
 */

import React from 'react';
import debounce from 'lodash.debounce';
import './InputForm.css';

interface InputFormProps {
  onSubmit: (text: string, url?: string, title?: string) => void;
  loading: boolean;
  initialText?: string;
}

interface LoadingState {
  message: string;
  showTimeout: boolean;
}

interface ValidationErrors {
  text?: string;
  url?: string;
}

/**
 * Input form with validation and debouncing
 *
 * Features:
 * - Text or URL required (at least one)
 * - Optional title field
 * - Debounced validation (300ms)
 * - Loading state with disabled inputs
 * - Progressive loading messages (Analyzing → Retrieving → Evaluating)
 * - Timeout message after 30 seconds
 * - Duplicate submission prevention via disabled state
 * - ARIA labels and semantic HTML
 * - Inline validation error messages
 */
const InputForm: React.FC<InputFormProps> = ({
  onSubmit,
  loading,
  initialText = '',
}) => {
  const [text, setText] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [errors, setErrors] = React.useState<ValidationErrors>({});
  const [touched, setTouched] = React.useState({ text: false, url: false });
  const [loadingState, setLoadingState] = React.useState<LoadingState>({
    message: 'Analyzing claim...',
    showTimeout: false,
  });

  // Update text when initialText changes (from example claims)
  React.useEffect(() => {
    if (initialText) {
      setText(initialText);
      setTouched((prev) => ({ ...prev, text: true }));
      // Clear validation errors when auto-filling
      setErrors({});
    }
  }, [initialText]);

  // Validation function
  const validate = React.useCallback(
    (textValue: string, urlValue: string): ValidationErrors => {
      const newErrors: ValidationErrors = {};

      // Text validation: minimum 10 characters if provided without URL
      if (textValue.trim() && textValue.trim().length < 10 && !urlValue.trim()) {
        newErrors.text = 'Text must be at least 10 characters';
      }

      // At least text or URL required
      if (!textValue.trim() && !urlValue.trim()) {
        newErrors.text = 'Please provide either text or a URL to analyze';
      }

      // URL format validation if provided
      if (urlValue.trim()) {
        try {
          new URL(urlValue);
        } catch {
          newErrors.url =
            'Please enter a valid URL (e.g., https://example.com)';
        }
      }

      return newErrors;
    },
    []
  );

  // Debounced validation (300ms)
  const debouncedValidate = React.useMemo(
    () =>
      debounce((textValue: string, urlValue: string) => {
        const validationErrors = validate(textValue, urlValue);
        setErrors(validationErrors);
      }, 300),
    [validate]
  );

  // Cleanup debounce on unmount
  React.useEffect(() => {
    return () => {
      debouncedValidate.cancel();
    };
  }, [debouncedValidate]);

  // Loading state progression with timeout message
  React.useEffect(() => {
    if (!loading) {
      // Reset loading state when not loading
      setLoadingState({
        message: 'Analyzing claim...',
        showTimeout: false,
      });
      return;
    }

    // Progress messages sequence
    const messages = [
      'Analyzing claim...',
      'Retrieving evidence...',
      'Evaluating sources...',
    ];
    let messageIndex = 0;

    // Update progress message every 5 seconds
    const progressInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      setLoadingState((prev) => ({
        ...prev,
        message: messages[messageIndex],
      }));
    }, 5000);

    // Show timeout message after 30 seconds
    const timeoutTimer = setTimeout(() => {
      setLoadingState({
        message: 'Retrieving evidence...',
        showTimeout: true,
      });
    }, 30000);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(timeoutTimer);
    };
  }, [loading]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);
    // Show validation errors as user types (after first touch)
    if (touched.text) {
      debouncedValidate(value, url);
    }
    // Mark as touched after first character
    if (value.length > 0 && !touched.text) {
      setTouched((prev) => ({ ...prev, text: true }));
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrl(value);
    // Show validation errors as user types (after first touch)
    if (touched.url) {
      debouncedValidate(text, value);
    }
    // Mark as touched after first character
    if (value.length > 0 && !touched.url) {
      setTouched((prev) => ({ ...prev, url: true }));
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleTextBlur = () => {
    setTouched((prev) => ({ ...prev, text: true }));
    const validationErrors = validate(text, url);
    setErrors(validationErrors);
  };

  const handleUrlBlur = () => {
    setTouched((prev) => ({ ...prev, url: true }));
    const validationErrors = validate(text, url);
    setErrors(validationErrors);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched
    setTouched({ text: true, url: true });

    // Validate
    const validationErrors = validate(text, url);
    setErrors(validationErrors);

    // Submit if no errors
    if (Object.keys(validationErrors).length === 0) {
      onSubmit(text.trim(), url.trim() || undefined, title.trim() || undefined);
    }
  };

  const hasErrors = Object.keys(errors).length > 0;
  const canSubmit = !loading && !hasErrors && (text.trim() || url.trim());

  return (
    <form className="input-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="text-input" className="form-label">
          Text to Analyze
        </label>
        <textarea
          id="text-input"
          className={`form-textarea ${errors.text && touched.text ? 'form-input-error' : ''}`}
          value={text}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          disabled={loading}
          placeholder="Enter a claim to analyze (minimum 10 characters). Example: 'The moon landing was faked in 1969' or 'Vaccines cause autism'"
          rows={6}
          aria-label="Text to analyze"
          aria-invalid={!!(errors.text && touched.text)}
          aria-describedby={
            errors.text && touched.text ? 'text-error' : undefined
          }
        />
        {errors.text && touched.text && (
          <span id="text-error" className="form-error" role="alert">
            {errors.text}
          </span>
        )}
      </div>

      <div className="form-divider">
        <span>OR</span>
      </div>

      <div className="form-group">
        <label htmlFor="url-input" className="form-label">
          URL to Analyze
        </label>
        <input
          id="url-input"
          type="text"
          className={`form-input ${errors.url && touched.url ? 'form-input-error' : ''}`}
          value={url}
          onChange={handleUrlChange}
          onBlur={handleUrlBlur}
          disabled={loading}
          placeholder="https://example.com/article"
          aria-label="URL to analyze"
          aria-invalid={!!(errors.url && touched.url)}
          aria-describedby={errors.url && touched.url ? 'url-error' : undefined}
        />
        {errors.url && touched.url && (
          <span id="url-error" className="form-error" role="alert">
            {errors.url}
          </span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="title-input" className="form-label">
          Title (Optional)
        </label>
        <input
          id="title-input"
          type="text"
          className="form-input"
          value={title}
          onChange={handleTitleChange}
          disabled={loading}
          placeholder="Article or content title"
          aria-label="Content title (optional)"
        />
      </div>

      <button
        type="submit"
        className="form-submit-button"
        disabled={!canSubmit}
        aria-label={loading ? loadingState.message : 'Analyze content'}
        aria-live={loading ? 'polite' : undefined}
      >
        {loading ? (
          <>
            <span className="spinner" aria-hidden="true"></span>
            {loadingState.message}
          </>
        ) : (
          'Analyze'
        )}
      </button>

      {loading && loadingState.showTimeout && (
        <div className="loading-timeout-message" role="status" aria-live="polite">
          ⏳ Analysis taking longer than expected. Please wait...
        </div>
      )}
    </form>
  );
};

export default InputForm;
