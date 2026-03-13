/**
 * Lambda Handler Tests
 *
 * Tests for AWS Lambda handler including demo mode defaulting behavior
 */

import { handler } from './lambda';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { randomUUID } from 'crypto';

// Generate a valid UUID for mocking
const mockUUID = randomUUID();

// Mock demoMode utilities - use real getDemoResponseForContent since it includes trace
jest.mock('./utils/demoMode', () => {
  const actual = jest.requireActual('./utils/demoMode');
  return {
    ...actual,
    isDemoMode: jest.fn(() => false), // Default to false for testing
    demoDelay: jest.fn(() => Promise.resolve()),
  };
});

// Mock groundingService to prevent real network calls
jest.mock('./services/groundingService', () => ({
  getGroundingService: jest.fn(),
  groundTextOnly: jest.fn(() =>
    Promise.resolve({
      sources: [],
      queries: 0,
      providerUsed: ['mock'],
      sourcesCount: 0,
      cacheHit: false,
      latencyMs: 0,
    })
  ),
}));

// Mock orchestration pipeline to prevent real NOVA calls
jest.mock('./orchestration/iterativeOrchestrationPipeline', () => ({
  analyzeWithIterativeOrchestration: jest.fn(() =>
    Promise.resolve({
      claim: 'test',
      decomposition: {
        originalClaim: 'test',
        subclaims: [],
        timestamp: '2024-01-01T00:00:00Z',
      },
      verdict: {
        classification: 'unverified',
        confidence: 0.3,
        supportedSubclaims: [],
        unsupportedSubclaims: [],
        contradictorySummary: '',
        unresolvedUncertainties: [],
        bestEvidence: [],
        rationale: 'Mock verdict',
      },
      evidenceBuckets: {
        supporting: [],
        contradicting: [],
        context: [],
        rejected: [],
      },
      contradictionResult: {
        evidence: [],
        queries: [],
        foundContradictions: false,
      },
      metrics: {
        totalLatencyMs: 0,
        novaCallsMade: 0,
        novaTokensUsed: 0,
        groundingCallsMade: 0,
        totalSourcesRetrieved: 0,
        sourcesAfterFiltering: 0,
        passesExecuted: 0,
        sourceClassesCount: 0,
        averageQualityScore: 0,
      },
      logs: [],
      config: {} as any,
    })
  ),
}));

/**
 * Create mock API Gateway event
 */
function createMockEvent(path: string, method: string, body?: any): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
      requestId: 'test-request-id',
      routeKey: `${method} ${path}`,
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000,
    },
    body: body ? JSON.stringify(body) : undefined,
    isBase64Encoded: false,
  };
}

