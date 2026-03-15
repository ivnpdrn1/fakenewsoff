/**
 * Pass-Through Mode Activation Utility
 *
 * Generic utility for executing operations with pass-through fallback when AI models fail.
 * Ensures evidence is preserved even when downstream AI models encounter errors.
 */

/**
 * Result of executing an operation with pass-through support
 */
export interface PassThroughResult<T> {
  /** Operation result (either from successful execution or fallback) */
  result: T;
  /** Whether pass-through fallback was used */
  fallbackUsed: boolean;
  /** Model failure message if fallback was used */
  modelFailure?: string;
}

/**
 * Execute an operation with pass-through fallback support
 *
 * @param stage - Stage name for logging (e.g., 'evidenceFilter', 'verdictSynthesizer')
 * @param evidence - Evidence to preserve if operation fails
 * @param operation - Async operation to execute
 * @param fallbackFn - Fallback function to generate result from evidence
 * @returns Result with fallback status and optional failure message
 */
export async function executeWithPassThrough<T>(
  stage: string,
  evidence: any[],
  operation: () => Promise<T>,
  fallbackFn: (evidence: any[]) => T
): Promise<PassThroughResult<T>> {
  try {
    const result = await operation();
    return { result, fallbackUsed: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'WARN',
        service: 'passThroughExecutor',
        event: `${stage.toUpperCase()}_FALLBACK`,
        message: `${stage} model failed - activating pass-through preservation`,
        error_message: errorMessage,
        evidence_count: evidence.length,
      })
    );

    const result = fallbackFn(evidence);
    return {
      result,
      fallbackUsed: true,
      modelFailure: `${stage} model failed: ${errorMessage}`,
    };
  }
}
