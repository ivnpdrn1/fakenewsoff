/**
 * Evidence Preservation Invariant Validator
 *
 * Validates that evidence is never lost during response packaging.
 * The invariant rule: If LIVE_SOURCES_BEFORE_PACKAGING > 0, then LIVE_SOURCES_AFTER_PACKAGING > 0
 */

/**
 * Validation result
 */
export interface ValidationResult {
  /** Validation status */
  status: 'PASS' | 'FAIL';
  /** Validation message */
  message: string;
}

/**
 * Validate evidence preservation invariant
 *
 * @param liveSourcesBeforePackaging - Number of live sources before packaging
 * @param liveSourcesAfterPackaging - Number of live sources after packaging
 * @returns Validation result with status and message
 */
export function validateEvidencePreservationInvariant(
  liveSourcesBeforePackaging: number,
  liveSourcesAfterPackaging: number
): ValidationResult {
  if (liveSourcesBeforePackaging > 0 && liveSourcesAfterPackaging === 0) {
    const message = 'INVARIANT VIOLATION: Evidence was lost during packaging';
    console.log(
      JSON.stringify({
        level: 'ERROR',
        service: 'evidencePreservationValidator',
        event: 'EVIDENCE_PRESERVATION_INVARIANT',
        status: 'FAIL',
        before_count: liveSourcesBeforePackaging,
        after_count: liveSourcesAfterPackaging,
        message,
      })
    );
    return { status: 'FAIL', message };
  } else {
    console.log(
      JSON.stringify({
        level: 'INFO',
        service: 'evidencePreservationValidator',
        event: 'EVIDENCE_PRESERVATION_INVARIANT',
        status: 'PASS',
        before_count: liveSourcesBeforePackaging,
        after_count: liveSourcesAfterPackaging,
      })
    );
    return {
      status: 'PASS',
      message: 'Evidence preservation invariant satisfied',
    };
  }
}
