/**
 * TraceCollector - Collects trace steps during pipeline execution
 *
 * Responsibilities:
 * - Initialize trace with request metadata
 * - Record trace steps with timing and status
 * - Filter sensitive information from summaries
 * - Generate final trace object
 */

import { randomUUID } from 'crypto';
import type {
  OperationMode,
  StepStatus,
  TraceObject,
  TraceStepObject,
  DecisionSummary,
} from '../types/trace';
import { TraceSanitizer } from './traceSanitizer';

interface StepInProgress {
  step_id: string;
  name: string;
  start_time: number;
  timestamp: string;
}

export class TraceCollector {
  private requestId: string;
  private mode: OperationMode;
  private steps: TraceStepObject[] = [];
  private stepsInProgress: Map<string, StepInProgress> = new Map();
  private pipelineStartTime: number;

  constructor(requestId: string, mode: OperationMode) {
    this.requestId = requestId;
    this.mode = mode;
    this.pipelineStartTime = Date.now();
  }

  /**
   * Start a new trace step
   */
  startStep(name: string): void {
    const step_id = randomUUID();
    const start_time = Date.now();
    const timestamp = new Date(start_time).toISOString();

    this.stepsInProgress.set(name, {
      step_id,
      name,
      start_time,
      timestamp,
    });
  }

  /**
   * Complete a trace step with success status
   */
  completeStep(name: string, summary: string, status: StepStatus = 'completed'): void {
    const inProgress = this.stepsInProgress.get(name);
    if (!inProgress) {
      // Step was not started, create it now with 0 duration
      this.startStep(name);
      const newInProgress = this.stepsInProgress.get(name)!;
      this._finalizeStep(newInProgress, summary, status, 0);
      return;
    }

    const duration_ms = Date.now() - inProgress.start_time;
    this._finalizeStep(inProgress, summary, status, duration_ms);
  }

  /**
   * Mark a trace step as failed
   */
  failStep(name: string, summary: string): void {
    this.completeStep(name, summary, 'failed');
  }

  /**
   * Mark a trace step as skipped
   */
  skipStep(name: string, summary: string): void {
    this.completeStep(name, summary, 'skipped');
  }

  /**
   * Get the complete trace object
   */
  getTrace(decisionSummary: DecisionSummary): TraceObject {
    const total_duration_ms = Date.now() - this.pipelineStartTime;

    return {
      request_id: this.requestId,
      mode: this.mode,
      provider: 'aws_bedrock',
      pipeline: 'nova',
      steps: this.steps,
      decision_summary: decisionSummary,
      total_duration_ms,
    };
  }

  /**
   * Finalize a step and add it to the steps array
   */
  private _finalizeStep(
    inProgress: StepInProgress,
    summary: string,
    status: StepStatus,
    duration_ms: number
  ): void {
    // Sanitize the summary to ensure no sensitive information
    const sanitizedSummary = TraceSanitizer.sanitize(summary);

    const step: TraceStepObject = {
      step_id: inProgress.step_id,
      name: inProgress.name,
      status,
      duration_ms,
      summary: sanitizedSummary,
      timestamp: inProgress.timestamp,
    };

    this.steps.push(step);
    this.stepsInProgress.delete(inProgress.name);
  }

  /**
   * Add metadata to the most recent step
   */
  addMetadata(metadata: Record<string, unknown>): void {
    if (this.steps.length > 0) {
      const lastStep = this.steps[this.steps.length - 1];
      lastStep.metadata = { ...lastStep.metadata, ...metadata };
    }
  }
}
