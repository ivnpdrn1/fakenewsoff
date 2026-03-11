/**
 * TracePanel Component
 *
 * Renders complete trace from NOVA pipeline.
 * Displays all trace steps and decision summary.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.9
 */

import type { TraceObject } from '../../../shared/schemas/index.js';
import TraceStep from './TraceStep.js';
import './TracePanel.css';

interface TracePanelProps {
  trace?: TraceObject;
}

/**
 * TracePanel component displaying complete pipeline trace
 *
 * Features:
 * - Title "How NOVA Reached This Result"
 * - All trace steps in sequence
 * - Decision summary at the end
 * - Graceful handling of missing trace
 */
function TracePanel({ trace }: TracePanelProps) {
  // Don't render if trace is missing
  if (!trace) {
    return null;
  }

  return (
    <div className="trace-panel">
      <h2 className="trace-panel-title">How NOVA Reached This Result</h2>
      
      <div className="trace-steps">
        {trace.steps.map((step) => (
          <TraceStep key={step.step_id} step={step} />
        ))}
      </div>

      <div className="trace-decision-summary">
        <h3>Decision Summary</h3>
        <div className="trace-decision-content">
          <div className="trace-decision-row">
            <span className="trace-decision-label">Verdict:</span>
            <span className="trace-decision-value">{trace.decision_summary.verdict}</span>
          </div>
          <div className="trace-decision-row">
            <span className="trace-decision-label">Confidence:</span>
            <span className="trace-decision-value">{trace.decision_summary.confidence}%</span>
          </div>
          <div className="trace-decision-row">
            <span className="trace-decision-label">Evidence Count:</span>
            <span className="trace-decision-value">{trace.decision_summary.evidence_count}</span>
          </div>
          <div className="trace-decision-rationale">
            <span className="trace-decision-label">Rationale:</span>
            <p>{trace.decision_summary.rationale}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TracePanel;
