/**
 * Query Generator
 *
 * Generates diverse search queries from claim decomposition.
 * Uses queryBuilder.ts for reliable multi-query generation.
 */

import { generateQueriesFromSubclaims } from '../services/novaClient';
import { generateQueries as generateQueriesFromText } from '../utils/queryBuilder';
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
    this.logGenerationStart(decomposition);

    // Primary strategy: Use queryBuilder.ts for reliable multi-query generation
    const queryBuilderResult = generateQueriesFromText(decomposition.originalClaim);
    
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'queryGenerator',
        event: 'query_variants_generated',
        queries_before_dedup: queryBuilderResult.queries,
        queries_count: queryBuilderResult.queries.length,
        entities_extracted: queryBuilderResult.metadata.entitiesExtracted,
        key_phrases_extracted: queryBuilderResult.metadata.keyPhrasesExtracted,
      })
    );

    // Convert to Query[] format with types
    const queries: Query[] = queryBuilderResult.queries.map((queryText, index) => {
      // Assign query types based on content and position
      let type: Query['type'] = 'exact';
      
      if (index === 0) {
        type = 'exact'; // First query is always exact
      } else if (queryText.toLowerCase().includes('latest') || queryText.toLowerCase().includes('news')) {
        type = 'date_sensitive';
      } else if (queryText.toLowerCase().includes('reuters') || queryText.toLowerCase().includes('bbc')) {
        type = 'official_confirmation';
      } else if (queryText.toLowerCase().includes('what is')) {
        type = 'fact_check';
      } else if (queryBuilderResult.metadata.entitiesExtracted.length > 0 && 
                 queryBuilderResult.metadata.entitiesExtracted.some(e => queryText.includes(e))) {
        type = 'entity_action';
      } else {
        type = 'regional';
      }

      return {
        type,
        text: queryText,
        priority: 1.0 - (index * 0.1), // Decreasing priority
      };
    });

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'queryGenerator',
        event: 'orchestrator_queries_finalized',
        queries_after_dedup: queries.map(q => q.text),
        queries_count: queries.length,
        query_types: queries.map(q => q.type),
      })
    );

    this.logGenerationSuccess(queries);

    return queries;
  }

  /**
   * Fallback: extract keywords from claim (legacy)
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
        original_claim: decomposition.originalClaim.substring(0, 100),
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
        query_texts: queries.map((q) => q.text),
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
