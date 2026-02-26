/**
 * SourceList Component
 *
 * Displays 0-3 credible sources with title, snippet, URL, and credibility explanation.
 * Shows empty state when no sources are available.
 *
 * Validates: Requirements 3.3, 5.5
 */

import React from 'react';
import type { CredibleSource } from '../../../shared/schemas/index.js';
import './SourceList.css';

interface SourceListProps {
  sources: CredibleSource[];
}

/**
 * List component for displaying credible sources
 *
 * Features:
 * - Displays 0-3 sources with all fields
 * - Links open in new tab with security attributes
 * - Empty state when no sources available
 * - Semantic list markup for accessibility
 */
const SourceList: React.FC<SourceListProps> = ({ sources }) => {
  if (sources.length === 0) {
    return (
      <div className="source-list-empty">
        <p>No credible sources available for this analysis.</p>
      </div>
    );
  }

  return (
    <ul className="source-list" role="list">
      {sources.map((source, index) => (
        <li key={source.url} className="source-item">
          <div className="source-header">
            <h3 className="source-title">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Source ${index + 1}: ${source.title}`}
              >
                {source.title}
              </a>
            </h3>
            <span className="source-domain">{source.domain}</span>
          </div>

          <p className="source-snippet">{source.snippet}</p>

          <div className="source-credibility">
            <strong>Why credible:</strong> {source.why}
          </div>
        </li>
      ))}
    </ul>
  );
};

export default SourceList;
