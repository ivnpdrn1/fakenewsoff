/**
 * InputForm Component
 *
 * Input form for text and URL analysis with validation and debouncing.
 * Supports text input, URL input, and optional title field.
 *
 * Validates: Requirements 1.1, 1.2, 5.1, 5.2, 5.5, 25.5
 */

import React from 'react';
import debounce from 'lodash.debounce';
import './InputForm.css';

interface InputFormProps {
  onSubmit: (text: string, url?: string, title?: string) => void;
  loading: boolean;
  demoMode: boolean;
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
 * - ARIA labels and semantic HTML
 * - Inline validation error messages
 */
const InputForm: React.FC<InputFormProps> = ({
  onSubmit,
  loading,
  demoMode,
}) => {
  const [text, setText] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [errors, setErrors] = React.useState<ValidationErrors>({});
  const [touched, setTouched] = React.useState({ text: false, url: false });

  // Validation function
  const validate = React.useCallback(
    (textValue: string, urlValue: string): ValidationErrors => {
      const newErrors: ValidationErrors = {};

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

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);
    if (touched.text) {
      debouncedValidate(value, url);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrl(value);
    if (touched.url) {
      debouncedValidate(text, value);
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
          placeholder="Enter text to analyze for misinformation..."
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
        aria-label={loading ? 'Analyzing...' : 'Analyze content'}
      >
        {loading ? (
          <>
            <span className="spinner" aria-hidden="true"></span>
            Analyzing...
          </>
        ) : (
          'Analyze'
        )}
      </button>

      {demoMode && (
        <div className="demo-hint" role="status">
          💡 Demo mode active: Try keywords like "fake", "disputed", "verified",
          "bias", or "manipulated"
        </div>
      )}
    </form>
  );
};

export default InputForm;
