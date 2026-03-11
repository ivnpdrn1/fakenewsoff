/**
 * StatusBadge Component
 *
 * Displays color-coded status labels with icons and descriptions for analysis results.
 * Uses React.memo for performance optimization.
 *
 * Validates: Requirements 4.1
 */

import React from 'react';
import type { StatusLabel } from '../../../shared/schemas/index.js';
import './StatusBadge.css';

interface StatusBadgeProps {
  label: StatusLabel;
  showDescription?: boolean;
}

interface VerdictConfig {
  icon: string;
  description: string;
}

const VERDICT_CONFIG: Record<string, VerdictConfig> = {
  'supported': {
    icon: '✓',
    description: 'Evidence strongly supports this claim',
  },
  'true': {
    icon: '✓',
    description: 'Evidence strongly supports this claim',
  },
  'disputed': {
    icon: '✗',
    description: 'Evidence contradicts this claim',
  },
  'false': {
    icon: '✗',
    description: 'Evidence contradicts this claim',
  },
  'misleading': {
    icon: '⚠',
    description: 'Claim is partially true but misleading',
  },
  'partially true': {
    icon: '◐',
    description: 'Some aspects supported, others not',
  },
  'partially_true': {
    icon: '◐',
    description: 'Some aspects supported, others not',
  },
  'unverified': {
    icon: '?',
    description: 'Insufficient evidence to verify',
  },
  'manipulated': {
    icon: '⚠',
    description: 'Content appears to be manipulated',
  },
  'biased framing': {
    icon: '⚠',
    description: 'Content shows biased framing',
  },
};

/**
 * Color-coded badge component for status labels with icons and descriptions
 *
 * Maps status labels to colors and icons:
 * - Supported/True: green with ✓
 * - Disputed/False: red with ✗
 * - Misleading: orange with ⚠
 * - Partially True: yellow with ◐
 * - Unverified: gray with ?
 * - Manipulated: darkred with ⚠
 * - Biased framing: orange with ⚠
 */
const StatusBadge: React.FC<StatusBadgeProps> = React.memo(({ label, showDescription = false }) => {
  const normalizedLabel = label.toLowerCase().replace('_', ' ');
  const config = VERDICT_CONFIG[normalizedLabel] || {
    icon: '?',
    description: 'Status unknown',
  };
  
  const className = `status-badge status-badge-${label.toLowerCase().replace(/[_ ]/g, '-')}`;

  return (
    <div className="status-badge-container">
      <span className={className} role="status" aria-label={`Status: ${label}`}>
        <span className="status-badge-icon" aria-hidden="true">{config.icon}</span>
        <span className="status-badge-label">{label}</span>
      </span>
      {showDescription && (
        <p className="status-badge-description">{config.description}</p>
      )}
    </div>
  );
});

StatusBadge.displayName = 'StatusBadge';

export default StatusBadge;
