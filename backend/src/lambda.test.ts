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

// Mock demoMode utilities
jest.mock('./utils/demoMode', () => ({
  isDemoMode: jest.fn(() => false), // Default to false for testing
  getDemoResponseForContent: jest.fn(() => ({
    request_id: mockUUID,
    status_label: 'Unverified',
    confidence_score: 30,
    recommendation: 'Test recommendation',
    progress_stages: [
      { stage: 'Test Stage', status: 'completed', timestamp: '2024-01-01T00:00:00Z' },
    ],
    sources: [],
    media_risk: null,
    misinformation_type: null,
    sift_guidance: 'Test guidance',
    timestamp: '2024-01-01T00:00:00Z',
  })),
  demoDelay: jest.fn(() => Promise.resolve()),
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
