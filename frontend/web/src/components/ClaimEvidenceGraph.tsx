/**
 * Claim Evidence Graph Component
 *
 * Visualizes the relationship between a claim and its evidence sources.
 * Shows stance (supports/contradicts/mentions/unclear) with deterministic layout.
 */

import React from 'react';
import type { NormalizedSourceWithStance } from '../../../shared/schemas/index.js';
import './ClaimEvidenceGraph.css';

interface ClaimEvidenceGraphProps {
  sources: NormalizedSourceWithStance[];
}

/**
 * Format credibility tier for display
 */
const formatCredibilityTier = (tier: 1 | 2 | 3): string => {
  switch (tier) {
    case 1:
      return 'High';
    case 2:
      return 'Medium';
    case 3:
      return 'Low';
    default:
      return 'Unknown';
  }
};

/**
 * Create tooltip text with all source details
 */
const createTooltipText = (source: NormalizedSourceWithStance): string => {
  const date = source.publishDate
    ? new Date(source.publishDate).toLocaleDateString()
    : 'No date';
  const credibility = formatCredibilityTier(source.credibilityTier);
  
  return `${source.title}\n${source.domain}\n${date}\nCredibility: ${credibility}`;
};

/**
 * Create ARIA label for source node
 */
const createAriaLabel = (source: NormalizedSourceWithStance, stance: string): string => {
  const date = source.publishDate
    ? new Date(source.publishDate).toLocaleDateString()
    : 'No date';
  const credibility = formatCredibilityTier(source.credibilityTier);
  
  return `${stance} source: ${source.title} from ${source.domain}, published ${date}, ${credibility} credibility. Click to open in new tab.`;
};

/**
 * Claim Evidence Graph - Visual representation of claim vs sources
 *
 * Features:
 * - Center node: Claim
 * - Source nodes grouped by stance
 * - Clickable source nodes (open URL in new tab)
 * - Hover tooltips with source details
 * - Empty state for zero sources
 * - Deterministic layout (no physics jitter)
 */
