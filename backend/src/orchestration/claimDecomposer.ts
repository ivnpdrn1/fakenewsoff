/**
 * Claim Decomposer
 *
 * Decomposes claims into verifiable subclaims using NOVA as a reasoning coordinator.
 * Provides fallback to single subclaim if decomposition fails.
 */

import { decomposeClaimToSubclaims } from '../services/novaClient';
import type { ClaimDecomposition } from '../types/orchestration';

/**
 * Claim decomposer service
 */
export class ClaimDecomposer {
  /**
   * Decompose claim into verifiable subclaims
   *
   * @param claim - Original claim to decompose
   * @returns Claim decomposition with subclaims
   */
  async decompose(claim: string): Promise<ClaimDecomposition> {
    try {
      this.logDecompositionStart(claim);

      const decomposition = await decomposeClaimToSubclaims(claim);

      this.logDecompositionSuccess(decomposition);

      return decomposition;
    } catch (error) {
      this.logDecompositionError(claim, error);

      // Fallback: return single subclaim
      return {
        originalClaim: claim,
        subclaims: [
          {
            type: 'action',
            text: claim,
            importance: 1.0,
          },
        ],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Log decomposition start
   */
  private logDecompositionStart(claim: string): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'claimDecomposer',
        event: 'decomposition_start',
        claim_length: claim.length,
      })
    );
  }

  /**
   * Log decomposition success
   */
  private logDecompositionSuccess(decomposition: ClaimDecomposition): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'claimDecomposer',
        event: 'decomposition_success',
        subclaim_count: decomposition.subclaims.length,
        subclaim_types: decomposition.subclaims.map((sc) => sc.type),
        subclaim_texts: decomposition.subclaims.map((sc) => sc.text.substring(0, 50)),
      })
    );
  }

  /**
   * Log decomposition error
   */
  private logDecompositionError(claim: string, error: unknown): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'WARN',
        service: 'claimDecomposer',
        event: 'decomposition_error',
        claim_length: claim.length,
        claim_preview: claim.substring(0, 100),
        error_message: error instanceof Error ? error.message : 'Unknown error',
        error_stack: error instanceof Error ? error.stack?.substring(0, 200) : undefined,
        fallback_used: true,
        fallback_strategy: 'single_subclaim',
      })
    );
  }
}
