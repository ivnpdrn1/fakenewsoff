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
import SIFTPanel from './SIFTPanel.js';
import './ResultsCard.css';

interface ResultsCardProps {
  response: AnalysisResponse;
}

/**
 * Get confidence level classification
 */
function getConfidenceLevel(score: number): 'low' | 'medium' | 'high' {
  if (score < 50) return 'low';
  if (score < 75) return 'medium';
  return 'high';
}

/**
 * Check if a source URL appears to be a generic page
 * Generic pages include: homepage, category pages, search pages, tag pages
 */
function isGenericPage(url: string, title: string): boolean {
  try {
    // Parse URL manually to work in both browser and test environments
    // Extract pathname and search from URL string
    let pathname = '';
    let search = '';
    
    try {
      // Try using URL constructor first (works in browser and modern test environments)
      const urlObj = new URL(url);
      pathname = urlObj.pathname.toLowerCase();
      search = urlObj.search.toLowerCase();
    } catch {
      // Fallback: manual parsing for environments where URL constructor fails
      const urlMatch = url.match(/^https?:\/\/[^/]+(\/[^?#]*)?(\?[^#]*)?/);
      if (urlMatch) {
        pathname = (urlMatch[1] || '/').toLowerCase();
        search = (urlMatch[2] || '').toLowerCase();
      } else {
        // Can't parse URL, don't filter it out
        return false;
      }
    }
    
    const titleLower = title.toLowerCase();
    
    // Homepage patterns
    if (pathname === '/' || pathname === '/index.html' || pathname === '/index.php') {
      return true;
    }
    
    // Category page patterns
    if (pathname.includes('/category/') || pathname.includes('/categories/') || 
        pathname.includes('/section/') || pathname.includes('/sections/')) {
      return true;
    }
    
    // Tag page patterns
    if (pathname.includes('/tag/') || pathname.includes('/tags/') || 
        pathname.includes('/topic/') || pathname.includes('/topics/')) {
      return true;
    }
    
    // Search page patterns
    if (pathname.includes('/search') || search.includes('?s=') || 
        search.includes('?q=') || search.includes('search=')) {
      return true;
    }
    
    // Latest news / archive patterns (only if it's just /news/ or /latest/ or /archive/ without specific article)
    const pathParts = pathname.split('/').filter(p => p.length > 0);
    if ((pathname.includes('/latest') || pathname.includes('/archive')) && pathParts.length <= 1) {
      return true;
    }
    // /news/ is only generic if it's exactly /news or /news/ (no article path after)
    if (pathname === '/news' || pathname === '/news/') {
      return true;
    }
    
    // Title-based detection for generic pages
    if (titleLower.includes('home page') || titleLower.includes('homepage') ||
        titleLower === 'home' || titleLower.includes('latest news') ||
        titleLower.includes('search results')) {
      return true;
    }
    
    return false;
  } catch {
    // If URL parsing fails, don't filter it out
    return false;
  }
}

/**
 * Filter out generic pages from sources
 */
function filterUsableSources<T extends { url: string; title: string }>(sources: T[]): T[] {
  return sources.filter(source => !isGenericPage(source.url, source.title));
}

/**
 * Get contextual confidence message based on score and orchestration metadata
 */
function getConfidenceMessage(score: number, response: AnalysisResponse): React.ReactNode {
  const level = getConfidenceLevel(score);
  const orchestration = response.orchestration;
  const textGrounding = response.text_grounding;

  // Build factors affecting confidence
  const factors: string[] = [];
  
  if (orchestration?.enabled) {
    // Evidence quality factor
    if (orchestration.average_quality >= 0.75) {
      factors.push('high-quality evidence');
    } else if (orchestration.average_quality >= 0.5) {
      factors.push('moderate-quality evidence');
    } else {
      factors.push('limited evidence quality');
    }

    // Source diversity factor
    if (orchestration.source_classes >= 2) {
      factors.push('diverse sources');
    } else if (orchestration.source_classes === 1) {
      factors.push('limited source diversity');
    }

    // Contradictions factor
    if (orchestration.contradictions_found) {
      factors.push('contradicting evidence found');
    }
  } else if (textGrounding) {
    // Fallback to text grounding metadata
    if (textGrounding.sources.length >= 3) {
      factors.push('multiple sources');
    } else if (textGrounding.sources.length > 0) {
      factors.push('limited sources');
    } else {
      factors.push('no sources found');
    }
  }

  // Build message based on confidence level
  if (level === 'low') {
    return (
      <div className="confidence-message confidence-warning">
        <div className="confidence-message-header">
          <span className="confidence-icon">⚠️</span>
          <strong>Low Confidence - Insufficient Evidence</strong>
        </div>
        <p className="confidence-message-text">
          We found limited evidence for this claim. This analysis may not be reliable.
        </p>
        {factors.length > 0 && (
          <p className="confidence-factors">
            <strong>Factors:</strong> {factors.join(', ')}
          </p>
        )}
        <div className="confidence-suggestions">
          <strong>Suggestions:</strong>
          <ul>
            <li>Try providing a URL to the original source for better results</li>
            <li>Rephrase the claim to be more specific</li>
            <li>Check if the claim is too recent for news coverage</li>
          </ul>
        </div>
      </div>
    );
  }

  if (level === 'medium') {
    return (
      <div className="confidence-message confidence-moderate">
        <div className="confidence-message-header">
          <span className="confidence-icon">ℹ️</span>
          <strong>Moderate Confidence - Some Uncertainty</strong>
        </div>
        <p className="confidence-message-text">
          We found some evidence for this claim, but there is uncertainty in the analysis.
        </p>
        {factors.length > 0 && (
          <p className="confidence-factors">
            <strong>Factors:</strong> {factors.join(', ')}
          </p>
        )}
      </div>
    );
  }

  // High confidence
  return (
    <div className="confidence-message confidence-high">
      <div className="confidence-message-header">
        <span className="confidence-icon">✓</span>
        <strong>High Confidence - Strong Evidence</strong>
      </div>
      <p className="confidence-message-text">
        We found strong evidence for this analysis.
      </p>
      {factors.length > 0 && (
        <p className="confidence-factors">
          <strong>Factors:</strong> {factors.join(', ')}
        </p>
      )}
    </div>
  );
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

  // Filter out generic pages from text_grounding sources
  const filteredTextGroundingSources = response.text_grounding?.sources 
    ? filterUsableSources(response.text_grounding.sources)
    : [];

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
          <StatusBadge label={response.status_label} showDescription={true} />
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

        {/* Confidence context messaging */}
        <div className={`confidence-context ${getConfidenceLevel(response.confidence_score)}`}>
          {getConfidenceMessage(response.confidence_score, response)}
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

      {response.orchestration?.enabled && (
        <section className="results-orchestration">
          <details className="orchestration-details">
            <summary className="orchestration-summary">
              <span className="orchestration-icon">ℹ️</span>
              <span className="orchestration-title">
                Analysis Details (Orchestration Used)
              </span>
            </summary>
            <div className="orchestration-content">
              <div className="orchestration-item">
                <h4>Passes Executed: {response.orchestration.passes_executed}</h4>
                <p className="orchestration-explanation">
                  {response.orchestration.passes_executed === 1
                    ? 'Single pass: Initial retrieval'
                    : response.orchestration.passes_executed === 2
                      ? '2 passes: Initial retrieval + targeted refinement'
                      : '3 passes: Initial retrieval + targeted refinement + contradiction search'}
                </p>
              </div>

              <div className="orchestration-item">
                <h4>
                  Source Diversity: {response.orchestration.source_classes}{' '}
                  {response.orchestration.source_classes === 1
                    ? 'class'
                    : 'classes'}
                </h4>
                <p className="orchestration-explanation">
                  {response.orchestration.source_classes === 0
                    ? 'No source diversity'
                    : response.orchestration.source_classes === 1
                      ? '1 class: Limited diversity'
                      : response.orchestration.source_classes === 2
                        ? '2 classes: Moderate diversity (e.g., news_media, fact_checker)'
                        : `${response.orchestration.source_classes} classes: High diversity across multiple source types`}
                </p>
              </div>

              <div className="orchestration-item">
                <h4>
                  Average Quality:{' '}
                  {response.orchestration.average_quality.toFixed(2)}
                </h4>
                <p className="orchestration-explanation">
                  {response.orchestration.average_quality >= 0.75
                    ? 'High quality evidence'
                    : response.orchestration.average_quality >= 0.5
                      ? 'Medium quality evidence'
                      : 'Lower quality evidence'}
                </p>
              </div>

              {response.orchestration.contradictions_found && (
                <div className="orchestration-item orchestration-contradictions">
                  <h4>⚠️ Contradictions: Found</h4>
                  <p className="orchestration-explanation">
                    Safety-first contradiction check performed. Review
                    contradicting sources carefully.
                  </p>
                </div>
              )}
            </div>
          </details>
        </section>
      )}

      <section className="results-sources">
        <h2>Evidence Sources</h2>
        
        {/* Display stance-classified sources from text_grounding if available */}
        {response.text_grounding && response.text_grounding.sources.length > 0 ? (
          filteredTextGroundingSources.length === 0 ? (
            // All sources were filtered out as generic pages
            <div className="no-sources-message empty-state">
              <div className="empty-state-icon">🔍</div>
              <h3>No Usable Sources Found</h3>
              <p className="empty-state-description">
                We found some pages, but they were generic pages (homepages, category pages, or search results) 
                that don't provide specific evidence for this claim.
              </p>
              <div className="empty-state-suggestions">
                <h4>Suggestions:</h4>
                <ul>
                  <li><strong>Provide a URL</strong> to the original source for better, more specific results</li>
                  <li><strong>Rephrase your claim</strong> to be more specific and include key details</li>
                  <li><strong>Check if the claim is too recent</strong> for news coverage to be available</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="stance-grouped-sources">
              {/* Supporting Sources */}
              {filteredTextGroundingSources.filter(s => s.stance === 'supports').length > 0 && (
                <div className="stance-group stance-supports">
                  <h3 className="stance-group-header">
                    <span className="stance-icon stance-icon-supports">✓</span>
                    Supporting Evidence
                  </h3>
                  <div className="stance-sources-list">
                    {filteredTextGroundingSources
                      .filter(s => s.stance === 'supports')
                      .sort((a, b) => a.credibilityTier - b.credibilityTier)
                      .map((source, index) => (
                          <div key={index} className="stance-source-item">
                            <h4 className="source-title">
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="source-link"
                              >
                                {source.title}
                              </a>
                            </h4>
                            <p className="source-domain">{source.domain}</p>
                            <p className="source-snippet">{source.snippet}</p>
                            {source.stanceJustification && (
                              <p className="source-stance-justification">
                                <strong>Why supporting:</strong> {source.stanceJustification}
                              </p>
                            )}
                            <div className="source-metadata">
                              <span 
                                className={`source-credibility credibility-tier-${source.credibilityTier}`}
                                title={
                                  source.credibilityTier === 1 
                                    ? 'High credibility: Established, authoritative sources with strong editorial standards'
                                    : source.credibilityTier === 2 
                                      ? 'Medium credibility: Generally reliable sources, verify with additional sources'
                                      : 'Low credibility: Less established sources, verify carefully with authoritative sources'
                                }
                              >
                                Credibility: {source.credibilityTier === 1 ? 'High' : source.credibilityTier === 2 ? 'Medium' : 'Low'}
                              </span>
                              <span className="source-date">
                                {new Date(source.publishDate).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Contradicting Sources */}
                {filteredTextGroundingSources.filter(s => s.stance === 'contradicts').length > 0 && (
                  <div className="stance-group stance-contradicts">
                    <h3 className="stance-group-header">
                      <span className="stance-icon stance-icon-contradicts">✗</span>
                      Contradicting Evidence
                    </h3>
                    <div className="stance-sources-list">
                      {filteredTextGroundingSources
                        .filter(s => s.stance === 'contradicts')
                        .sort((a, b) => a.credibilityTier - b.credibilityTier)
                        .map((source, index) => (
                          <div key={index} className="stance-source-item">
                            <h4 className="source-title">
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="source-link"
                              >
                                {source.title}
                              </a>
                            </h4>
                            <p className="source-domain">{source.domain}</p>
                            <p className="source-snippet">{source.snippet}</p>
                            {source.stanceJustification && (
                              <p className="source-stance-justification">
                                <strong>Why contradicting:</strong> {source.stanceJustification}
                              </p>
                            )}
                            <div className="source-metadata">
                              <span 
                                className={`source-credibility credibility-tier-${source.credibilityTier}`}
                                title={
                                  source.credibilityTier === 1 
                                    ? 'High credibility: Established, authoritative sources with strong editorial standards'
                                    : source.credibilityTier === 2 
                                      ? 'Medium credibility: Generally reliable sources, verify with additional sources'
                                      : 'Low credibility: Less established sources, verify carefully with authoritative sources'
                                }
                              >
                                Credibility: {source.credibilityTier === 1 ? 'High' : source.credibilityTier === 2 ? 'Medium' : 'Low'}
                              </span>
                              <span className="source-date">
                                {new Date(source.publishDate).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Contextual Sources (mentions/unclear) */}
                {filteredTextGroundingSources.filter(s => s.stance === 'mentions' || s.stance === 'unclear').length > 0 && (
                  <div className="stance-group stance-contextual">
                    <h3 className="stance-group-header">
                      <span className="stance-icon stance-icon-contextual">ℹ</span>
                      Contextual Information
                    </h3>
                    <div className="stance-sources-list">
                      {filteredTextGroundingSources
                        .filter(s => s.stance === 'mentions' || s.stance === 'unclear')
                        .sort((a, b) => a.credibilityTier - b.credibilityTier)
                        .map((source, index) => (
                          <div key={index} className="stance-source-item">
                            <h4 className="source-title">
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="source-link"
                              >
                                {source.title}
                              </a>
                            </h4>
                            <p className="source-domain">{source.domain}</p>
                            <p className="source-snippet">{source.snippet}</p>
                            {source.stanceJustification && (
                              <p className="source-stance-justification">
                                <strong>Context:</strong> {source.stanceJustification}
                              </p>
                            )}
                            <div className="source-metadata">
                              <span 
                                className={`source-credibility credibility-tier-${source.credibilityTier}`}
                                title={
                                  source.credibilityTier === 1 
                                    ? 'High credibility: Established, authoritative sources with strong editorial standards'
                                    : source.credibilityTier === 2 
                                      ? 'Medium credibility: Generally reliable sources, verify with additional sources'
                                      : 'Low credibility: Less established sources, verify carefully with authoritative sources'
                                }
                              >
                                Credibility: {source.credibilityTier === 1 ? 'High' : source.credibilityTier === 2 ? 'Medium' : 'Low'}
                              </span>
                              <span className="source-date">
                                {new Date(source.publishDate).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )
        ) : response.credible_sources && response.credible_sources.length > 0 ? (
          (() => {
            // Filter out generic pages from legacy credible_sources
            const usableSources = filterUsableSources(response.credible_sources);
            
            if (usableSources.length === 0) {
              return (
                <div className="no-sources-message empty-state">
                  <div className="empty-state-icon">🔍</div>
                  <h3>No Usable Sources Found</h3>
                  <p className="empty-state-description">
                    We found some pages, but they were generic pages (homepages, category pages, or search results) 
                    that don't provide specific evidence for this claim.
                  </p>
                  <div className="empty-state-suggestions">
                    <h4>Suggestions:</h4>
                    <ul>
                      <li><strong>Provide a URL</strong> to the original source for better, more specific results</li>
                      <li><strong>Rephrase your claim</strong> to be more specific and include key details</li>
                      <li><strong>Check if the claim is too recent</strong> for news coverage to be available</li>
                    </ul>
                  </div>
                </div>
              );
            }
            
            return (
              <div className="credible-sources-list">
                {usableSources.map((source, index) => (
                  <div key={index} className="credible-source-item">
                    <h3 className="source-title">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="source-link"
                      >
                        {source.title}
                      </a>
                    </h3>
                    <p className="source-domain">{source.domain}</p>
                    <p className="source-snippet">{source.snippet}</p>
                    <p className="source-why">
                      <strong>Why credible:</strong> {source.why}
                    </p>
                  </div>
                ))}
              </div>
            );
          })()
        ) : (
          <div className="no-sources-message empty-state">
            <div className="empty-state-icon">🔍</div>
            <h3>No Evidence Sources Found</h3>
            <p className="empty-state-description">
              We couldn't find credible sources for this claim.
            </p>
            <div className="empty-state-suggestions">
              <h4>This could mean:</h4>
              <ul>
                <li>The claim is too vague or general</li>
                <li>The topic is too recent for news coverage</li>
                <li>The claim may not be newsworthy</li>
              </ul>
              <h4>Try:</h4>
              <ul>
                <li><strong>Providing a URL</strong> to the original source</li>
                <li><strong>Making the claim more specific</strong></li>
                <li><strong>Checking if the claim is factual vs opinion</strong></li>
              </ul>
            </div>
          </div>
        )}

        {response.grounding && (
          <div className="grounding-metadata">
            <p className="grounding-info">
              <strong>Search terms used:</strong>{' '}
              {response.grounding.providerUsed === 'demo'
                ? 'Demo mode'
                : 'Real-time search'}
            </p>
            <p className="grounding-info">
              <strong>Provider used:</strong>{' '}
              {response.grounding.providerUsed === 'bing'
                ? 'Bing News'
                : response.grounding.providerUsed === 'gdelt'
                  ? 'GDELT'
                  : response.grounding.providerUsed === 'demo'
                    ? 'Demo'
                    : 'None'}
            </p>
            <p className="grounding-info">
              <strong>Sources found:</strong> {response.grounding.sources_count}
            </p>
            {response.grounding.errors &&
              response.grounding.errors.length > 0 && (
                <details className="grounding-errors">
                  <summary>Errors ({response.grounding.errors.length})</summary>
                  <ul>
                    {response.grounding.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </details>
              )}
          </div>
        )}
      </section>

      <section className="results-sift">
        <SIFTPanel
          guidance={response.sift_guidance}
          sources={response.credible_sources || response.sources}
          siftDetails={response.sift}
        />
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
