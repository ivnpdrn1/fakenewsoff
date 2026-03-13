/**
 * AWS Lambda handler for FakeNewsOff Backend
 *
 * Wraps the existing HTTP server logic for Lambda/API Gateway
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { isDemoMode, getDemoResponseForContent, demoDelay } from './utils/demoMode';
import { getGroundingService, groundTextOnly } from './services/groundingService';
import { getEnv } from './utils/envValidation';
import { normalizeSourceScores } from './utils/scoreNormalizer';
import { analyzeWithIterativeOrchestration } from './orchestration/iterativeOrchestrationPipeline';

const DEMO_MODE = isDemoMode();

interface AnalyzeRequest {
  text: string;
  url?: string;
  title?: string;
  demo_mode?: boolean;
}

/**
 * Lambda handler
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  // V4 BUILD MARKER - Log at startup to prove V4 is deployed
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    event: 'LAMBDA_HANDLER_STARTUP_V4',
    build_fix_version: 'v6',
    handler_file: 'lambda.ts',
    orchestration_method_used: 'multiQuery',
    ground_method_used: 'groundTextOnly',
    grounding_path: 'multi_query_provider_pipeline',
    fix_description: 'Orchestrator uses groundTextOnly() for multi-query provider pipeline',
  }));

  const path = event.rawPath || event.requestContext.http.path;
  const method = event.requestContext.http.method;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  // Handle OPTIONS (CORS preflight)
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    };
  }

  // Handle /health endpoint
  if (path === '/health' && method === 'GET') {
    // Check if Bedrock is configured
    let bedrockStatus: 'available' | 'not_configured' = 'not_configured';
    try {
      const env = getEnv();
      const hasBedrockRegion = !!env.BEDROCK_REGION;
      const hasModelId = !!env.CLAUDE_MODEL_ID;
      bedrockStatus = (hasBedrockRegion && hasModelId) ? 'available' : 'not_configured';
    } catch {
      bedrockStatus = 'not_configured';
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        status: 'ok',
        demo_mode: DEMO_MODE,
        bedrock_status: bedrockStatus,
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // Handle /health/grounding endpoint
  if (path === '/health/grounding' && method === 'GET') {
    try {
      const groundingService = getGroundingService();
      const healthStatus = groundingService.getHealthStatus();

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(healthStatus),
      };
    } catch (error: any) {
      console.error('Error checking grounding health:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: false,
          error: 'Failed to check grounding health',
        }),
      };
    }
  }

  // Handle /internal/grounding-selftest endpoint (requires token)
  if (path === '/internal/grounding-selftest' && method === 'POST') {
    try {
      const env = getEnv();
      const expectedToken = env.INTERNAL_DIAGNOSTICS_TOKEN;

      // Check if token is configured
      if (!expectedToken) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Diagnostics endpoint not configured' }),
        };
      }

      // Verify token from Authorization header
      const authHeader = event.headers?.authorization || event.headers?.Authorization;
      const providedToken = authHeader?.replace(/^Bearer\s+/i, '');

      if (providedToken !== expectedToken) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Unauthorized' }),
        };
      }

      // Parse optional test query from body
      const body = event.body ? JSON.parse(event.body) : {};
      const testQuery = body.query || 'breaking news';

      // Run self-test
      const groundingService = getGroundingService();
      const results = await groundingService.runSelfTest(testQuery);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(results),
      };
    } catch (error: any) {
      console.error('Error running grounding self-test:', error);

      if (error instanceof SyntaxError) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Invalid JSON in request body' }),
        };
      }

      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Self-test failed',
          message: error.message,
        }),
      };
    }
  }

  // Handle /analyze endpoint
  if (path === '/analyze' && method === 'POST') {
    try {
      // Parse request body
      const body = event.body ? JSON.parse(event.body) : {};
      const request = body as AnalyzeRequest;

      // Validate required fields
      if (!request.text || typeof request.text !== 'string' || request.text.trim() === '') {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Text field is required and must be non-empty' }),
        };
      }

      // Use demo mode from request, or fall back to environment DEMO_MODE
      // Default to production mode (false) unless explicitly requested or environment forces it
      const demoMode = request.demo_mode !== undefined ? request.demo_mode : DEMO_MODE;

      // Detect text-only grounding request (no URL provided)
      const isTextOnly = !request.url || request.url.trim() === '';

      // Log request path selection
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        event: 'analyze_request_received',
        demo_mode: demoMode,
        is_text_only: isTextOnly,
        text_length: request.text.length,
      }));

      if (demoMode) {
        // Demo mode: return deterministic response based on keywords
        await demoDelay(); // Simulate API delay
        const result: any = getDemoResponseForContent(request.text);

        // If text-only, add text grounding sources
        if (isTextOnly) {
          try {
            const textGrounding = await groundTextOnly(request.text, undefined, true);
            // Normalize scores to prevent null validation errors
            if (textGrounding.sources && textGrounding.sources.length > 0) {
              textGrounding.sources = normalizeSourceScores(textGrounding.sources);
            }
            result.text_grounding = textGrounding;
          } catch (error: any) {
            console.error('Error in text grounding (demo mode):', error);
            // Continue without text grounding on error
          }
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result),
        };
      } else {
        // Production mode: check if iterative orchestration is enabled
        const env = getEnv();
        const useIterativeOrchestration = env.ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED;

        // Log path selection
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          event: 'analyze_path_selected',
          path: useIterativeOrchestration && isTextOnly ? 'orchestrated_grounding' : isTextOnly ? 'legacy_text_grounding' : 'url_analysis',
          orchestration_enabled: useIterativeOrchestration,
          is_text_only: isTextOnly,
        }));

        if (useIterativeOrchestration && isTextOnly) {
          // Use new iterative orchestration pipeline
          console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            event: 'grounding_method_selected',
            method: 'iterative_orchestration',
            using_new_orchestrated_grounding: true,
            using_legacy_grounding: false,
          }));

          console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            event: 'LAMBDA_FIX_PATH_ACTIVE_V4',
            handler: 'analyze_orchestration',
            fix_version: 'v6',
            orchestration_method_used: 'multiQuery',
            ground_method_used: 'groundTextOnly',
            grounding_path: 'multi_query_provider_pipeline',
            text_length: request.text.length,
          }));

          try {
            const orchestrationResult = await analyzeWithIterativeOrchestration(request.text, demoMode);

            // DIAGNOSTIC: Log orchestration result structure
            console.log(JSON.stringify({
              timestamp: new Date().toISOString(),
              level: 'INFO',
              event: 'ORCHESTRATION_RESULT_RECEIVED_V4',
              has_queries: !!orchestrationResult.queries,
              queries_count: orchestrationResult.queries?.length || 0,
              queries_preview: orchestrationResult.queries?.slice(0, 3).map(q => q.text.substring(0, 50)) || [],
              subclaim_count: orchestrationResult.decomposition.subclaims.length,
              subclaim_preview: orchestrationResult.decomposition.subclaims.map(sc => sc.text.substring(0, 50)),
              providers_succeeded: orchestrationResult.retrievalStatus.providersSucceeded,
              providers_attempted: orchestrationResult.retrievalStatus.providersAttempted,
              providers_failed: orchestrationResult.retrievalStatus.providersFailed,
              evidence_count: orchestrationResult.evidenceBuckets.supporting.length,
              has_failure_details: !!orchestrationResult.retrievalStatus.providerFailureDetails,
              failure_details_count: orchestrationResult.retrievalStatus.providerFailureDetails?.length || 0,
              fix_version: 'v4',
            }));

            // Convert orchestration result to complete API response format
            const result: any = {
              request_id: randomUUID(),
              status_label: orchestrationResult.verdict.classification,
              confidence_score: Math.round(orchestrationResult.verdict.confidence * 100),
              recommendation: orchestrationResult.verdict.rationale,
              progress_stages: [
                { stage: 'Decomposition', status: 'completed', timestamp: new Date().toISOString() },
                { stage: 'Query Generation', status: 'completed', timestamp: new Date().toISOString() },
                { stage: 'Evidence Orchestration', status: 'completed', timestamp: new Date().toISOString() },
                { stage: 'Verdict Synthesis', status: 'completed', timestamp: new Date().toISOString() },
              ],
              sources: orchestrationResult.evidenceBuckets.supporting.slice(0, 3).map((source: any) => ({
                url: source.url,
                title: source.title,
                snippet: source.snippet,
                why: source.stanceJustification || 'Supporting evidence',
                domain: source.domain,
              })),
              media_risk: null,
              misinformation_type: null,
              sift_guidance: `Based on the analysis: ${orchestrationResult.verdict.rationale}`,
              timestamp: new Date().toISOString(),
              text_grounding: {
                sources: normalizeSourceScores(orchestrationResult.evidenceBuckets.supporting.slice(0, 6)),
                queries: orchestrationResult.queries.map(q => q.text), // Include generated queries
                providerUsed: orchestrationResult.retrievalStatus.providersSucceeded.length > 0 
                  ? orchestrationResult.retrievalStatus.providersSucceeded 
                  : ['orchestrated'],
                sourcesCount: orchestrationResult.evidenceBuckets.supporting.length,
                cacheHit: false,
                latencyMs: orchestrationResult.metrics.totalLatencyMs,
              },
              // DIAGNOSTIC: Temporary debug field
              _debug_fix_v4: {
                fix_version: 'v4',
                queries_from_orchestration: orchestrationResult.queries.map(q => q.text),
                queries_count: orchestrationResult.queries.length,
                subclaim_count: orchestrationResult.decomposition.subclaims.length,
                subclaims_preview: orchestrationResult.decomposition.subclaims.map(sc => sc.text.substring(0, 50)),
                orchestration_method_used: 'multiQuery',
                ground_method_used: 'groundTextOnly',
                grounding_path: 'multi_query_provider_pipeline',
                providers_from_status: orchestrationResult.retrievalStatus.providersSucceeded,
                providers_failed: orchestrationResult.retrievalStatus.providersFailed,
                provider_failure_details: orchestrationResult.retrievalStatus.providerFailureDetails || [],
                fix_active: true,
              },
              // Add retrieval status for production transparency
              retrieval_status: orchestrationResult.retrievalStatus,
              // Add orchestration metadata (optional, for debugging)
              orchestration: {
                enabled: true,
                passes_executed: orchestrationResult.metrics.passesExecuted,
                source_classes: orchestrationResult.metrics.sourceClassesCount,
                average_quality: orchestrationResult.metrics.averageQualityScore,
                contradictions_found: orchestrationResult.contradictionResult.foundContradictions,
              },
              // Add trace for transparency
              trace: orchestrationResult.trace,
            };

            return {
              statusCode: 200,
              headers: corsHeaders,
              body: JSON.stringify(result),
            };
          } catch (error: any) {
            console.error('Error in iterative orchestration:', error);
            
            // Return honest error response instead of demo fallback
            return {
              statusCode: 500,
              headers: corsHeaders,
              body: JSON.stringify({
                error: 'Evidence retrieval failed',
                message: 'Unable to retrieve sufficient evidence to analyze this claim. Please try again later.',
                details: error.message,
              }),
            };
          }
        }

        // Legacy text-only grounding path (when orchestration disabled)
        if (isTextOnly) {
          console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            event: 'grounding_method_selected',
            method: 'legacy_text_grounding',
            using_new_orchestrated_grounding: false,
            using_legacy_grounding: true,
          }));

          try {
            const textGrounding = await groundTextOnly(request.text, undefined, false);
            
            // Check if grounding returned sources
            if (textGrounding.sources.length === 0) {
              // Return honest no-evidence response
              const reasonMessage = textGrounding.reasonCodes?.includes('KEYS_MISSING')
                ? 'Evidence retrieval is not fully configured. Please contact support.'
                : textGrounding.reasonCodes?.includes('ERROR')
                ? 'Evidence retrieval encountered an error. Please try again later.'
                : 'Unable to find sufficient evidence for this claim at this time.';

              return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                  request_id: randomUUID(),
                  status_label: 'Unverified',
                  confidence_score: 0,
                  recommendation: reasonMessage,
                  progress_stages: [
                    { stage: 'Evidence Retrieval', status: 'completed', timestamp: new Date().toISOString() },
                  ],
                  sources: [],
                  media_risk: null,
                  misinformation_type: null,
                  sift_guidance: 'Unable to retrieve evidence. Cannot verify this claim at this time.',
                  timestamp: new Date().toISOString(),
                  text_grounding: textGrounding,
                  reason_codes: textGrounding.reasonCodes || ['PROVIDER_EMPTY'],
                }),
              };
            }

            // Normalize scores to prevent null validation errors
            if (textGrounding.sources && textGrounding.sources.length > 0) {
              textGrounding.sources = normalizeSourceScores(textGrounding.sources);
            }

            // Build response from real grounding data
            const result: any = {
              request_id: randomUUID(),
              status_label: 'Unverified', // TODO: Classify based on stance distribution
              confidence_score: 50, // TODO: Calculate from evidence
              recommendation: 'Analysis based on retrieved evidence. Review sources carefully.',
              progress_stages: [
                { stage: 'Evidence Retrieval', status: 'completed', timestamp: new Date().toISOString() },
                { stage: 'Stance Classification', status: 'completed', timestamp: new Date().toISOString() },
              ],
              sources: textGrounding.sources.slice(0, 3).map((source: any) => ({
                url: source.url,
                title: source.title,
                snippet: source.snippet,
                why: source.stanceJustification || 'Retrieved evidence',
                domain: source.domain,
              })),
              media_risk: null,
              misinformation_type: null,
              sift_guidance: 'Review the evidence sources and verify their credibility.',
              timestamp: new Date().toISOString(),
              text_grounding: textGrounding,
            };

            return {
              statusCode: 200,
              headers: corsHeaders,
              body: JSON.stringify(result),
            };
          } catch (error: any) {
            console.error('Error in text grounding:', error);
            
            // Return honest error response
            return {
              statusCode: 500,
              headers: corsHeaders,
              body: JSON.stringify({
                error: 'Evidence retrieval failed',
                message: 'Unable to retrieve evidence to analyze this claim. Please try again later.',
                details: error.message,
              }),
            };
          }
        }

        // URL analysis path (not yet implemented)
        return {
          statusCode: 501,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'URL analysis not implemented',
            message: 'URL analysis is not yet available. Please submit text claims only.',
          }),
        };
      }
    } catch (error: any) {
      console.error('Error analyzing content:', error);

      if (error instanceof SyntaxError) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Invalid JSON in request body' }),
        };
      }

      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }
  }

  // 404 for other routes
  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' }),
  };
}
