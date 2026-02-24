/**
 * Smoke Tests - End-to-End Happy Path Validation
 * 
 * These tests validate the core flows that judges will evaluate:
 * 1. Nova LLM analysis with structured output
 * 2. Content fetching with caching
 * 3. Full cache flow (store and retrieve)
 * 
 * Run with: npm test -- smoke.test.ts --runInBand
 * Demo mode: DEMO_MODE=true npm test -- smoke.test.ts --runInBand
 */

import { extractClaims, synthesizeEvidence, determineLabel } from '../services/novaClient';
import { fetchFullText, clearFetchCache } from '../services/fetchService';
import { checkCache, storeInCache } from '../services/cacheService';
import type { AnalysisRequest } from '../utils/dynamodb';
import type { AnalysisResponse } from '../utils/schemaValidators';

// Mock AWS SDK for Nova Client
jest.mock('@aws-sdk/client-bedrock-runtime', () => {
  const actualCommand = jest.requireActual('@aws-sdk/client-bedrock-runtime');
  return {
    BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
      send: jest.fn()
    })),
    InvokeModelCommand: jest.fn().mockImplementation((input) => {
      return { input, ...actualCommand.InvokeModelCommand };
    })
  };
});

// Mock DynamoDB for Cache Service
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { __resetClient } from '../services/novaClient';
import * as dynamodb from '../utils/dynamodb';

