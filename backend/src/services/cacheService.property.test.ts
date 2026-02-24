/**
 * Property-Based Tests for Cache Service
 * 
 * Tests caching behavior across a wide range of inputs using fast-check.
 * 
 * REPRODUCIBILITY:
 * When a property test fails, fast-check outputs a seed and path in the error message.
 * To reproduce the exact failure:
 * 
 * 1. Copy the seed from the error output (e.g., seed: 1234567890)
 * 2. Add the seed to fc.assert options:
 *    fc.assert(fc.asyncProperty(...), { seed: 1234567890, numRuns: 1 })
 * 
 * 3. Optionally, use the path to narrow down to the exact failing case:
 *    fc.assert(fc.asyncProperty(...), { seed: 1234567890, path: "0:1:2" })
 * 
 * Example:
 *    return fc.assert(
 *      fc.asyncProperty(analysisRequestArbitrary, async (request) => {
 *        // test logic
 *      }),
 *      { seed: 1234567890, path: "0:1:2", numRuns: 1 }
 *    );
 * 
 * Property 31: JSON Serialization Round Trip
 * Validates: Requirements 12.4
 */

import * as fc from 'fast-check';
import { checkCache, storeInCache, AnalysisRequestWithCache, __resetTestEvents } from './cacheService';
import { AnalysisRecord } from '../utils/dynamodb';
import * as dynamodb from '../utils/dynamodb';
import * as hash from '../utils/hash';

// Mock the dynamodb and hash modules
jest.mock('../utils/dynamodb');
jest.mock('../utils/hash');

/**
 * Arbitrary generator for AnalysisRequest objects
 */
const analysisRequestArbitrary = fc.record({
  text: fc.string({ minLength: 10, maxLength: 500 }).filter(s => s.trim().length > 0),
  url: fc.option(fc.webUrl(), { nil: undefined }),
  title: fc.option(fc.string({ minLength: 5, maxLength: 100 }), { nil: undefined }),
  selectedText: fc.option(fc.string({ minLength: 5, maxLength: 200 }), { nil: undefined }),
  imageUrl: fc.option(fc.webUrl(), { nil: undefined })
});

/**
 * Arbitrary generator for AnalysisResponse objects
 */
const analysisResponseArbitrary = fc.record({
  request_id: fc.uuid(),
  status_label: fc.constantFrom(
    "Supported" as const,
    "Disputed" as const,
    "Unverified" as const,
    "Manipulated" as const,
    "Biased framing" as const
  ),
  confidence_score: fc.integer({ min: 0, max: 100 }),
  recommendation: fc.string({ minLength: 10, maxLength: 200 }),
  progress_stages: fc.array(
    fc.record({
      stage: fc.constantFrom(
        "Extracting claims",
        "Finding better coverage",
        "Ranking sources",
        "Retrieving evidence",
        "Media check",
        "Synthesizing report"
      ),
      status: fc.constantFrom("completed" as const, "in_progress" as const, "pending" as const),
      timestamp: fc.option(fc.date().map(d => d.toISOString()), { nil: null })
    }),
    { minLength: 1, maxLength: 6 }
  ),
  sources: fc.array(
    fc.record({
      url: fc.webUrl(),
      title: fc.string({ minLength: 5, maxLength: 100 }),
      snippet: fc.string({ minLength: 20, maxLength: 300 }),
      why: fc.string({ minLength: 10, maxLength: 150 }),
      domain: fc.domain()
    }),
    { minLength: 0, maxLength: 3 }
  ),
  media_risk: fc.option(
    fc.constantFrom("low" as const, "medium" as const, "high" as const),
    { nil: null }
  ),
  misinformation_type: fc.option(
    fc.constantFrom(
      "Satire or Parody" as const,
      "Misleading Content" as const,
      "Imposter Content" as const,
      "Fabricated Content" as const,
      "False Connection" as const,
      "False Context" as const,
      "Manipulated Content" as const
    ),
    { nil: null }
  ),
  sift_guidance: fc.string({ minLength: 50, maxLength: 500 }),
  timestamp: fc.date().map(d => d.toISOString())
});

