/**
 * Integration tests for Feature Flag Routing
 *
 * Tests ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED flag behavior
 *
 * NOTE: These tests require real API keys and will make actual API calls.
 * Set SKIP_INTEGRATION_TESTS=true to skip these tests in CI/CD.
 */

import { APIGatewayProxyResultV2 } from 'aws-lambda';

// Mock groundingService to prevent real network calls in unit tests
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

// Mock orchestration pipeline to prevent real NOVA calls in unit tests
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
        passesExecuted: 1,
        sourceClassesCount: 0,
        averageQualityScore: 0,
      },
      logs: [],
      config: {} as any,
    })
  ),
}));

describe('Feature Flag Routing Integration Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Feature Flag Disabled (Legacy Pipeline)', () => {
    beforeEach(() => {
      process.env.ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED = 'false';
      process.env.DEMO_MODE = 'false'; // Disable demo mode for testing
    });

    it('should use legacy pipeline when flag is disabled', async () => {
      const { handler } = await import('./lambda');

      const event = {
        rawPath: '/analyze',
        requestContext: {
          http: {
            method: 'POST',
            path: '/analyze',
          },
        },
        body: JSON.stringify({
          text: 'Test claim for legacy pipeline',
        }),
      } as any;

      const response = (await handler(event)) as APIGatewayProxyResultV2 & {
        statusCode: number;
        body: string;
      };

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);

      // Verify legacy response structure
      expect(body).toHaveProperty('status_label');
      expect(body).toHaveProperty('confidence_score');
      expect(body).toHaveProperty('text_grounding');

      // Verify orchestration metadata is NOT present (legacy mode)
      expect(body.orchestration).toBeUndefined();
    });
  });

  describe('Feature Flag Enabled (Orchestration Pipeline)', () => {
    beforeEach(() => {
      process.env.ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED = 'true';
      process.env.DEMO_MODE = 'false';
    });

    it('should use orchestration pipeline when flag is enabled for text-only', async () => {
      const { handler } = await import('./lambda');

      const event = {
        rawPath: '/analyze',
        requestContext: {
          http: {
            method: 'POST',
            path: '/analyze',
          },
        },
        body: JSON.stringify({
          text: 'Test claim for orchestration',
          // No URL = text-only
        }),
      } as any;

      const response = (await handler(event)) as APIGatewayProxyResultV2 & {
        statusCode: number;
        body: string;
      };

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);

      // Verify response has orchestration metadata
      expect(body).toHaveProperty('orchestration');
      expect(body.orchestration).toHaveProperty('enabled', true);
      expect(body.orchestration).toHaveProperty('passes_executed');
      expect(body.orchestration).toHaveProperty('source_classes');
      expect(body.orchestration).toHaveProperty('average_quality');
      expect(body.orchestration).toHaveProperty('contradictions_found');

      // Verify backward compatible fields still present
      expect(body).toHaveProperty('status_label');
      expect(body).toHaveProperty('confidence_score');
      expect(body).toHaveProperty('text_grounding');
      expect(body.text_grounding).toHaveProperty('sources');
      expect(body.text_grounding).toHaveProperty('providerUsed');
    });
  });

  describe('Response Schema Compatibility', () => {
    it('should maintain backward compatible response shape', async () => {
      process.env.ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED = 'true';
      process.env.DEMO_MODE = 'false';

      const { handler } = await import('./lambda');

      const event = {
        rawPath: '/analyze',
        requestContext: {
          http: {
            method: 'POST',
            path: '/analyze',
          },
        },
        body: JSON.stringify({
          text: 'Backward compatibility test',
        }),
      } as any;

      const response = (await handler(event)) as APIGatewayProxyResultV2 & {
        statusCode: number;
        body: string;
      };
      const body = JSON.parse(response.body);

      // Verify all required legacy fields are present
      expect(body).toHaveProperty('status_label');
      expect(body).toHaveProperty('confidence_score');
      expect(body).toHaveProperty('rationale');
      expect(body).toHaveProperty('text_grounding');

      // Verify text_grounding structure
      expect(body.text_grounding).toHaveProperty('sources');
      expect(body.text_grounding).toHaveProperty('queries');
      expect(body.text_grounding).toHaveProperty('providerUsed');
      expect(body.text_grounding).toHaveProperty('sourcesCount');
      expect(body.text_grounding).toHaveProperty('cacheHit');
      expect(body.text_grounding).toHaveProperty('latencyMs');

      // Verify sources array structure
      expect(Array.isArray(body.text_grounding.sources)).toBe(true);

      // Verify orchestration metadata is optional and non-breaking
      if (body.orchestration) {
        expect(typeof body.orchestration.enabled).toBe('boolean');
        expect(typeof body.orchestration.passes_executed).toBe('number');
      }
    });
  });

  describe('Error Handling and Fallback', () => {
    it('should return 400 for invalid request', async () => {
      process.env.ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED = 'true';

      const { handler } = await import('./lambda');

      const event = {
        rawPath: '/analyze',
        requestContext: {
          http: {
            method: 'POST',
            path: '/analyze',
          },
        },
        body: JSON.stringify({
          // Missing required 'text' field
        }),
      } as any;

      const response = (await handler(event)) as APIGatewayProxyResultV2 & {
        statusCode: number;
        body: string;
      };

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });

    it('should handle malformed JSON gracefully', async () => {
      const { handler } = await import('./lambda');

      const event = {
        rawPath: '/analyze',
        requestContext: {
          http: {
            method: 'POST',
            path: '/analyze',
          },
        },
        body: 'invalid json{',
      } as any;

      const response = (await handler(event)) as APIGatewayProxyResultV2 & {
        statusCode: number;
        body: string;
      };

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('JSON');
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in all responses', async () => {
      const { handler } = await import('./lambda');

      const event = {
        rawPath: '/analyze',
        requestContext: {
          http: {
            method: 'POST',
            path: '/analyze',
          },
        },
        body: JSON.stringify({
          text: 'CORS test',
        }),
      } as any;

      const response = (await handler(event)) as APIGatewayProxyResultV2 & {
        statusCode: number;
        body: string;
        headers?: Record<string, string>;
      };

      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Methods');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Headers');
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
    });
  });
});
