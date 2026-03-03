/**
 * ResultsCard Component
 *
 * Displays full analysis results including status, confidence, recommendation,
 * sources, SIFT guidance, media risk, and misinformation type.
 *
 * Validates: Requirements 1.4, 3.1-3.7, 5.5
 */

import React from 'react';
import type { AnalysisResponse } from '../../../shared/schemas/index.js';
import StatusBadge from './StatusBadge.js';
import SourceList from './SourceList.js';
import SIFTPanel from './SIFTPanel.js';
import './ResultsCard.css';

interface ResultsCardProps {
  response: AnalysisResponse;
}

/**
 * Comprehensive analysis results display
 *
 * Features:
 * - Status badge with color coding
 * - Confidence score with progress bar
 * - Recommendation text
 * - Conditional media risk display
 * - Conditional misinformation type display
 * - Credible sources list
 * - SIFT framework guidance
 * - Copy to clipboard and export JSON buttons
 */
const ResultsCard: React.FC<ResultsCardProps> = ({ response }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyToClipboard = () => {
    const summary = `
FakeNewsOff Analysis Results
============================

Status: ${response.status_label}
Confidence: ${response.confidence_score}%

Recommendation:
${response.recommendation}

${response.media_risk ? `Media Risk: ${response.media_risk}\n` : ''}
${response.misinformation_type ? `Misinformation Type: ${response.misinformation_type}\n` : ''}

Sources:
${response.sources.map((s, i) => `${i + 1}. ${s.title} (${s.domain})\n   ${s.url}`).join('\n')}

Request ID: ${response.request_id}
Timestamp: ${new Date(response.timestamp).toLocaleString()}
    `.trim();

    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(response, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analysis-${response.request_id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <article className="results-card">
      <header className="results-header">
        <div className="results-status-row">
          <StatusBadge label={response.status_label} />
          <div className="results-confidence">
            <span className="confidence-label">Confidence:</span>
            <span className="confidence-value">
              {response.confidence_score}%
            </span>
          </div>
        </div>

        <div className="confidence-bar-container">
          <div
            className="confidence-bar"
            style={{ width: `${response.confidence_score}%` }}
            role="progressbar"
            aria-valuenow={response.confidence_score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Confidence score: ${response.confidence_score}%`}
          />
        </div>
      </header>

      <section className="results-recommendation">
        <h2>Recommendation</h2>
        <p>{response.recommendation}</p>
      </section>

      {response.media_risk && (
        <section className="results-media-risk">
          <h3>Media Risk</h3>
          <span
            className={`media-risk-badge media-risk-${response.media_risk}`}
          >
            {response.media_risk.toUpperCase()}
          </span>
        </section>
      )}

      {response.misinformation_type && (
        <section className="results-misinfo-type">
          <h3>Misinformation Type</h3>
          <p className="misinfo-type-value">{response.misinformation_type}</p>
        </section>
      )}

      <section className="results-sources">
        <h2>Credible Sources</h2>
        <SourceList sources={response.sources} />
      </section>

      <section className="results-sift">
        <SIFTPanel guidance={response.sift_guidance} sources={response.sources} />
      </section>

      <footer className="results-actions">
        <button
          className="action-button"
          onClick={handleCopyToClipboard}
          aria-label="Copy analysis summary to clipboard"
        >
          {copied ? '✓ Copied!' : '📋 Copy to Clipboard'}
        </button>
        <button
          className="action-button"
          onClick={handleExportJSON}
          aria-label="Export analysis as JSON file"
        >
          💾 Export JSON
        </button>
      </footer>

      <div className="results-metadata">
        <span>Request ID: {response.request_id}</span>
        <span>Analyzed: {new Date(response.timestamp).toLocaleString()}</span>
      </div>
    </article>
  );
};

export default ResultsCard;
