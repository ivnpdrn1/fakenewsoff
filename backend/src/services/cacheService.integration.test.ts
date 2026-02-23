/**
 * Integration Tests for Cache Service Logger
 * 
 * Verifies that the logger wrapper correctly routes logs based on NODE_ENV:
 * - In test mode: Logs to event buffer
 * - In production mode: Logs to console
 */

import { checkCache, storeInCache, __getTestEvents, __resetTestEvents } from './cacheService';
import { AnalysisRequest } from '../utils/dynamodb';
import { AnalysisResponse } from '../utils/schemaValidators';
import * as dynamodb from '../utils/dynamodb';
import * as hash from '../utils/hash';

// Mock the dynamodb and hash modules
jest.mock('../utils/dynamodb');
jest.mock('../utils/hash');

describe('Cache Service Logger Integration', () => {
  const mockRequest: AnalysisRequest = {
    text: 'Test content for logging verification',
    url: 'https://example.com',
    title: 'Test Article',
    selectedText: undefined,
    imageUrl: undefined
  };

  const mockResponse: AnalysisResponse = {
    request_id: 'test-request-123',
    status_label: 'Supported',
    confidence_score: 85,
    recommendation: 'This content appears to be supported by evidence.',
    progress_stages: [],
    sources: [],
    media_risk: null,
    misinformation_type: null,
    sift_guidance: 'Test guidance',
    timestamp: new Date().toISOString()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    __resetTestEvents();
    delete process.env.CACHE_DISABLE;
  });

  describe('Test Mode (NODE_ENV === "test")', () => {
    it('should buffer events instead of logging to console', async () => {
      // Ensure we're in test mode
      expect(process.env.NODE_ENV).toBe('test');

      // Mock dependencies
      jest.mocked(hash.computeContentHash).mockResolvedValue('test-hash-123');
      jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([]);
      jest.mocked(dynamodb.storeAnalysisRecord).mockResolvedValue();

      // Spy on console.log
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Perform cache operations
      await checkCache(mockRequest); // Should log cache_miss
      await storeInCache(mockRequest, mockResponse); // Should log cache_stored

      // Verify console.log was NOT called (events buffered instead)
      expect(consoleLogSpy).not.toHaveBeenCalled();

      // Verify events were buffered
      const events = __getTestEvents();
      expect(events.length).toBe(2);
      expect(events[0].event).toBe('cache_miss');
      expect(events[1].event).toBe('cache_stored');

      consoleLogSpy.mockRestore();
    });

    it('should reset event buffer between tests', async () => {
      // Mock dependencies
      jest.mocked(hash.computeContentHash).mockResolvedValue('test-hash-456');
      jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([]);

      // First operation
      await checkCache(mockRequest);
      expect(__getTestEvents().length).toBe(1);

      // Reset buffer
      __resetTestEvents();
      expect(__getTestEvents().length).toBe(0);

      // Second operation
      await checkCache(mockRequest);
      expect(__getTestEvents().length).toBe(1);
    });
  });

  describe('Production Mode (NODE_ENV !== "test")', () => {
    it('should log to console in production mode', async () => {
      // Save original NODE_ENV
      const originalEnv = process.env.NODE_ENV;

      try {
        // Set to production mode
        process.env.NODE_ENV = 'production';

        // Mock dependencies
        jest.mocked(hash.computeContentHash).mockResolvedValue('prod-hash-123');
        jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([]);
        jest.mocked(dynamodb.storeAnalysisRecord).mockResolvedValue();

        // Spy on console.log
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

        // Reset event buffer to ensure clean state
        __resetTestEvents();

        // Perform cache operations
        await checkCache(mockRequest); // Should log cache_miss
        await storeInCache(mockRequest, mockResponse); // Should log cache_stored

        // Verify console.log WAS called (production mode)
        expect(consoleLogSpy).toHaveBeenCalledTimes(2);

        // Verify the logged content
        const firstCall = consoleLogSpy.mock.calls[0][0];
        const secondCall = consoleLogSpy.mock.calls[1][0];

        expect(firstCall).toContain('cache_miss');
        expect(firstCall).toContain('prod-hash-123');
        expect(secondCall).toContain('cache_stored');
        expect(secondCall).toContain('test-request-123');

        // Verify events were NOT buffered (should be empty)
        const events = __getTestEvents();
        expect(events.length).toBe(0);

        consoleLogSpy.mockRestore();
      } finally {
        // Restore original NODE_ENV
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should log cache_bypassed events in production', async () => {
      const originalEnv = process.env.NODE_ENV;

      try {
        process.env.NODE_ENV = 'production';
        process.env.CACHE_DISABLE = 'true';

        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

        await checkCache(mockRequest);

        expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        const loggedContent = consoleLogSpy.mock.calls[0][0];
        expect(loggedContent).toContain('cache_bypassed');
        expect(loggedContent).toContain('global_disable');

        consoleLogSpy.mockRestore();
      } finally {
        process.env.NODE_ENV = originalEnv;
        delete process.env.CACHE_DISABLE;
      }
    });
  });
});
