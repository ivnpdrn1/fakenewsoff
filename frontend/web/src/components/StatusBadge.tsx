/**
 * StatusBadge Component
 *
 * Displays color-coded status labels for analysis results.
 * Uses React.memo for performance optimization.
 *
 * Validates: Requirements 3.1, 5.3
 */

import React from 'react';
import type { StatusLabel } from '../../../shared/schemas/index.js';
import './StatusBadge.css';

interface StatusBadgeProps {
  label: StatusLabel;
}

/**
 * Color-coded badge component for status labels
 *
 * Maps status labels to colors:
 * - Supported: green
 * - Disputed: red
 * - Unverified: yellow
 * - Manipulated: darkred
 * - Biased framing: orange
 */
const StatusBadge: React.FC<StatusBadgeProps> = React.memo(({ label }) => {
  const className = `status-badge status-badge-${label.toLowerCase().replace(' ', '-')}`;

  return (
    <span className={className} role="status" aria-label={`Status: ${label}`}>
      {label}
    </span>
  );
});

StatusBadge.displayName = 'StatusBadge';

export default StatusBadge;
