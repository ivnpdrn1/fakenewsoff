/**
 * Preservation Property Tests for Production Retrieval Efficiency
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 *
 * Property 2: Preservation - Evidence Quality and Classification
 *
 * **IMPORTANT**: Follow observation-first methodology
 * These tests observe behavior on UNFIXED code for non-buggy inputs
 * Tests should PASS on unfixed code to confirm baseline behavior to preserve
 *
 * Property-based testing generates many test cases for stronger guarantees
 *
 * For any evidence sources successfully retrieved, the fixed system SHALL produce
 * exactly the same quality scores, normalization, stance classification, and
 * acceptance decisions as the original system, preserving all existing evidence
 * processing behavior.
 */

import * as fc from 'fast-check';
import { getDemoTextGroundingBundle } from '../utils/demoGrounding';
import { groundTextOnly } from '../services/groundingService';
import {
  normalizeMediastackArticles,
  normalizeGDELTArticles,
  normalizeBingArticles,
  scoreAndRank,
  assignCredibilityTier,
} from '../services/sourceNormalizer';
import { SourceClassifier } from './sourceClassifier';
import type { NormalizedSourceWithStance, GDELTArticle, BingNewsArticle } from '../types/grounding';
import type { MediastackArticle } from '../clients/mediastackClient';
import type { PageType } from '../types/orchestration';

