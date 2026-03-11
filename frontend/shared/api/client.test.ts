/**
 * API Client Tests
 * 
 * Tests for the health check functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally before importing the module
global.fetch = vi.fn();

describe('checkApiHealth', () => {
  let checkApiHealth: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset modules to clear cached runtime config
    vi.resetModules();
    
    // Re-import the module to get fresh state
    const module = await import('./client.js');
    checkApiHealth = module.checkApiHealth;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return healthy status when backend and grounding are ok', async () => {
    // Mock config.json load (first call)
    // Mock successful health check (second call)
    // Mock successful grounding health check (third call)
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: false, // config.json not found, will use fallback
        json: async () => ({})
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok', demo_mode: false })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          bing_configured: true,
          gdelt_configured: true,
          timeout_ms: 5000,
          cache_ttl_seconds: 3600,
          provider_enabled: true,
          provider_order: ['bing', 'gdelt']
        })
      });

    const result = await checkApiHealth();

    expect(result.status).toBe('healthy');
    expect(result.message).toBe('All systems operational');
    expect(result.backend.available).toBe(true);
    expect(result.grounding?.enabled).toBe(true);
    expect(result.grounding?.providers.bing).toBe(true);
    expect(result.grounding?.providers.gdelt).toBe(true);
  });

  it('should return degraded status when backend is ok but grounding is disabled', async () => {
    // Mock config.json load
    // Mock successful health check
    // Mock grounding disabled
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({})
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok', demo_mode: false })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: false,
          bing_configured: false,
          gdelt_configured: false,
          timeout_ms: 5000,
          cache_ttl_seconds: 3600,
          provider_enabled: false,
          provider_order: []
        })
      });

    const result = await checkApiHealth();

    expect(result.status).toBe('degraded');
    expect(result.message).toBe('Backend is healthy but grounding is disabled');
    expect(result.backend.available).toBe(true);
    expect(result.grounding?.enabled).toBe(false);
  });

  it('should return unhealthy status when backend is unreachable', async () => {
    // Mock config.json load
    // Mock network error for health check
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({})
      })
      .mockRejectedValueOnce(new Error('Network error'));

    const result = await checkApiHealth();

    expect(result.status).toBe('unhealthy');
    expect(result.message).toContain('Backend unreachable');
    expect(result.backend.available).toBe(false);
    expect(result.grounding).toBeUndefined();
  });

  it('should return degraded status when grounding check fails but backend is ok', async () => {
    // Mock config.json load
    // Mock successful health check
    // Mock grounding check failure
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({})
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok', demo_mode: false })
      })
      .mockRejectedValueOnce(new Error('Grounding check failed'));

    const result = await checkApiHealth();

    expect(result.status).toBe('degraded');
    expect(result.message).toBe('Backend is healthy but grounding status unknown');
    expect(result.backend.available).toBe(true);
    expect(result.grounding).toBeUndefined();
  });

  it('should return degraded status when only Bing is configured', async () => {
    // Mock config.json load
    // Mock successful health check
    // Mock only Bing configured
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({})
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok', demo_mode: false })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: false,
          bing_configured: true,
          gdelt_configured: false,
          timeout_ms: 5000,
          cache_ttl_seconds: 3600,
          provider_enabled: true,
          provider_order: ['bing']
        })
      });

    const result = await checkApiHealth();

    expect(result.status).toBe('degraded');
    expect(result.message).toBe('Backend is healthy but GDELT grounding is not configured');
    expect(result.backend.available).toBe(true);
    expect(result.grounding?.enabled).toBe(true);
    expect(result.grounding?.providers.bing).toBe(true);
    expect(result.grounding?.providers.gdelt).toBe(false);
  });
});


describe('analyzeContent retry logic', () => {
  let analyzeContent: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Re-import the module to get fresh state
    const module = await import('./client.js');
    analyzeContent = module.analyzeContent;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should NOT retry validation errors (4xx)', async () => {
    // Mock config.json load
    // Mock 400 error
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({})
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: {
          get: (name: string) => name === 'content-type' ? 'application/json' : null
        },
        json: async () => ({ error: 'Bad request' })
      });

    const result = await analyzeContent({ text: 'Test claim' });

    expect(result.success).toBe(false);
    expect(result.error.type).toBe('server');
    expect(result.error.statusCode).toBe(400);
    
    // Should have made only 2 fetch calls: 1 config + 1 attempt (no retries)
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should NOT retry timeout errors', async () => {
    // Mock config.json load
    // Mock timeout (AbortError)
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({})
      })
      .mockRejectedValueOnce(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));

    const result = await analyzeContent({ text: 'Test claim' });

    expect(result.success).toBe(false);
    expect(result.error.type).toBe('timeout');
    
    // Should have made only 2 fetch calls: 1 config + 1 attempt (no retries)
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
