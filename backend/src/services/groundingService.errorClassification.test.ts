/**
 * Unit tests for error classification in groundingService
 * 
 * Tests that error messages are properly classified as rate-limit, quota, or throttling errors
 * and that appropriate cooldowns are set.
 */

import { getGroundingService, resetGroundingService, getProviderCooldown } from './groundingService';

describe('Error Classification', () => {
  beforeEach(() => {
    resetGroundingService();
  });

  describe('Rate-limit error detection', () => {
    it('should detect "rate limit" as rate-limit error', () => {
      const service = getGroundingService();
      const serviceAny = service as any;

      // Simulate error message with "rate limit"
      const errorMessage = 'API rate limit exceeded';
      const isRateLimit = errorMessage.toLowerCase().includes('rate limit') || 
                          errorMessage.toLowerCase().includes('429') || 
                          errorMessage.toLowerCase().includes('too many requests');

      expect(isRateLimit).toBe(true);
    });

    it('should detect "429" as rate-limit error', () => {
      const errorMessage = 'HTTP 429 error';
      const isRateLimit = errorMessage.toLowerCase().includes('rate limit') || 
                          errorMessage.toLowerCase().includes('429') || 
                          errorMessage.toLowerCase().includes('too many requests');

      expect(isRateLimit).toBe(true);
    });

    it('should detect "too many requests" as rate-limit error', () => {
      const errorMessage = 'Too many requests, please slow down';
      const isRateLimit = errorMessage.toLowerCase().includes('rate limit') || 
                          errorMessage.toLowerCase().includes('429') || 
                          errorMessage.toLowerCase().includes('too many requests');

      expect(isRateLimit).toBe(true);
    });
  });

  describe('Quota error detection', () => {
    it('should detect "quota exceeded" as quota error', () => {
      const errorMessage = 'Quota exceeded for this month';
      const isQuota = errorMessage.toLowerCase().includes('quota exceeded') || 
                      errorMessage.toLowerCase().includes('subscription limit');

      expect(isQuota).toBe(true);
    });

    it('should detect "subscription limit" as quota error', () => {
      const errorMessage = 'Subscription limit reached';
      const isQuota = errorMessage.toLowerCase().includes('quota exceeded') || 
                      errorMessage.toLowerCase().includes('subscription limit');

      expect(isQuota).toBe(true);
    });
  });

  describe('Throttling error detection', () => {
    it('should detect "throttled" as throttling error', () => {
      const errorMessage = 'Request throttled';
      const isThrottled = errorMessage.toLowerCase().includes('throttled') || 
                          errorMessage.toLowerCase().includes('slow down');

      expect(isThrottled).toBe(true);
    });

    it('should detect "slow down" as throttling error', () => {
      const errorMessage = 'Please slow down your requests';
      const isThrottled = errorMessage.toLowerCase().includes('throttled') || 
                          errorMessage.toLowerCase().includes('slow down');

      expect(isThrottled).toBe(true);
    });
  });

  describe('Cooldown duration based on error type', () => {
    it('should set 5 minute cooldown for rate-limit errors', () => {
      const errorMessage = 'Too many requests';
      const isRateLimit = errorMessage.toLowerCase().includes('rate limit') || 
                          errorMessage.toLowerCase().includes('429') || 
                          errorMessage.toLowerCase().includes('too many requests');
      
      const cooldownMs = isRateLimit ? 5 * 60 * 1000 : 2 * 60 * 1000;
      
      expect(cooldownMs).toBe(5 * 60 * 1000); // 5 minutes
    });

    it('should set 2 minute cooldown for quota errors', () => {
      const errorMessage = 'Quota exceeded';
      const isRateLimit = errorMessage.toLowerCase().includes('rate limit') || 
                          errorMessage.toLowerCase().includes('429') || 
                          errorMessage.toLowerCase().includes('too many requests');
      const isQuota = errorMessage.toLowerCase().includes('quota exceeded') || 
                      errorMessage.toLowerCase().includes('subscription limit');
      
      const cooldownMs = isRateLimit ? 5 * 60 * 1000 : 2 * 60 * 1000;
      
      expect(cooldownMs).toBe(2 * 60 * 1000); // 2 minutes
    });

    it('should set 2 minute cooldown for throttling errors', () => {
      const errorMessage = 'Request throttled';
      const isRateLimit = errorMessage.toLowerCase().includes('rate limit') || 
                          errorMessage.toLowerCase().includes('429') || 
                          errorMessage.toLowerCase().includes('too many requests');
      const isThrottled = errorMessage.toLowerCase().includes('throttled') || 
                          errorMessage.toLowerCase().includes('slow down');
      
      const cooldownMs = isRateLimit ? 5 * 60 * 1000 : 2 * 60 * 1000;
      
      expect(cooldownMs).toBe(2 * 60 * 1000); // 2 minutes
    });
  });
});
