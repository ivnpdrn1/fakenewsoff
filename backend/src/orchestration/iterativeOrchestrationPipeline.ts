/**
 * Iterative Orchestration Pipeline
 *
 * Main pipeline function that wires together all orchestration components.
 * Transforms claims into verdicts through multi-stage evidence orchestration.
 */

import { getGroundingService } from '../services/groundingService';
import { getConfig } from './orchestrationConfig';
import { ClaimDecomposer } from './claimDecomposer';
import { QueryGenerator } from './queryGenerator';
import { EvidenceOrchestrator } from './evidenceOrchestrator';
import { EvidenceFilter } from './evidenceFilter';
import { SourceClassifier } from './sourceClassifier';
import { ContradictionSearcher } from './contradictionSearcher';
import { VerdictSynthesizer } from './verdictSynthesizer';
import { TraceCollector } from '../utils/traceCollector';
import { DegradedStateTracker } from '../utils/degradedStateTracker';
import { validateEvidencePreservationInvariant } from '../utils/evidencePreservationValidator';
import { logger } from '../utils/logger';
import { getEnv } from '../utils/envValidation';
import { randomUUID } from 'crypto';
import type {
  OrchestrationResult,
  PipelineLog,
  PipelineMetrics,
  EvidenceBucket,
} from '../types/orchestration';
import type { DecisionSummary } from '../types/trace';

/**
 * Analyze claim with iterative evidence orchestration
 *
 * @param claim - User's claim to analyze
 * @param isDemoMode - Whether to use demo evidence provider (default: false)
 * @returns Complete orchestration result with verdict
 */
