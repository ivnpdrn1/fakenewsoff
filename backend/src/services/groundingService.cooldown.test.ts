/**
 * Provider Cooldown Tracking Tests
 * 
 * Tests for Task 3.2: Provider cooldown tracking in groundingService
 */

import { getGroundingService, resetGroundingService, getProviderCooldown, setProviderCooldown } from './groundingService';

describe('Provider Cooldown Tracking', () => {
  beforeEach(() => {
    resetGroundingService();
  });

  afterEach(() => {
    resetGroundingService();
  });

  test('should set and get provider cooldown', () => {
    const provider = 'mediastack';
    const reason = 'rate_limit';
    const durationMs = 5 * 60 * 1000; // 5 minutes

    // Set cooldown
    setProviderCooldown(provider, reason, durationMs);

    // Get cooldown
    const cooldown = getProviderCooldown(provider);

    expect(cooldown).toBeDefined();
    expect(cooldown?.reason).toBe(reason);
    expect(cooldown?.until).toBeGreaterThan(Date.now());
    expect(cooldown?.until).toBeLessThanOrEqual(Date.now() + durationMs + 100); // Allow 100ms tolerance
  });

  test('should return undefined for provider without cooldown', () => {
    const cooldown = getProviderCooldown('bing');
    expect(cooldown).toBeUndefined();
  });

  test('should expire cooldown after duration', async () => {
    const provider = 'gdelt';
    const reason = 'quota_exceeded';
    const durationMs = 100; // 100ms for fast test

    // Set cooldown
    setProviderCooldown(provider, reason, durationMs);

    // Cooldown should be active
    let cooldown = getProviderCooldown(provider);
    expect(cooldown).toBeDefined();
    expect(cooldown?.reason).toBe(reason);

    // Wait for cooldown to expire
    await new Promise(resolve => setTimeout(resolve, durationMs + 50));

    // Cooldown should be expired
    cooldown = getProviderCooldown(provider);
    expect(cooldown).toBeUndefined();
  });

  test('should track multiple provider cooldowns independently', () => {
    // Set cooldowns for different providers
    setProviderCooldown('mediastack', 'rate_limit', 5 * 60 * 1000);
    setProviderCooldown('bing', 'throttled', 2 * 60 * 1000);
    setProviderCooldown('gdelt', 'quota_exceeded', 3 * 60 * 1000);

    // Check each cooldown
    const mediastackCooldown = getProviderCooldown('mediastack');
    const bingCooldown = getProviderCooldown('bing');
    const gdeltCooldown = getProviderCooldown('gdelt');

    expect(mediastackCooldown?.reason).toBe('rate_limit');
    expect(bingCooldown?.reason).toBe('throttled');
    expect(gdeltCooldown?.reason).toBe('quota_exceeded');
  });

  test('should update cooldown when set again for same provider', () => {
    const provider = 'mediastack';

    // Set initial cooldown
    setProviderCooldown(provider, 'rate_limit', 5 * 60 * 1000);
    const firstCooldown = getProviderCooldown(provider);
    expect(firstCooldown?.reason).toBe('rate_limit');

    // Update cooldown with different reason
    setProviderCooldown(provider, 'quota_exceeded', 2 * 60 * 1000);
    const secondCooldown = getProviderCooldown(provider);
    expect(secondCooldown?.reason).toBe('quota_exceeded');
    expect(secondCooldown?.until).not.toBe(firstCooldown?.until);
  });

  test('should use correct cooldown durations for different error types', () => {
    const rateLimitDuration = 5 * 60 * 1000; // 5 minutes
    const quotaDuration = 2 * 60 * 1000; // 2 minutes

    // Set rate-limit cooldown
    setProviderCooldown('mediastack', 'rate_limit', rateLimitDuration);
    const rateLimitCooldown = getProviderCooldown('mediastack');
    expect(rateLimitCooldown?.until).toBeGreaterThan(Date.now() + rateLimitDuration - 100);

    // Set quota cooldown
    setProviderCooldown('bing', 'quota_exceeded', quotaDuration);
    const quotaCooldown = getProviderCooldown('bing');
    expect(quotaCooldown?.until).toBeGreaterThan(Date.now() + quotaDuration - 100);
    expect(quotaCooldown?.until).toBeLessThan(rateLimitCooldown!.until);
  });
});
