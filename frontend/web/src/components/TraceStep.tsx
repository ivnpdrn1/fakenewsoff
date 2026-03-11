/**
 * TraceStep Component
 *
 * Renders an individual trace step from the NOVA pipeline.
 * Displays step name, status icon, duration, and summary.
 *
 * Validates: Requirements 8.3, 8.4, 8.5, 8.6, 8.7, 8.8
 */

import type { TraceStep } from '../../../shared/schemas/index.js';
import './TraceStep.css';

interface TraceStepProps {
  step: TraceStep;
}

/**
 * TraceStep component displaying individual pipeline step
 *
 * Features:
 * - Status icon (✓ for completed, ✕ for failed, ⚠ for skipped)
 * - Step name and duration
 * - Summary text
 * - Color-coded by status
 */
function TraceStepComponent({ step }: TraceStepProps) {
  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'failed':
        return '✕';
      case 'skipped':
        return '⚠';
      default:
        return '?';
    }
  };

  const getStatusClass = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'trace-step-completed';
      case 'failed':
        return 'trace-step-failed';
      case 'skipped':
        return 'trace-step-skipped';
      default:
        return 'trace-step-unknown';
    }
  };

  return (
    <div className={`trace-step ${getStatusClass(step.status)}`}>
      <div className="trace-step-header">
        <span className="trace-step-icon">{getStatusIcon(step.status)}</span>
        <span className="trace-step-name">{step.name}</span>
        <span className="trace-step-duration">{step.duration_ms}ms</span>
      </div>
      <div className="trace-step-summary">{step.summary}</div>
    </div>
  );
}

export default TraceStepComponent;
