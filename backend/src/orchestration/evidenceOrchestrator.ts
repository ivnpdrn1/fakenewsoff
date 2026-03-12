/**
 * Evidence Orchestrator
 *
 * Coordinates multi-pass evidence retrieval with progressive refinement.
 * Implements iterative retrieval loop with quality thresholds and stopping conditions.
 */

import type { GroundingService } from '../services/groundingService';
import type { EvidenceFilter } from './evidenceFilter';
import type { SourceClassifier } from './sourceClassifier';
import type {
  Query,
  EvidenceCandidate,
  FilteredEvidence,
  ClassifiedSource,
  OrchestrationConfig,
  PipelineState,
} from '../types/orchestration';
import type { NormalizedSourceWithStance } from '../types/grounding';
import { getDemoEvidence } from '../demo/demoEvidenceProvider';

/**
 * Evidence orchestrator service
 */
export class EvidenceOrchestrator {
  constructor(
    private readonly groundingService: GroundingService,
    private readonly evidenceFilter: EvidenceFilter,
    private readonly sourceClassifier: SourceClassifier,
    private readonly config: OrchestrationConfig,
    private readonly isDemoMode: boolean = false
  ) {}

  /**
   * Orchestrate multi-pass evidence retrieval
   *
   * @param queries - Initial queries to execute
   * @param claim - Original claim
   * @returns Pipeline state with collected evidence
   */
  async orchestrate(queries: Query[], claim: string): Promise<PipelineState> {
    this.logOrchestrationStart(queries.length);

    const state: PipelineState = {
      currentPass: 0,
      collectedEvidence: [],
      sourceClassesRepresented: new Set(),
      averageQualityScore: 0,
      qualityThresholdMet: false,
      shouldContinue: true,
    };

    // Execute passes until stopping condition met
    while (state.shouldContinue && state.currentPass < this.config.maxRetrievalPasses) {
      state.currentPass++;

      // Build pass queries
      const passQueries = this.buildPassQueries(queries, state);

      // Execute pass
      const passEvidence = await this.executePass(passQueries, claim, state.currentPass);

      // Add to collected evidence
      state.collectedEvidence.push(...passEvidence);

      // Update state
      this.updateState(state);

      // Check stopping conditions
      state.shouldContinue = this.shouldContinue(state);

      this.logPassComplete(state);
    }

    this.logOrchestrationComplete(state);

    return state;
  }

  /**
   * Execute single retrieval pass
   */
  private async executePass(
    queries: Query[],
    claim: string,
    passNumber: number
  ): Promise<EvidenceCandidate[]> {
    this.logPassStart(passNumber, queries.length);

    const candidates: EvidenceCandidate[] = [];

    // In demo mode, use demo evidence provider instead of grounding service
    if (this.isDemoMode) {
      // Get demo evidence for the claim
      const demoSources = getDemoEvidence(claim);
      
      // Convert to evidence candidates
      for (const source of demoSources) {
        candidates.push(this.toEvidenceCandidate(source, queries[0] || { text: claim, type: 'exact' }, passNumber));
      }
      
      // Simulate realistic latency (50-100ms)
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
    } else {
      // Execute queries in parallel
      const results = await Promise.all(
        queries.map(async (query) => {
          try {
            // Call grounding service
            const bundle = await this.groundingService.ground(query.text);

            // Convert to evidence candidates with default stance
            return bundle.sources.map((source) => this.toEvidenceCandidate(source, query, passNumber));
          } catch (error) {
            this.logQueryError(query, error);
            return [];
          }
        })
      );

      // Flatten results
      for (const result of results) {
        candidates.push(...result);
      }
    }

    // Filter evidence
    const filtered = await this.evidenceFilter.filter(candidates, claim);

    // Keep only passed evidence
    const passed = filtered.filter((e) => e.passed);

    // Classify sources
    const classified = passed.map((e) =>
      this.sourceClassifier.classify(this.addStanceInfo(e), e.pageType)
    );

    return classified as EvidenceCandidate[];
  }

  /**
   * Add stance information to evidence (default to 'mentions')
   */
  private addStanceInfo(evidence: FilteredEvidence): NormalizedSourceWithStance {
    return {
      ...evidence,
      stance: 'mentions',
      provider: 'gdelt',
      credibilityTier: 2,
    };
  }