describe('Lambda Handler', () => {
  describe('Health Endpoint', () => {
    it('should return 200 for GET /health', async () => {
      const event = createMockEvent('/health', 'GET');
      const response = await handler(event);

      // Type guard: ensure response is an object
      if (typeof response === 'string') {
        throw new Error('Expected object response, got string');
      }

      expect(response.statusCode).toBe(200);
      expect(response.headers?.['Content-Type']).toBe('application/json');

      const body = JSON.parse(response.body || '{}');
      expect(body.status).toBe('ok');
      expect(body).toHaveProperty('timestamp');
    });
  });

  describe('CORS Handling', () => {
    it('should return 204 for OPTIONS request', async () => {
      const event = createMockEvent('/analyze', 'OPTIONS');
      const response = await handler(event);

      // Type guard: ensure response is an object
      if (typeof response === 'string') {
        throw new Error('Expected object response, got string');
      }

      expect(response.statusCode).toBe(204);
      expect(response.headers?.['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers?.['Access-Control-Allow-Methods']).toContain('POST');
    });
  });

  describe('Analyze Endpoint - Demo Mode Defaulting', () => {
    // UUID regex pattern for validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    it('should use demo mode when demo_mode is omitted', async () => {
      const event = createMockEvent('/analyze', 'POST', {
        text: 'Test content',
      });

      const response = await handler(event);

      // Type guard: ensure response is an object
      if (typeof response === 'string') {
        throw new Error('Expected object response, got string');
      }

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body || '{}');
      expect(body.request_id).toBeDefined();
      expect(typeof body.request_id).toBe('string');
      expect(body.request_id).toMatch(uuidRegex);
      expect(body.status_label).toBe('Unverified');
      expect(body).not.toHaveProperty('error');
    });

    it('should use demo mode when demo_mode is false', async () => {
      const event = createMockEvent('/analyze', 'POST', {
        text: 'Test content',
        demo_mode: false,
      });

      const response = await handler(event);

      // Type guard: ensure response is an object
      if (typeof response === 'string') {
        throw new Error('Expected object response, got string');
      }

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body || '{}');
      expect(body.request_id).toBeDefined();
      expect(typeof body.request_id).toBe('string');
      expect(body.request_id).toMatch(uuidRegex);
      expect(body.status_label).toBe('Unverified');
      expect(body).not.toHaveProperty('error');
    });

    it('should use demo mode when demo_mode is true', async () => {
      const event = createMockEvent('/analyze', 'POST', {
        text: 'Test content',
        demo_mode: true,
      });

      const response = await handler(event);

      // Type guard: ensure response is an object
      if (typeof response === 'string') {
        throw new Error('Expected object response, got string');
      }

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body || '{}');
      expect(body.request_id).toBeDefined();
      expect(typeof body.request_id).toBe('string');
      expect(body.request_id).toMatch(uuidRegex);
      expect(body.status_label).toBe('Unverified');
      expect(body).not.toHaveProperty('error');
    });

    it('should never return 501 for production mode', async () => {
      const event = createMockEvent('/analyze', 'POST', {
        text: 'Test content',
        demo_mode: false,
      });

      const response = await handler(event);

      // Type guard: ensure response is an object
      if (typeof response === 'string') {
        throw new Error('Expected object response, got string');
      }

      expect(response.statusCode).not.toBe(501);
      expect(response.statusCode).toBe(200);
    });

    it('should return valid UUID in request_id for all demo modes', async () => {
      const testCases = [
        { demo_mode: true },
        { demo_mode: false },
        {}, // omitted
      ];

      for (const testCase of testCases) {
        const event = createMockEvent('/analyze', 'POST', {
          text: 'Test content',
          ...testCase,
        });

        const response = await handler(event);

        // Type guard: ensure response is an object
        if (typeof response === 'string') {
          throw new Error('Expected object response, got string');
        }

        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body || '{}');
        expect(body.request_id).toBeDefined();
        expect(typeof body.request_id).toBe('string');
        expect(body.request_id).toMatch(uuidRegex);
      }
    });

    it('should include trace in demo mode responses', async () => {
      // Only test demo_mode=true since that's when demo mode is actually used
      const event = createMockEvent('/analyze', 'POST', {
        text: 'Test content',
        demo_mode: true,
      });

      const response = await handler(event);

      // Type guard: ensure response is an object
      if (typeof response === 'string') {
        throw new Error('Expected object response, got string');
      }

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body || '{}');
      
      // Verify trace is present
      expect(body.trace).toBeDefined();
      expect(typeof body.trace).toBe('object');
      
      // Verify trace structure
      expect(body.trace.request_id).toBeDefined();
      expect(body.trace.mode).toBe('demo');
      expect(body.trace.steps).toBeDefined();
      expect(Array.isArray(body.trace.steps)).toBe(true);
      expect(body.trace.steps.length).toBe(11); // All 11 pipeline stages
      expect(body.trace.decision_summary).toBeDefined();
      expect(body.trace.total_duration_ms).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    it('should return 400 when text is missing', async () => {
      const event = createMockEvent('/analyze', 'POST', {});

      const response = await handler(event);

      // Type guard: ensure response is an object
      if (typeof response === 'string') {
        throw new Error('Expected object response, got string');
      }

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body || '{}');
      expect(body.error).toContain('Text field is required');
    });

    it('should return 400 when text is empty string', async () => {
      const event = createMockEvent('/analyze', 'POST', {
        text: '',
      });

      const response = await handler(event);

      // Type guard: ensure response is an object
      if (typeof response === 'string') {
        throw new Error('Expected object response, got string');
      }

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body || '{}');
      expect(body.error).toContain('Text field is required');
    });

    it('should return 400 when text is whitespace only', async () => {
      const event = createMockEvent('/analyze', 'POST', {
        text: '   ',
      });

      const response = await handler(event);

      // Type guard: ensure response is an object
      if (typeof response === 'string') {
        throw new Error('Expected object response, got string');
      }

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body || '{}');
      expect(body.error).toContain('Text field is required');
    });

    it('should return 400 for invalid JSON', async () => {
      const event = createMockEvent('/analyze', 'POST');
      event.body = 'invalid json{';

      const response = await handler(event);

      // Type guard: ensure response is an object
      if (typeof response === 'string') {
        throw new Error('Expected object response, got string');
      }

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body || '{}');
      expect(body.error).toContain('Invalid JSON');
    });
  });

  describe('404 Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const event = createMockEvent('/unknown', 'GET');

      const response = await handler(event);

      // Type guard: ensure response is an object
      if (typeof response === 'string') {
        throw new Error('Expected object response, got string');
      }

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body || '{}');
      expect(body.error).toBe('Not found');
    });
  });
});

