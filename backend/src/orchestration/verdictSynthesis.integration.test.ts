/**
 * Integration tests for verdict synthesis with trusted sources
 * 
 * Validates that supporting evidence from trusted domains produces
 * high-confidence SUPPORTED verdicts, not unverified low-confidence results
 */

import { describe, it, expect } from '@jest/globals';
import { synthesizeVerdict } from '../services/novaClient';
import type { ClaimDecomposition, EvidenceBucket, FilteredEvidence } from '../types/orchestration';

describe('Verdict Synthesis Integration', () => {
  describe('Trusted Source Support', () => {
    it.skip('should produce high-confidence supported verdict for Russia-Ukraine claim with trusted sources', async () => {
      // Skipped: Requires AWS Bedrock credentials
      // This test validates end-to-end behavior with real LLM calls
      // Run manually in environments with AWS credentials configured
      
      const claim = 'Russia invaded Ukraine in February 2022';
      
      const decomposition: ClaimDecomposition = {
        originalClaim: claim,
        subclaims: [
          { type: 'actor', text: 'Russia', importance: 1.0 },
          { type: 'action', text: 'invaded', importance: 1.0 },
          { type: 'object', text: 'Ukraine', importance: 1.0 },
          { type: 'time', text: 'in February 2022', importance: 0.9 }
        ],
        timestamp: new Date().toISOString()
      };

      const supportingEvidence: FilteredEvidence[] = [
        {
          url: 'https://www.reuters.com/world/europe/russia-invades-ukraine-2022-02-24/',
          title: 'Russia invades Ukraine',
          snippet: 'Russia invaded Ukraine on February 24, 2022, launching a full-scale military operation',
          domain: 'reuters.com',
          publishDate: '2022-02-24T06:00:00Z',
          score: 0.95,
          stance: 'supports',
          stanceJustification: 'Source provides factual evidence supporting the claim',
          provider: 'serper',
          credibilityTier: 1,
          sourceClass: 'major_international',
          authorityLevel: 'high',
          pageType: 'article',
          qualityScore: {
            claimRelevance: 0.95,
            specificity: 0.9,
            directness: 0.95,
            freshness: 0.8,
            sourceAuthority: 1.0,
            primaryWeight: 0.8,
            contradictionValue: 0.0,
            corroborationCount: 0.9,
            accessibility: 0.9,
            geographicRelevance: 0.95,
            composite: 0.92
          },
          retrievedByQuery: 'Russia invaded Ukraine February 2022',
          retrievedInPass: 1,
          passed: true
        },
        {
          url: 'https://www.bbc.com/news/world-europe-60503037',
          title: 'Russia attacks Ukraine',
          snippet: 'Russia invaded its neighbor Ukraine on Feb. 24, 2022',
          domain: 'bbc.com',
          publishDate: '2022-02-24T07:00:00Z',
          score: 0.93,
          stance: 'supports',
          stanceJustification: 'Source provides factual evidence supporting the claim',
          provider: 'serper',
          credibilityTier: 1,
          sourceClass: 'major_international',
          authorityLevel: 'high',
          pageType: 'article',
          qualityScore: {
            claimRelevance: 0.93,
            specificity: 0.88,
            directness: 0.92,
            freshness: 0.8,
            sourceAuthority: 1.0,
            primaryWeight: 0.75,
            contradictionValue: 0.0,
            corroborationCount: 0.85,
            accessibility: 0.88,
            geographicRelevance: 0.93,
            composite: 0.89
          },
          retrievedByQuery: 'Russia invaded Ukraine February 2022',
          retrievedInPass: 1,
          passed: true
        },
        {
          url: 'https://apnews.com/article/russia-ukraine-invasion-feb-2022',
          title: 'Russia launches invasion of Ukraine',
          snippet: 'Russia invaded Ukraine on February 24, 2022',
          domain: 'apnews.com',
          publishDate: '2022-02-24T06:30:00Z',
          score: 0.94,
          stance: 'supports',
          stanceJustification: 'Source provides factual evidence supporting the claim',
          provider: 'serper',
          credibilityTier: 1,
          sourceClass: 'major_international',
          authorityLevel: 'high',
          pageType: 'article',
          qualityScore: {
            claimRelevance: 0.94,
            specificity: 0.89,
            directness: 0.93,
            freshness: 0.8,
            sourceAuthority: 1.0,
            primaryWeight: 0.78,
            contradictionValue: 0.0,
            corroborationCount: 0.87,
            accessibility: 0.89,
            geographicRelevance: 0.94,
            composite: 0.90
          },
          retrievedByQuery: 'Russia invaded Ukraine February 2022',
          retrievedInPass: 1,
          passed: true
        }
      ];

      const evidenceBuckets: EvidenceBucket = {
        supporting: supportingEvidence,
        contradicting: [],
        context: [],
        rejected: []
      };

      const verdict = await synthesizeVerdict(claim, decomposition, evidenceBuckets);

      // Assertions
      expect(verdict.classification).toBe('true');
      expect(verdict.confidence).toBeGreaterThanOrEqual(0.85); // High confidence
      expect(verdict.supportedSubclaims.length).toBeGreaterThan(0);
      expect(verdict.bestEvidence.length).toBeGreaterThan(0);
    }, 30000); // 30 second timeout for LLM call

    it.skip('should handle contextual-only evidence with low confidence', async () => {
      // Skipped: Requires AWS Bedrock credentials
      const claim = 'Russia invaded Ukraine in February 2022';
      
      const decomposition: ClaimDecomposition = {
        originalClaim: claim,
        subclaims: [
          { type: 'actor', text: 'Russia', importance: 1.0 },
          { type: 'action', text: 'invaded', importance: 1.0 },
          { type: 'object', text: 'Ukraine', importance: 1.0 },
          { type: 'time', text: 'in February 2022', importance: 0.9 }
        ],
        timestamp: new Date().toISOString()
      };

      const contextualEvidence: FilteredEvidence[] = [
        {
          url: 'https://example.com/ukraine-history',
          title: 'Ukraine Conflict Background',
          snippet: 'The Ukraine conflict has historical roots in regional tensions',
          domain: 'example.com',
          publishDate: '2022-03-01T00:00:00Z',
          score: 0.5,
          stance: 'mentions',
          stanceJustification: 'Source mentions key terms from claim',
          provider: 'gdelt',
          credibilityTier: 3,
          sourceClass: 'regional_media',
          authorityLevel: 'low',
          pageType: 'article',
          qualityScore: {
            claimRelevance: 0.5,
            specificity: 0.4,
            directness: 0.3,
            freshness: 0.7,
            sourceAuthority: 0.4,
            primaryWeight: 0.0,
            contradictionValue: 0.0,
            corroborationCount: 0.0,
            accessibility: 0.6,
            geographicRelevance: 0.5,
            composite: 0.45
          },
          retrievedByQuery: 'Russia Ukraine conflict',
          retrievedInPass: 1,
          passed: true
        }
      ];

      const evidenceBuckets: EvidenceBucket = {
        supporting: [],
        contradicting: [],
        context: contextualEvidence,
        rejected: []
      };

      const verdict = await synthesizeVerdict(claim, decomposition, evidenceBuckets);

      // Assertions
      expect(verdict.classification).toBe('unverified');
      expect(verdict.confidence).toBeLessThan(0.5); // Low confidence
    }, 30000);
  });
});
