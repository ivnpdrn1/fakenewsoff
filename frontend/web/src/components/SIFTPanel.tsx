/**
 * SIFTPanel Component
 *
 * Displays SIFT framework guidance (Stop, Investigate, Find, Trace).
 * Parses guidance string and displays four interactive components.
 * Clicking a tile opens a modal with detailed guidance and actions.
 *
 * Validates: Requirements 3.4, 5.5
 */

import React, { useState } from 'react';
import './SIFTPanel.css';

interface SIFTPanelProps {
  guidance: string;
  sources?: Array<{ url: string; title: string; snippet: string }>;
}

interface SIFTSection {
  title: string;
  content: string;
}

/**
 * Parse SIFT guidance string into four sections
 *
 * Expected format: "Stop: ... Investigate: ... Find: ... Trace: ..."
 */
function parseSIFTGuidance(guidance: string): SIFTSection[] {
  const sections: SIFTSection[] = [];
  const siftKeywords = ['Stop', 'Investigate', 'Find', 'Trace'];

  // Split by SIFT keywords while preserving the keywords
  let remainingText = guidance;

  for (let i = 0; i < siftKeywords.length; i++) {
    const keyword = siftKeywords[i];
    const pattern = new RegExp(`${keyword}:\\s*`, 'i');
    const match = remainingText.match(pattern);

    if (match && match.index !== undefined) {
      // Extract content until next keyword or end
      const startIndex = match.index + match[0].length;
      let endIndex = remainingText.length;

      // Find next keyword
      for (let j = i + 1; j < siftKeywords.length; j++) {
        const nextPattern = new RegExp(`${siftKeywords[j]}:`, 'i');
        const nextMatch = remainingText.match(nextPattern);
        if (nextMatch && nextMatch.index !== undefined) {
          endIndex = nextMatch.index;
          break;
        }
      }

      const content = remainingText.substring(startIndex, endIndex).trim();
      sections.push({ title: keyword, content });

      remainingText = remainingText.substring(endIndex);
    }
  }

  // Fallback: if parsing fails, show raw guidance
  if (sections.length === 0) {
    sections.push({ title: 'SIFT Guidance', content: guidance });
  }

  return sections;
}

/**
 * Get suggested search queries based on SIFT step
 */
function getSuggestedSearches(step: string): string[] {
  const baseSearches: Record<string, string[]> = {
    Stop: [
      'fact check',
      'is this true',
      'debunked'
    ],
    Investigate: [
      'source credibility',
      'author background',
      'publication reputation'
    ],
    Find: [
      'better coverage',
      'original source',
      'mainstream news'
    ],
    Trace: [
      'original claim',
      'primary source',
      'when was this published'
    ]
  };

  return baseSearches[step] || [];
}

/**
 * SIFT Modal Component
 */
interface SIFTModalProps {
  section: SIFTSection;
  sources?: Array<{ url: string; title: string; snippet: string }>;
  onClose: () => void;
}

const SIFTModal: React.FC<SIFTModalProps> = ({ section, sources, onClose }) => {
  const suggestedSearches = getSuggestedSearches(section.title);

  const handleCopySteps = async () => {
    try {
      await navigator.clipboard.writeText(`${section.title}: ${section.content}`);
      alert('Copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSearch = (query: string) => {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    window.open(searchUrl, '_blank', 'noopener,noreferrer');
  };

  const handleOpenSources = () => {
    sources?.forEach((source) => {
      window.open(source.url, '_blank', 'noopener,noreferrer');
    });
  };

  // Close on ESC key
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const icons: Record<string, string> = {
    Stop: '🛑',
    Investigate: '🔍',
    Find: '📰',
    Trace: '🔗',
  };

  return (
    <div className="sift-modal-overlay" onClick={onClose}>
      <div className="sift-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="sift-modal-title" aria-modal="true">
        <div className="sift-modal-header">
          <h2 id="sift-modal-title" className="sift-modal-title">
            <span className="sift-modal-icon" aria-hidden="true">
              {icons[section.title] || '💡'}
            </span>
            SIFT: {section.title}
          </h2>
          <button
            className="sift-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="sift-modal-content">
          <p className="sift-modal-guidance">{section.content}</p>

          <div className="sift-modal-actions">
            <button className="sift-action-button" onClick={handleCopySteps}>
              📋 Copy Steps
            </button>

            {sources && sources.length > 0 ? (
              <button className="sift-action-button" onClick={handleOpenSources}>
                🔗 Open Sources ({sources.length})
              </button>
            ) : (
              <div className="sift-searches">
                <h3 className="sift-searches-title">Suggested Searches:</h3>
                <div className="sift-search-buttons">
                  {suggestedSearches.map((query) => (
                    <button
                      key={query}
                      className="sift-search-button"
                      onClick={() => handleSearch(query)}
                    >
                      🔍 {query}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * SIFT framework guidance panel
 *
 * Features:
 * - Parses SIFT guidance string
 * - Displays four interactive tiles
 * - Opens modal with detailed guidance on click
 * - Keyboard accessible (Enter/Space)
 * - Provides actionable steps and search suggestions
 */
const SIFTPanel: React.FC<SIFTPanelProps> = ({ guidance, sources }) => {
  const [selectedSection, setSelectedSection] = useState<SIFTSection | null>(null);
  const sections = React.useMemo(() => parseSIFTGuidance(guidance), [guidance]);

  const icons: Record<string, string> = {
    Stop: '🛑',
    Investigate: '🔍',
    Find: '📰',
    Trace: '🔗',
    'SIFT Guidance': '💡',
  };

  const handleTileClick = (section: SIFTSection) => {
    setSelectedSection(section);
  };

  const handleTileKeyDown = (e: React.KeyboardEvent, section: SIFTSection) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedSection(section);
    }
  };

  return (
    <div className="sift-panel">
      <h2 className="sift-panel-title">SIFT Framework Guidance</h2>
      <div className="sift-sections">
        {sections.map((section) => (
          <button
            key={section.title}
            className="sift-section"
            onClick={() => handleTileClick(section)}
            onKeyDown={(e) => handleTileKeyDown(e, section)}
            aria-label={`View ${section.title} guidance`}
          >
            <h3 className="sift-section-title">
              <span className="sift-icon" aria-hidden="true">
                {icons[section.title] || '•'}
              </span>
              {section.title}
            </h3>
            <p className="sift-section-content">{section.content}</p>
            <span className="sift-section-hint">Click for details</span>
          </button>
        ))}
      </div>

      {selectedSection && (
        <SIFTModal
          section={selectedSection}
          sources={sources}
          onClose={() => setSelectedSection(null)}
        />
      )}
    </div>
  );
};

export default SIFTPanel;