describe('Integration Tests - Provider Failure Propagation', () => {
  // Mock environment to enable orchestration
  beforeAll(() => {
    process.env.ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED = 'true';
  });

  afterAll(() => {
    delete process.env.ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED;
  });

  describe('Lambda Response Construction with Provider Failures', () => {
    /**
     * **Validates: Requirements 2.3, 2.4**
     * 
     * Integration test verifying that provider failure details are correctly
     * propagated from orchestration result to both retrieval_status and _debug_fix_v4
     * fields in the lambda response.
     */
    it('should populate both retrieval_status.providerFailureDetails and _debug_fix_v4.provider_failure_details when providers fail', async () => {
      // Mock orchestration result with provider failure details
      const mockOrchestrationResult = {
        claim: 'Test claim with provider failures',
        decomposition: {
          originalClaim: 'Test claim with provider failures',
          subclaims: [
            { type: 'actor', text: 'Test actor', importance: 0.8 },
          ],
          timestamp: '2024-01-01T00:00:00Z',
        },
        queries: [
          { type: 'exact', text: 'Test query 1', priority: 1.0 },
          { type: 'entity_action', text: 'Test query 2', priority: 0.9 },
        ],
        verdict: {
          classification: 'unverified',
          confidence: 0.3,
          supportedSubclaims: [],
          unsupportedSubclaims: [],
          contradictorySummary: '',
          unresolvedUncertainties: [],
          bestEvidence: [],
          rationale: 'Insufficient evidence due to provider failures',
        },
        evidenceBuckets: {
          supporting: [],
          contradicting: [],
          context: [],
          rejected: [],
        },
        contradictionResult: {
          evidence: [],
          queries: [],
          foundContradictions: false,
        },
        metrics: {
          totalLatencyMs: 1500,
          novaCallsMade: 2,
          novaTokensUsed: 500,
          groundingCallsMade: 2,
          totalSourcesRetrieved: 0,
          sourcesAfterFiltering: 0,
          passesExecuted: 1,
          sourceClassesCount: 0,
          averageQualityScore: 0,
        },
        logs: [],
        config: {} as any,
        retrievalStatus: {
          mode: 'degraded' as const,
          status: 'partial' as const,
          source: 'live' as const,
          cacheHit: false,
          providersAttempted: ['mediastack', 'gdelt'],
          providersSucceeded: [],
          providersFailed: ['mediastack', 'gdelt'],
          warnings: ['Limited evidence retrieved'],
          providerFailureDetails: [
            {
              provider: 'mediastack',
              query: 'Test query 1',
              reason: 'quota_exceeded',
              stage: 'attempt_failed' as const,
              rawCount: 0,
              normalizedCount: 0,
              acceptedCount: 0,
              errorMessage: 'API quota exceeded for current billing period',
            },
            {
              provider: 'gdelt',
              query: 'Test query 2',
              reason: 'rate_limit',
              stage: 'attempt_failed' as const,
              rawCount: 0,
              normalizedCount: 0,
              acceptedCount: 0,
              errorMessage: 'Rate limit exceeded, please try again later',
            },
          ],
        },
      };

      // Mock the orchestration pipeline
      const { analyzeWithIterativeOrchestration } = require('./orchestration/iterativeOrchestrationPipeline');
      analyzeWithIterativeOrchestration.mockResolvedValueOnce(mockOrchestrationResult);

      // Create request event
      const event = createMockEvent('/analyze', 'POST', {
        text: 'Test claim with provider failures',
        demo_mode: false,
      });

      // Execute handler
      const response = await handler(event);

      // Type guard
      if (typeof response === 'string') {
        throw new Error('Expected object response, got string');
      }

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body || '{}');

      // Verify retrieval_status.providerFailureDetails is populated
      expect(body.retrieval_status).toBeDefined();
      expect(body.retrieval_status.providerFailureDetails).toBeDefined();
      expect(Array.isArray(body.retrieval_status.providerFailureDetails)).toBe(true);
      expect(body.retrieval_status.providerFailureDetails.length).toBe(2);

      // Verify first failure detail (mediastack)
      const mediastackFailure = body.retrieval_status.providerFailureDetails[0];
      expect(mediastackFailure.provider).toBe('mediastack');
      expect(mediastackFailure.query).toBe('Test query 1');
      expect(mediastackFailure.reason).toBe('quota_exceeded');
      expect(mediastackFailure.stage).toBe('attempt_failed');
      expect(mediastackFailure.rawCount).toBe(0);
      expect(mediastackFailure.normalizedCount).toBe(0);
      expect(mediastackFailure.acceptedCount).toBe(0);
      expect(mediastackFailure.errorMessage).toBe('API quota exceeded for current billing period');

      // Verify second failure detail (gdelt)
      const gdeltFailure = body.retrieval_status.providerFailureDetails[1];
      expect(gdeltFailure.provider).toBe('gdelt');
      expect(gdeltFailure.query).toBe('Test query 2');
      expect(gdeltFailure.reason).toBe('rate_limit');
      expect(gdeltFailure.stage).toBe('attempt_failed');
      expect(gdeltFailure.errorMessage).toBe('Rate limit exceeded, please try again later');

      // Verify _debug_fix_v4.provider_failure_details is populated
      expect(body._debug_fix_v4).toBeDefined();
      expect(body._debug_fix_v4.provider_failure_details).toBeDefined();
      expect(Array.isArray(body._debug_fix_v4.provider_failure_details)).toBe(true);
      expect(body._debug_fix_v4.provider_failure_details.length).toBe(2);

      // Verify _debug_fix_v4 contains same failure details
      expect(body._debug_fix_v4.provider_failure_details[0].provider).toBe('mediastack');
      expect(body._debug_fix_v4.provider_failure_details[1].provider).toBe('gdelt');

      // Verify retrieval status fields
      expect(body.retrieval_status.mode).toBe('degraded');
      expect(body.retrieval_status.status).toBe('partial');
      expect(body.retrieval_status.providersAttempted).toEqual(['mediastack', 'gdelt']);
      expect(body.retrieval_status.providersSucceeded).toEqual([]);
      expect(body.retrieval_status.providersFailed).toEqual(['mediastack', 'gdelt']);
    });

    /**
     * **Validates: Requirements 2.3, 2.4**
     * 
     * Verify that when providers succeed, providerFailureDetails is empty
     */
    it('should have empty providerFailureDetails when providers succeed', async () => {
      // Mock orchestration result with successful retrieval
      const mockOrchestrationResult = {
        claim: 'Test claim with successful retrieval',
        decomposition: {
          originalClaim: 'Test claim with successful retrieval',
          subclaims: [
            { type: 'actor', text: 'Test actor', importance: 0.8 },
          ],
          timestamp: '2024-01-01T00:00:00Z',
        },
        queries: [
          { type: 'exact', text: 'Test query 1', priority: 1.0 },
        ],
        verdict: {
          classification: 'true',
          confidence: 0.8,
          supportedSubclaims: ['Test actor'],
          unsupportedSubclaims: [],
          contradictorySummary: '',
          unresolvedUncertainties: [],
          bestEvidence: [],
          rationale: 'Strong supporting evidence found',
        },
        evidenceBuckets: {
          supporting: [
            {
              url: 'https://example.com/article',
              title: 'Test Article',
              snippet: 'Test snippet',
              publishDate: '2024-01-01',
              domain: 'example.com',
              score: 0.9,
            },
          ],
          contradicting: [],
          context: [],
          rejected: [],
        },
        contradictionResult: {
          evidence: [],
          queries: [],
          foundContradictions: false,
        },
        metrics: {
          totalLatencyMs: 1000,
          novaCallsMade: 2,
          novaTokensUsed: 500,
          groundingCallsMade: 1,
          totalSourcesRetrieved: 5,
          sourcesAfterFiltering: 5,
          passesExecuted: 1,
          sourceClassesCount: 2,
          averageQualityScore: 0.8,
        },
        logs: [],
        config: {} as any,
        retrievalStatus: {
          mode: 'production' as const,
          status: 'complete' as const,
          source: 'live' as const,
          cacheHit: false,
          providersAttempted: ['mediastack'],
          providersSucceeded: ['mediastack'],
          providersFailed: [],
          warnings: [],
          providerFailureDetails: [],
        },
      };

      // Mock the orchestration pipeline
      const { analyzeWithIterativeOrchestration } = require('./orchestration/iterativeOrchestrationPipeline');
      analyzeWithIterativeOrchestration.mockResolvedValueOnce(mockOrchestrationResult);

      // Create request event
      const event = createMockEvent('/analyze', 'POST', {
        text: 'Test claim with successful retrieval',
        demo_mode: false,
      });

      // Execute handler
      const response = await handler(event);

      // Type guard
      if (typeof response === 'string') {
        throw new Error('Expected object response, got string');
      }

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body || '{}');

      // Verify providerFailureDetails is empty
      expect(body.retrieval_status.providerFailureDetails).toEqual([]);
      expect(body._debug_fix_v4.provider_failure_details).toEqual([]);

      // Verify successful retrieval status
      expect(body.retrieval_status.mode).toBe('production');
      expect(body.retrieval_status.status).toBe('complete');
      expect(body.retrieval_status.providersSucceeded).toEqual(['mediastack']);
      expect(body.retrieval_status.providersFailed).toEqual([]);
    });
  });
});
