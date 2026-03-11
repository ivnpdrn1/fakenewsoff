/**
 * Score Normalizer Tests
 * 
 * Tests for score normalization utility
 */

import { normalizeSourceScores, validateSourceScores } from './scoreNormalizer';
import type { NormalizedSourceWithStance } from '../types/grounding';

describe('Score Normalizer', () => {
  describe('normalizeSourceScores', () => {
    it('should preserve valid numeric scores', () => {
      const sources: NormalizedSourceWithStance[] = [
        {
          url: 'https://example.com/1',
          title: 'Test 1',
          snippet: 'Snippet 1',
          publishDate: '2024-01-01T00:00:00Z',
          domain: 'example.com',
          score: 0.8,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
        {
          url: 'https://example.com/2',
          title: 'Test 2',
          snippet: 'Snippet 2',
          publishDate: '2024-01-01T00:00:00Z',
          domain: 'example.com',
          score: 0.5,
          stance: 'mentions',
          provider: 'gdelt',
          credibilityTier: 2,
        },
      ];

      const normalized = normalizeSourceScores(sources);

      expect(normalized[0].score).toBe(0.8);
      expect(normalized[1].score).toBe(0.5);
    });

    it('should convert null scores to 0', () => {
      const sources: any[] = [
        {
          url: 'https://example.com/1',
          title: 'Test 1',
          snippet: 'Snippet 1',
          publishDate: '2024-01-01T00:00:00Z',
          domain: 'example.com',
          score: null,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
      ];

      const normalized = normalizeSourceScores(sources);

      expect(normalized[0].score).toBe(0);
    });

    it('should convert undefined scores to 0', () => {
      const sources: any[] = [
        {
          url: 'https://example.com/1',
          title: 'Test 1',
          snippet: 'Snippet 1',
          publishDate: '2024-01-01T00:00:00Z',
          domain: 'example.com',
          score: undefined,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
      ];

      const normalized = normalizeSourceScores(sources);

      expect(normalized[0].score).toBe(0);
    });

    it('should convert NaN scores to 0', () => {
      const sources: any[] = [
        {
          url: 'https://example.com/1',
          title: 'Test 1',
          snippet: 'Snippet 1',
          publishDate: '2024-01-01T00:00:00Z',
          domain: 'example.com',
          score: NaN,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
      ];

      const normalized = normalizeSourceScores(sources);

      expect(normalized[0].score).toBe(0);
    });

    it('should convert non-numeric scores to 0', () => {
      const sources: any[] = [
        {
          url: 'https://example.com/1',
          title: 'Test 1',
          snippet: 'Snippet 1',
          publishDate: '2024-01-01T00:00:00Z',
          domain: 'example.com',
          score: 'invalid',
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
      ];

      const normalized = normalizeSourceScores(sources);

      expect(normalized[0].score).toBe(0);
    });

    it('should handle mixed valid and invalid scores', () => {
      const sources: any[] = [
        {
          url: 'https://example.com/1',
          title: 'Test 1',
          snippet: 'Snippet 1',
          publishDate: '2024-01-01T00:00:00Z',
          domain: 'example.com',
          score: 0.8,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
        {
          url: 'https://example.com/2',
          title: 'Test 2',
          snippet: 'Snippet 2',
          publishDate: '2024-01-01T00:00:00Z',
          domain: 'example.com',
          score: null,
          stance: 'mentions',
          provider: 'gdelt',
          credibilityTier: 2,
        },
        {
          url: 'https://example.com/3',
          title: 'Test 3',
          snippet: 'Snippet 3',
          publishDate: '2024-01-01T00:00:00Z',
          domain: 'example.com',
          score: undefined,
          stance: 'contradicts',
          provider: 'bing',
          credibilityTier: 3,
        },
        {
          url: 'https://example.com/4',
          title: 'Test 4',
          snippet: 'Snippet 4',
          publishDate: '2024-01-01T00:00:00Z',
          domain: 'example.com',
          score: 0.3,
          stance: 'unclear',
          provider: 'gdelt',
          credibilityTier: 1,
        },
      ];

      const normalized = normalizeSourceScores(sources);

      expect(normalized[0].score).toBe(0.8);
      expect(normalized[1].score).toBe(0);
      expect(normalized[2].score).toBe(0);
      expect(normalized[3].score).toBe(0.3);
    });

    it('should preserve zero scores', () => {
      const sources: NormalizedSourceWithStance[] = [
        {
          url: 'https://example.com/1',
          title: 'Test 1',
          snippet: 'Snippet 1',
          publishDate: '2024-01-01T00:00:00Z',
          domain: 'example.com',
          score: 0,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
      ];

      const normalized = normalizeSourceScores(sources);

      expect(normalized[0].score).toBe(0);
    });

    it('should handle empty array', () => {
      const sources: NormalizedSourceWithStance[] = [];

      const normalized = normalizeSourceScores(sources);

      expect(normalized).toEqual([]);
    });

    it('should not mutate original array', () => {
      const sources: any[] = [
        {
          url: 'https://example.com/1',
          title: 'Test 1',
          snippet: 'Snippet 1',
          publishDate: '2024-01-01T00:00:00Z',
          domain: 'example.com',
          score: null,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
      ];

      const normalized = normalizeSourceScores(sources);

      expect(sources[0].score).toBe(null);
      expect(normalized[0].score).toBe(0);
    });
  });

  describe('validateSourceScores', () => {
    it('should return true for all valid scores', () => {
      const sources: NormalizedSourceWithStance[] = [
        {
          url: 'https://example.com/1',
          title: 'Test 1',
          snippet: 'Snippet 1',
          publishDate: '2024-01-01T00:00:00Z',
          domain: 'example.com',
          score: 0.8,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
        {
          url: 'https://example.com/2',
          title: 'Test 2',
          snippet: 'Snippet 2',
          publishDate: '2024-01-01T00:00:00Z',
          domain: 'example.com',
          score: 0.5,
          stance: 'mentions',
          provider: 'gdelt',
          credibilityTier: 2,
        },
      ];

      expect(validateSourceScores(sources)).toBe(true);
    });

    it('should return false for null scores', () => {
      const sources: any[] = [
        {
          url: 'https://example.com/1',
          title: 'Test 1',
          snippet: 'Snippet 1',
          publishDate: '2024-01-01T00:00:00Z',
          domain: 'example.com',
          score: null,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
      ];

      expect(validateSourceScores(sources)).toBe(false);
    });

    it('should return false for undefined scores', () => {
      const sources: any[] = [
        {
          url: 'https://example.com/1',
          title: 'Test 1',
          snippet: 'Snippet 1',
          publishDate: '2024-01-01T00:00:00Z',
          domain: 'example.com',
          score: undefined,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
      ];

      expect(validateSourceScores(sources)).toBe(false);
    });

    it('should return false for NaN scores', () => {
      const sources: any[] = [
        {
          url: 'https://example.com/1',
          title: 'Test 1',
          snippet: 'Snippet 1',
          publishDate: '2024-01-01T00:00:00Z',
          domain: 'example.com',
          score: NaN,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
      ];

      expect(validateSourceScores(sources)).toBe(false);
    });

    it('should return true for empty array', () => {
      const sources: NormalizedSourceWithStance[] = [];

      expect(validateSourceScores(sources)).toBe(true);
    });
  });
});