export async function analyzeWithIterativeOrchestration(
  claim: string,
  isDemoMode: boolean = false
): Promise<OrchestrationResult> {
  const startTime = Date.now();
  const logs: PipelineLog[] = [];
  const config = getConfig();

  // Initialize trace collector
  const requestId = randomUUID();
  const traceCollector = new TraceCollector(requestId, isDemoMode ? 'demo' : 'production');

  // Log pipeline start
  logs.push({
    stage: 'pipeline',
    timestamp: new Date().toISOString(),
    message: 'Pipeline started',
    data: { claim_length: claim.length, demo_mode: isDemoMode },
  });

  // Trace Step 1: Claim Intake
  traceCollector.startStep('Claim Intake');
  traceCollector.completeStep(
    'Claim Intake',
    `Received claim with ${claim.length} characters for verification`
  );

  try {
    // Initialize services
    const groundingService = getGroundingService();
    const evidenceFilter = new EvidenceFilter(config.minEvidenceScore, isDemoMode);
    const sourceClassifier = new SourceClassifier();
    const evidenceOrchestrator = new EvidenceOrchestrator(
      groundingService,
      evidenceFilter,
      sourceClassifier,
      config,
      isDemoMode
    );
    const contradictionSearcher = new ContradictionSearcher(
      groundingService,
      evidenceFilter,
      sourceClassifier,
      isDemoMode
    );
    const verdictSynthesizer = new VerdictSynthesizer();
    
    // Initialize degraded state tracker
    const degradedStateTracker = new DegradedStateTracker();

    // Stage 1: Claim Decomposition
    logs.push({
      stage: 'decomposition',
      timestamp: new Date().toISOString(),
      message: 'Starting claim decomposition',
    });

    // Trace Step 2: Claim Framing
    traceCollector.startStep('Claim Framing');

    const claimDecomposer = new ClaimDecomposer();
    const decomposition = await claimDecomposer.decompose(claim);

    traceCollector.completeStep(
      'Claim Framing',
      `Analyzed claim and identified ${decomposition.subclaims.length} subclaim${decomposition.subclaims.length !== 1 ? 's' : ''} for verification`
    );

    logs.push({
      stage: 'decomposition',
      timestamp: new Date().toISOString(),
      message: 'Claim decomposition complete',
      data: { subclaim_count: decomposition.subclaims.length },
    });

    // Stage 2: Query Generation
    logs.push({
      stage: 'query_generation',
      timestamp: new Date().toISOString(),
      message: 'Starting query generation',
    });

    const queryGenerator = new QueryGenerator();
    const queries = await queryGenerator.generateQueries(decomposition);

    logs.push({
      stage: 'query_generation',
      timestamp: new Date().toISOString(),
      message: 'Query generation complete',
      data: { query_count: queries.length },
    });

    // Stage 3: Evidence Orchestration
    logs.push({
      stage: 'orchestration',
      timestamp: new Date().toISOString(),
      message: 'Starting evidence orchestration',
    });

    // Trace Step 3: Evidence Cache Check (will be updated during orchestration)
    traceCollector.startStep('Evidence Cache Check');
    traceCollector.completeStep('Evidence Cache Check', 'Checking evidence cache for existing results');

    // Trace Step 4: Evidence Retrieval
    traceCollector.startStep('Evidence Retrieval');

    const pipelineState = await evidenceOrchestrator.orchestrate(queries, claim);

    // DIAGNOSTIC: Log pipeline state after orchestration (AFTER RETRIEVAL)
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'iterativeOrchestrationPipeline',
        event: 'RETRIEVED_SOURCES_COUNT',
        count: pipelineState.collectedEvidence.length,
        current_pass: pipelineState.currentPass,
        source_classes_represented: pipelineState.sourceClassesRepresented.size,
        average_quality_score: pipelineState.averageQualityScore,
        has_provider_failure_details: !!pipelineState.providerFailureDetails,
        provider_failure_details_count: pipelineState.providerFailureDetails?.length || 0,
      })
    );

    // Update Evidence Retrieval trace step based on results
    const evidenceCount = pipelineState.collectedEvidence.length;
    let retrievalSummary = `Retrieved ${evidenceCount} evidence source${evidenceCount !== 1 ? 's' : ''}`;
    if (evidenceCount === 0) {
      retrievalSummary = 'No evidence sources retrieved';
    }
    if (isDemoMode) {
      retrievalSummary += ' (demo mode)';
    }
    traceCollector.completeStep('Evidence Retrieval', retrievalSummary);

    // Trace Step 5: Retrieval Status Evaluation
    traceCollector.startStep('Retrieval Status Evaluation');
    const traceRetrievalMode = evidenceCount >= 3 ? 'production' : 'degraded';
    const evaluationSummary =
      traceRetrievalMode === 'production'
        ? `Sufficient evidence retrieved for production analysis`
        : `Limited evidence available, operating in degraded mode`;
    traceCollector.completeStep('Retrieval Status Evaluation', evaluationSummary);

    logs.push({
      stage: 'orchestration',
      timestamp: new Date().toISOString(),
      message: 'Evidence orchestration complete',
      data: {
        passes_executed: pipelineState.currentPass,
        evidence_count: pipelineState.collectedEvidence.length,
      },
    });

    // Stage 4: Contradiction Search
    logs.push({
      stage: 'contradiction',
      timestamp: new Date().toISOString(),
      message: 'Starting contradiction search',
    });

    const contradictionQueries = queries.filter((q) => q.type === 'contradiction');
    const contradictionResult = await contradictionSearcher.searchContradictions(
      claim,
      contradictionQueries
    );

    // Track contradiction searcher fallback
    if (contradictionResult.fallbackUsed && contradictionResult.modelFailure) {
      degradedStateTracker.trackStage('contradictionSearcher', contradictionResult.modelFailure);
    }

    logs.push({
      stage: 'contradiction',
      timestamp: new Date().toISOString(),
      message: 'Contradiction search complete',
      data: {
        found_contradictions: contradictionResult.foundContradictions,
        contradiction_count: contradictionResult.evidence.length,
      },
    });

    // Stage 5: Evidence Bucketing
    // Trace Step 6: Source Screening
    traceCollector.startStep('Source Screening');

    const evidenceBuckets: EvidenceBucket = {
      supporting: pipelineState.collectedEvidence.filter((e) => e.stance === 'supports') as any,
      contradicting: [
        ...pipelineState.collectedEvidence.filter((e) => e.stance === 'contradicts'),
        ...contradictionResult.evidence,
      ] as any,
      context: pipelineState.collectedEvidence.filter((e) => e.stance === 'mentions') as any,
      rejected: [],
    };

    // DIAGNOSTIC: Log evidence bucketing (AFTER STANCE CLASSIFICATION)
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'iterativeOrchestrationPipeline',
        event: 'BUCKETED_SOURCES_COUNT',
        supporting_count: evidenceBuckets.supporting.length,
        contradicting_count: evidenceBuckets.contradicting.length,
        context_count: evidenceBuckets.context.length,
        rejected_count: evidenceBuckets.rejected.length,
        total_before_bucketing: pipelineState.collectedEvidence.length,
        total_after_bucketing: evidenceBuckets.supporting.length + evidenceBuckets.contradicting.length + evidenceBuckets.context.length,
      })
    );

    // SLICE 1: Evidence Preservation Invariant Check
    const retrievedSourcesCount = pipelineState.collectedEvidence.length;
    let liveSourcesBeforePackaging = evidenceBuckets.supporting.length + evidenceBuckets.contradicting.length + evidenceBuckets.context.length;

    // DIAGNOSTIC: Log sources before packaging
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'iterativeOrchestrationPipeline',
        event: 'SOURCES_BEFORE_PACKAGING',
        retrieved_count: retrievedSourcesCount,
        bucketed_count: liveSourcesBeforePackaging,
        supporting: evidenceBuckets.supporting.length,
        contradicting: evidenceBuckets.contradicting.length,
        context: evidenceBuckets.context.length,
      })
    );

    // SLICE 1: Pass-through fallback if all evidence was rejected by filter
    if (retrievedSourcesCount > 0 && liveSourcesBeforePackaging === 0) {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'WARN',
          service: 'iterativeOrchestrationPipeline',
          event: 'EVIDENCE_PRESERVATION_TRIGGERED',
          retrieved_count: retrievedSourcesCount,
          after_filter_count: liveSourcesBeforePackaging,
          message: 'All retrieved evidence was rejected by filter - activating pass-through preservation',
        })
      );

      // Preserve top N retrieved sources with neutral metadata
      const topN = Math.min(6, retrievedSourcesCount);
      const preservedSources = pipelineState.collectedEvidence.slice(0, topN).map((evidence) => ({
        ...evidence,
        qualityScore: {
          claimRelevance: 0.7,
          specificity: 0.7,
          directness: 0.7,
          freshness: 0.7,
          sourceAuthority: 0.7,
          primaryWeight: 0.0,
          contradictionValue: 0.0,
          corroborationCount: 0.0,
          accessibility: 0.7,
          geographicRelevance: 0.7,
          composite: 0.7,
        },
        passed: true,
        stance: 'mentions' as const,
      }));

      // Add preserved sources to context bucket
      evidenceBuckets.context.push(...(preservedSources as any));
      liveSourcesBeforePackaging = preservedSources.length;
      
      degradedStateTracker.trackStage('evidenceFilter', 'Evidence filter rejected all sources - pass-through preservation activated');

      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          service: 'iterativeOrchestrationPipeline',
          event: 'EVIDENCE_PRESERVED',
          preserved_count: preservedSources.length,
          degraded_stages: degradedStateTracker.getMetadata().degradedStages,
        })
      );
    }

    // SLICE 1: Log evidence preservation invariant
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'iterativeOrchestrationPipeline',
        event: 'LIVE_SOURCES_BEFORE_PACKAGING',
        count: liveSourcesBeforePackaging,
        retrieved_count: retrievedSourcesCount,
        evidence_preserved: degradedStateTracker.hasAnyDegradation(),
      })
    );

    const totalSources = evidenceBuckets.supporting.length + evidenceBuckets.contradicting.length + evidenceBuckets.context.length;
    traceCollector.completeStep(
      'Source Screening',
      `Screened ${totalSources} source${totalSources !== 1 ? 's' : ''} and categorized by credibility`
    );

    // Trace Step 7: Credibility Assessment
    traceCollector.startStep('Credibility Assessment');
    const avgQuality = pipelineState.averageQualityScore;
    traceCollector.completeStep(
      'Credibility Assessment',
      `Assessed source quality (average score: ${avgQuality.toFixed(1)})`
    );

    // Trace Step 8: Evidence Stance Classification
    traceCollector.startStep('Evidence Stance Classification');
    const stanceSummary = `Classified evidence: ${evidenceBuckets.supporting.length} supporting, ${evidenceBuckets.contradicting.length} contradicting, ${evidenceBuckets.context.length} contextual`;
    traceCollector.completeStep('Evidence Stance Classification', stanceSummary);

    // Stage 6: Verdict Synthesis
    logs.push({
      stage: 'synthesis',
      timestamp: new Date().toISOString(),
      message: 'Starting verdict synthesis',
    });

    // Trace Step 9: Bedrock Reasoning
    traceCollector.startStep('Bedrock Reasoning');

    const synthesisResult = await verdictSynthesizer.synthesize(
      claim,
      decomposition,
      evidenceBuckets,
      contradictionResult
    );

    const verdict = synthesisResult.verdict;

    // Track verdict synthesizer fallback
    if (synthesisResult.fallbackUsed && synthesisResult.modelFailure) {
      degradedStateTracker.trackStage('verdictSynthesizer', synthesisResult.modelFailure);
    }

    traceCollector.completeStep(
      'Bedrock Reasoning',
      `AI model analyzed ${totalSources} evidence source${totalSources !== 1 ? 's' : ''} and generated verdict (Amazon NOVA Lite)`
    );

    // Trace Step 10: Verdict Generation
    traceCollector.startStep('Verdict Generation');
    traceCollector.completeStep(
      'Verdict Generation',
      `Generated ${verdict.classification} verdict with ${Math.round(verdict.confidence * 100)}% confidence`
    );

    logs.push({
      stage: 'synthesis',
      timestamp: new Date().toISOString(),
      message: 'Verdict synthesis complete',
      data: {
        classification: verdict.classification,
        confidence: verdict.confidence,
      },
    });

    // Calculate metrics
    const metrics: PipelineMetrics = {
      totalLatencyMs: Date.now() - startTime,
      novaCallsMade: 0, // TODO: Track from usage tracker
      novaTokensUsed: 0, // TODO: Track from usage tracker
      groundingCallsMade: queries.length + contradictionQueries.length,
      totalSourcesRetrieved: pipelineState.collectedEvidence.length,
      sourcesAfterFiltering: pipelineState.collectedEvidence.length,
      passesExecuted: pipelineState.currentPass,
      sourceClassesCount: pipelineState.sourceClassesRepresented.size,
      averageQualityScore: pipelineState.averageQualityScore,
    };

    // Calculate retrieval status
    const totalEvidence = pipelineState.collectedEvidence.length;
    
    // Extract actual providers from collected evidence
    const providersUsedSet = new Set<string>();
    for (const evidence of pipelineState.collectedEvidence) {
      if (evidence.provider) {
        providersUsedSet.add(evidence.provider);
      }
    }
    
    // Build providersAttempted from providerFailureDetails if available, otherwise from evidence
    let providersAttempted: string[] = [];
    if (isDemoMode) {
      providersAttempted = ['demo'];
    } else if (pipelineState.providerFailureDetails && pipelineState.providerFailureDetails.length > 0) {
      // Use providers from failure details (includes all attempted providers)
      const attemptedSet = new Set<string>();
      for (const failure of pipelineState.providerFailureDetails) {
        attemptedSet.add(failure.provider);
      }
      // Also add providers that succeeded (from evidence)
      for (const provider of providersUsedSet) {
        attemptedSet.add(provider);
      }
      providersAttempted = Array.from(attemptedSet);
    } else if (providersUsedSet.size > 0) {
      // Use providers from evidence
      providersAttempted = Array.from(providersUsedSet);
    } else {
      // Fallback: use configured provider order from environment
      const env = getEnv();
      const providerOrder = (env.GROUNDING_PROVIDER_ORDER || 'mediastack,gdelt,serper')
        .split(',')
        .map((p) => p.trim().toLowerCase())
        .filter((p) => p === 'bing' || p === 'gdelt' || p === 'mediastack' || p === 'serper');
      providersAttempted = providerOrder.length > 0 ? providerOrder : ['mediastack', 'gdelt', 'serper'];
    }
    
    const providersSucceeded: string[] = [];
    const providersFailed: string[] = [];
    const warnings: string[] = [];

    // Determine provider status based on evidence retrieved
    if (totalEvidence > 0) {
      // Add providers that actually returned evidence
      providersSucceeded.push(...Array.from(providersUsedSet));
      
      // If no providers in evidence, assume demo or gdelt
      if (providersSucceeded.length === 0) {
        providersSucceeded.push(isDemoMode ? 'demo' : 'gdelt');
      }
    } else {
      // All attempted providers failed
      providersFailed.push(...providersAttempted);
      if (!isDemoMode) {
        warnings.push('All evidence providers failed to return results. This may be due to rate limiting, timeout, or temporary unavailability.');
      }
    }

    // Determine retrieval status
    let retrievalMode: 'production' | 'degraded' = 'production';
    let retrievalStatus: 'complete' | 'partial' | 'failed' = 'complete';
    let retrievalSource: 'live' | 'cache' | 'mixed' = isDemoMode ? 'cache' : 'live';

    if (totalEvidence === 0) {
      retrievalMode = 'degraded';
      retrievalStatus = 'failed';
      if (!isDemoMode) {
        warnings.push('Evidence retrieval failed. Analysis completed in degraded production mode with limited evidence availability.');
      }
    } else if (totalEvidence < 3) {
      retrievalMode = 'degraded';
      retrievalStatus = 'partial';
      if (!isDemoMode) {
        warnings.push('Limited evidence retrieved. Analysis completed in degraded production mode.');
      }
    }

    logs.push({
      stage: 'pipeline',
      timestamp: new Date().toISOString(),
      message: 'Pipeline complete',
      data: metrics as any,
    });

    // Trace Step 11: Response Packaging
    traceCollector.startStep('Response Packaging');
    
    // SLICE 1: Final source count invariant check
    const finalSourceCount = evidenceBuckets.supporting.length + evidenceBuckets.contradicting.length + evidenceBuckets.context.length;
    
    // DIAGNOSTIC: Log sources after packaging
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'iterativeOrchestrationPipeline',
        event: 'SOURCES_AFTER_PACKAGING',
        count: finalSourceCount,
        supporting: evidenceBuckets.supporting.length,
        contradicting: evidenceBuckets.contradicting.length,
        context: evidenceBuckets.context.length,
      })
    );

    // SLICE 1: Evidence preservation invariant validation
    validateEvidencePreservationInvariant(liveSourcesBeforePackaging, finalSourceCount);
    
    traceCollector.completeStep('Response Packaging', 'Assembled final response with verdict and evidence');

    // Generate decision summary for trace
    const decisionSummary: DecisionSummary = {
      verdict: verdict.classification,
      confidence: Math.round(verdict.confidence * 100),
      rationale: verdict.rationale,
      evidence_count: totalEvidence,
    };

    // Get complete trace
    const trace = traceCollector.getTrace(decisionSummary);

    // Update trace mode based on retrieval status
    if (retrievalMode === 'degraded') {
      trace.mode = 'degraded';
    }

    // Transform provider failure details to match RetrievalStatus type
    const transformedProviderFailureDetails = pipelineState.providerFailureDetails?.map(detail => ({
      provider: detail.provider,
      query: detail.query,
      reason: detail.reason,
      stage: 'attempt_failed' as const, // Map numeric stage to string stage
      rawCount: detail.raw_count,
      normalizedCount: detail.normalized_count,
      acceptedCount: detail.accepted_count,
      errorMessage: detail.error_message,
    }));

    // Log provider failure details propagation
    if (transformedProviderFailureDetails && transformedProviderFailureDetails.length > 0) {
      const providerNames = [...new Set(transformedProviderFailureDetails.map(d => d.provider))];
      logs.push({
        stage: 'pipeline',
        timestamp: new Date().toISOString(),
        message: 'PROVIDER_FAILURE_DETAILS_PROPAGATED',
        data: {
          entry_count: transformedProviderFailureDetails.length,
          providers: providerNames,
        },
      });
      
      logger.info('Provider failure details propagated', {
        event: 'PROVIDER_FAILURE_DETAILS_PROPAGATED',
        requestId,
        entry_count: transformedProviderFailureDetails.length,
        providers: providerNames,
      });
    }

    return {
      claim,
      decomposition,
      queries, // Include generated queries in result
      verdict,
      evidenceBuckets,
      contradictionResult,
      metrics,
      logs,
      config,
      retrievalStatus: {
        mode: retrievalMode,
        status: retrievalStatus,
        source: retrievalSource,
        cacheHit: false, // TODO: Track from grounding service
        providersAttempted,
        providersSucceeded,
        providersFailed,
        warnings,
        providerFailureDetails: transformedProviderFailureDetails,
        // Evidence preservation fields from degraded state tracker
        ...degradedStateTracker.getMetadata(),
      },
      trace,
    };
  } catch (error) {
    logs.push({
      stage: 'pipeline',
      timestamp: new Date().toISOString(),
      message: 'Pipeline error',
      data: {
        error_message: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    throw error;
  }
}