const ClaimEvidenceGraph: React.FC<ClaimEvidenceGraphProps> = ({ sources }) => {
  // Group sources by stance
  const supports = sources.filter((s) => s.stance === 'supports');
  const contradicts = sources.filter((s) => s.stance === 'contradicts');
  const mentions = sources.filter((s) => s.stance === 'mentions');
  const unclear = sources.filter((s) => s.stance === 'unclear');

  // Calculate summary counts (before limiting)
  const totalSourceCount = sources.length;
  const supportCount = supports.length;
  const contradictCount = contradicts.length;
  const mentionUnclearCount = mentions.length + unclear.length;

  // Limit to top 10 sources when >10 available (safety-first: prioritize contradicting)
  let displaySources = sources;
  let isLimited = false;
  
  if (sources.length > 10) {
    isLimited = true;
    
    // Sort by priority: contradicts first, then by score
    const sortedSources = [...sources].sort((a, b) => {
      // Contradicting sources have highest priority
      if (a.stance === 'contradicts' && b.stance !== 'contradicts') return -1;
      if (a.stance !== 'contradicts' && b.stance === 'contradicts') return 1;
      
      // Within same priority, sort by score (higher first)
      return b.score - a.score;
    });
    
    displaySources = sortedSources.slice(0, 10);
  }
  
  // Re-group display sources by stance
  const displaySupports = displaySources.filter((s) => s.stance === 'supports');
  const displayContradicts = displaySources.filter((s) => s.stance === 'contradicts');
  const displayMentions = displaySources.filter((s) => s.stance === 'mentions');
  const displayUnclear = displaySources.filter((s) => s.stance === 'unclear');

  // Handle source click
  const handleSourceClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Render empty state
  if (sources.length === 0) {
    return (
      <div className="claim-evidence-graph-card">
        <h3 className="graph-title">Claim Evidence Graph</h3>
        <div className="graph-summary">
          Sources: 0 — Supports: 0 — Contradicts: 0 — Mentions/Unclear: 0
        </div>
        <div className="graph-container empty-state">
          <svg 
            viewBox="0 0 800 500" 
            className="graph-svg"
            role="img"
            aria-label="Empty claim evidence graph with no sources found"
          >
            {/* Center claim node */}
            <g className="node claim-node" role="img" aria-label="Central claim node">
              <circle cx="400" cy="250" r="50" />
              <text
                x="400"
                y="250"
                textAnchor="middle"
                dominantBaseline="middle"
                aria-hidden="true"
              >
                Claim
              </text>
            </g>
          </svg>
          <div className="empty-state-message">
            No evidence sources found for this analysis.
          </div>
        </div>
      </div>
    );
  }

  // Render graph with sources
  return (
    <div className="claim-evidence-graph-card">
      <h3 className="graph-title">Claim Evidence Graph</h3>
      <div className="graph-summary">
        Sources: {totalSourceCount} — Supports: {supportCount} — Contradicts:{' '}
        {contradictCount} — Mentions/Unclear: {mentionUnclearCount}
      </div>
      {isLimited && (
        <div className="graph-limit-message">
          Showing top 10 of {totalSourceCount} sources (prioritizing contradicting sources)
        </div>
      )}
      <div className="graph-container">
        <svg 
          viewBox="0 0 800 500" 
          className="graph-svg"
          role="img"
          aria-label={`Claim evidence graph showing ${sources.length} sources: ${supportCount} supporting, ${contradictCount} contradicting, ${mentionUnclearCount} mentioning or unclear`}
        >
          {/* Define markers for edge arrows */}
          <defs>
            <marker
              id="arrow-supports"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="#22c55e" />
            </marker>
            <marker
              id="arrow-contradicts"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="#ef4444" />
            </marker>
            <marker
              id="arrow-mentions"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="#3b82f6" />
            </marker>
            <marker
              id="arrow-unclear"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="#9ca3af" />
            </marker>
          </defs>

          {/* Center claim node */}
          <g className="node claim-node" role="img" aria-label="Central claim node">
            <circle cx="400" cy="250" r="50" />
            <text x="400" y="250" textAnchor="middle" dominantBaseline="middle" aria-hidden="true">
              Claim
            </text>
          </g>

          {/* Render supports sources (right side) */}
          {displaySupports.map((source, index) => {
            const y = 100 + index * 120;
            const x = 600;
            const ariaLabel = createAriaLabel(source, 'Supporting');
            return (
              <g key={`supports-${index}`}>
                {/* Edge */}
                <line
                  x1="450"
                  y1="250"
                  x2={x - 55}
                  y2={y}
                  className="edge edge-supports"
                  markerEnd="url(#arrow-supports)"
                  aria-hidden="true"
                />
                {/* Node */}
                <g
                  className="node source-node supports-node"
                  onClick={() => handleSourceClick(source.url)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSourceClick(source.url);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                  role="button"
                  tabIndex={0}
                  aria-label={ariaLabel}
                >
                  <circle cx={x} cy={y} r="50" />
                  <text
                    x={x}
                    y={y - 10}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="source-title"
                    aria-hidden="true"
                  >
                    {source.domain}
                  </text>
                  <text
                    x={x}
                    y={y + 10}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="source-stance"
                    aria-hidden="true"
                  >
                    Supports
                  </text>
                  <title>{createTooltipText(source)}</title>
                </g>
              </g>
            );
          })}

          {/* Render contradicts sources (left side) */}
          {displayContradicts.map((source, index) => {
            const y = 100 + index * 120;
            const x = 200;
            const ariaLabel = createAriaLabel(source, 'Contradicting');
            return (
              <g key={`contradicts-${index}`}>
                {/* Edge */}
                <line
                  x1="350"
                  y1="250"
                  x2={x + 55}
                  y2={y}
                  className="edge edge-contradicts"
                  markerEnd="url(#arrow-contradicts)"
                  aria-hidden="true"
                />
                {/* Node */}
                <g
                  className="node source-node contradicts-node"
                  onClick={() => handleSourceClick(source.url)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSourceClick(source.url);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                  role="button"
                  tabIndex={0}
                  aria-label={ariaLabel}
                >
                  <circle cx={x} cy={y} r="50" />
                  <text
                    x={x}
                    y={y - 10}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="source-title"
                    aria-hidden="true"
                  >
                    {source.domain}
                  </text>
                  <text
                    x={x}
                    y={y + 10}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="source-stance"
                    aria-hidden="true"
                  >
                    Contradicts
                  </text>
                  <title>{createTooltipText(source)}</title>
                </g>
              </g>
            );
          })}

          {/* Render mentions/unclear sources (bottom) */}
          {[...displayMentions, ...displayUnclear].map((source, index) => {
            const x = 300 + index * 120;
            const y = 420;
            const stance =
              source.stance === 'mentions' ? 'mentions' : 'unclear';
            const stanceLabel = stance === 'mentions' ? 'Mentions' : 'Unclear';
            const ariaLabel = createAriaLabel(source, stanceLabel);
            return (
              <g key={`${stance}-${index}`}>
                {/* Edge */}
                <line
                  x1="400"
                  y1="300"
                  x2={x}
                  y2={y - 55}
                  className={`edge edge-${stance}`}
                  markerEnd={`url(#arrow-${stance})`}
                  strokeDasharray={stance === 'mentions' ? '5,5' : '2,2'}
                  aria-hidden="true"
                />
                {/* Node */}
                <g
                  className={`node source-node ${stance}-node`}
                  onClick={() => handleSourceClick(source.url)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSourceClick(source.url);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                  role="button"
                  tabIndex={0}
                  aria-label={ariaLabel}
                >
                  <circle cx={x} cy={y} r="45" />
                  <text
                    x={x}
                    y={y - 8}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="source-title"
                    aria-hidden="true"
                  >
                    {source.domain}
                  </text>
                  <text
                    x={x}
                    y={y + 8}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="source-stance"
                    aria-hidden="true"
                  >
                    {stanceLabel}
                  </text>
                  <title>{createTooltipText(source)}</title>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default ClaimEvidenceGraph;
