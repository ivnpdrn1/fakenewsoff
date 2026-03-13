/**
 * Query Builder Tests
 */

import { generateQueries } from './queryBuilder';

describe('Query Builder', () => {
  describe('generateQueries', () => {
    it('should generate multiple queries for news-style claims', () => {
      const result = generateQueries('Russia Ukraine war latest news');

      expect(result.queries.length).toBeGreaterThanOrEqual(3);
      expect(result.queries.length).toBeLessThanOrEqual(6);
      
      // Should include original claim
      expect(result.queries.some(q => q.includes('Russia') && q.includes('Ukraine'))).toBe(true);
      
      // Should include news-focused variants
      const hasNewsVariant = result.queries.some(q => 
        q.includes('news') || q.includes('latest') || q.includes('updates')
      );
      expect(hasNewsVariant).toBe(true);
    });

    it('should generate queries for ongoing conflict claims', () => {
      const result = generateQueries('The war in Ukraine continues');

      expect(result.queries.length).toBeGreaterThanOrEqual(3);
      
      // Should extract entities
      expect(result.metadata.entitiesExtracted.length).toBeGreaterThan(0);
      
      // Should include Ukraine in queries
      expect(result.queries.some(q => q.toLowerCase().includes('ukraine'))).toBe(true);
    });

    it('should generate queries for ceasefire talks', () => {
      const result = generateQueries('Israel Hamas ceasefire talks');

      expect(result.queries.length).toBeGreaterThanOrEqual(3);
      
      // Should include entities
      expect(result.queries.some(q => q.includes('Israel') || q.includes('Hamas'))).toBe(true);
      
      // Should include news variants
      expect(result.queries.some(q => q.includes('news') || q.includes('latest'))).toBe(true);
    });

    it('should generate queries for tech announcements', () => {
      const result = generateQueries('OpenAI releases new AI model');

      expect(result.queries.length).toBeGreaterThanOrEqual(3);
      
      // Should include OpenAI in queries (even if not extracted as entity)
      expect(result.queries.some(q => q.includes('OpenAI'))).toBe(true);
      
      // Should include news-focused queries
      expect(result.queries.some(q => q.includes('releases') || q.includes('model'))).toBe(true);
    });

    it('should generate queries for economic news', () => {
      const result = generateQueries('US inflation rate increases');

      expect(result.queries.length).toBeGreaterThanOrEqual(3);
      
      // Should include key economic terms
      expect(result.queries.some(q => 
        q.toLowerCase().includes('inflation') || q.toLowerCase().includes('rate')
      )).toBe(true);
    });

    it('should deduplicate similar queries', () => {
      const result = generateQueries('Russia Ukraine war news');

      // Check for duplicates (case-insensitive)
      const lowerQueries = result.queries.map(q => q.toLowerCase());
      const uniqueQueries = new Set(lowerQueries);
      
      expect(uniqueQueries.size).toBe(result.queries.length);
    });

    it('should always generate at least 3 queries', () => {
      const shortClaim = 'War continues';
      const result = generateQueries(shortClaim);

      expect(result.queries.length).toBeGreaterThanOrEqual(3);
    });

    it('should cap queries at 6', () => {
      const longClaim = 'The ongoing conflict between Russia and Ukraine continues with latest news reports indicating ceasefire talks';
      const result = generateQueries(longClaim);

      expect(result.queries.length).toBeLessThanOrEqual(6);
    });
  });
});
