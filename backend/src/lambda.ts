/**
 * AWS Lambda handler for FakeNewsOff Backend
 *
 * Wraps the existing HTTP server logic for Lambda/API Gateway
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { isDemoMode, getDemoResponseForContent, demoDelay } from './utils/demoMode';
import { getGroundingService } from './services/groundingService';
import { getEnv } from './utils/envValidation';

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
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        status: 'ok',
        demo_mode: DEMO_MODE,
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
      const demoMode = request.demo_mode !== undefined ? request.demo_mode : DEMO_MODE;

      if (demoMode) {
        // Demo mode: return deterministic response based on keywords
        await demoDelay(); // Simulate API delay
        const result = getDemoResponseForContent(request.text);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result),
        };
      } else {
        // Production mode: would call real analysis service
        // For now, fall back to demo mode since production is not implemented
        await demoDelay();
        const result = getDemoResponseForContent(request.text);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result),
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
