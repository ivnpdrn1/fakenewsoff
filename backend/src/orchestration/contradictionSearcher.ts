/**
 * Contradiction Searcher
 *
 * Actively seeks disconfirming evidence using contradiction queries.
 * Ensures contradictory evidence is included in final analysis.
 */

import type { GroundingService } from '../services/groundingService';
import type { EvidenceFilter } from './evidenceFilter';
import type { SourceClassifier } from './sourceClassifier';
import type {
  Query,
  FilteredEvidence,
  ContradictionResult,
} from '../types/orchestration';
import type { NormalizedSourceWithStance } from '../types/grounding';
import { getDemoEvidence } from '../demo/demoEvidenceProvider';

/**
 * Contradiction searcher service
 */
export class ContradictionSearcher {
  constructor(
    private readonly groundingService: GroundingService,
    private readonly evidenceFilter: EvidenceFilter,
    private readonly sourceClassifier: SourceClassifier,
    private readonly isDemoMode: boolean = false
  ) {}

  /**
   * Search for contradictory evidence
   *
   * @param claim - Original claim
   * @param contradictionQueries - Queries targeting disconfirming evidence
   * @returns Contradiction result with evidence and analysis
   */
  async searchContradictions(
    claim: string,
    contradictionQueries: Query[]
  ): Promise<ContradictionResult> {
    this.logSearchStart(contradictionQueries.length);

    if (contradictionQueries.length === 0) {
      return {
        evidence: [],
        queries: [],
        foundContradictions: false,
        fallbackUsed: false,
      };
    }

    const contradictoryEvidence: FilteredEvidence[] = [];
    const executedQueries: string[] = [];
    let fallbackUsed = false;
    let modelFailure: string | undefined;

    // In demo mode, contradiction evidence is already included in main demo evidence
    // So we return empty here to avoid duplicates
    if (this.isDemoMode) {
      return {
        evidence: [],
        queries: [],
        foundContradictions: false,
        fallbackUsed: false,
      };
    }

    // Execute contradiction queries
    for (const query of contradictionQueries) {
      try {
        executedQueries.push(query.text);

        // Call grounding service
        const bundle = await this.groundingService.ground(query.text);

        // Convert to evidence candidates
        const candidates = bundle.sources.map((source) => ({
          ...source,
          stance: 'contradicts' as const,
          provider: 'gdelt' as const,
          credibilityTier: 2 as const,
          retrievedByQuery: query.text,
          retrievedInPass: 3,
          qualityScore: {
            claimRelevance: 0,
            specificity: 0,
            directness: 0,
            freshness: 0,
            sourceAuthority: 0,
            primaryWeight: 0,
            contradictionValue: 1.0, // High contradiction value
            corroborationCount: 0,
            accessibility: 0,
            geographicRelevance: 0,
            composite: 0,
          },
          sourceClass: 'regional_media' as const,
          authorityLevel: 'medium' as const,
          pageType: 'article' as const,
        }));

        // Filter evidence (but don't reject just because it contradicts)
        const filterResult = await this.evidenceFilter.filter(candidates, claim);

        // Track if filter used fallback
        if (filterResult.fallbackUsed) {
          fallbackUsed = true;
          if (!modelFailure && filterResult.modelFailure) {
            modelFailure = filterResult.modelFailure;
          }
        }

        // Keep passed evidence
        const passed = filterResult.passed;

        // Classify sources
        const classified = passed.map((e) =>
          this.sourceClassifier.classify(this.addStanceInfo(e), e.pageType)
        );

        contradictoryEvidence.push(...(classified as FilteredEvidence[]));
      } catch (error) {
        // If contradiction search fails, use pass-through mode
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'WARN',
            service: 'contradictionSearcher',
            event: 'CONTRADICTION_SEARCH_FALLBACK',
            message: 'Contradiction search failed - activating pass-through preservation',
            error_message: errorMessage,
            query: query.text,
          })
        );
        
        fallbackUsed = true;
        if (!modelFailure) {
          modelFailure = `Contradiction search failed: ${errorMessage}`;
        }
        
        this.logQueryError(query, error);
      }
    }

    const foundContradictions = contradictoryEvidence.length > 0;

    this.logSearchComplete(contradictoryEvidence.length, foundContradictions);

    return {
      evidence: contradictoryEvidence,
      queries: executedQueries,
      foundContradictions,
      fallbackUsed,
      modelFailure,
    };
  }

  /**
   * Add stance information to evidence
   */
  private addStanceInfo(evidence: FilteredEvidence): NormalizedSourceWithStance {
    return {
      ...evidence,
      stance: 'contradicts',
      provider: 'gdelt',
      credibilityTier: 2,
    };
  }

  /**
   * Log search start
   */
  private logSearchStart(queryCount: number): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'contradictionSearcher',
        event: 'search_start',
        query_count: queryCount,
      })
    );
  }

  /**
   * Log search complete
   */
  private logSearchComplete(evidenceCount: number, foundContradictions: boolean): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'contradictionSearcher',
        event: 'search_complete',
        evidence_count: evidenceCount,
        found_contradictions: foundContradictions,
      })
    );
  }

  /**
   * Log query error
   */
  private logQueryError(query: Query, error: unknown): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'WARN',
        service: 'contradictionSearcher',
        event: 'query_error',
        query_type: query.type,
        query_text: query.text,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
    );
  }
}
