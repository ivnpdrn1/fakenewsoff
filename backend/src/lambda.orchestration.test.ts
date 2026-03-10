/**
 * Integration tests for Feature Flag Routing
 *
 * Tests ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED flag behavior
 *
 * NOTE: These tests require real API keys and will make actual API calls.
 * Set SKIP_INTEGRATION_TESTS=true to skip these tests in CI/CD.
 */

import { APIGatewayProxyResultV2 } from 'aws-lambda';

const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION_TESTS === 'true';

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
      process.env.DEMO_MODE = 'false'; // Disable demo mode for real testing
    });

    (SKIP_INTEGRATION ? it.skip : it)('should use legacy pipeline when flag is disabled', async () => {
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

    (SKIP_INTEGRATION ? it.skip : it)('should use orchestration pipeline when flag is enabled for text-only', async () => {
      // Note: This test will actually call NOVA and grounding services
      // In a real test environment, you'd mock these
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
    }, 60000); // 60 second timeout for real API calls
  });

  describe('Response Schema Compatibility', () => {
    (SKIP_INTEGRATION ? it.skip : it)('should maintain backward compatible response shape', async () => {
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

      if (body.text_grounding.sources.length > 0) {
        const source = body.text_grounding.sources[0];
        expect(source).toHaveProperty('url');
        expect(source).toHaveProperty('title');
        expect(source).toHaveProperty('snippet');
        expect(source).toHaveProperty('domain');
        expect(source).toHaveProperty('score');
      }

      // Verify orchestration metadata is optional and non-breaking
      if (body.orchestration) {
        expect(typeof body.orchestration.enabled).toBe('boolean');
        expect(typeof body.orchestration.passes_executed).toBe('number');
      }
    }, 60000);
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
