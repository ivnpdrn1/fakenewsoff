/**
 * ExampleClaims Component
 *
 * Displays example claims that users can click to auto-fill the input form.
 * Demonstrates different capabilities: supported claims, disputed claims, and unverified claims.
 *
 * Validates: Requirements 6.3, 11.3
 */

import React from 'react';
import './ExampleClaims.css';

interface ExampleClaim {
  id: string;
  text: string;
  category: 'supported' | 'disputed' | 'unverified';
  description: string;
}

interface ExampleClaimsProps {
  onClaimClick: (text: string) => void;
}

const EXAMPLE_CLAIMS: ExampleClaim[] = [
  {
    id: 'supported',
    text: 'The Eiffel Tower is located in Paris, France',
    category: 'supported',
    description: 'Shows orchestration success with supporting evidence',
  },
  {
    id: 'disputed',
    text: 'The moon landing was faked in 1969',
    category: 'disputed',
    description: 'Demonstrates contradiction detection',
  },
  {
    id: 'unverified',
    text: 'A new species was discovered yesterday',
    category: 'unverified',
    description: 'Shows empty state handling',
  },
];

/**
 * ExampleClaims component
 *
 * Features:
 * - Displays 3 example claims with different categories
 * - Clickable cards that auto-fill the input form
 * - Visual indicators for each category (color-coded)
 * - Descriptions explaining what each example demonstrates
 * - Accessible with keyboard navigation and ARIA labels
 */
const ExampleClaims: React.FC<ExampleClaimsProps> = ({ onClaimClick }) => {
  const handleClaimClick = (claim: ExampleClaim) => {
    onClaimClick(claim.text);
  };

  const handleKeyDown = (e: React.KeyboardEvent, claim: ExampleClaim) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClaimClick(claim.text);
    }
  };

  const getCategoryIcon = (category: ExampleClaim['category']): string => {
    switch (category) {
      case 'supported':
        return '✓';
      case 'disputed':
        return '✗';
      case 'unverified':
        return '?';
    }
  };

  const getCategoryLabel = (category: ExampleClaim['category']): string => {
    switch (category) {
      case 'supported':
        return 'Supported';
      case 'disputed':
        return 'Disputed';
      case 'unverified':
        return 'Unverified';
    }
  };

  return (
    <section className="example-claims" aria-labelledby="example-claims-heading">
      <h2 id="example-claims-heading" className="example-claims-heading">
        Try an Example
      </h2>
      <p className="example-claims-description">
        Click an example below to see how FakeNewsOff analyzes different types of claims
      </p>
      <div className="example-claims-grid">
        {EXAMPLE_CLAIMS.map((claim) => (
          <div
            key={claim.id}
            className={`example-claim-card example-claim-${claim.category}`}
            onClick={() => handleClaimClick(claim)}
            onKeyDown={(e) => handleKeyDown(e, claim)}
            role="button"
            tabIndex={0}
            aria-label={`Try example: ${claim.text}. ${claim.description}`}
          >
            <div className="example-claim-header">
              <span className="example-claim-icon" aria-hidden="true">
                {getCategoryIcon(claim.category)}
              </span>
              <span className="example-claim-category">
                {getCategoryLabel(claim.category)}
              </span>
            </div>
            <p className="example-claim-text">{claim.text}</p>
            <p className="example-claim-description">{claim.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ExampleClaims;
