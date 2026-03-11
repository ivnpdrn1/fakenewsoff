/**
 * Cache Service Tests
 *
 * Tests for cache lookup and storage functionality.
 *
 * Test Coverage:
 * - Cache hit returns cached response
 * - Cache miss returns null
 * - CACHE_DISABLE bypasses cache
 * - Per-request cache_bypass bypasses cache
 * - TTL window filtering (24 hours)
 * - Content hash computation from request
 * - Cache storage with TTL
 */

import { checkCache, storeInCache, AnalysisRequestWithCache } from './cacheService';
import { AnalysisRequest, AnalysisRecord } from '../utils/dynamodb';
import { AnalysisResponse } from '../utils/schemaValidators';
import * as dynamodb from '../utils/dynamodb';
import * as hash from '../utils/hash';

// Mock the dynamodb and hash modules
jest.mock('../utils/dynamodb');
jest.mock('../utils/hash');

describe('cacheService', () => {
  const mockRequest: AnalysisRequest = {
    text: 'Sample article text about climate change',
    url: 'https://example.com/article',
    title: 'Climate Change Article',
    selectedText: 'Selected portion of text',
  };

  const mockResponse: AnalysisResponse = {
    request_id: '550e8400-e29b-41d4-a716-446655440000',
    status_label: 'Supported',
    confidence_score: 85,
    recommendation: 'This claim is well-supported by credible sources.',
    progress_stages: [
      { stage: 'Extracting claims', status: 'completed', timestamp: '2024-01-15T10:30:00Z' },
    ],
    sources: [
      {
        url: 'https://reuters.com/article',
        title: 'Reuters Article',
        snippet: 'Evidence snippet',
        why: 'Relevant source',
        domain: 'reuters.com',
      },
    ],
    media_risk: null,
    misinformation_type: null,
    sift_guidance: 'SIFT guidance text',
    timestamp: '2024-01-15T10:30:00Z',
  };

  const mockContentHash = 'abc123def456';

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Reset environment variables
    delete process.env.CACHE_DISABLE;

    // Mock computeContentHash
    (hash.computeContentHash as jest.Mock).mockResolvedValue(mockContentHash);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('checkCache', () => {
    it('should return cached response on cache hit', async () => {
      // Mock cache hit
      const cachedRecord: AnalysisRecord = {
        request_id: mockResponse.request_id,
        request: mockRequest,
        response: mockResponse,
        created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
        updated_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        content_hash: mockContentHash,
        ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      };

      jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([cachedRecord]);

      const result = await checkCache(mockRequest);

      expect(result).not.toBeNull();
      expect(result?.cached).toBe(true);
      expect(result?.response.request_id).toBe(mockResponse.request_id);
      expect(result?.response.cached).toBe(true);
      expect(result?.response.cache_timestamp).toBe(cachedRecord.created_at);
      expect(result?.cache_age_hours).toBeGreaterThan(0);
      expect(result?.cache_age_hours).toBeLessThan(2);

      // Verify GSI query was called with correct parameters
      expect(dynamodb.queryByContentHash).toHaveBeenCalledWith(mockContentHash, 24);
    });

    it('should return null on cache miss', async () => {
      // Mock cache miss
      jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([]);

      const result = await checkCache(mockRequest);

      expect(result).toBeNull();
      expect(dynamodb.queryByContentHash).toHaveBeenCalledWith(mockContentHash, 24);
    });

    it('should bypass cache when CACHE_DISABLE is true', async () => {
      // Set global cache disable flag
      process.env.CACHE_DISABLE = 'true';

      const result = await checkCache(mockRequest);

      expect(result).toBeNull();
      // Should not query DynamoDB
      expect(dynamodb.queryByContentHash).not.toHaveBeenCalled();
    });

    it('should bypass cache when cache_bypass is true in request', async () => {
      const requestWithBypass: AnalysisRequestWithCache = {
        ...mockRequest,
        cache_bypass: true,
      };

      const result = await checkCache(requestWithBypass);

      expect(result).toBeNull();
      // Should not query DynamoDB
      expect(dynamodb.queryByContentHash).not.toHaveBeenCalled();
    });

    it('should return most recent cached result when multiple exist', async () => {
      const olderRecord: AnalysisRecord = {
        request_id: '111e8400-e29b-41d4-a716-446655440000',
        request: mockRequest,
        response: {
          ...mockResponse,
          request_id: '111e8400-e29b-41d4-a716-446655440000',
          confidence_score: 70,
        },
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
        updated_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        content_hash: mockContentHash,
        ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      };

      const newerRecord: AnalysisRecord = {
        request_id: '222e8400-e29b-41d4-a716-446655440000',
        request: mockRequest,
        response: {
          ...mockResponse,
          request_id: '222e8400-e29b-41d4-a716-446655440000',
          confidence_score: 85,
        },
        created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
        updated_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        content_hash: mockContentHash,
        ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      };

      jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([olderRecord, newerRecord]);

      const result = await checkCache(mockRequest);

      expect(result).not.toBeNull();
      expect(result?.response.confidence_score).toBe(85); // Should return newer record
      expect(result?.response.request_id).toBe('222e8400-e29b-41d4-a716-446655440000');
      expect(result?.response.cache_timestamp).toBe(newerRecord.created_at);
    });

    it('should compute content hash from request fields', async () => {
      jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([]);

      await checkCache(mockRequest);

      // Verify hash computation was called
      expect(hash.computeContentHash).toHaveBeenCalled();

      // Verify combined content includes all relevant fields
      const callArg = jest.mocked(hash.computeContentHash).mock.calls[0][0];
      expect(callArg).toContain(mockRequest.text);
      expect(callArg).toContain(mockRequest.selectedText);
      expect(callArg).toContain(mockRequest.url);
      expect(callArg).toContain(mockRequest.title);
    });

    it('should handle requests with missing optional fields', async () => {
      const minimalRequest: AnalysisRequest = {
        text: 'Just text',
      };

      jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([]);

      const result = await checkCache(minimalRequest);

      expect(result).toBeNull();
      expect(hash.computeContentHash).toHaveBeenCalled();
    });

    it('should calculate cache age correctly', async () => {
      const twoHoursAgo = new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString();

      const cachedRecord: AnalysisRecord = {
        request_id: mockResponse.request_id,
        request: mockRequest,
        response: mockResponse,
        created_at: twoHoursAgo,
        updated_at: twoHoursAgo,
        content_hash: mockContentHash,
        ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      };

      jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([cachedRecord]);

      const result = await checkCache(mockRequest);

      expect(result).not.toBeNull();
      expect(result?.cache_age_hours).toBeGreaterThan(1.9);
      expect(result?.cache_age_hours).toBeLessThan(2.1);
    });
  });

  describe('storeInCache', () => {
    it('should store analysis result with content hash and TTL', async () => {
      jest.mocked(dynamodb.storeAnalysisRecord).mockResolvedValue();

      await storeInCache(mockRequest, mockResponse);

      // Verify storeAnalysisRecord was called
      expect(dynamodb.storeAnalysisRecord).toHaveBeenCalledTimes(1);

      const storedRecord = jest.mocked(dynamodb.storeAnalysisRecord).mock.calls[0][0];

      // Verify record structure
      expect(storedRecord.request_id).toBe(mockResponse.request_id);
      expect(storedRecord.request).toEqual(mockRequest);
      expect(storedRecord.response).toEqual(mockResponse);
      expect(storedRecord.content_hash).toBe(mockContentHash);
      expect(storedRecord.created_at).toBe(mockResponse.timestamp);
      expect(storedRecord.updated_at).toBe(mockResponse.timestamp);

      // Verify TTL is set (30 days from now)
      expect(storedRecord.ttl).toBeDefined();
      const expectedTtl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      expect(storedRecord.ttl).toBeGreaterThan(expectedTtl - 10); // Allow 10 second tolerance
      expect(storedRecord.ttl).toBeLessThan(expectedTtl + 10);
    });

    it('should compute content hash before storing', async () => {
      jest.mocked(dynamodb.storeAnalysisRecord).mockResolvedValue();

      await storeInCache(mockRequest, mockResponse);

      // Verify hash computation was called
      expect(hash.computeContentHash).toHaveBeenCalled();

      // Verify stored record has the computed hash
      const storedRecord = jest.mocked(dynamodb.storeAnalysisRecord).mock.calls[0][0];
      expect(storedRecord.content_hash).toBe(mockContentHash);
    });

    it('should handle storage errors gracefully', async () => {
      const storageError = new Error('DynamoDB storage failed');
      jest.mocked(dynamodb.storeAnalysisRecord).mockRejectedValue(storageError);

      await expect(storeInCache(mockRequest, mockResponse)).rejects.toThrow(
        'DynamoDB storage failed'
      );
    });
  });

  describe('content hash computation', () => {
    it('should produce same hash for same content', async () => {
      const request1: AnalysisRequest = {
        text: 'Same text',
        url: 'https://example.com',
        title: 'Same title',
      };

      const request2: AnalysisRequest = {
        text: 'Same text',
        url: 'https://example.com',
        title: 'Same title',
      };

      jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([]);

      await checkCache(request1);
      const hash1Call = jest.mocked(hash.computeContentHash).mock.calls[0][0];

      jest.clearAllMocks();
      jest.mocked(hash.computeContentHash).mockResolvedValue(mockContentHash);
      jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([]);

      await checkCache(request2);
      const hash2Call = jest.mocked(hash.computeContentHash).mock.calls[0][0];

      expect(hash1Call).toBe(hash2Call);
    });

    it('should produce different hash for different content', async () => {
      const request1: AnalysisRequest = {
        text: 'Different text 1',
      };

      const request2: AnalysisRequest = {
        text: 'Different text 2',
      };

      jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([]);

      await checkCache(request1);
      const hash1Call = jest.mocked(hash.computeContentHash).mock.calls[0][0];

      jest.clearAllMocks();
      jest.mocked(hash.computeContentHash).mockResolvedValue(mockContentHash);
      jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([]);

      await checkCache(request2);
      const hash2Call = jest.mocked(hash.computeContentHash).mock.calls[0][0];

      expect(hash1Call).not.toBe(hash2Call);
    });

    it('should exclude imageUrl from hash computation', async () => {
      const request1: AnalysisRequest = {
        text: 'Same text',
        imageUrl: 'https://example.com/image1.jpg',
      };

      const request2: AnalysisRequest = {
        text: 'Same text',
        imageUrl: 'https://example.com/image2.jpg',
      };

      jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([]);

      await checkCache(request1);
      const hash1Call = jest.mocked(hash.computeContentHash).mock.calls[0][0];

      jest.clearAllMocks();
      jest.mocked(hash.computeContentHash).mockResolvedValue(mockContentHash);
      jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([]);

      await checkCache(request2);
      const hash2Call = jest.mocked(hash.computeContentHash).mock.calls[0][0];

      // Hash should be same (imageUrl excluded)
      expect(hash1Call).toBe(hash2Call);
      expect(hash1Call).not.toContain('image1.jpg');
      expect(hash1Call).not.toContain('image2.jpg');
    });
  });

  describe('TTL window filtering', () => {
    it('should only return results within 24-hour window', async () => {
      jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([]);

      await checkCache(mockRequest);

      // Verify query was called with 24-hour TTL window
      expect(dynamodb.queryByContentHash).toHaveBeenCalledWith(mockContentHash, 24);
    });

    it('should not return results outside TTL window', async () => {
      // This is handled by DynamoDB query, but we verify the call
      jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([]);

      const result = await checkCache(mockRequest);

      expect(result).toBeNull();
      // DynamoDB query filters by created_at > threshold
      expect(dynamodb.queryByContentHash).toHaveBeenCalledWith(mockContentHash, 24);
    });
  });
});
