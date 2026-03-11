/**
 * Trace Types for Explainable AI Trace Feature
 *
 * Provides transparent, step-by-step visibility into NOVA's verification pipeline
 * while maintaining security by excluding internal prompts, chain-of-thought reasoning,
 * secrets, and raw model deliberation.
 */

/**
 * Operation mode of the NOVA pipeline
 */
export type OperationMode = 'production' | 'degraded' | 'demo';

/**
 * Execution status of a trace step
 */
export type StepStatus = 'completed' | 'failed' | 'skipped';

/**
 * AI provider used for verification
 */
export type Provider = 'aws_bedrock';

/**
 * Pipeline identifier
 */
export type Pipeline = 'nova';

/**
 * Individual trace step representing a stage in the NOVA pipeline
 */
export interface TraceStepObject {
  /** Unique identifier for this step (UUID) */
  step_id: string;

  /** Human-readable step name */
  name: string;

  /** Execution status */
  status: StepStatus;

  /** Execution time in milliseconds */
  duration_ms: number;

  /** Safe, user-facing summary (no prompts, secrets, or chain-of-thought) */
  summary: string;

  /** ISO8601 timestamp */
  timestamp: string;

  /** Optional metadata (cache hit, provider info, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * Decision summary containing the final verdict information
 */
export interface DecisionSummary {
  /** Final verdict classification */
  verdict: string;

  /** Confidence score (0-100) */
  confidence: number;

  /** Verdict rationale */
  rationale: string;

  /** Number of evidence sources used */
  evidence_count: number;
}

/**
 * Complete trace object for a claim verification request
 */
export interface TraceObject {
  /** Request UUID */
  request_id: string;

  /** Operation mode */
  mode: OperationMode;

  /** AI provider */
  provider: Provider;

  /** Pipeline name */
  pipeline: Pipeline;

  /** Ordered trace steps */
  steps: TraceStepObject[];

  /** Decision summary */
  decision_summary: DecisionSummary;

  /** Total pipeline duration in milliseconds */
  total_duration_ms: number;
}
