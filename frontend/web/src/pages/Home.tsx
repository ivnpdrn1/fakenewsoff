/**
 * Home Page
 *
 * Entry point for content analysis with InputForm, demo mode toggle, and API integration.
 * Handles form submission, loading states, error handling, and navigation to results.
 *
 * Validates: Requirements 1.1, 1.3, 2.1, 2.2, 2.3, 2.5
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import InputForm from '../components/InputForm.js';
import ErrorState from '../components/ErrorState.js';
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
 * - Error display on failure
 * - Loading state management
 */
function Home() {
  const navigate = useNavigate();
  const { demoMode, setDemoMode } = useDemoMode();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);

  const handleSubmit = async (text: string, url?: string, title?: string) => {
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
        // Navigate to results page with response data
        navigate('/results', {
          state: { response: result.data },
        });
      } else {
        // Display error
        setError(result.error);
      }
    } catch (err) {
      // Unexpected error (shouldn't happen with Result type)
      console.error('Unexpected error:', err);
      setError({
        type: 'unknown',
        message: 'An unexpected error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
  };

  const handleDemoModeToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDemoMode(e.target.checked);
  };

  return (
    <div className="home">
      <div className="home-container">
        <header className="home-header">
          <h1>FakeNewsOff</h1>
          <p className="subtitle">Real-time misinformation detection</p>
        </header>

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
          <ErrorState error={error} onRetry={handleRetry} />
        ) : (
          <InputForm
            onSubmit={handleSubmit}
            loading={loading}
            demoMode={demoMode}
          />
        )}
      </div>
    </div>
  );
}

export default Home;
