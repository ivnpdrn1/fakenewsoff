/**
 * Verdict Synthesizer
 *
 * Produces final analysis with confidence and rationale using NOVA.
 * Synthesizes verdict from supporting, contradicting, and unclear evidence.
 */

import { synthesizeVerdict } from '../services/novaClient';
import type {
  ClaimDecomposition,
  ContradictionResult,
  Verdict,
  SynthesisResult,
  EvidenceBucket,
} from '../types/orchestration';

/**
 * Verdict synthesizer service
 */
export class VerdictSynthesizer {
  /**
   * Synthesize final verdict from evidence
   *
   * @param claim - Original claim
   * @param decomposition - Claim decomposition
   * @param evidenceBuckets - Categorized evidence
   * @param contradictionResult - Contradiction search result
   * @returns Synthesis result with verdict and fallback metadata
   */
  async synthesize(
    claim: string,
    decomposition: ClaimDecomposition,
    evidenceBuckets: EvidenceBucket,
    contradictionResult: ContradictionResult
  ): Promise<SynthesisResult> {
    try {
      this.logSynthesisStart(
        evidenceBuckets.supporting.length,
        evidenceBuckets.contradicting.length
      );

      // Call NOVA to synthesize verdict
      const verdict = await synthesizeVerdict(
        claim,
        decomposition,
        evidenceBuckets
      );

      this.logSynthesisSuccess(verdict);

      return {
        verdict,
        fallbackUsed: false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'WARN',
          service: 'verdictSynthesizer',
          event: 'VERDICT_SYNTHESIS_FALLBACK',
          message: 'Verdict synthesis failed - activating pass-through preservation',
          error_message: errorMessage,
          evidence_count: evidenceBuckets.supporting.length + evidenceBuckets.contradicting.length + evidenceBuckets.context.length,
        })
      );
      
      this.logSynthesisError(error);

      // Fallback: return degraded verdict with preserved evidence
      const verdict = this.fallbackVerdict(claim, decomposition, evidenceBuckets, contradictionResult);
      
      return {
        verdict,
        fallbackUsed: true,
        modelFailure: `Verdict synthesis failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Fallback verdict when synthesis fails
   * Returns degraded verdict with preserved evidence
   */
  private fallbackVerdict(
    claim: string,
    decomposition: ClaimDecomposition,
    evidenceBuckets: EvidenceBucket,
    contradictionResult: ContradictionResult
  ): Verdict {
    const supportingCount = evidenceBuckets.supporting.length;
    const contradictingCount = evidenceBuckets.contradicting.length;

    // Return degraded verdict with preserved evidence
    const classification: Verdict['classification'] = 'unverified';
    const confidence = 0;
    const rationale = 'Verdict synthesis failed - evidence preserved for manual review';

    return {
      classification,
      confidence,
      supportedSubclaims: [],
      unsupportedSubclaims: decomposition.subclaims.map((sc) => sc.text),
      contradictorySummary: contradictionResult.foundContradictions
        ? `Found ${contradictingCount} contradictory sources`
        : 'No contradictory evidence found',
      unresolvedUncertainties: ['Verdict synthesis model failed - manual review required'],
      bestEvidence: evidenceBuckets.supporting.slice(0, 3),
      rationale,
    };
  }

  /**
   * Log synthesis start
   */
  private logSynthesisStart(supportingCount: number, contradictingCount: number): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'verdictSynthesizer',
        event: 'synthesis_start',
        supporting_count: supportingCount,
        contradicting_count: contradictingCount,
      })
    );
  }

  /**
   * Log synthesis success
   */
  private logSynthesisSuccess(verdict: Verdict): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'verdictSynthesizer',
        event: 'synthesis_success',
        classification: verdict.classification,
        confidence: verdict.confidence,
        supported_subclaims: verdict.supportedSubclaims.length,
        unsupported_subclaims: verdict.unsupportedSubclaims.length,
      })
    );
  }

  /**
   * Log synthesis error
   */
  private logSynthesisError(error: unknown): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'WARN',
        service: 'verdictSynthesizer',
        event: 'synthesis_error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        fallback_used: true,
      })
    );
  }
}
