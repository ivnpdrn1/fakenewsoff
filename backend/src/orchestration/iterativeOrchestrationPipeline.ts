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
import type {
  OrchestrationResult,
  PipelineLog,
  PipelineMetrics,
  EvidenceBucket,
} from '../types/orchestration';

/**
 * Analyze claim with iterative evidence orchestration
 *
 * @param claim - User's claim to analyze
 * @returns Complete orchestration result with verdict
 */
export async function analyzeWithIterativeOrchestration(
  claim: string
): Promise<OrchestrationResult> {
  const startTime = Date.now();
  const logs: PipelineLog[] = [];
  const config = getConfig();

  // Log pipeline start
  logs.push({
    stage: 'pipeline',
    timestamp: new Date().toISOString(),
    message: 'Pipeline started',
    data: { claim_length: claim.length },
  });

  try {
    // Initialize services
    const groundingService = getGroundingService();
    const evidenceFilter = new EvidenceFilter(config.minEvidenceScore);
    const sourceClassifier = new SourceClassifier();
    const evidenceOrchestrator = new EvidenceOrchestrator(
      groundingService,
      evidenceFilter,
      sourceClassifier,
      config
    );
    const contradictionSearcher = new ContradictionSearcher(
      groundingService,
      evidenceFilter,
      sourceClassifier
    );
    const verdictSynthesizer = new VerdictSynthesizer();

    // Stage 1: Claim Decomposition
    logs.push({
      stage: 'decomposition',
      timestamp: new Date().toISOString(),
      message: 'Starting claim decomposition',
    });

    const claimDecomposer = new ClaimDecomposer();
    const decomposition = await claimDecomposer.decompose(claim);

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

    const pipelineState = await evidenceOrchestrator.orchestrate(queries, claim);

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
    const evidenceBuckets: EvidenceBucket = {
      supporting: pipelineState.collectedEvidence.filter((e) => e.stance === 'supports') as any,
      contradicting: [
        ...pipelineState.collectedEvidence.filter((e) => e.stance === 'contradicts'),
        ...contradictionResult.evidence,
      ] as any,
      context: pipelineState.collectedEvidence.filter((e) => e.stance === 'mentions') as any,
      rejected: [],
    };

    // Stage 6: Verdict Synthesis
    logs.push({
      stage: 'synthesis',
      timestamp: new Date().toISOString(),
      message: 'Starting verdict synthesis',
    });

    const verdict = await verdictSynthesizer.synthesize(
      claim,
      decomposition,
      evidenceBuckets,
      contradictionResult
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
    const providersAttempted = ['gdelt']; // TODO: Track from grounding service
    const providersSucceeded: string[] = [];
    const providersFailed: string[] = [];
    const warnings: string[] = [];

    // Determine provider status based on evidence retrieved
    if (totalEvidence > 0) {
      providersSucceeded.push('gdelt');
    } else {
      providersFailed.push('gdelt');
      warnings.push('GDELT provider did not return evidence. This may be due to rate limiting, timeout, or temporary unavailability.');
    }

    // Determine retrieval status
    let retrievalMode: 'production' | 'degraded' = 'production';
    let retrievalStatus: 'complete' | 'partial' | 'failed' = 'complete';
    let retrievalSource: 'live' | 'cache' | 'mixed' = 'live'; // Default to live

    if (totalEvidence === 0) {
      retrievalMode = 'degraded';
      retrievalStatus = 'failed';
      warnings.push('Evidence retrieval failed. Analysis completed in degraded production mode with limited evidence availability.');
    } else if (totalEvidence < 3) {
      retrievalMode = 'degraded';
      retrievalStatus = 'partial';
      warnings.push('Limited evidence retrieved. Analysis completed in degraded production mode.');
    }

    logs.push({
      stage: 'pipeline',
      timestamp: new Date().toISOString(),
      message: 'Pipeline complete',
      data: metrics as any,
    });

    return {
      claim,
      decomposition,
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
      },
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
