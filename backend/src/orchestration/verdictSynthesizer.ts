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
   * @returns Final verdict with classification and rationale
   */
  async synthesize(
    claim: string,
    decomposition: ClaimDecomposition,
    evidenceBuckets: EvidenceBucket,
    contradictionResult: ContradictionResult
  ): Promise<Verdict> {
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

      return verdict;
    } catch (error) {
      this.logSynthesisError(error);

      // Fallback: return partial verdict
      return this.fallbackVerdict(claim, decomposition, evidenceBuckets, contradictionResult);
    }
  }

  /**
   * Fallback verdict when synthesis fails
   */
  private fallbackVerdict(
    claim: string,
    decomposition: ClaimDecomposition,
    evidenceBuckets: EvidenceBucket,
    contradictionResult: ContradictionResult
  ): Verdict {
    const supportingCount = evidenceBuckets.supporting.length;
    const contradictingCount = evidenceBuckets.contradicting.length;

    // Simple heuristic classification
    let classification: Verdict['classification'];
    let confidence: number;
    let rationale: string;

    if (supportingCount === 0 && contradictingCount === 0) {
      classification = 'unverified';
      confidence = 0.3;
      rationale = 'The system could not retrieve sufficient reliable evidence at this time. Evidence sources may be temporarily unavailable, rate-limited, or the claim may be too recent for verification. This is a production analysis with limited evidence availability.';
    } else if (supportingCount > contradictingCount * 2) {
      classification = 'true';
      confidence = 0.7;
      rationale = `Found ${supportingCount} supporting sources with limited contradictory evidence.`;
    } else if (contradictingCount > supportingCount * 2) {
      classification = 'false';
      confidence = 0.7;
      rationale = `Found ${contradictingCount} contradictory sources with limited supporting evidence.`;
    } else if (supportingCount > 0 && contradictingCount > 0) {
      classification = 'partially_true';
      confidence = 0.6;
      rationale = `Found mixed evidence: ${supportingCount} supporting and ${contradictingCount} contradicting sources.`;
    } else {
      classification = 'unverified';
      confidence = 0.4;
      rationale = 'Limited evidence available for verification.';
    }

    return {
      classification,
      confidence,
      supportedSubclaims: decomposition.subclaims.map((sc) => sc.text),
      unsupportedSubclaims: [],
      contradictorySummary: contradictionResult.foundContradictions
        ? `Found ${contradictingCount} contradictory sources`
        : 'No contradictory evidence found',
      unresolvedUncertainties: supportingCount === 0 && contradictingCount === 0 
        ? ['Evidence retrieval did not return sufficient sources']
        : [],
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
