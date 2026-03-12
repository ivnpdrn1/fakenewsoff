/**
 * Home Page
 *
 * Entry point for content analysis with InputForm, demo mode toggle, and API integration.
 * Handles form submission, loading states, error handling, and navigation to results.
 * Tracks retry attempts to provide contextual suggestions after repeated failures.
 *
 * Validates: Requirements 1.1, 1.3, 2.1, 2.2, 2.3, 2.5, 9.1, 9.2, 9.3, 9.4, 9.5, 29.1, 29.2, 29.4
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import InputForm from '../components/InputForm.js';
import ErrorState from '../components/ErrorState.js';
import ExampleClaims from '../components/ExampleClaims.js';
import ApiStatus from '../components/ApiStatus.js';
import { useDemoMode } from '../context/DemoModeContext.js';
import { analyzeContent } from '../../../shared/api/client.js';
import type { ApiError } from '../../../shared/utils/errors.js';
import './Home.css';

/**
 * Home page with input form and demo mode toggle
 *
 * Features:
 * - InputForm component for text/URL input
 * - Demo mode toggle with localStorage persistence
 * - Demo mode banner when active
 * - API integration with analyzeContent()
 * - Navigation to /results on success
 * - Error display on failure with input preservation
 * - Loading state management
 * - Retry functionality with preserved input
 * - Retry count tracking for contextual suggestions
 */
function Home() {
  const navigate = useNavigate();
  const { demoMode, setDemoMode } = useDemoMode();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);
  
  // Preserve user input for retry
  const [preservedText, setPreservedText] = React.useState<string>('');
  const [preservedUrl, setPreservedUrl] = React.useState<string | undefined>();
  const [preservedTitle, setPreservedTitle] = React.useState<string | undefined>();
  
  // Track retry attempts for showing suggestions
  const [retryCount, setRetryCount] = React.useState<number>(0);
  
  // State for auto-filled example claim
  const [exampleText, setExampleText] = React.useState<string>('');

  const handleSubmit = async (text: string, url?: string, title?: string) => {
    // Preserve input for potential retry
    setPreservedText(text);
    setPreservedUrl(url);
    setPreservedTitle(title);
    
    setLoading(true);
    setError(null);

    try {
      const result = await analyzeContent({
        text,
        url,
        title,
        demoMode,
      });

      if (result.success) {
        // Reset retry count on success
        setRetryCount(0);
        
        // Navigate to results page with response data
        navigate('/results', {
          state: { response: result.data },
        });
      } else {
        // Display error and increment retry count
        setError(result.error);
        setRetryCount(prev => prev + 1);
      }
    } catch (err) {
      // Unexpected error (shouldn't happen with Result type)
      console.error('Unexpected error:', err);
      setError({
        type: 'unknown',
        message: 'An unexpected error occurred',
      });
      setRetryCount(prev => prev + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    // Retry with preserved input
    if (preservedText) {
      setError(null);
      handleSubmit(preservedText, preservedUrl, preservedTitle);
    }
  };

  const handleCancel = () => {
    // Clear error and preserved input to return to clean state
    setError(null);
    setPreservedText('');
    setPreservedUrl(undefined);
    setPreservedTitle(undefined);
    setRetryCount(0);
  };

  const handleDemoModeToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDemoMode(e.target.checked);
  };

  const handleExampleClaimClick = (text: string, isDemoMode: boolean) => {
    // Auto-fill the input form with the example claim text
    setExampleText(text);
    // Clear any existing errors
    setError(null);
    // Enable demo mode for example claims to ensure they work correctly
    setDemoMode(isDemoMode);
  };

  return (
    <div className="home">
      <div className="home-container">
        <header className="home-header">
          <h1>FakeNewsOff</h1>
          <p className="subtitle">Real-time misinformation detection powered by evidence</p>
        </header>

        <ApiStatus />

        {demoMode && (
          <div className="demo-banner" role="status">
            🎭 Demo Mode Active - Using keyword-based responses
          </div>
        )}

        <div className="demo-mode-toggle">
          <label htmlFor="demo-mode-checkbox" className="toggle-label">
            <input
              id="demo-mode-checkbox"
              type="checkbox"
              checked={demoMode}
              onChange={handleDemoModeToggle}
              className="toggle-checkbox"
              aria-label="Toggle demo mode"
            />
            <span className="toggle-text">Demo Mode</span>
          </label>
          <p className="toggle-description">
            Enable demo mode to test without AWS credentials
          </p>
        </div>

        {error ? (
          <ErrorState 
            error={error} 
            onRetry={handleRetry} 
            onCancel={handleCancel}
            preservedInput={preservedText}
            retryCount={retryCount}
          />
        ) : (
          <>
            <ExampleClaims onClaimClick={handleExampleClaimClick} />
            <InputForm
              onSubmit={handleSubmit}
              loading={loading}
              demoMode={demoMode}
              initialText={exampleText}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default Home;