  /**
   * Build queries for current pass
   */
  private buildPassQueries(allQueries: Query[], state: PipelineState): Query[] {
    if (state.currentPass === 1) {
      // Pass 1: Broad queries (exact, entity_action, date_sensitive)
      return allQueries.filter((q) =>
        ['exact', 'entity_action', 'date_sensitive'].includes(q.type)
      );
    } else if (state.currentPass === 2) {
      // Pass 2: Targeted queries (official_confirmation, regional, fact_check)
      return allQueries.filter((q) =>
        ['official_confirmation', 'regional', 'fact_check'].includes(q.type)
      );
    } else {
      // Pass 3: Contradiction and primary source queries
      return allQueries.filter((q) =>
        ['contradiction', 'primary_source'].includes(q.type)
      );
    }
  }

  /**
   * Update pipeline state after pass
   */
  private updateState(state: PipelineState): void {
    // Update source classes represented
    state.sourceClassesRepresented.clear();
    for (const evidence of state.collectedEvidence) {
      const classified = evidence as ClassifiedSource;
      if (classified.sourceClass) {
        state.sourceClassesRepresented.add(classified.sourceClass);
      }
    }

    // Calculate average quality score
    if (state.collectedEvidence.length > 0) {
      const totalScore = state.collectedEvidence.reduce(
        (sum, e) => sum + (e.qualityScore?.composite || 0),
        0
      );
      state.averageQualityScore = totalScore / state.collectedEvidence.length;
    }

    // Check quality threshold
    state.qualityThresholdMet =
      state.averageQualityScore >= this.config.minEvidenceScore &&
      state.sourceClassesRepresented.size >= this.config.minSourceDiversity;
  }

  /**
   * Check if should continue to next pass
   */
  private shouldContinue(state: PipelineState): boolean {
    // Stop if quality threshold met
    if (state.qualityThresholdMet) {
      return false;
    }

    // Stop if max passes reached
    if (state.currentPass >= this.config.maxRetrievalPasses) {
      return false;
    }

    // Stop if no evidence collected
    if (state.collectedEvidence.length === 0 && state.currentPass > 1) {
      return false;
    }

    return true;
  }

  /**
   * Convert normalized source to evidence candidate
   */
  private toEvidenceCandidate(
    source: { url: string; title: string; snippet: string; publishDate: string; domain: string; score: number },
    query: Query,
    passNumber: number
  ): EvidenceCandidate {
    return {
      url: source.url,
      title: source.title,
      snippet: source.snippet,
      publishDate: source.publishDate,
      domain: source.domain,
      score: source.score,
      stance: 'mentions',
      provider: 'gdelt',
      credibilityTier: 2,
      retrievedByQuery: query.text,
      retrievedInPass: passNumber,
      qualityScore: {
        claimRelevance: 0,
        specificity: 0,
        directness: 0,
        freshness: 0,
        sourceAuthority: 0,
        primaryWeight: 0,
        contradictionValue: 0,
        corroborationCount: 0,
        accessibility: 0,
        geographicRelevance: 0,
        composite: 0,
      },
      sourceClass: 'regional_media',
      authorityLevel: 'medium',
      pageType: 'article',
    };
  }

  /**
   * Log orchestration start
   */
  private logOrchestrationStart(queryCount: number): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'evidenceOrchestrator',
        event: 'orchestration_start',
        query_count: queryCount,
        max_passes: this.config.maxRetrievalPasses,
      })
    );
  }

  /**
   * Log pass start
   */
  private logPassStart(passNumber: number, queryCount: number): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'evidenceOrchestrator',
        event: 'pass_start',
        pass_number: passNumber,
        query_count: queryCount,
      })
    );
  }

  /**
   * Log pass complete
   */
  private logPassComplete(state: PipelineState): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'evidenceOrchestrator',
        event: 'pass_complete',
        pass_number: state.currentPass,
        evidence_count: state.collectedEvidence.length,
        source_classes: Array.from(state.sourceClassesRepresented),
        average_quality: state.averageQualityScore,
        threshold_met: state.qualityThresholdMet,
      })
    );
  }

  /**
   * Log orchestration complete
   */
  private logOrchestrationComplete(state: PipelineState): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'evidenceOrchestrator',
        event: 'orchestration_complete',
        passes_executed: state.currentPass,
        total_evidence: state.collectedEvidence.length,
        source_classes: Array.from(state.sourceClassesRepresented),
        average_quality: state.averageQualityScore,
        threshold_met: state.qualityThresholdMet,
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
        service: 'evidenceOrchestrator',
        event: 'query_error',
        query_type: query.type,
        query_text: query.text,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
    );
  }
}