describe('Smoke Tests - Core Flows', () => {
  let mockSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    clearFetchCache();
    __resetClient();
    
    mockSend = jest.fn();
    (BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend
    }));
  });

  describe('Flow 1: Nova LLM Analysis', () => {
    it('should extract claims from content', async () => {
      const mockResponse = {
        claims: [
          {
            text: 'The sky is blue due to Rayleigh scattering',
            confidence: 0.95,
            category: 'factual' as const
          }
        ],
        summary: 'Content about atmospheric physics'
      };

      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          completion: JSON.stringify(mockResponse)
        }))
      });

      const result = await extractClaims('The sky is blue due to Rayleigh scattering.', 'Sky Color Facts');

      expect(result.claims).toBeDefined();
      expect(result.claims.length).toBeGreaterThan(0);
      expect(result.claims[0].text).toBeTruthy();
      expect(result.summary).toBeTruthy();
    }, 15000);

    it('should synthesize evidence from sources', async () => {
      const mockSynthesis = {
        synthesis: 'Strong evidence supports the claim about atmospheric scattering',
        sourceAnalysis: [
          {
            url: 'https://example.com/physics',
            title: 'Atmospheric Physics',
            snippet: 'Rayleigh scattering explains blue sky',
            why: 'Scientific explanation',
            stance: 'supports' as const,
            credibility: 'high' as const
          }
        ],
        evidenceStrength: 'strong' as const
      };

      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          completion: JSON.stringify(mockSynthesis)
        }))
      });

      const claims = [
        { text: 'The sky is blue', confidence: 0.95, category: 'factual' as const }
      ];
      const sources = [
        {
          url: 'https://example.com/physics',
          title: 'Atmospheric Physics',
          snippet: 'Rayleigh scattering explains blue sky',
          why: 'Scientific explanation',
          domain: 'example.com'
        }
      ];

      const result = await synthesizeEvidence(claims, sources, []);

      expect(result.synthesis).toBeDefined();
      expect(result.evidenceStrength).toBeDefined();
      expect(['strong', 'moderate', 'weak', 'insufficient']).toContain(result.evidenceStrength);
    }, 15000);

    it('should determine status label and recommendation', async () => {
      const mockLabel = {
        status_label: 'Supported' as const,
        confidence_score: 85,
        misinformation_type: null,
        recommendation: 'This claim is well-supported by credible sources.',
        sift_guidance: 'Stop: Verified. Investigate: Credible source. Find: Multiple confirmations.',
        reasoning: 'Multiple credible sources confirm'
      };

      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          completion: JSON.stringify(mockLabel)
        }))
      });

      const claims = [
        { text: 'The sky is blue', confidence: 0.95, category: 'factual' as const }
      ];
      const synthesis = {
        synthesis: 'Strong evidence',
        sourceAnalysis: [],
        evidenceStrength: 'strong' as const
      };

      const result = await determineLabel(claims, synthesis);

      expect(result.status_label).toBeDefined();
      expect(['Supported', 'Disputed', 'Unverified', 'Manipulated', 'Biased framing']).toContain(result.status_label);
      expect(result.confidence_score).toBeGreaterThanOrEqual(0);
      expect(result.confidence_score).toBeLessThanOrEqual(100);
      expect(result.recommendation).toBeTruthy();
      expect(result.sift_guidance).toBeTruthy();
    }, 15000);
  });

  describe('Flow 2: Content Fetching & Caching', () => {
    it('should fetch article text and cache results', async () => {
      const testUrl = 'https://example.com/article';
      
      // First fetch - cache miss
      const result1 = await fetchFullText(testUrl);
      expect(result1.cleanedText).toBeDefined();
      expect(result1.extraction_method).toMatch(/article|body/);
      
      // Second fetch - cache hit (should return same result)
      const result2 = await fetchFullText(testUrl);
      expect(result2).toEqual(result1);
      expect(result2.cleanedText).toBe(result1.cleanedText);
    }, 10000);

    it('should handle fetch errors gracefully', async () => {
      const invalidUrl = 'https://nonexistent-domain-12345.com/article';
      
      const result = await fetchFullText(invalidUrl);
      
      // Should return result with warnings, not throw
      expect(result).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.warnings.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Flow 3: Analysis Cache', () => {
    beforeEach(() => {
      // Mock DynamoDB operations
      jest.spyOn(dynamodb, 'queryByContentHash').mockResolvedValue([]);
      jest.spyOn(dynamodb, 'storeAnalysisRecord').mockResolvedValue();
    });

    it('should cache and retrieve analysis results', async () => {
      const request: AnalysisRequest = {
        text: 'Test claim about vaccines',
        url: 'https://example.com/test',
        title: 'Test Article'
      };

      const response: AnalysisResponse = {
        request_id: 'test-123',
        status_label: 'Supported',
        confidence_score: 85,
        recommendation: 'This claim is supported by evidence.',
        progress_stages: [],
        sources: [],
        media_risk: null,
        misinformation_type: null,
        sift_guidance: 'Test guidance',
        timestamp: new Date().toISOString()
      };

      // Store in cache
      await storeInCache(request, response);

      // Verify storeAnalysisRecord was called
      expect(dynamodb.storeAnalysisRecord).toHaveBeenCalled();
      const storedRecord = (dynamodb.storeAnalysisRecord as jest.Mock).mock.calls[0][0];
      expect(storedRecord.request_id).toBe('test-123');
      expect(storedRecord.content_hash).toBeDefined();
    });

    it('should return null on cache miss', async () => {
      const request: AnalysisRequest = {
        text: 'New claim not in cache',
        url: 'https://example.com/new',
        title: 'New Article'
      };

      // Mock empty cache
      (dynamodb.queryByContentHash as jest.Mock).mockResolvedValue([]);

      const cached = await checkCache(request);
      expect(cached).toBeNull();
    });

    it('should return cached result on cache hit', async () => {
      const request: AnalysisRequest = {
        text: 'Cached claim',
        url: 'https://example.com/cached',
        title: 'Cached Article'
      };

      const cachedResponse: AnalysisResponse = {
        request_id: 'cached-123',
        status_label: 'Supported',
        confidence_score: 90,
        recommendation: 'Cached recommendation',
        progress_stages: [],
        sources: [],
        media_risk: null,
        misinformation_type: null,
        sift_guidance: 'Cached guidance',
        timestamp: new Date().toISOString()
      };

      // Mock cache hit
      (dynamodb.queryByContentHash as jest.Mock).mockResolvedValue([
        {
          request_id: 'cached-123',
          request,
          response: cachedResponse,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          content_hash: 'test-hash',
          ttl: Math.floor(Date.now() / 1000) + 86400
        }
      ]);

      const cached = await checkCache(request);
      expect(cached).not.toBeNull();
      expect(cached?.response.request_id).toBe('cached-123');
      expect(cached?.cached).toBe(true);
    });
  });

  describe('Integration: Full Analysis Flow', () => {
    it('should complete end-to-end analysis workflow', async () => {
      // Mock Nova responses for full flow
      const claimResponse = {
        claims: [
          { text: 'Test claim', confidence: 0.9, category: 'factual' as const }
        ],
        summary: 'Test summary'
      };

      const synthesisResponse = {
        synthesis: 'Test synthesis',
        sourceAnalysis: [],
        evidenceStrength: 'moderate' as const
      };

      const labelResponse = {
        status_label: 'Unverified' as const,
        confidence_score: 50,
        misinformation_type: null,
        recommendation: 'Verify before sharing',
        sift_guidance: 'Apply SIFT framework',
        reasoning: 'Insufficient evidence'
      };

      mockSend
        .mockResolvedValueOnce({
          body: new TextEncoder().encode(JSON.stringify({
            completion: JSON.stringify(claimResponse)
          }))
        })
        .mockResolvedValueOnce({
          body: new TextEncoder().encode(JSON.stringify({
            completion: JSON.stringify(synthesisResponse)
          }))
        })
        .mockResolvedValueOnce({
          body: new TextEncoder().encode(JSON.stringify({
            completion: JSON.stringify(labelResponse)
          }))
        });

      // Step 1: Extract claims
      const claims = await extractClaims('Test content', 'Test Title');
      expect(claims.claims.length).toBeGreaterThan(0);

      // Step 2: Synthesize evidence
      const synthesis = await synthesizeEvidence(claims.claims, [], []);
      expect(synthesis.synthesis).toBeTruthy();

      // Step 3: Determine label
      const label = await determineLabel(claims.claims, synthesis);
      expect(label.status_label).toBeTruthy();
      expect(label.recommendation).toBeTruthy();

      // Verify all steps completed successfully
      expect(mockSend).toHaveBeenCalledTimes(3);
    }, 20000);
  });
});
