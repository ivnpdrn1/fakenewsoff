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

  // Calculate summary counts
  const supportCount = supports.length;
  const contradictCount = contradicts.length;
  const mentionUnclearCount = mentions.length + unclear.length;

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
          <svg viewBox="0 0 800 400" className="graph-svg">
            {/* Center claim node */}
            <g className="node claim-node">
              <circle cx="400" cy="200" r="60" />
              <text
                x="400"
                y="200"
                textAnchor="middle"
                dominantBaseline="middle"
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
        Sources: {sources.length} — Supports: {supportCount} — Contradicts:{' '}
        {contradictCount} — Mentions/Unclear: {mentionUnclearCount}
      </div>
      <div className="graph-container">
        <svg viewBox="0 0 800 500" className="graph-svg">
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
          <g className="node claim-node">
            <circle cx="400" cy="250" r="50" />
            <text x="400" y="250" textAnchor="middle" dominantBaseline="middle">
              Claim
            </text>
          </g>

          {/* Render supports sources (right side) */}
          {supports.map((source, index) => {
            const y = 100 + index * 120;
            const x = 600;
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
                />
                {/* Node */}
                <g
                  className="node source-node supports-node"
                  onClick={() => handleSourceClick(source.url)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx={x} cy={y} r="50" />
                  <text
                    x={x}
                    y={y - 10}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="source-title"
                  >
                    {source.domain}
                  </text>
                  <text
                    x={x}
                    y={y + 10}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="source-stance"
                  >
                    Supports
                  </text>
                  <title>
                    {source.title}\n{source.domain}\n
                    {source.publishDate
                      ? new Date(source.publishDate).toLocaleDateString()
                      : ''}
                  </title>
                </g>
              </g>
            );
          })}

          {/* Render contradicts sources (left side) */}
          {contradicts.map((source, index) => {
            const y = 100 + index * 120;
            const x = 200;
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
                />
                {/* Node */}
                <g
                  className="node source-node contradicts-node"
                  onClick={() => handleSourceClick(source.url)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx={x} cy={y} r="50" />
                  <text
                    x={x}
                    y={y - 10}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="source-title"
                  >
                    {source.domain}
                  </text>
                  <text
                    x={x}
                    y={y + 10}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="source-stance"
                  >
                    Contradicts
                  </text>
                  <title>
                    {source.title}\n{source.domain}\n
                    {source.publishDate
                      ? new Date(source.publishDate).toLocaleDateString()
                      : ''}
                  </title>
                </g>
              </g>
            );
          })}

          {/* Render mentions/unclear sources (bottom) */}
          {[...mentions, ...unclear].map((source, index) => {
            const x = 300 + index * 120;
            const y = 420;
            const stance =
              source.stance === 'mentions' ? 'mentions' : 'unclear';
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
                />
                {/* Node */}
                <g
                  className={`node source-node ${stance}-node`}
                  onClick={() => handleSourceClick(source.url)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx={x} cy={y} r="45" />
                  <text
                    x={x}
                    y={y - 8}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="source-title"
                  >
                    {source.domain}
                  </text>
                  <text
                    x={x}
                    y={y + 8}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="source-stance"
                  >
                    {stance === 'mentions' ? 'Mentions' : 'Unclear'}
                  </text>
                  <title>
                    {source.title}\n{source.domain}\n
                    {source.publishDate
                      ? new Date(source.publishDate).toLocaleDateString()
                      : ''}
                  </title>
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
