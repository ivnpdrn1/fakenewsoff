/**
 * Extension Popup UI
 *
 * Main UI for the browser extension popup.
 * Captures selected text, analyzes content, and displays results.
 *
 * Validates: Requirements 6.1, 6.4, 6.5, 8.1, 8.2, 8.3, 8.5
 */

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { analyzeContent } from '../../shared/api/client.js';
import { getUserFriendlyErrorMessage } from '../../shared/utils/errors.js';
import type { AnalysisResponse } from '../../shared/schemas/index.js';
import type { ApiError } from '../../shared/utils/errors.js';
import './popup.css';

// ============================================================================
// Types
// ============================================================================

type ViewState = 'input' | 'loading' | 'results' | 'error';

// ============================================================================
// StatusBadge Component
// ============================================================================

interface StatusBadgeProps {
  label: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ label }) => {
  const className = `status-badge status-badge-${label.toLowerCase().replace(' ', '-')}`;
  return (
    <span className={className} role="status" aria-label={`Status: ${label}`}>
      {label}
    </span>
  );
};

// ============================================================================
// Main Popup Component
// ============================================================================

function Popup() {
  const [viewState, setViewState] = useState<ViewState>('input');
  const [text, setText] = useState<string>('');
  const [response, setResponse] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [demoMode, setDemoMode] = useState<boolean>(false);

  // Load demo mode preference and selected text on mount
  useEffect(() => {
    // Load demo mode preference from chrome.storage.local
    chrome.storage.local.get(['demoMode'], (result) => {
      if (result.demoMode !== undefined) {
        setDemoMode(result.demoMode);
      }
    });

    // Request selected text from content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: 'GET_SELECTION' },
          (response) => {
            // Check for errors (e.g., content script not loaded)
            if (chrome.runtime.lastError) {
              console.warn(
                'Could not get selection:',
                chrome.runtime.lastError
              );
              // Fall back to page snippet
              chrome.tabs.sendMessage(
                tabs[0].id!,
                { type: 'GET_PAGE_SNIPPET' },
                (snippetResponse) => {
                  if (chrome.runtime.lastError) {
                    console.warn(
                      'Could not get snippet:',
                      chrome.runtime.lastError
                    );
                  } else if (snippetResponse?.text) {
                    setText(snippetResponse.text);
                  }
                }
              );
            } else if (response?.text) {
              setText(response.text);
            } else {
              // No selection, request page snippet
              chrome.tabs.sendMessage(
                tabs[0].id!,
                { type: 'GET_PAGE_SNIPPET' },
                (snippetResponse) => {
                  if (chrome.runtime.lastError) {
                    console.warn(
                      'Could not get snippet:',
                      chrome.runtime.lastError
                    );
                  } else if (snippetResponse?.text) {
                    setText(snippetResponse.text);
                  }
                }
              );
            }
          }
        );
      }
    });
  }, []);

  // Handle analyze button click
  const handleAnalyze = async () => {
    if (!text.trim()) {
      setError({
        type: 'validation',
        message: 'Please enter or select some text to analyze',
        details: ['text: must not be empty'],
      });
      setViewState('error');
      return;
    }

    setViewState('loading');
    setError(null);

    const result = await analyzeContent({
      text: text.trim(),
      demoMode,
    });

    if (result.success) {
      setResponse(result.data);
      setViewState('results');
    } else {
      setError(result.error);
      setViewState('error');
      console.error('Analysis error:', result.error);
    }
  };

  // Handle demo mode toggle
  const handleDemoModeToggle = (checked: boolean) => {
    setDemoMode(checked);
    chrome.storage.local.set({ demoMode: checked });
  };

  // Handle "View Full Analysis" button
  const handleViewFullAnalysis = () => {
    if (response) {
      const webUiUrl = `http://localhost:5173/results?request_id=${response.request_id}`;
      chrome.tabs.create({ url: webUiUrl });
    }
  };

  // Handle "New Analysis" button
  const handleNewAnalysis = () => {
    setViewState('input');
    setResponse(null);
    setError(null);
  };

  // Truncate recommendation to 200 characters
  const truncateRecommendation = (recommendation: string): string => {
    if (recommendation.length <= 200) {
      return recommendation;
    }
    return recommendation.substring(0, 197) + '...';
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1 className="popup-title">FakeNewsOff</h1>
        {demoMode && (
          <div
            className="demo-indicator"
            role="status"
            aria-label="Demo mode active"
          >
            🎭 Demo
          </div>
        )}
      </header>

      {/* Input View */}
      {viewState === 'input' && (
        <div className="popup-content">
          <div className="input-section">
            <label htmlFor="text-input" className="input-label">
              Text to analyze:
            </label>
            <textarea
              id="text-input"
              className="text-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter text or select text on the page..."
              rows={6}
              aria-label="Text to analyze"
            />
          </div>

          <div className="demo-mode-section">
            <label className="demo-mode-label">
              <input
                type="checkbox"
                checked={demoMode}
                onChange={(e) => handleDemoModeToggle(e.target.checked)}
                aria-label="Enable demo mode"
              />
              <span>Demo Mode</span>
            </label>
          </div>

          <button
            className="analyze-button"
            onClick={handleAnalyze}
            disabled={!text.trim()}
            aria-label="Analyze content"
          >
            Analyze
          </button>
        </div>
      )}

      {/* Loading View */}
      {viewState === 'loading' && (
        <div className="popup-content">
          <div className="loading-state">
            <div
              className="spinner"
              role="status"
              aria-label="Analyzing content"
            >
              <div className="spinner-circle"></div>
            </div>
            <p className="loading-text">Analyzing content...</p>
          </div>
        </div>
      )}

      {/* Results View */}
      {viewState === 'results' && response && (
        <div className="popup-content">
          <div className="results-section">
            <div className="status-section">
              <StatusBadge label={response.status_label} />
              <div className="confidence-section">
                <span className="confidence-label">Confidence:</span>
                <span className="confidence-value">
                  {response.confidence_score}%
                </span>
              </div>
            </div>

            <div className="recommendation-section">
              <h2 className="recommendation-title">Recommendation</h2>
              <p className="recommendation-text">
                {truncateRecommendation(response.recommendation)}
              </p>
            </div>

            <div className="actions-section">
              <button
                className="view-full-button"
                onClick={handleViewFullAnalysis}
                aria-label="View full analysis in web UI"
              >
                View Full Analysis
              </button>
              <button
                className="new-analysis-button"
                onClick={handleNewAnalysis}
                aria-label="Start new analysis"
              >
                New Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error View */}
      {viewState === 'error' && error && (
        <div className="popup-content">
          <div className="error-state">
            <div className="error-icon" role="img" aria-label="Error">
              ⚠️
            </div>
            <p className="error-message">
              {getUserFriendlyErrorMessage(error)}
            </p>
            <button
              className="retry-button"
              onClick={handleNewAnalysis}
              aria-label="Try again"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Mount React App
// ============================================================================

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