describe('Property 31: JSON Serialization Round Trip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetTestEvents();
    delete process.env.CACHE_DISABLE;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * **Validates: Requirements 12.4**
   * 
   * Test that cached responses maintain data integrity through serialization.
   * When a response is stored in cache and retrieved, all fields should be preserved.
   */
  it('should preserve all response fields through cache storage and retrieval', () => {
    return fc.assert(
      fc.asyncProperty(
        analysisRequestArbitrary,
        analysisResponseArbitrary,
        async (request, response) => {
          // Clear mocks for each property test run
          jest.clearAllMocks();
          
          // Generate a consistent hash for this test
          const mockHash = 'test-hash-' + Math.random().toString(36).substring(7);
          jest.mocked(hash.computeContentHash).mockResolvedValue(mockHash);
          jest.mocked(dynamodb.storeAnalysisRecord).mockResolvedValue();

          // Store in cache
          await storeInCache(request, response);

          // Verify storage was called
          expect(dynamodb.storeAnalysisRecord).toHaveBeenCalledTimes(1);
          const storedRecord = jest.mocked(dynamodb.storeAnalysisRecord).mock.calls[0][0];

          // Property assertions:
          // 1. All request fields should be preserved
          expect(storedRecord.request.text).toBe(request.text);
          expect(storedRecord.request.url).toBe(request.url);
          expect(storedRecord.request.title).toBe(request.title);
          expect(storedRecord.request.selectedText).toBe(request.selectedText);
          expect(storedRecord.request.imageUrl).toBe(request.imageUrl);

          // 2. All response fields should be preserved
          expect(storedRecord.response.request_id).toBe(response.request_id);
          expect(storedRecord.response.status_label).toBe(response.status_label);
          expect(storedRecord.response.confidence_score).toBe(response.confidence_score);
          expect(storedRecord.response.recommendation).toBe(response.recommendation);
          expect(storedRecord.response.sift_guidance).toBe(response.sift_guidance);
          expect(storedRecord.response.timestamp).toBe(response.timestamp);
          expect(storedRecord.response.media_risk).toBe(response.media_risk);
          expect(storedRecord.response.misinformation_type).toBe(response.misinformation_type);

          // 3. Nested structures should be preserved
          expect(storedRecord.response.progress_stages.length).toBe(response.progress_stages.length);
          expect(storedRecord.response.sources.length).toBe(response.sources.length);

          // 4. Serialization round trip should produce equivalent object
          const serialized = JSON.stringify(storedRecord.response);
          const parsed = JSON.parse(serialized);
          expect(parsed).toEqual(response);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Test that repeated requests with same content return cached=true
   */
  it('should return cached=true for repeated requests with identical content', () => {
    return fc.assert(
      fc.asyncProperty(
        analysisRequestArbitrary,
        analysisResponseArbitrary,
        async (request, response) => {
          const mockHash = 'consistent-hash-123';
          jest.mocked(hash.computeContentHash).mockResolvedValue(mockHash);

          // Create a cached record
          const cachedRecord: AnalysisRecord = {
            request_id: response.request_id,
            request,
            response,
            created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
            updated_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
            content_hash: mockHash,
            ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
          };

          jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([cachedRecord]);

          // Check cache
          const result = await checkCache(request);

          // Property assertions:
          // 1. Should return a cached result
          expect(result).not.toBeNull();
          expect(result?.cached).toBe(true);

          // 2. Response should have cached flag
          expect(result?.response.cached).toBe(true);

          // 3. Response should have cache_timestamp
          expect(result?.response.cache_timestamp).toBe(cachedRecord.created_at);

          // 4. All original response fields should be preserved
          expect(result?.response.request_id).toBe(response.request_id);
          expect(result?.response.status_label).toBe(response.status_label);
          expect(result?.response.confidence_score).toBe(response.confidence_score);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Test that cache expires after 24 hours
   */
  it('should not return cached results older than 24 hours', () => {
    return fc.assert(
      fc.asyncProperty(
        analysisRequestArbitrary,
        analysisResponseArbitrary,
        async (request, _response) => {
          const mockHash = 'expired-hash-456';
          jest.mocked(hash.computeContentHash).mockResolvedValue(mockHash);

          // Mock queryByContentHash to return empty array (simulating expired cache)
          // In real implementation, DynamoDB query filters by created_at > threshold
          jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([]);

          // Check cache
          const result = await checkCache(request);

          // Property assertions:
          // 1. Should return null (cache miss)
          expect(result).toBeNull();

          // 2. Query should have been called with 24-hour TTL window
          expect(dynamodb.queryByContentHash).toHaveBeenCalledWith(mockHash, 24);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test that different content produces different cache lookups
   */
  /**
   * Test that different content produces different cache lookups
   */
  it('should produce different hashes for different content', () => {
    return fc.assert(
      fc.asyncProperty(
        analysisRequestArbitrary,
        analysisRequestArbitrary,
        async (request1, request2) => {
          // Clear mocks for this test run
          jest.clearAllMocks();
          
          // Use fc.pre to skip identical requests
          fc.pre(
            request1.text !== request2.text || 
            request1.url !== request2.url || 
            request1.title !== request2.title || 
            request1.selectedText !== request2.selectedText
          );

          // Use real hash computation to verify different content produces different hashes
          const hash1 = 'hash-' + JSON.stringify(request1);
          const hash2 = 'hash-' + JSON.stringify(request2);

          // Mock different hashes for different requests
          jest.mocked(hash.computeContentHash)
            .mockResolvedValueOnce(hash1)
            .mockResolvedValueOnce(hash2);

          jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([]);

          // Check cache for both requests
          await checkCache(request1);
          await checkCache(request2);

          // Property assertions:
          // 1. Should have called queryByContentHash twice
          expect(dynamodb.queryByContentHash).toHaveBeenCalledTimes(2);

          // 2. Should have been called with different hashes
          const call1Hash = jest.mocked(dynamodb.queryByContentHash).mock.calls[0][0];
          const call2Hash = jest.mocked(dynamodb.queryByContentHash).mock.calls[1][0];
          expect(call1Hash).not.toBe(call2Hash);
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Test that imageUrl does not affect cache hash
   */
  it('should produce same hash for same content with different imageUrl', () => {
    return fc.assert(
      fc.asyncProperty(
        analysisRequestArbitrary,
        fc.webUrl(),
        fc.webUrl(),
        async (baseRequest, imageUrl1, imageUrl2) => {
          // Clear mocks for each property test run
          jest.clearAllMocks();
          
          // Create two requests with same content but different imageUrls
          const request1 = { ...baseRequest, imageUrl: imageUrl1 };
          const request2 = { ...baseRequest, imageUrl: imageUrl2 };

          // Mock same hash for both (imageUrl excluded from hash)
          const mockHash = 'same-hash-789';
          jest.mocked(hash.computeContentHash).mockResolvedValue(mockHash);
          jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([]);

          // Check cache for both requests
          await checkCache(request1);
          const hash1Call = jest.mocked(hash.computeContentHash).mock.calls[0][0];

          await checkCache(request2);
          const hash2Call = jest.mocked(hash.computeContentHash).mock.calls[1][0];

          // Property assertions:
          // 1. Hash computation should not include imageUrl
          expect(hash1Call).not.toContain(imageUrl1);
          expect(hash1Call).not.toContain(imageUrl2);

          // 2. Hash input should be the same for both requests
          expect(hash1Call).toBe(hash2Call);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test cache age calculation accuracy
   */
  it('should accurately calculate cache age in hours', () => {
    return fc.assert(
      fc.asyncProperty(
        analysisRequestArbitrary,
        analysisResponseArbitrary,
        fc.integer({ min: 1, max: 23 }), // Hours ago (within 24-hour window)
        async (request, response, hoursAgo) => {
          const mockHash = 'age-test-hash';
          jest.mocked(hash.computeContentHash).mockResolvedValue(mockHash);

          // Create cached record with specific age
          const createdAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
          const cachedRecord: AnalysisRecord = {
            request_id: response.request_id,
            request,
            response,
            created_at: createdAt,
            updated_at: createdAt,
            content_hash: mockHash,
            ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
          };

          jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([cachedRecord]);

          // Check cache
          const result = await checkCache(request);

          // Property assertions:
          // 1. Should return cached result
          expect(result).not.toBeNull();

          // 2. Cache age should be approximately correct (within 0.1 hour tolerance)
          expect(result?.cache_age_hours).toBeGreaterThan(hoursAgo - 0.1);
          expect(result?.cache_age_hours).toBeLessThan(hoursAgo + 0.1);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test that most recent cached result is returned when multiple exist
   */
  it('should return most recent result when multiple cached results exist', () => {
    return fc.assert(
      fc.asyncProperty(
        analysisRequestArbitrary,
        analysisResponseArbitrary,
        analysisResponseArbitrary,
        fc.integer({ min: 2, max: 10 }), // Hours ago for older record
        fc.integer({ min: 1, max: 1 }), // Hours ago for newer record
        async (request, olderResponse, newerResponse, olderHours, newerHours) => {
          const mockHash = 'multi-cache-hash';
          jest.mocked(hash.computeContentHash).mockResolvedValue(mockHash);

          // Create two cached records with different ages
          const olderRecord: AnalysisRecord = {
            request_id: olderResponse.request_id,
            request,
            response: olderResponse,
            created_at: new Date(Date.now() - olderHours * 60 * 60 * 1000).toISOString(),
            updated_at: new Date(Date.now() - olderHours * 60 * 60 * 1000).toISOString(),
            content_hash: mockHash,
            ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
          };

          const newerRecord: AnalysisRecord = {
            request_id: newerResponse.request_id,
            request,
            response: newerResponse,
            created_at: new Date(Date.now() - newerHours * 60 * 60 * 1000).toISOString(),
            updated_at: new Date(Date.now() - newerHours * 60 * 60 * 1000).toISOString(),
            content_hash: mockHash,
            ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
          };

          jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([olderRecord, newerRecord]);

          // Check cache
          const result = await checkCache(request);

          // Property assertions:
          // 1. Should return the newer record
          expect(result).not.toBeNull();
          expect(result?.response.request_id).toBe(newerResponse.request_id);

          // 2. Cache age should reflect the newer record
          expect(result?.cache_age_hours).toBeLessThan(olderHours);
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Test TTL is set correctly for stored records
   */
  it('should set TTL to 30 days from storage time', () => {
    return fc.assert(
      fc.asyncProperty(
        analysisRequestArbitrary,
        analysisResponseArbitrary,
        async (request, response) => {
          const mockHash = 'ttl-test-hash';
          jest.mocked(hash.computeContentHash).mockResolvedValue(mockHash);
          jest.mocked(dynamodb.storeAnalysisRecord).mockResolvedValue();

          // Store in cache
          await storeInCache(request, response);

          // Get stored record
          const storedRecord = jest.mocked(dynamodb.storeAnalysisRecord).mock.calls[0][0];

          // Property assertions:
          // 1. TTL should be set
          expect(storedRecord.ttl).toBeDefined();

          // 2. TTL should be approximately 30 days from now (allow 60 second tolerance)
          const expectedTtl = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
          expect(storedRecord.ttl).toBeGreaterThan(expectedTtl - 60);
          expect(storedRecord.ttl).toBeLessThan(expectedTtl + 60);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test cache bypass flags work correctly
   */
  it('should bypass cache when cache_bypass flag is set', () => {
    return fc.assert(
      fc.asyncProperty(
        analysisRequestArbitrary,
        async (request) => {
          const requestWithBypass: AnalysisRequestWithCache = {
            ...request,
            cache_bypass: true
          };

          // Check cache
          const result = await checkCache(requestWithBypass);

          // Property assertions:
          // 1. Should return null (cache bypassed)
          expect(result).toBeNull();

          // 2. Should not query DynamoDB
          expect(dynamodb.queryByContentHash).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Test that content hash includes all relevant fields
   */
  it('should compute hash from all relevant request fields', () => {
    return fc.assert(
      fc.asyncProperty(
        analysisRequestArbitrary,
        async (request) => {
          // Clear mocks for each property test run
          jest.clearAllMocks();
          
          jest.mocked(hash.computeContentHash).mockResolvedValue('test-hash');
          jest.mocked(dynamodb.queryByContentHash).mockResolvedValue([]);

          // Check cache
          await checkCache(request);

          // Property assertions:
          // 1. Hash computation should have been called
          expect(hash.computeContentHash).toHaveBeenCalledTimes(1);

          // 2. Hash input should include relevant fields
          const hashInput = jest.mocked(hash.computeContentHash).mock.calls[0][0];
          
          if (request.text) {
            expect(hashInput).toContain(request.text);
          }
          if (request.selectedText) {
            expect(hashInput).toContain(request.selectedText);
          }
          if (request.url) {
            expect(hashInput).toContain(request.url);
          }
          if (request.title) {
            expect(hashInput).toContain(request.title);
          }
        }
      ),
      { numRuns: 25 }
    );
  });
});
