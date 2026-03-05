/**
 * FakeNewsOff Backend Server
 *
 * Simple HTTP server that exposes the /analyze endpoint for the frontend.
 * Supports both demo mode and production mode.
 */

import * as http from 'http';
import { isDemoMode, getDemoResponseForContent, demoDelay } from './utils/demoMode';

const PORT = process.env.PORT || 3000;
const DEMO_MODE = isDemoMode();

interface AnalyzeRequest {
  text: string;
  url?: string;
  title?: string;
  demo_mode?: boolean;
}

/**
 * Parse JSON body from request
 */
function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res: http.ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

/**
 * Handle CORS preflight
 */
function handleOptions(res: http.ServerResponse) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end();
}

/**
 * Handle /analyze endpoint
 */
async function handleAnalyze(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    const body = (await parseBody(req)) as AnalyzeRequest;

    // Validate required fields
    if (!body.text || typeof body.text !== 'string' || body.text.trim() === '') {
      sendJson(res, 400, { error: 'Text field is required and must be non-empty' });
      return;
    }

    // Use demo mode from request or environment
    const demoMode = body.demo_mode !== undefined ? body.demo_mode : DEMO_MODE;

    if (demoMode) {
      // Demo mode: return deterministic response based on keywords
      await demoDelay(); // Simulate API delay
      const result = getDemoResponseForContent(body.text);
      sendJson(res, 200, result);
    } else {
      // Production mode: would call real analysis service
      // For now, return error since production mode is not implemented
      sendJson(res, 501, {
        error: 'Production mode not implemented yet. Please use demo_mode=true',
      });
    }
  } catch (error: any) {
    console.error('Error analyzing content:', error);

    if (error.message === 'Invalid JSON') {
      sendJson(res, 400, { error: 'Invalid JSON in request body' });
    } else {
      sendJson(res, 500, { error: 'Internal server error' });
    }
  }
}

/**
 * Request handler
 */
async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = req.url || '';
  const method = req.method || '';

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    handleOptions(res);
    return;
  }

  // Handle /analyze endpoint
  if (url === '/analyze' && method === 'POST') {
    await handleAnalyze(req, res);
    return;
  }

  // Handle health check
  if (url === '/health' && method === 'GET') {
    sendJson(res, 200, { status: 'ok', demo_mode: DEMO_MODE });
    return;
  }

  // 404 for other routes
  sendJson(res, 404, { error: 'Not found' });
}

/**
 * Start server
 */
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`FakeNewsOff backend server running on port ${PORT}`);
  console.log(`Demo mode: ${DEMO_MODE ? 'enabled' : 'disabled'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Analyze endpoint: http://localhost:${PORT}/analyze`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
