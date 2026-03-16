/**
 * Evidence Orchestrator
 *
 * Coordinates multi-pass evidence retrieval with progressive refinement.
 * Implements iterative retrieval loop with quality thresholds and stopping conditions.
 */

import type { GroundingService } from '../services/groundingService';
import { groundTextOnly } from '../services/groundingService';
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

    // Add provider health summary and failure details to pipeline state
    if ((this as any)._lastProviderHealthSummary) {
      state.providerHealthSummary = (this as any)._lastProviderHealthSummary;
    }
    if ((this as any)._lastProviderFailureDetails) {
      state.providerFailureDetails = (this as any)._lastProviderFailureDetails;
      
      // DIAGNOSTIC: Log provider failure details capture
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'evidenceOrchestrator',
        event: 'PROVIDER_FAILURE_DETAILS_CAPTURED',
        failure_count: state.providerFailureDetails?.length || 0,
        providers_with_failures: state.providerFailureDetails ? [...new Set(state.providerFailureDetails.map(f => f.provider))] : [],
        failure_details: state.providerFailureDetails ? state.providerFailureDetails.map(f => ({
          provider: f.provider,
          reason: f.reason,
          stage: f.stage,
          error: f.error_message.substring(0, 100),
        })) : [],
      }));
    } else {
      // DIAGNOSTIC: Log when no failure details are captured
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'WARN',
        service: 'evidenceOrchestrator',
        event: 'PROVIDER_FAILURE_DETAILS_MISSING',
        message: 'No provider failure details were captured during orchestration',
      }));
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
        // Implement staged execution with query budgeting
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          event: 'ORCHESTRATOR_STAGED_EXECUTION_START',
          service: 'evidenceOrchestrator',
          pass_number: passNumber,
          query_count: queries.length,
          orchestration_method_used: 'stagedExecution',
          fix_version: 'production_retrieval_efficiency_v3',
        }));

        // Rank queries by relevance
        const rankedQueries = this.rankQueriesByRelevance(queries);

        // Initialize provider tracking
        const providerQueryCount: Record<string, number> = {
          mediastack: 0,
          gdelt: 0,
          serper: 0,
          bing: 0,
        };
        const providerFailureDetails: Array<{
          provider: string;
          query: string;
          reason: string;
          stage: number;
          latency: number;
          raw_count: number;
          normalized_count: number;
          accepted_count: number;
          http_status?: number;
          error_message: string;
        }> = [];
        const cacheHitSources: string[] = [];
        let maxStageReached = 0;

        // Helper function to count usable evidence
        const countUsableEvidence = (candidates: EvidenceCandidate[]): number => {
          return candidates.length;
        };

        // Stage 1: Send best 1 query to Mediastack
        if (rankedQueries.length > 0) {
          maxStageReached = 1;
          const stage1Query = rankedQueries[0];

          console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            event: 'ORCHESTRATOR_STAGE_1_START',
            service: 'evidenceOrchestrator',
            pass_number: passNumber,
            stage: 1,
            query: stage1Query.text,
            provider: 'mediastack',
          }));

          // Check Mediastack cooldown
          const mediastackCooldown = this.groundingService.getProviderCooldown('mediastack');
          if (!mediastackCooldown) {
            const stage1StartTime = Date.now();

            try {
              const result = await this.groundingService.ground(stage1Query.text, undefined, undefined, false);
              const stage1Latency = Date.now() - stage1StartTime;

              providerQueryCount.mediastack++;

              if (result.cacheHit) {
                cacheHitSources.push(`stage1_${stage1Query.text.substring(0, 30)}`);
              }

              // Capture provider failure details from grounding result
              if (result.providerFailureDetails) {
                providerFailureDetails.push({
                  provider: result.providerFailureDetails.provider,
                  query: stage1Query.text,
                  reason: result.providerFailureDetails.reason,
                  stage: 1,
                  latency: stage1Latency,
                  raw_count: result.providerFailureDetails.raw_count || 0,
                  normalized_count: result.providerFailureDetails.normalized_count || 0,
                  accepted_count: result.providerFailureDetails.accepted_count || 0,
                  error_message: result.providerFailureDetails.error_message || '',
                });
              }

              // Convert sources to evidence candidates
              // Note: result.sources is NormalizedSourceWithStance[] from groundTextOnly
              for (const source of result.sources) {
                // Preserve stance from groundTextOnly - DO NOT override
                const sourceWithStance = source as NormalizedSourceWithStance;
                const candidate = this.toEvidenceCandidate(sourceWithStance, stage1Query, passNumber);
                candidates.push({
                  ...candidate,
                  provider: result.providerUsed,
                  // Preserve stance from source - DO NOT override to 'mentions'
                  stance: sourceWithStance.stance,
                  credibilityTier: sourceWithStance.credibilityTier || 2,
                });
              }

              console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                level: 'INFO',
                event: 'ORCHESTRATOR_STAGE_1_COMPLETE',
                service: 'evidenceOrchestrator',
                pass_number: passNumber,
                stage: 1,
                provider: result.providerUsed,
                sources_retrieved: result.sources.length,
                cache_hit: result.cacheHit,
                latency_ms: stage1Latency,
              }));
            } catch (error) {
              const stage1Latency = Date.now() - stage1StartTime;
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';

              providerFailureDetails.push({
                provider: 'mediastack',
                query: stage1Query.text,
                reason: 'attempt_failed',
                stage: 1,
                latency: stage1Latency,
                raw_count: 0,
                normalized_count: 0,
                accepted_count: 0,
                error_message: errorMessage,
              });

              console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                level: 'WARN',
                event: 'ORCHESTRATOR_STAGE_1_FAILED',
                service: 'evidenceOrchestrator',
                pass_number: passNumber,
                stage: 1,
                provider: 'mediastack',
                error: errorMessage.substring(0, 100),
                latency_ms: stage1Latency,
              }));
            }
          } else {
            console.log(JSON.stringify({
              timestamp: new Date().toISOString(),
              level: 'INFO',
              event: 'ORCHESTRATOR_STAGE_1_SKIPPED',
              service: 'evidenceOrchestrator',
              pass_number: passNumber,
              stage: 1,
              provider: 'mediastack',
              reason: 'cooldown_active',
              cooldown_reason: mediastackCooldown.reason,
              remaining_ms: mediastackCooldown.until - Date.now(),
            }));
          }
        }

        // Stage 2: If zero usable evidence from Stage 1, send best 1 query to GDELT
        if (countUsableEvidence(candidates) === 0 && rankedQueries.length > 0) {
          maxStageReached = 2;
          const stage2Query = rankedQueries[0];

          console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            event: 'ORCHESTRATOR_STAGE_2_START',
            service: 'evidenceOrchestrator',
            pass_number: passNumber,
            stage: 2,
            query: stage2Query.text,
            provider: 'gdelt',
          }));

          // Check GDELT cooldown
          const gdeltCooldown = this.groundingService.getProviderCooldown('gdelt');
          if (!gdeltCooldown) {
            const stage2StartTime = Date.now();

            try {
              const result = await this.groundingService.ground(stage2Query.text, undefined, undefined, false);
              const stage2Latency = Date.now() - stage2StartTime;

              providerQueryCount.gdelt++;

              if (result.cacheHit) {
                cacheHitSources.push(`stage2_${stage2Query.text.substring(0, 30)}`);
              }

              // Capture provider failure details from grounding result
              if (result.providerFailureDetails) {
                providerFailureDetails.push({
                  provider: result.providerFailureDetails.provider,
                  query: stage2Query.text,
                  reason: result.providerFailureDetails.reason,
                  stage: 2,
                  latency: stage2Latency,
                  raw_count: result.providerFailureDetails.raw_count || 0,
                  normalized_count: result.providerFailureDetails.normalized_count || 0,
                  accepted_count: result.providerFailureDetails.accepted_count || 0,
                  error_message: result.providerFailureDetails.error_message || '',
                });
              }

              // Convert sources to evidence candidates
              // Note: result.sources is NormalizedSourceWithStance[] from groundTextOnly
              for (const source of result.sources) {
                // Preserve stance from groundTextOnly - DO NOT override
                const sourceWithStance = source as NormalizedSourceWithStance;
                const candidate = this.toEvidenceCandidate(sourceWithStance, stage2Query, passNumber);
                candidates.push({
                  ...candidate,
                  provider: result.providerUsed,
                  // Preserve stance from source - DO NOT override to 'mentions'
                  stance: sourceWithStance.stance,
                  credibilityTier: sourceWithStance.credibilityTier || 2,
                });
              }

              console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                level: 'INFO',
                event: 'ORCHESTRATOR_STAGE_2_COMPLETE',
                service: 'evidenceOrchestrator',
                pass_number: passNumber,
                stage: 2,
                provider: result.providerUsed,
                sources_retrieved: result.sources.length,
                cache_hit: result.cacheHit,
                latency_ms: stage2Latency,
              }));
            } catch (error) {
              const stage2Latency = Date.now() - stage2StartTime;
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';

              providerFailureDetails.push({
                provider: 'gdelt',
                query: stage2Query.text,
                reason: 'attempt_failed',
                stage: 2,
                latency: stage2Latency,
                raw_count: 0,
                normalized_count: 0,
                accepted_count: 0,
                error_message: errorMessage,
              });

              console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                level: 'WARN',
                event: 'ORCHESTRATOR_STAGE_2_FAILED',
                service: 'evidenceOrchestrator',
                pass_number: passNumber,
                stage: 2,
                provider: 'gdelt',
                error: errorMessage.substring(0, 100),
                latency_ms: stage2Latency,
              }));
            }
          } else {
            console.log(JSON.stringify({
              timestamp: new Date().toISOString(),
              level: 'INFO',
              event: 'ORCHESTRATOR_STAGE_2_SKIPPED',
              service: 'evidenceOrchestrator',
              pass_number: passNumber,
              stage: 2,
              provider: 'gdelt',
              reason: 'cooldown_active',
              cooldown_reason: gdeltCooldown.reason,
              remaining_ms: gdeltCooldown.until - Date.now(),
            }));
          }
        }

        // Stage 3: If still zero usable evidence, send one additional ranked query to available provider
        if (countUsableEvidence(candidates) === 0 && rankedQueries.length > 1) {
          maxStageReached = 3;
          const stage3Query = rankedQueries[1]; // Use second-best query

          // Determine available provider (prefer Mediastack, then Serper, then GDELT, then Bing)
          let stage3Provider: string | null = null;
          const mediastackCooldown = this.groundingService.getProviderCooldown('mediastack');
          const serperCooldown = this.groundingService.getProviderCooldown('serper');
          const gdeltCooldown = this.groundingService.getProviderCooldown('gdelt');
          const bingCooldown = this.groundingService.getProviderCooldown('bing');

          if (!mediastackCooldown && providerQueryCount.mediastack < 2) {
            stage3Provider = 'mediastack';
          } else if (!serperCooldown && providerQueryCount.serper < 2) {
            stage3Provider = 'serper';
          } else if (!gdeltCooldown && providerQueryCount.gdelt < 2) {
            stage3Provider = 'gdelt';
          } else if (!bingCooldown && providerQueryCount.bing < 2) {
            stage3Provider = 'bing';
          }

          if (stage3Provider) {
            console.log(JSON.stringify({
              timestamp: new Date().toISOString(),
              level: 'INFO',
              event: 'ORCHESTRATOR_STAGE_3_START',
              service: 'evidenceOrchestrator',
              pass_number: passNumber,
              stage: 3,
              query: stage3Query.text,
              provider: stage3Provider,
            }));

            const stage3StartTime = Date.now();

            try {
              const result = await this.groundingService.ground(stage3Query.text, undefined, undefined, false);
              const stage3Latency = Date.now() - stage3StartTime;

              providerQueryCount[stage3Provider]++;

              if (result.cacheHit) {
                cacheHitSources.push(`stage3_${stage3Query.text.substring(0, 30)}`);
              }

              // Capture provider failure details from grounding result
              if (result.providerFailureDetails) {
                providerFailureDetails.push({
                  provider: result.providerFailureDetails.provider,
                  query: stage3Query.text,
                  reason: result.providerFailureDetails.reason,
                  stage: 3,
                  latency: stage3Latency,
                  raw_count: result.providerFailureDetails.raw_count || 0,
                  normalized_count: result.providerFailureDetails.normalized_count || 0,
                  accepted_count: result.providerFailureDetails.accepted_count || 0,
                  error_message: result.providerFailureDetails.error_message || '',
                });
              }

              // Convert sources to evidence candidates
              // Note: result.sources is NormalizedSourceWithStance[] from groundTextOnly
              for (const source of result.sources) {
                // Preserve stance from groundTextOnly - DO NOT override
                const sourceWithStance = source as NormalizedSourceWithStance;
                const candidate = this.toEvidenceCandidate(sourceWithStance, stage3Query, passNumber);
                candidates.push({
                  ...candidate,
                  provider: result.providerUsed,
                  // Preserve stance from source - DO NOT override to 'mentions'
                  stance: sourceWithStance.stance,
                  credibilityTier: sourceWithStance.credibilityTier || 2,
                });
              }

              console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                level: 'INFO',
                event: 'ORCHESTRATOR_STAGE_3_COMPLETE',
                service: 'evidenceOrchestrator',
                pass_number: passNumber,
                stage: 3,
                provider: result.providerUsed,
                sources_retrieved: result.sources.length,
                cache_hit: result.cacheHit,
                latency_ms: stage3Latency,
              }));
            } catch (error) {
              const stage3Latency = Date.now() - stage3StartTime;
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';

              providerFailureDetails.push({
                provider: stage3Provider,
                query: stage3Query.text,
                reason: 'attempt_failed',
                stage: 3,
                latency: stage3Latency,
                raw_count: 0,
                normalized_count: 0,
                accepted_count: 0,
                error_message: errorMessage,
              });

              console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                level: 'WARN',
                event: 'ORCHESTRATOR_STAGE_3_FAILED',
                service: 'evidenceOrchestrator',
                pass_number: passNumber,
                stage: 3,
                provider: stage3Provider,
                error: errorMessage.substring(0, 100),
                latency_ms: stage3Latency,
              }));
            }
          } else {
            console.log(JSON.stringify({
              timestamp: new Date().toISOString(),
              level: 'INFO',
              event: 'ORCHESTRATOR_STAGE_3_SKIPPED',
              service: 'evidenceOrchestrator',
              pass_number: passNumber,
              stage: 3,
              reason: 'no_available_provider',
              cooldowns: {
                mediastack: mediastackCooldown ? mediastackCooldown.reason : 'none',
                serper: serperCooldown ? serperCooldown.reason : 'none',
                gdelt: gdeltCooldown ? gdeltCooldown.reason : 'none',
                bing: bingCooldown ? bingCooldown.reason : 'none',
              },
            }));
          }
        }

        // Build provider health summary
        const activeCooldowns: string[] = [];
        const mediastackCooldown = this.groundingService.getProviderCooldown('mediastack');
        const serperCooldown = this.groundingService.getProviderCooldown('serper');
        const gdeltCooldown = this.groundingService.getProviderCooldown('gdelt');
        const bingCooldown = this.groundingService.getProviderCooldown('bing');

        if (mediastackCooldown) activeCooldowns.push('mediastack');
        if (serperCooldown) activeCooldowns.push('serper');
        if (gdeltCooldown) activeCooldowns.push('gdelt');
        if (bingCooldown) activeCooldowns.push('bing');

        // Store provider health summary in a way that can be accessed by the orchestrator
        // This will be added to the pipeline state in the orchestrate method
        (this as any)._lastProviderHealthSummary = {
          provider_budget_used: providerQueryCount,
          provider_cooldowns_active: activeCooldowns,
          cache_hit_source: cacheHitSources,
          staged_retrieval_phase_reached: maxStageReached,
        };

        // Store provider failure details
        (this as any)._lastProviderFailureDetails = providerFailureDetails;

        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          event: 'ORCHESTRATOR_STAGED_EXECUTION_COMPLETE',
          service: 'evidenceOrchestrator',
          pass_number: passNumber,
          sources_retrieved: candidates.length,
          max_stage_reached: maxStageReached,
          provider_budget_used: providerQueryCount,
          provider_cooldowns_active: activeCooldowns,
          cache_hits: cacheHitSources.length,
        }));
      }

      // Filter evidence
      const filterResult = await this.evidenceFilter.filter(candidates, claim);

      // DIAGNOSTIC: Log filtered sources count
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'evidenceOrchestrator',
        event: 'FILTERED_SOURCES_COUNT',
        pass_number: passNumber,
        candidates_before_filter: candidates.length,
        filtered_total: filterResult.passed.length + filterResult.rejected.length,
        filtered_passed: filterResult.passed.length,
        filtered_rejected: filterResult.rejected.length,
      }));

      // Keep only passed evidence
      const passed = filterResult.passed;

      // Classify sources
      const classified = passed.map((e) =>
        this.sourceClassifier.classify(this.addStanceInfo(e), e.pageType)
      );

      return classified as EvidenceCandidate[];
    }

  /**
   * Rank queries by relevance for staged execution
   *
   * Prioritizes queries based on:
   * 1. Query type ('exact' and 'entity_action' are highest priority)
   * 2. Query text length and specificity (longer, more specific queries ranked higher)
   * 3. Priority score from query generation
   *
   * @param queries - Queries to rank
   * @returns Ranked query list (highest priority first)
   */
  private rankQueriesByRelevance(queries: Query[]): Query[] {
    return [...queries].sort((a, b) => {
      // Priority 1: Query type
      const typeScoreA = this.getQueryTypeScore(a.type);
      const typeScoreB = this.getQueryTypeScore(b.type);

      if (typeScoreA !== typeScoreB) {
        return typeScoreB - typeScoreA; // Higher score first
      }

      // Priority 2: Query priority from generation
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }

      // Priority 3: Query specificity (length and word count)
      const specificityA = this.getQuerySpecificity(a.text);
      const specificityB = this.getQuerySpecificity(b.text);

      return specificityB - specificityA; // Higher specificity first
    });
  }

  /**
   * Get score for query type (higher = more relevant)
   */
  private getQueryTypeScore(type: string): number {
    const typeScores: Record<string, number> = {
      'exact': 10,
      'entity_action': 9,
      'date_sensitive': 7,
      'official_confirmation': 7,
      'primary_source': 6,
      'regional': 5,
      'contradiction': 5,
      'fact_check': 4,
    };

    return typeScores[type] || 3;
  }

  /**
   * Calculate query specificity based on length and structure
   */
  private getQuerySpecificity(text: string): number {
    const words = text.trim().split(/\s+/);
    const wordCount = words.length;
    const charCount = text.length;

    // Specificity score: balance between length and word count
    // Prefer queries with 3-8 words (not too short, not too long)
    const wordCountScore = wordCount >= 3 && wordCount <= 8 ? 1.0 : 0.5;
    const lengthScore = Math.min(charCount / 100, 1.0); // Normalize to 0-1

    return wordCountScore * 0.6 + lengthScore * 0.4;
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
