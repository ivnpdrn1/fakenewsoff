/**
 * Smoke Test for UI-Backend Integration
 * 
 * Validates the complete UI → Backend → UI flow in demo mode.
 * Tests all five status labels and error handling.
 * 
 * Requirements: 19.1-19.5
 * 
 * Run with: DEMO_MODE=true npm test
 * No AWS credentials required.
 */

import { describe, it, expect, beforeAll } from 'vitest';

// ============================================================================
// Test Configuration
// ============================================================================

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const ANALYZE_ENDPOINT = `${BACKEND_URL}/analyze`;
const TEST_TIMEOUT = 10000; // 10 seconds per test

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Call the backend /analyze endpoint
 */
async function analyzeContent(params: {
  text: string;
  url?: string;
  title?: string;
  demo_mode?: boolean;
}): Promise<Response> {
  const response = await fetch(ANALYZE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  return response;
}

/**
 * Validate response structure
 */
function validateResponseStructure(data: any): void {
  // Required fields
  expect(data).toHaveProperty('request_id');
  expect(data).toHaveProperty('status_label');
  expect(data).toHaveProperty('confidence_score');
  expect(data).toHaveProperty('recommendation');
  expect(data).toHaveProperty('progress_stages');
  expect(data).toHaveProperty('sources');
  expect(data).toHaveProperty('sift_guidance');
  expect(data).toHaveProperty('timestamp');

  // Type validations
  expect(typeof data.request_id).toBe('string');
  expect(typeof data.status_label).toBe('string');
  expect(typeof data.confidence_score).toBe('number');
  expect(typeof data.recommendation).toBe('string');
  expect(Array.isArray(data.progress_stages)).toBe(true);
  expect(Array.isArray(data.sources)).toBe(true);
  expect(typeof data.sift_guidance).toBe('string');
  expect(typeof data.timestamp).toBe('string');

  // Value validations
  expect(data.confidence_score).toBeGreaterThanOrEqual(0);
  expect(data.confidence_score).toBeLessThanOrEqual(100);
  expect(['Supported', 'Disputed', 'Unverified', 'Manipulated', 'Biased framing']).toContain(
    data.status_label
  );
}

// ============================================================================
// Smoke Tests
// ============================================================================

describe('UI-Backend Integration Smoke Tests', () => {
  beforeAll(() => {
    console.log('Running smoke tests against:', BACKEND_URL);
    console.log('Demo mode should be enabled on the backend');
  });

  describe('Demo Mode - All Five Status Labels', () => {
    it(
      'should return Manipulated status for "fake manipulated" content',
      async () => {
        const response = await analyzeContent({
          text: 'This fake news story has been manipulated with Photoshop',
          demo_mode: true,
        });

        expect(response.ok).toBe(true);
        expect(response.status).toBe(200);

        const data = await response.json();
        validateResponseStructure(data);

        expect(data.status_label).toBe('Manipulated');
        expect(data.confidence_score).toBeGreaterThan(80); // High confidence for manipulated
        expect(data.recommendation).toContain('manipulated');
      },
      TEST_TIMEOUT
    );

    it(
      'should return Disputed status for "disputed false" content',
      async () => {
        const response = await analyzeContent({
          text: 'This disputed claim has been proven false by fact-checkers',
          demo_mode: true,
        });

        expect(response.ok).toBe(true);
        expect(response.status).toBe(200);

        const data = await response.json();
        validateResponseStructure(data);

        expect(data.status_label).toBe('Disputed');
        expect(data.confidence_score).toBeGreaterThan(60); // Good confidence for disputed
        expect(data.recommendation).toContain('disputed');
      },
      TEST_TIMEOUT
    );

    it(
      'should return Biased framing status for "bias framing" content',
      async () => {
        const response = await analyzeContent({
          text: 'This article uses selective bias and framing techniques',
          demo_mode: true,
        });

        expect(response.ok).toBe(true);
        expect(response.status).toBe(200);

        const data = await response.json();
        validateResponseStructure(data);

        expect(data.status_label).toBe('Biased framing');
        expect(data.confidence_score).toBeGreaterThan(50); // Moderate confidence for bias
        expect(data.recommendation).toContain('framing');
      },
      TEST_TIMEOUT
    );

    it(
      'should return Supported status for "verified confirmed" content',
      async () => {
        const response = await analyzeContent({
          text: 'This verified claim has been confirmed by multiple credible sources',
          demo_mode: true,
        });

        expect(response.ok).toBe(true);
        expect(response.status).toBe(200);

        const data = await response.json();
        validateResponseStructure(data);

        expect(data.status_label).toBe('Supported');
        expect(data.confidence_score).toBeGreaterThan(70); // High confidence for supported
        expect(data.recommendation).toContain('supported');
      },
      TEST_TIMEOUT
    );

    it(
      'should return Unverified status for random content',
      async () => {
        const response = await analyzeContent({
          text: 'This is a random claim without specific keywords',
          demo_mode: true,
        });

        expect(response.ok).toBe(true);
        expect(response.status).toBe(200);

        const data = await response.json();
        validateResponseStructure(data);

        expect(data.status_label).toBe('Unverified');
        expect(data.confidence_score).toBeLessThan(50); // Low confidence for unverified
        expect(data.recommendation).toContain('verify');
      },
      TEST_TIMEOUT
    );
  });

  describe('Response Validation', () => {
    it(
      'should include progress stages with completed status',
      async () => {
        const response = await analyzeContent({
          text: 'Test content for progress stages',
          demo_mode: true,
        });

        const data = await response.json();
        expect(data.progress_stages.length).toBeGreaterThan(0);

        data.progress_stages.forEach((stage: any) => {
          expect(stage).toHaveProperty('stage');
          expect(stage).toHaveProperty('status');
          expect(stage).toHaveProperty('timestamp');
          expect(stage.status).toBe('completed');
        });
      },
      TEST_TIMEOUT
    );

    it(
      'should include sources array (0-3 items)',
      async () => {
        const response = await analyzeContent({
          text: 'This verified claim has credible sources',
          demo_mode: true,
        });

        const data = await response.json();
        expect(Array.isArray(data.sources)).toBe(true);
        expect(data.sources.length).toBeLessThanOrEqual(3);

        // If sources exist, validate structure
        if (data.sources.length > 0) {
          data.sources.forEach((source: any) => {
            expect(source).toHaveProperty('url');
            expect(source).toHaveProperty('title');
            expect(source).toHaveProperty('snippet');
            expect(source).toHaveProperty('why');
            expect(source).toHaveProperty('domain');
          });
        }
      },
      TEST_TIMEOUT
    );

    it(
      'should include SIFT guidance with all four components',
      async () => {
        const response = await analyzeContent({
          text: 'Test content for SIFT guidance',
          demo_mode: true,
        });

        const data = await response.json();
        expect(data.sift_guidance).toBeTruthy();
        expect(typeof data.sift_guidance).toBe('string');

        // SIFT guidance should contain all four components
        expect(data.sift_guidance).toContain('Stop:');
        expect(data.sift_guidance).toContain('Investigate:');
        expect(data.sift_guidance).toContain('Find:');
        expect(data.sift_guidance).toContain('Trace:');
      },
      TEST_TIMEOUT
    );

    it(
      'should include media_risk when present',
      async () => {
        const response = await analyzeContent({
          text: 'This fake manipulated content has high media risk',
          demo_mode: true,
        });

        const data = await response.json();
        
        // media_risk can be null or one of: low, medium, high
        if (data.media_risk !== null) {
          expect(['low', 'medium', 'high']).toContain(data.media_risk);
        }
      },
      TEST_TIMEOUT
    );

    it(
      'should include misinformation_type when present',
      async () => {
        const response = await analyzeContent({
          text: 'This disputed false claim is misleading',
          demo_mode: true,
        });

        const data = await response.json();
        
        // misinformation_type can be null or a valid FirstDraft taxonomy type
        if (data.misinformation_type !== null) {
          expect(typeof data.misinformation_type).toBe('string');
          expect(data.misinformation_type.length).toBeGreaterThan(0);
        }
      },
      TEST_TIMEOUT
    );
  });

  describe('Error Handling', () => {
    it(
      'should return 400 for missing text field',
      async () => {
        const response = await fetch(ANALYZE_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            demo_mode: true,
            // Missing text field
          }),
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toHaveProperty('error');
      },
      TEST_TIMEOUT
    );

    it(
      'should return 400 for empty text field',
      async () => {
        const response = await analyzeContent({
          text: '',
          demo_mode: true,
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toHaveProperty('error');
      },
      TEST_TIMEOUT
    );

    it(
      'should handle invalid JSON gracefully',
      async () => {
        const response = await fetch(ANALYZE_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: 'invalid json',
        });

        expect(response.status).toBe(400);
      },
      TEST_TIMEOUT
    );
  });

  describe('Optional Fields', () => {
    it(
      'should accept url and title fields',
      async () => {
        const response = await analyzeContent({
          text: 'Test content with URL and title',
          url: 'https://example.com/article',
          title: 'Test Article Title',
          demo_mode: true,
        });

        expect(response.ok).toBe(true);
        const data = await response.json();
        validateResponseStructure(data);
      },
      TEST_TIMEOUT
    );

    it(
      'should work without demo_mode flag (backend should detect DEMO_MODE env)',
      async () => {
        const response = await analyzeContent({
          text: 'Test content without explicit demo_mode flag',
        });

        // Should still work if backend has DEMO_MODE=true
        expect(response.ok).toBe(true);
        const data = await response.json();
        validateResponseStructure(data);
      },
      TEST_TIMEOUT
    );
  });

  describe('Performance', () => {
    it(
      'should respond within 5 seconds in demo mode',
      async () => {
        const startTime = Date.now();
        
        const response = await analyzeContent({
          text: 'Performance test content',
          demo_mode: true,
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(response.ok).toBe(true);
        expect(duration).toBeLessThan(5000); // Should respond in < 5 seconds
      },
      TEST_TIMEOUT
    );
  });
});

