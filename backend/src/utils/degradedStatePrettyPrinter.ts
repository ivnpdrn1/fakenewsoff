/**
 * Degraded State Pretty Printer
 *
 * Formats degraded state metadata for human-readable output.
 * Useful for logging, debugging, and user-facing messages.
 */

/**
 * Format degraded stages for display
 *
 * @param degradedStages - Array of stage names
 * @returns Human-readable stage list
 */
export function formatDegradedStages(degradedStages: string[]): string {
  if (degradedStages.length === 0) {
    return 'None';
  }

  const stageNames: Record<string, string> = {
    evidenceFilter: 'Evidence Filter',
    stanceClassifier: 'Stance Classifier',
    contradictionSearcher: 'Contradiction Searcher',
    verdictSynthesizer: 'Verdict Synthesizer',
  };

  return degradedStages.map((stage) => stageNames[stage] || stage).join(', ');
}

/**
 * Format model failures for display
 *
 * @param modelFailures - Array of model failure objects
 * @returns Human-readable failure list
 */
export function formatModelFailures(modelFailures: Array<{ stage: string; message: string }>): string {
  if (modelFailures.length === 0) {
    return 'None';
  }

  return modelFailures
    .map((failure, index) => {
      const stageNames: Record<string, string> = {
        evidenceFilter: 'Evidence Filter',
        stanceClassifier: 'Stance Classifier',
        contradictionSearcher: 'Contradiction Searcher',
        verdictSynthesizer: 'Verdict Synthesizer',
      };

      const stageName = stageNames[failure.stage] || failure.stage;
      const message = failure.message.length > 100 ? `${failure.message.substring(0, 100)}...` : failure.message;

      return `${index + 1}. ${stageName}: ${message}`;
    })
    .join('\n');
}

/**
 * Format complete degraded state metadata
 *
 * @param metadata - Degraded state metadata object
 * @returns Human-readable formatted output
 */
export function formatDegradedStateMetadata(metadata: {
  evidencePreserved: boolean;
  degradedStages: string[];
  modelFailures: Array<{ stage: string; message: string }>;
}): string {
  const lines: string[] = [];

  lines.push('=== Degraded State Report ===');
  lines.push('');
  lines.push(`Evidence Preserved: ${metadata.evidencePreserved ? 'Yes' : 'No'}`);
  lines.push('');
  lines.push(`Degraded Stages: ${formatDegradedStages(metadata.degradedStages)}`);
  lines.push('');
  lines.push('Model Failures:');
  lines.push(formatModelFailures(metadata.modelFailures));
  lines.push('');
  lines.push('=============================');

  return lines.join('\n');
}

/**
 * Format degraded state for compact logging
 *
 * @param metadata - Degraded state metadata object
 * @returns Compact one-line summary
 */
export function formatDegradedStateCompact(metadata: {
  evidencePreserved: boolean;
  degradedStages: string[];
  modelFailures: Array<{ stage: string; message: string }>;
}): string {
  const preserved = metadata.evidencePreserved ? 'preserved' : 'lost';
  const stageCount = metadata.degradedStages.length;
  const failureCount = metadata.modelFailures.length;

  return `Evidence ${preserved} | ${stageCount} degraded stage(s) | ${failureCount} model failure(s)`;
}
