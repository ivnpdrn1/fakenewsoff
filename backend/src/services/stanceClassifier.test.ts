/**
 * Tests for Stance Classifier
 * 
 * Validates semantic equivalence detection for dates and factual statements
 */

import { describe, it, expect } from '@jest/globals';
import { classifyStance } from './stanceClassifier';

describe('StanceClassifier', () => {
  describe('Date Semantic Equivalence', () => {
    it('should classify exact date as supporting month-level claim', () => {
      const claim = 'Russia invaded Ukraine in February 2022';
      const title = 'Russia Invades Ukraine';
      const snippet = 'Russia invaded Ukraine on February 24, 2022';

      const result = classifyStance(claim, title, snippet);

      expect(result.stance).toBe('supports');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should support abbreviated month format', () => {
      const claim = 'Russia invaded Ukraine in February 2022';
      const title = 'Russia Invades Ukraine';
      const snippet = 'Russia invaded Ukraine on Feb. 24, 2022';

      const result = classifyStance(claim, title, snippet);

      expect(result.stance).toBe('supports');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should support abbreviated month without period', () => {
      const claim = 'Russia invaded Ukraine in February 2022';
      const title = 'Russia Invades Ukraine';
      const snippet = 'Russia invaded Ukraine on Feb 24, 2022';

      const result = classifyStance(claim, title, snippet);

      expect(result.stance).toBe('supports');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should support additional context in evidence', () => {
      const claim = 'Russia invaded Ukraine in February 2022';
      const title = 'Russia Invades Ukraine';
      const snippet = 'Russia invaded its neighbor Ukraine on February 24, 2022';

      const result = classifyStance(claim, title, snippet);

      expect(result.stance).toBe('supports');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should support different date formats', () => {
      const claim = 'Russia invaded Ukraine in February 2022';
      const title = 'Russia Invades Ukraine';
      const snippet = 'On 24 February 2022, Russia invaded Ukraine';

      const result = classifyStance(claim, title, snippet);

      expect(result.stance).toBe('supports');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe('Explicit Support Keywords', () => {
    it('should detect explicit confirmation keywords', () => {
      const claim = 'Climate change is real';
      const title = 'Scientists Confirm Climate Change';
      const snippet = 'Scientists confirm that climate change is real and verified by data';

      const result = classifyStance(claim, title, snippet);

      expect(result.stance).toBe('supports');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe('Contradiction Detection', () => {
    it('should detect contradiction keywords', () => {
      const claim = 'The moon landing was fake';
      const title = 'Moon Landing Hoax Debunked';
      const snippet = 'Scientists debunk and disprove moon landing hoax claims';

      const result = classifyStance(claim, title, snippet);

      expect(result.stance).toBe('contradicts');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe('Contextual Evidence', () => {
    it('should classify contextual-only evidence as mentions or unclear', () => {
      const claim = 'Russia invaded Ukraine in February 2022';
      const title = 'Ukraine Conflict Background';
      const snippet = 'The Ukraine conflict has historical roots in regional tensions';

      const result = classifyStance(claim, title, snippet);

      // Should NOT be classified as supports
      expect(result.stance).not.toBe('supports');
      expect(['mentions', 'unclear']).toContain(result.stance);
    });
  });

  describe('Unrelated Evidence', () => {
    it('should classify unrelated evidence as unclear', () => {
      const claim = 'Russia invaded Ukraine in February 2022';
      const title = 'Stock Market Update';
      const snippet = 'Stock markets showed volatility today';

      const result = classifyStance(claim, title, snippet);

      expect(result.stance).toBe('unclear');
    });
  });

  describe('Edge Cases', () => {
    it('should handle different year (no support)', () => {
      const claim = 'Russia invaded Ukraine in February 2022';
      const title = 'Historical Conflict';
      const snippet = 'Russia invaded Ukraine in February 2014';

      const result = classifyStance(claim, title, snippet);

      // Different year should not be classified as supports
      expect(result.stance).not.toBe('supports');
    });

    it('should handle different month (no support)', () => {
      const claim = 'Russia invaded Ukraine in February 2022';
      const title = 'Conflict Timeline';
      const snippet = 'Russia invaded Ukraine in March 2022';

      const result = classifyStance(claim, title, snippet);

      // Different month should not be classified as supports
      expect(result.stance).not.toBe('supports');
    });
  });
});
