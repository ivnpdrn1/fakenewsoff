/**
 * Results Page
 *
 * Displays analysis results with ResultsCard component.
 * Receives AnalysisResponse from location.state and provides navigation back to home.
 *
 * Validates: Requirements 1.4, 4.1, 4.2, 4.5
 */

import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import ResultsCard from '../components/ResultsCard.js';
import ApiStatus from '../components/ApiStatus.js';
import ClaimEvidenceGraph from '../components/ClaimEvidenceGraph.js';
import type { AnalysisResponse } from '../../../shared/schemas/index.js';
import './Results.css';

interface LocationState {
  response?: AnalysisResponse;
}

/**
 * Results page displaying analysis results
 *
 * Features:
 * - Displays ResultsCard component with analysis response
 * - Receives AnalysisResponse from location.state
 * - "New Analysis" button navigating back to home
 * - Redirects to home if no response in state
 * - Clean layout with proper spacing
 * - Shows fallback banner if production mode was unavailable
 */
function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;

  // Redirect to home if no response in state
  if (!state || !state.response) {
    return <Navigate to="/" replace />;
  }

  const handleNewAnalysis = () => {
    navigate('/');
  };

  // Extract sources from text_grounding if available
  const graphSources = state.response.text_grounding?.sources || [];

  return (
    <div className="results">
      <div className="results-container">
        <header className="results-page-header">
          <h1>Analysis Results</h1>
          <button
            className="new-analysis-button"
            onClick={handleNewAnalysis}
            aria-label="Start new analysis"
          >
            ← New Analysis
          </button>
        </header>

        {/* Claim Evidence Graph - Show if we have text grounding sources */}
        {graphSources.length > 0 && (
          <ClaimEvidenceGraph sources={graphSources} />
        )}

        <ResultsCard response={state.response} />

        <ApiStatus lastGroundingMetadata={state.response.grounding} />
      </div>
    </div>
  );
}

export default Results;
