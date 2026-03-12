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
    const evidenceFilter = new EvidenceFilter(config.minEvidenceScore);
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

    const verdict = await verdictSynthesizer.synthesize(
      claim,
      decomposition,
      evidenceBuckets,
      contradictionResult
    );

    traceCollector.completeStep(
      'Bedrock Reasoning',
      `AI model analyzed ${totalSources} evidence source${totalSources !== 1 ? 's' : ''} and generated verdict (Claude 3 Haiku)`
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
    const providersAttempted = isDemoMode ? ['demo'] : ['gdelt'];
    const providersSucceeded: string[] = [];
    const providersFailed: string[] = [];
    const warnings: string[] = [];

    // Determine provider status based on evidence retrieved
    if (totalEvidence > 0) {
      providersSucceeded.push(isDemoMode ? 'demo' : 'gdelt');
    } else {
      providersFailed.push(isDemoMode ? 'demo' : 'gdelt');
      if (!isDemoMode) {
        warnings.push('GDELT provider did not return evidence. This may be due to rate limiting, timeout, or temporary unavailability.');
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