describe('Preservation Property Tests: Evidence Quality and Classification', () => {
  describe('Demo mode evidence retrieval (UNFIXED CODE)', () => {
    /**
     * Requirement 3.1, 3.2: Demo mode should return deterministic results
     * This behavior must be preserved after fix
     */
    it('should return deterministic results in demo mode (Preservation)', () => {
      const claim = 'The Eiffel Tower is located in Paris, France';

      // Call twice to verify determinism
      const result1 = getDemoTextGroundingBundle(claim);
      const result2 = getDemoTextGroundingBundle(claim);

      // Document baseline behavior
      console.log('Preservation Test - Demo mode determinism:');
      console.log(`  Sources found (call 1): ${result1.sources.length}`);
      console.log(`  Sources found (call 2): ${result2.sources.length}`);
      console.log(`  Provider used: ${result1.providerUsed.join(', ')}`);

      // BASELINE BEHAVIOR: Demo mode returns deterministic results
      // PRESERVATION: Must continue to return identical results after fix
      expect(result1.sources.length).toBe(result2.sources.length);
      expect(result1.sources.length).toBeGreaterThan(0);

      // Verify sources are identical
      for (let i = 0; i < result1.sources.length; i++) {
        expect(result1.sources[i].url).toBe(result2.sources[i].url);
        expect(result1.sources[i].title).toBe(result2.sources[i].title);
        expect(result1.sources[i].stance).toBe(result2.sources[i].stance);
      }
    });

    /**
     * Property-based test: Demo mode should be deterministic for ANY claim
     */
    it('Property: Demo mode returns identical results for same claim (PBT)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }),
          (claim) => {
            const result1 = getDemoTextGroundingBundle(claim);
            const result2 = getDemoTextGroundingBundle(claim);

            // Property: Results should be identical
            expect(result1.sources.length).toBe(result2.sources.length);
            expect(result1.providerUsed).toEqual(result2.providerUsed);

            // Verify all sources match
            for (let i = 0; i < result1.sources.length; i++) {
              expect(result1.sources[i].url).toBe(result2.sources[i].url);
              expect(result1.sources[i].title).toBe(result2.sources[i].title);
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Source normalization (UNFIXED CODE)', () => {
    /**
     * Requirement 3.1, 3.5: Source normalization should remain unchanged
     */
    it('should normalize Mediastack articles consistently (Preservation)', () => {
      const mockArticles: MediastackArticle[] = [
        {
          title: 'Breaking News: Major Event',
          description: 'Details about the major event that occurred today.',
          url: 'https://example.com/news/article-1',
          published_at: '2024-03-03T10:00:00Z',
          source: 'Example News',
        },
        {
          title: 'Another Important Story',
          description: 'More information about another important development.',
          url: 'https://example.com/news/article-2',
          published_at: '2024-03-02T15:00:00Z',
          source: 'Example News',
        },
      ];

      const normalized = normalizeMediastackArticles(mockArticles);

      // Document baseline behavior
      console.log('Preservation Test - Mediastack normalization:');
      console.log(`  Input articles: ${mockArticles.length}`);
      console.log(`  Normalized sources: ${normalized.length}`);
      console.log(`  First source domain: ${normalized[0]?.domain}`);

      // BASELINE BEHAVIOR: Normalization produces consistent structure
      // PRESERVATION: Must continue to produce same structure after fix
      expect(normalized.length).toBe(mockArticles.length);
      expect(normalized[0]).toHaveProperty('url');
      expect(normalized[0]).toHaveProperty('title');
      expect(normalized[0]).toHaveProperty('snippet');
      expect(normalized[0]).toHaveProperty('publishDate');
      expect(normalized[0]).toHaveProperty('domain');
      expect(normalized[0].domain).toBe('example.com');
    });

    it('should normalize GDELT articles consistently (Preservation)', () => {
      const mockArticles: GDELTArticle[] = [
        {
          url: 'https://example.com/gdelt/article-1',
          title: 'GDELT Article Title',
          seendate: '20240303100000',
          domain: 'example.com',
          language: 'English',
        },
      ];

      const normalized = normalizeGDELTArticles(mockArticles);

      // Document baseline behavior
      console.log('Preservation Test - GDELT normalization:');
      console.log(`  Input articles: ${mockArticles.length}`);
      console.log(`  Normalized sources: ${normalized.length}`);

      // BASELINE BEHAVIOR: GDELT normalization works correctly
      // PRESERVATION: Must continue to work after fix
      expect(normalized.length).toBe(mockArticles.length);
      expect(normalized[0]).toHaveProperty('url');
      expect(normalized[0]).toHaveProperty('title');
      expect(normalized[0]).toHaveProperty('domain');
      expect(normalized[0].domain).toBe('example.com');
    });

    it('should normalize Bing articles consistently (Preservation)', () => {
      const mockArticles: BingNewsArticle[] = [
        {
          name: 'Bing News Article',
          url: 'https://example.com/bing/article-1',
          description: 'Description of the Bing news article.',
          datePublished: '2024-03-03T10:00:00Z',
          provider: [{ name: 'Example Provider' }],
        },
      ];

      const normalized = normalizeBingArticles(mockArticles);

      // Document baseline behavior
      console.log('Preservation Test - Bing normalization:');
      console.log(`  Input articles: ${mockArticles.length}`);
      console.log(`  Normalized sources: ${normalized.length}`);

      // BASELINE BEHAVIOR: Bing normalization works correctly
      // PRESERVATION: Must continue to work after fix
      expect(normalized.length).toBe(mockArticles.length);
      expect(normalized[0]).toHaveProperty('url');
      expect(normalized[0]).toHaveProperty('title');
      expect(normalized[0]).toHaveProperty('domain');
    });

    /**
     * Property-based test: Normalization should preserve article count
     */
    it('Property: Normalization preserves article count (PBT)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              title: fc.string({ minLength: 5, maxLength: 100 }),
              description: fc.string({ minLength: 10, maxLength: 200 }),
              url: fc.webUrl(),
              published_at: fc.date().map((d) => d.toISOString()),
              source: fc.string({ minLength: 3, maxLength: 50 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (articles) => {
            const normalized = normalizeMediastackArticles(articles);

            // Property: Output count should match input count
            return normalized.length === articles.length;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Evidence quality scoring (UNFIXED CODE)', () => {
    /**
     * Requirement 3.1, 3.5: Quality scoring should remain unchanged
     */
    it('should score and rank sources consistently (Preservation)', () => {
      const mockSources = [
        {
          url: 'https://reuters.com/article-1',
          title: 'Climate change impacts accelerating',
          snippet: 'New research shows climate impacts are accelerating.',
          publishDate: '2024-03-03T10:00:00Z',
          domain: 'reuters.com',
          score: 0,
        },
        {
          url: 'https://example.com/article-2',
          title: 'Climate news',
          snippet: 'Some climate news.',
          publishDate: '2024-01-01T10:00:00Z',
          domain: 'example.com',
          score: 0,
        },
      ];

      const query = 'climate change impacts';
      const scored = scoreAndRank(mockSources, query);

      // Document baseline behavior
      console.log('Preservation Test - Quality scoring:');
      console.log(`  Input sources: ${mockSources.length}`);
      console.log(`  Scored sources: ${scored.length}`);
      console.log(`  First source score: ${scored[0].score}`);
      console.log(`  Second source score: ${scored[1].score}`);

      // BASELINE BEHAVIOR: Scoring produces numeric scores
      // PRESERVATION: Must continue to produce same scoring logic after fix
      expect(scored.length).toBe(mockSources.length);
      expect(scored[0].score).toBeGreaterThan(0);
      expect(scored[1].score).toBeGreaterThan(0);
      // Reuters with recent date and good title match should score higher
      expect(scored[0].score).toBeGreaterThan(scored[1].score);
    });

    it('should assign credibility tiers consistently (Preservation)', () => {
      const domains = [
        { domain: 'reuters.com', expectedTier: 1 },
        { domain: 'example.com', expectedTier: 3 },
        { domain: 'bbc.com', expectedTier: 1 },
      ];

      // Document baseline behavior
      console.log('Preservation Test - Credibility tiers:');

      for (const { domain, expectedTier } of domains) {
        const tier = assignCredibilityTier(domain);
        console.log(`  ${domain}: tier ${tier}`);

        // BASELINE BEHAVIOR: Known domains get tier 1, unknown get tier 3
        // PRESERVATION: Must continue to assign same tiers after fix
        expect(tier).toBe(expectedTier);
      }
    });

    /**
     * Property-based test: Scoring should always produce valid scores
     */
    it('Property: Scoring produces valid scores for all sources (PBT)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              url: fc.webUrl(),
              title: fc.string({ minLength: 5, maxLength: 100 }),
              snippet: fc.string({ minLength: 10, maxLength: 200 }),
              publishDate: fc.date().map((d) => d.toISOString()),
              domain: fc.domain(),
              score: fc.constant(0),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.string({ minLength: 5, maxLength: 50 }),
          (sources, query) => {
            const scored = scoreAndRank(sources, query);

            // Property: All scores should be valid numbers >= 0
            return scored.every((s) => typeof s.score === 'number' && s.score >= 0);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Stance classification (UNFIXED CODE)', () => {
    /**
     * Requirement 3.1, 3.5: Stance classification should remain unchanged
     */
    it('should classify sources by domain consistently (Preservation)', () => {
      const classifier = new SourceClassifier();

      const mockSources: Array<NormalizedSourceWithStance & { pageType: any }> = [
        {
          url: 'https://reuters.com/article',
          title: 'Reuters Article',
          snippet: 'Article snippet',
          publishDate: '2024-03-03T10:00:00Z',
          domain: 'reuters.com',
          score: 0.9,
          stance: 'supports',
          stanceJustification: 'Evidence supports claim',
          provider: 'mediastack',
          credibilityTier: 1,
          pageType: 'article',
        },
        {
          url: 'https://whitehouse.gov/statement',
          title: 'Official Statement',
          snippet: 'Government statement',
          publishDate: '2024-03-03T10:00:00Z',
          domain: 'whitehouse.gov',
          score: 0.95,
          stance: 'supports',
          stanceJustification: 'Official confirmation',
          provider: 'gdelt',
          credibilityTier: 1,
          pageType: 'official_statement',
        },
      ];

      // Document baseline behavior
      console.log('Preservation Test - Source classification:');

      for (const source of mockSources) {
        const classified = classifier.classify(source, source.pageType);
        console.log(`  ${source.domain}: ${classified.sourceClass}, ${classified.authorityLevel}`);

        // BASELINE BEHAVIOR: Classification assigns source class and authority
        // PRESERVATION: Must continue to classify correctly after fix
        expect(classified).toHaveProperty('sourceClass');
        expect(classified).toHaveProperty('authorityLevel');
        expect(classified.sourceClass).toBeDefined();
        expect(classified.authorityLevel).toBeDefined();
      }

      // Verify specific classifications
      const reuters = classifier.classify(mockSources[0], 'article');
      expect(reuters.sourceClass).toBe('major_international');
      expect(reuters.authorityLevel).toBe('high');

      const whitehouse = classifier.classify(mockSources[1], 'official_statement');
      expect(whitehouse.sourceClass).toBe('official_government');
      expect(whitehouse.authorityLevel).toBe('high');
    });

    /**
     * Property-based test: Classification should always produce valid results
     */
    it('Property: Classification produces valid source class and authority (PBT)', () => {
      const classifier = new SourceClassifier();

      fc.assert(
        fc.property(
          fc.record({
            url: fc.webUrl(),
            title: fc.string({ minLength: 5, maxLength: 100 }),
            snippet: fc.string({ minLength: 10, maxLength: 200 }),
            publishDate: fc.date().map((d) => d.toISOString()),
            domain: fc.domain(),
            score: fc.double({ min: 0, max: 1 }),
            stance: fc.constantFrom('supports', 'contradicts', 'mentions', 'unclear'),
            stanceJustification: fc.string({ minLength: 10, maxLength: 100 }),
            provider: fc.constantFrom('mediastack', 'gdelt', 'bing'),
            credibilityTier: fc.constantFrom(1, 2, 3),
          }),
          fc.constantFrom<PageType>('article', 'official_statement', 'press_release', 'fact_check'),
          (source, pageType) => {
            const classified = classifier.classify(source as any, pageType);

            // Property: Classification should always produce valid values
            const validSourceClasses = [
              'major_international',
              'official_government',
              'international_org',
              'fact_checker',
              'primary_source',
              'regional_media',
            ];
            const validAuthorityLevels = ['high', 'medium', 'low'];

            return (
              validSourceClasses.includes(classified.sourceClass) &&
              validAuthorityLevels.includes(classified.authorityLevel)
            );
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Direct grounding service calls (UNFIXED CODE)', () => {
    /**
     * Requirement 3.1, 3.2, 3.3, 3.4: Direct grounding calls should work unchanged
     * This tests grounding service behavior outside of orchestration
     */
    it('should return empty evidence for unavailable claims (Preservation)', async () => {
      // This claim should have no real evidence
      const claim = 'xyzabc123 nonexistent claim with no evidence';
      const result = await groundTextOnly(claim, 'preservation-test-unavailable', true);

      // Document baseline behavior
      console.log('Preservation Test - No evidence available:');
      console.log(`  Sources found: ${result.sources.length}`);
      console.log(`  Provider used: ${result.providerUsed.join(', ')}`);

      // BASELINE BEHAVIOR: Returns empty or demo sources
      // PRESERVATION: Must continue to handle unavailable claims after fix
      expect(result).toHaveProperty('sources');
      expect(result).toHaveProperty('providerUsed');
      expect(result).toHaveProperty('sourcesCount');
      expect(Array.isArray(result.sources)).toBe(true);
    });

    it('should complete within performance budget (Preservation)', async () => {
      const claim = 'technology news';
      const startTime = Date.now();
      const result = await groundTextOnly(claim, 'preservation-test-performance', true);
      const duration = Date.now() - startTime;

      // Document baseline behavior
      console.log('Preservation Test - Performance budget:');
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Result latency: ${result.latencyMs}ms`);

      // BASELINE BEHAVIOR: Demo mode completes quickly
      // PRESERVATION: Must maintain performance after fix
      expect(duration).toBeLessThan(1000); // Demo mode should be fast
      expect(result.latencyMs).toBeLessThan(1000);
    });
  });

  describe('Baseline Behavior Documentation', () => {
    it('should document the baseline behaviors to preserve', () => {
      // This test documents the expected baseline behaviors:
      // 1. Demo mode returns deterministic results
      // 2. Source normalization (Mediastack, GDELT, Bing) produces consistent structure
      // 3. Evidence quality scoring produces numeric scores
      // 4. Credibility tier assignment works correctly
      // 5. Stance classification assigns source class and authority
      // 6. Direct grounding calls handle unavailable claims
      // 7. Performance budget is maintained

      // Preservation requirements:
      // - Demo mode determinism preserved
      // - Normalization structure unchanged
      // - Scoring logic unchanged
      // - Classification logic unchanged
      // - Performance maintained

      expect(true).toBe(true); // Placeholder for documentation
    });
  });
});
