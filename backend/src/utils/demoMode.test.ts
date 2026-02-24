/**
 * Unit Tests for Demo Mode Utilities
 */

import {
  isDemoMode,
  getDemoResponse,
  getDemoResponseForContent,
  getDemoConfig,
  demoDelay
} from './demoMode';

describe('demoMode', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isDemoMode', () => {
    it('should return false when DEMO_MODE is not set', () => {
      delete process.env.DEMO_MODE;
      expect(isDemoMode()).toBe(false);
    });

    it('should return true when DEMO_MODE is true', () => {
      process.env.DEMO_MODE = 'true';
      expect(isDemoMode()).toBe(true);
    });

    it('should return false when DEMO_MODE is false', () => {
      process.env.DEMO_MODE = 'false';
      expect(isDemoMode()).toBe(false);
    });
  });

  describe('getDemoResponse', () => {
    it('should return supported response', () => {
      const response = getDemoResponse('supported');
      
      expect(response.status_label).toBe('Supported');
      expect(response.confidence_score).toBe(85);
      expect(response.sources.length).toBeGreaterThan(0);
      expect(response.misinformation_type).toBeNull();
      expect(response.recommendation).toContain('supported');
    });

    it('should return disputed response', () => {
      const response = getDemoResponse('disputed');
      
      expect(response.status_label).toBe('Disputed');
      expect(response.confidence_score).toBe(75);
      expect(response.sources.length).toBeGreaterThan(0);
      expect(response.misinformation_type).toBe('Misleading Content');
      expect(response.media_risk).toBe('medium');
    });

    it('should return unverified response', () => {
      const response = getDemoResponse('unverified');
      
      expect(response.status_label).toBe('Unverified');
      expect(response.confidence_score).toBe(30);
      expect(response.sources.length).toBe(0);
      expect(response.misinformation_type).toBeNull();
    });

    it('should return manipulated response', () => {
      const response = getDemoResponse('manipulated');
      
      expect(response.status_label).toBe('Manipulated');
      expect(response.confidence_score).toBe(90);
      expect(response.misinformation_type).toBe('Manipulated Content');
      expect(response.media_risk).toBe('high');
    });

    it('should return biased response', () => {
      const response = getDemoResponse('biased');
      
      expect(response.status_label).toBe('Biased framing');
      expect(response.confidence_score).toBe(70);
      expect(response.misinformation_type).toBe('Misleading Content');
      expect(response.media_risk).toBe('low');
    });

    it('should include all required fields', () => {
      const response = getDemoResponse('supported');
      
      expect(response.request_id).toBeDefined();
      expect(response.status_label).toBeDefined();
      expect(response.confidence_score).toBeDefined();
      expect(response.recommendation).toBeDefined();
      expect(response.progress_stages).toBeDefined();
      expect(response.sources).toBeDefined();
      expect(response.sift_guidance).toBeDefined();
      expect(response.timestamp).toBeDefined();
    });

    it('should accept custom request ID', () => {
      const customId = 'custom-test-123';
      const response = getDemoResponse('supported', customId);
      
      expect(response.request_id).toBe(customId);
    });
  });

  describe('getDemoResponseForContent', () => {
    it('should return manipulated for fake content', () => {
      const response = getDemoResponseForContent('This is a fake image');
      expect(response.status_label).toBe('Manipulated');
    });

    it('should return disputed for false claims', () => {
      const response = getDemoResponseForContent('This claim is false and debunked');
      expect(response.status_label).toBe('Disputed');
    });

    it('should return biased for biased content', () => {
      const response = getDemoResponseForContent('This shows selective framing and bias');
      expect(response.status_label).toBe('Biased framing');
    });

    it('should return supported for verified content', () => {
      const response = getDemoResponseForContent('This has been verified and confirmed');
      expect(response.status_label).toBe('Supported');
    });

    it('should return unverified for neutral content', () => {
      const response = getDemoResponseForContent('Some random claim');
      expect(response.status_label).toBe('Unverified');
    });

    it('should be case insensitive', () => {
      const response1 = getDemoResponseForContent('FAKE NEWS');
      const response2 = getDemoResponseForContent('fake news');
      
      expect(response1.status_label).toBe(response2.status_label);
    });
  });

  describe('getDemoConfig', () => {
    it('should return default config when no env vars set', () => {
      delete process.env.DEMO_MODE;
      delete process.env.DEMO_DELAY;
      delete process.env.DEMO_LOG;
      
      const config = getDemoConfig();
      
      expect(config.enabled).toBe(false);
      expect(config.responseDelay).toBe(500);
      expect(config.logRequests).toBe(false);
    });

    it('should respect DEMO_MODE env var', () => {
      process.env.DEMO_MODE = 'true';
      
      const config = getDemoConfig();
      
      expect(config.enabled).toBe(true);
    });

    it('should respect DEMO_DELAY env var', () => {
      process.env.DEMO_DELAY = '1000';
      
      const config = getDemoConfig();
      
      expect(config.responseDelay).toBe(1000);
    });

    it('should respect DEMO_LOG env var', () => {
      process.env.DEMO_LOG = 'true';
      
      const config = getDemoConfig();
      
      expect(config.logRequests).toBe(true);
    });
  });

  describe('demoDelay', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should delay when demo mode is enabled', async () => {
      process.env.DEMO_MODE = 'true';
      process.env.DEMO_DELAY = '100';
      
      const promise = demoDelay();
      
      expect(promise).toBeInstanceOf(Promise);
      
      jest.advanceTimersByTime(100);
      await promise;
    });

    it('should not delay when demo mode is disabled', async () => {
      process.env.DEMO_MODE = 'false';
      
      const promise = demoDelay();
      
      // Should resolve immediately
      await promise;
    });

    it('should accept custom delay', async () => {
      process.env.DEMO_MODE = 'true';
      
      const promise = demoDelay(200);
      
      jest.advanceTimersByTime(200);
      await promise;
    });

    it('should not delay when delay is 0', async () => {
      process.env.DEMO_MODE = 'true';
      process.env.DEMO_DELAY = '0';
      
      const promise = demoDelay();
      
      // Should resolve immediately
      await promise;
    });
  });
});
