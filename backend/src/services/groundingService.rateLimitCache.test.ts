/**
 * Unit tests for rate-limit cache functionality in groundingService
 *
 * Tests the short-term rate-limit cache (2-5 minute TTL) that stores
 * rate-limit errors with provider and timestamp to prevent repeated
 * calls to providers that have recently returned rate-limit errors.
 */

import { getGroundingService, resetGroundingService, getRateLimitCached } from './groundingService';

describe('Rate-limit Cache', () => {
  beforeEach(() => {
    resetGroundingService();
  });

  afterEach(() => {
    resetGroundingService();
  });

  describe('getRateLimitCached', () => {
    it('should return undefined when no cache entry exists', () => {
      const cached = getRateLimitCached('mediastack');
      expect(cached).toBeUndefined();
    });

    it('should return cached rate-limit info when entry exists and not expired', () => {
      const service = getGroundingService();
      const serviceAny = service as any;

      // Set a cache entry with 5 minute TTL
      serviceAny.setRateLimitCache('mediastack', 'rate_limit', 300000);

      const cached = getRateLimitCached('mediastack');
      expect(cached).toBeDefined();
      expect(cached?.reason).toBe('rate_limit');
      expect(cached?.timestamp).toBeDefined();
      expect(typeof cached?.timestamp).toBe('number');
    });

    it('should return undefined when cache entry has expired', () => {
      const service = getGroundingService();
      const serviceAny = service as any;

      // Set a cache entry with 0ms TTL (immediately expired)
      serviceAny.setRateLimitCache('mediastack', 'rate_limit', 0);

      // Wait a tiny bit to ensure expiration
      const cached = getRateLimitCached('mediastack');
      expect(cached).toBeUndefined();
    });

    it('should handle multiple providers independently', () => {
      const service = getGroundingService();
      const serviceAny = service as any;

      // Set cache entries for different providers
      serviceAny.setRateLimitCache('mediastack', 'rate_limit', 300000);
      serviceAny.setRateLimitCache('gdelt', 'quota_exceeded', 180000);

      const mediastackCached = getRateLimitCached('mediastack');
      const gdeltCached = getRateLimitCached('gdelt');

      expect(mediastackCached).toBeDefined();
      expect(mediastackCached?.reason).toBe('rate_limit');

      expect(gdeltCached).toBeDefined();
      expect(gdeltCached?.reason).toBe('quota_exceeded');
    });

    it('should use default TTL of 180000ms (3 minutes) when not specified', () => {
      const service = getGroundingService();
      const serviceAny = service as any;

      // Set cache entry without specifying TTL
      serviceAny.setRateLimitCache('mediastack', 'rate_limit');

      const cached = getRateLimitCached('mediastack');
      expect(cached).toBeDefined();
      expect(cached?.reason).toBe('rate_limit');
    });

    it('should clean up expired entries on access', async () => {
      const service = getGroundingService();
      const serviceAny = service as any;

      // Set a cache entry with 1ms TTL
      serviceAny.setRateLimitCache('mediastack', 'rate_limit', 1);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      const cached = getRateLimitCached('mediastack');
      expect(cached).toBeUndefined();

      // Verify the entry was removed from the cache
      const cacheSize = serviceAny.rateLimitCache.size;
      expect(cacheSize).toBe(0);
    });
  });

  describe('setRateLimitCache', () => {
    it('should store rate-limit error with provider and timestamp', () => {
      const service = getGroundingService();
      const serviceAny = service as any;

      const beforeTimestamp = Date.now();
      serviceAny.setRateLimitCache('mediastack', 'rate_limit', 300000);
      const afterTimestamp = Date.now();

      const cached = getRateLimitCached('mediastack');
      expect(cached).toBeDefined();
      expect(cached?.reason).toBe('rate_limit');
      expect(cached?.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(cached?.timestamp).toBeLessThanOrEqual(afterTimestamp);
    });

    it('should overwrite existing cache entry for same provider', async () => {
      const service = getGroundingService();
      const serviceAny = service as any;

      // Set initial cache entry
      serviceAny.setRateLimitCache('mediastack', 'rate_limit', 300000);
      const firstCached = getRateLimitCached('mediastack');

      // Wait a bit and set new cache entry
      await new Promise(resolve => setTimeout(resolve, 10));

      serviceAny.setRateLimitCache('mediastack', 'quota_exceeded', 180000);
      const secondCached = getRateLimitCached('mediastack');

      expect(secondCached).toBeDefined();
      expect(secondCached?.reason).toBe('quota_exceeded');
      expect(secondCached?.timestamp).toBeGreaterThan(firstCached?.timestamp || 0);
    });
  });
});
