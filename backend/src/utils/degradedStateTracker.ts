/**
 * Degraded State Tracker
 *
 * Tracks which stages used pass-through mode and what model failures occurred
 * during the orchestration pipeline execution.
 */

/**
 * Degraded state metadata
 */
export interface DegradedStateMetadata {
  /** Whether evidence preservation was triggered */
  evidencePreserved: boolean;
  /** Stages that used pass-through mode */
  degradedStages: string[];
  /** Model failures encountered */
  modelFailures: string[];
}

/**
 * Degraded state tracker
 */
export class DegradedStateTracker {
  private degradedStages: string[] = [];
  private modelFailures: string[] = [];
  private evidencePreserved: boolean = false;

  /**
   * Track a stage that used pass-through mode
   *
   * @param stage - Stage name (e.g., 'evidenceFilter', 'verdictSynthesizer')
   * @param modelFailure - Model failure message
   */
  trackStage(stage: string, modelFailure: string): void {
    this.degradedStages.push(stage);
    this.modelFailures.push(modelFailure);
    this.evidencePreserved = true;
  }

  /**
   * Get degraded state metadata
   *
   * @returns Metadata object with all tracked degradation
   */
  getMetadata(): DegradedStateMetadata {
    return {
      evidencePreserved: this.evidencePreserved,
      degradedStages: [...this.degradedStages],
      modelFailures: [...this.modelFailures],
    };
  }

  /**
   * Check if any degradation occurred
   *
   * @returns True if any stage used pass-through mode
   */
  hasAnyDegradation(): boolean {
    return this.degradedStages.length > 0;
  }

  /**
   * Reset tracker state (for testing)
   */
  reset(): void {
    this.degradedStages = [];
    this.modelFailures = [];
    this.evidencePreserved = false;
  }
}
