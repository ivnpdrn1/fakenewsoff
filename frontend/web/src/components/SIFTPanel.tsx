/**
 * SIFTPanel Component
 *
 * Displays SIFT framework guidance (Stop, Investigate, Find, Trace).
 * Parses guidance string and displays four components with visual separation.
 *
 * Validates: Requirements 3.4, 5.5
 */

import React from 'react';
import './SIFTPanel.css';

interface SIFTPanelProps {
  guidance: string;
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
 * SIFT framework guidance panel
 *
 * Features:
 * - Parses SIFT guidance string
 * - Displays four components with icons
 * - Semantic headings for accessibility
 * - Visual separation between sections
 */
const SIFTPanel: React.FC<SIFTPanelProps> = ({ guidance }) => {
  const sections = React.useMemo(() => parseSIFTGuidance(guidance), [guidance]);

  const icons: Record<string, string> = {
    Stop: '🛑',
    Investigate: '🔍',
    Find: '📰',
    Trace: '🔗',
    'SIFT Guidance': '💡',
  };

  return (
    <div className="sift-panel">
      <h2 className="sift-panel-title">SIFT Framework Guidance</h2>
      <div className="sift-sections">
        {sections.map((section) => (
          <div key={section.title} className="sift-section">
            <h3 className="sift-section-title">
              <span className="sift-icon" aria-hidden="true">
                {icons[section.title] || '•'}
              </span>
              {section.title}
            </h3>
            <p className="sift-section-content">{section.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SIFTPanel;
