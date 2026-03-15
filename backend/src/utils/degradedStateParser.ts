/**
 * Degraded State Parser
 *
 * Parses degraded state metadata from API responses.
 * Validates and extracts degraded stages and model failures.
 */

/**
 * Parse degraded stages array
 *
 * @param degradedStages - Array of stage names that used fallback
 * @returns Parsed and validated stage names
 */
export function parseDegradedStages(degradedStages: unknown): string[] {
  if (!Array.isArray(degradedStages)) {
    throw new Error('degradedStages must be an array');
  }

  const validStages = ['evidenceFilter', 'stanceClassifier', 'contradictionSearcher', 'verdictSynthesizer'];
  const parsed: string[] = [];

  for (const stage of degradedStages) {
    if (typeof stage !== 'string') {
      throw new Error(`Invalid stage type: expected string, got ${typeof stage}`);
    }

    if (!validStages.includes(stage)) {
      throw new Error(`Invalid stage name: ${stage}`);
    }

    parsed.push(stage);
  }

  return parsed;
}

/**
 * Parse model failures array
 *
 * @param modelFailures - Array of model failure objects
 * @returns Parsed and validated model failures
 */
export function parseModelFailures(modelFailures: unknown): Array<{ stage: string; message: string }> {
  if (!Array.isArray(modelFailures)) {
    throw new Error('modelFailures must be an array');
  }

  const parsed: Array<{ stage: string; message: string }> = [];

  for (const failure of modelFailures) {
    if (typeof failure !== 'object' || failure === null) {
      throw new Error('Each model failure must be an object');
    }

    const failureObj = failure as Record<string, unknown>;

    if (typeof failureObj.stage !== 'string') {
      throw new Error('Model failure stage must be a string');
    }

    if (typeof failureObj.message !== 'string') {
      throw new Error('Model failure message must be a string');
    }

    parsed.push({
      stage: failureObj.stage,
      message: failureObj.message,
    });
  }

  return parsed;
}

/**
 * Parse complete degraded state metadata
 *
 * @param metadata - Degraded state metadata object
 * @returns Parsed and validated metadata
 */
export function parseDegradedStateMetadata(metadata: unknown): {
  evidencePreserved: boolean;
  degradedStages: string[];
  modelFailures: Array<{ stage: string; message: string }>;
} {
  if (typeof metadata !== 'object' || metadata === null) {
    throw new Error('Degraded state metadata must be an object');
  }

  const metadataObj = metadata as Record<string, unknown>;

  if (typeof metadataObj.evidencePreserved !== 'boolean') {
    throw new Error('evidencePreserved must be a boolean');
  }

  const degradedStages = parseDegradedStages(metadataObj.degradedStages);
  const modelFailures = parseModelFailures(metadataObj.modelFailures);

  return {
    evidencePreserved: metadataObj.evidencePreserved,
    degradedStages,
    modelFailures,
  };
}
