/**
 * Tests for Stance Classifier
 * 
 * Validates semantic equivalence detection for dates and factual statements,
 * and explicit confirmation pattern detection for trusted sources.
 */

import { describe, it, expect } from '@jest/globals';
import { classifyStance } from './stanceClassifier';

describe('StanceClassifier', () => {
  describe('Explicit Confirmation Patterns - Trusted Sources', () => {
    it('should classify BBC invasion confirmation as supports', () => {
      const claim = 'Russia invaded Ukraine in February 2022';
      const title = "Why did Putin's Russia invade Ukraine and how could the war end?";
      const snippet = 'When Russian President Vladimir Putin ordered up to 200,000 soldiers into Ukraine on 24 February 2022...';
      const domain = 'bbc.com';

      const result = classifyStance(claim, title, snippet, domain);

      expect(result.stance).toBe('supports');
      expect(result.confidence).toBeGreaterThanOrEqual(0.80);
    });

    it('should classify Reuters invasion reference as supports', () => {
      const claim = 'Russia invaded Ukraine in February 2022';
      const title = 'Echoes of 2022? Markets look back to Russia play book for Middle East conflict';
      const snippet = "...look back to Russia's invasion of Ukraine...";
      const domain = 'reuters.com';

      const result = classifyStance(claim, title, snippet, domain);

      expect(result.stance).toBe('supports');
      expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    });

    it('should classify Reuters invasion of Ukraine phrase as supports', () => {
      const claim = 'Russia invaded Ukraine in February 2022';
      const title = 'Markets look back to Russia playbook';
      const snippet = "Markets look back to Russia's invasion of Ukraine in 2022";
      const domain = 'reuters.com';

      const result = classifyStance(claim, title, snippet, domain);

      expect(result.stance).toBe('supports');
      expect(result.confidence).toBeGreaterThanOrEqual(0.80);
    });

    it('should classify NPR all-out invasion as supports', () => {
      const claim = 'Russia invaded Ukraine in February 2022';
      const title = 'Ukraine Conflict Analysis';
      const snippet = 'When the Kremlin launched its all-out invasion of Ukraine in 2022...';
      const domain = 'npr.org';

      const result = classifyStance(claim, title, snippet, domain);

      expect(result.stance).toBe('supports');
      expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    });

    it('should classify AP News invasion with exact date as supports', () => {
      const claim = 'Russia invaded Ukraine in February 2022';
      const title = 'Russia Invades Ukraine';
      const snippet = 'Russia launched a full-scale invasion of Ukraine on February 24, 2022';
      const domain = 'apnews.com';

      const result = classifyStance(claim, title, snippet, domain);

      expect(result.stance).toBe('supports');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('should give trusted sources higher confidence', () => {
      const claim = 'Russia invaded Ukraine in February 2022';
      const title = 'Russia Invades Ukraine';
      const snippet = 'Russia invaded Ukraine on February 24, 2022';
      
      const trustedResult = classifyStance(claim, title, snippet, 'reuters.com');
      const untrustedResult = classifyStance(claim, title, snippet, 'unknown-blog.com');

      expect(trustedResult.stance).toBe('supports');
      expect(untrustedResult.stance).toBe('supports');
      expect(trustedResult.confidence).toBeGreaterThan(untrustedResult.confidence);
    });
  });

  describe('Explicit Confirmation Patterns - Event Verb Matching', () => {
    it('should match "ordered troops into" as invasion confirmation', () => {
      const claim = 'Russia invaded Ukraine in February 2022';
      const title = 'Putin Orders Military Action';
      const snippet = 'Putin ordered troops into Ukraine in February 2022';

      const result = classifyStance(claim, title, snippet);

      expect(result.stance).toBe('supports');
      expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    });

    it('should match "launched invasion" as invasion confirmation', () => {
      const claim = 'Russia invaded Ukraine in February 2022';
      const title = 'Russia Launches Invasion';
      const snippet = 'Russia launched an invasion of Ukraine in February 2022';

      const result = classifyStance(claim, title, snippet);

      expect(result.stance).toBe('supports');
      expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    });

    it('should match "full-scale invasion" as invasion confirmation', () => {
      const claim = 'Russia invaded Ukraine in February 2022';
      const title = 'Full-Scale War Begins';
      const snippet = 'Russia began a full-scale invasion of Ukraine in February 2022';

      const result = classifyStance(claim, title, snippet);

      expect(result.stance).toBe('supports');
      expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    });
  });

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

  describe('Contextual Evidence - Regression Guards', () => {
    it('should classify contextual-only evidence as mentions or unclear', () => {
      const claim = 'Russia invaded Ukraine in February 2022';
      const title = 'Ukraine Conflict Background';
      const snippet = 'The Ukraine conflict has historical roots in regional tensions';

      const result = classifyStance(claim, title, snippet);

      // Should NOT be classified as supports
      expect(result.stance).not.toBe('supports');
      expect(['mentions', 'unclear']).toContain(result.stance);
    });

    it('should not classify generic war discussion as supports', () => {
      const claim = 'Russia invaded Ukraine in February 2022';
      const title = 'Ongoing Ukraine War Analysis';
      const snippet = 'A report discussed ongoing developments in the Ukraine war';

      const result = classifyStance(claim, title, snippet);

      // Should be mentions, not supports
      expect(result.stance).not.toBe('supports');
      expect(['mentions', 'unclear']).toContain(result.stance);
    });

    it('should require event confirmation even from trusted sources', () => {
      const claim = 'Russia invaded Ukraine in February 2022';
      const title = 'Ukraine Economic Impact';
      const snippet = 'The economic impact on Ukraine has been significant';
      const domain = 'reuters.com';

      const result = classifyStance(claim, title, snippet, domain);

      // Trusted domain alone is not enough - need event confirmation
      expect(result.stance).not.toBe('supports');
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
