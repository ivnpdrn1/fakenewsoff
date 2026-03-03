/**
 * AWS Lambda handler for FakeNewsOff Backend
 * 
 * Wraps the existing HTTP server logic for Lambda/API Gateway
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { isDemoMode, getDemoResponseForContent, demoDelay } from './utils/demoMode';

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
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
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
        timestamp: new Date().toISOString()
      }),
    };
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

      // Default to demo mode when production is not available
      // This ensures the API always works for demos/jury presentations
      const demoMode = request.demo_mode !== undefined ? request.demo_mode : true;

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
