/**
 * Query Generator
 *
 * Generates diverse search queries from claim decomposition using NOVA.
 * Provides fallback to keyword extraction if generation fails.
 */

import { generateQueriesFromSubclaims } from '../services/novaClient';
import type { ClaimDecomposition, Query } from '../types/orchestration';

/**
 * Query generator service
 */
export class QueryGenerator {
  /**
   * Generate search queries from claim decomposition
   *
   * @param decomposition - Claim decomposition
   * @returns Array of search queries
   */
  async generateQueries(decomposition: ClaimDecomposition): Promise<Query[]> {
    try {
      this.logGenerationStart(decomposition);

      const queries = await generateQueriesFromSubclaims(decomposition);

      this.logGenerationSuccess(queries);

      return queries;
    } catch (error) {
      this.logGenerationError(decomposition, error);

      // Fallback: extract keywords from claim
      return this.fallbackToKeywordExtraction(decomposition);
    }
  }

  /**
   * Fallback: extract keywords from claim
   */
  private fallbackToKeywordExtraction(decomposition: ClaimDecomposition): Query[] {
    const claim = decomposition.originalClaim;

    // Extract potential entities (capitalized words)
    const words = claim.split(/\s+/);
    const entities = words.filter((word) => /^[A-Z]/.test(word));

    const queries: Query[] = [
      {
        type: 'exact',
        text: claim,
        priority: 1.0,
      },
    ];

    // Add entity-based query if entities found
    if (entities.length > 0) {
      queries.push({
        type: 'entity_action',
        text: entities.join(' '),
        priority: 0.8,
      });
    }

    return queries;
  }

  /**
   * Log generation start
   */
  private logGenerationStart(decomposition: ClaimDecomposition): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'queryGenerator',
        event: 'generation_start',
        subclaim_count: decomposition.subclaims.length,
      })
    );
  }

  /**
   * Log generation success
   */
  private logGenerationSuccess(queries: Query[]): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'queryGenerator',
        event: 'generation_success',
        query_count: queries.length,
        query_types: queries.map((q) => q.type),
      })
    );
  }

  /**
   * Log generation error
   */
  private logGenerationError(decomposition: ClaimDecomposition, error: unknown): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'WARN',
        service: 'queryGenerator',
        event: 'generation_error',
        subclaim_count: decomposition.subclaims.length,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        fallback_used: true,
      })
    );
  }
}
