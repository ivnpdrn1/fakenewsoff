import { fetchFullText } from './fetchService';
import fetch from 'node-fetch';
import { Response } from 'node-fetch';
import * as fc from 'fast-check';

// Mock node-fetch
jest.mock('node-fetch');
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

/**
 * Property 21: Search Fallback
 * Validates: Requirements 7.4
 * 
 * This property test verifies that:
 * 1. URL fetch failure results in graceful degradation (returns empty text with warnings)
 * 2. Cached results are returned when available (cache hit after initial fetch)
 */

describe('fetchService - Property 21: Search Fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Property: For any URL fetch failure, the service should gracefully degrade
   * by returning an empty result with appropriate warnings, never throwing errors.
   */
  it('should gracefully degrade on fetch failures without throwing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl(), // Generate random valid URLs
        fc.oneof(
          fc.constant('network_error'),
          fc.constant('timeout'),
          fc.constant('abort'),
          fc.constant('http_error')
        ), // Generate different failure types
        async (url, failureType) => {
          // Setup mock based on failure type
          switch (failureType) {
            case 'network_error':
              mockFetch.mockRejectedValueOnce(new Error('Network error'));
              break;
            case 'timeout':
              // Don't actually create a long timeout - just reject immediately with AbortError
              const timeoutError = new Error('The operation was aborted');
              timeoutError.name = 'AbortError';
              mockFetch.mockRejectedValueOnce(timeoutError);
              break;
            case 'abort':
              const abortError = new Error('The operation was aborted');
              abortError.name = 'AbortError';
              mockFetch.mockRejectedValueOnce(abortError);
              break;
            case 'http_error':
              mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                headers: { get: () => null },
                text: async () => '<html><body>Error</body></html>'
              }  as unknown as Response);
              break;
          }

          // Execute fetch
          let result;
          let threwError = false;
          try {
            result = await fetchFullText(url);
          } catch {
            threwError = true;
          }

          // Property assertions:
          // 1. Should never throw an error (graceful degradation)
          expect(threwError).toBe(false);
          
          // 2. Should return a valid result object
          expect(result).toBeDefined();
          
          // Type assertion after checking result is defined
          if (!result) {
            throw new Error('Result should be defined');
          }
          
          expect(result).toHaveProperty('cleanedText');
          expect(result).toHaveProperty('warnings');
          expect(result).toHaveProperty('extraction_method');
          
          // 3. On failure, should have at least one warning explaining the failure
          // Note: cleanedText may not be empty for http_error since it extracts from error page
          if (failureType !== 'http_error') {
            expect(result.cleanedText).toBe('');
          }
          
          // 4. Should have at least one warning explaining the failure
          expect(result.warnings.length).toBeGreaterThan(0);
          
          // 5. Warnings should contain relevant error information
          const warningText = result.warnings.join(' ');
          const hasRelevantWarning = 
            warningText.includes('timeout') ||
            warningText.includes('error') ||
            warningText.includes('HTTP') ||
            warningText.includes('Fetch');
          expect(hasRelevantWarning).toBe(true);
        }
      ),
      { numRuns: 10 } // Run 10 test cases with different URLs and failure types
    );
  }, 5000); // 5 second timeout should be sufficient now

  /**
   * Property: For any URL that is successfully fetched, subsequent requests
   * to the same URL should return cached results without making additional
   * network requests (within the TTL window).
   */
  it('should return cached results when available', async () => {
    // Generator for non-blank text: ensures at least one non-whitespace character
    // This prevents flaky failures when random strings are whitespace-only or too short
    const nonBlankTextArb = fc.string({ minLength: 10, maxLength: 100 })
      .map(s => {
        const trimmed = s.trim();
        // Ensure we have substantial content that won't be stripped by HTML cleaner
        return trimmed.length > 5 ? trimmed : 'This is substantial default content for testing purposes.';
      })
      .filter(s => s.trim().length > 5); // Ensure result has meaningful content
    
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl(), // Generate random valid URLs
        nonBlankTextArb, // Generate random non-blank content
        async (url, content) => {
          // Setup successful response
          const htmlContent = `<html><head><title>Test</title></head><body><article>${content}</article></body></html>`;
          
          mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => null },
            text: async () => htmlContent
          }  as unknown as Response);

          // First fetch - should hit the network
          const result1 = await fetchFullText(url);
          const firstCallCount = mockFetch.mock.calls.length;
          
          // Property assertions for first fetch:
          // 1. Should make a network request
          expect(firstCallCount).toBeGreaterThan(0);
          
          // 2. Should return valid result with content
          expect(result1.cleanedText).toBeTruthy();
          expect(result1.cleanedText.length).toBeGreaterThan(0);
          
          // Second fetch - should use cache
          const result2 = await fetchFullText(url);
          const secondCallCount = mockFetch.mock.calls.length;
          
          // Property assertions for cached fetch:
          // 3. Should NOT make additional network request (cache hit)
          expect(secondCallCount).toBe(firstCallCount);
          
          // 4. Cached result should be identical to original result
          expect(result2).toEqual(result1);
          expect(result2.cleanedText).toBe(result1.cleanedText);
          expect(result2.title).toBe(result1.title);
          expect(result2.extraction_method).toBe(result1.extraction_method);
          expect(result2.warnings).toEqual(result1.warnings);
        }
      ),
      { numRuns: 15 } // Run 15 test cases with different URLs and content
    );
  });

  /**
   * Property: Cache should expire after TTL (1 hour), requiring a fresh fetch.
   * This ensures stale data doesn't persist indefinitely.
   */
  it('should refetch after cache TTL expires', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl(),
        fc.string({ minLength: 10, maxLength: 50 }),
        async (url, content) => {
          const htmlContent = `<html><body><article>${content}</article></body></html>`;
          
          mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => null },
            text: async () => htmlContent
          }  as unknown as Response);

          // First fetch
          await fetchFullText(url);
          const firstCallCount = mockFetch.mock.calls.length;
          
          // Advance time beyond TTL (1 hour + 1ms)
          jest.advanceTimersByTime(60 * 60 * 1000 + 1);
          
          // Second fetch after TTL expiry
          await fetchFullText(url);
          const secondCallCount = mockFetch.mock.calls.length;
          
          // Property assertion:
          // Should make a new network request after TTL expires
          expect(secondCallCount).toBeGreaterThan(firstCallCount);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Different URLs should not share cache entries.
   * Each URL should have its own independent cache entry.
   */
  it('should maintain separate cache entries for different URLs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(fc.webUrl(), fc.webUrl()).filter(([url1, url2]) => url1 !== url2), // Two different URLs
        fc.tuple(fc.string({ minLength: 5, maxLength: 30 }), fc.string({ minLength: 5, maxLength: 30 })),
        async ([url1, url2], [content1, content2]) => {
          // Setup different responses for different URLs
          mockFetch
            .mockResolvedValueOnce({
              ok: true,
              status: 200,
              headers: { get: () => null },
              text: async () => `<html><body><article>${content1}</article></body></html>`
            }  as unknown as Response)
            .mockResolvedValueOnce({
              ok: true,
              status: 200,
              headers: { get: () => null },
              text: async () => `<html><body><article>${content2}</article></body></html>`
            }  as unknown as Response);

          // Fetch both URLs
          const result1 = await fetchFullText(url1);
          const result2 = await fetchFullText(url2);
          
          // Property assertions:
          // 1. Both URLs should trigger network requests (no cross-contamination)
          expect(mockFetch).toHaveBeenCalledTimes(2);
          
          // 2. Results should be different (independent cache entries)
          expect(result1.cleanedText).not.toBe(result2.cleanedText);
          
          // 3. Fetching url1 again should use cache (no new request)
          mockFetch.mockClear();
          const result1Cached = await fetchFullText(url1);
          expect(mockFetch).not.toHaveBeenCalled();
          expect(result1Cached).toEqual(result1);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Graceful degradation should work consistently across
   * various HTTP error codes (403, 429, 500, etc.)
   */
  it('should handle various HTTP error codes gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl(),
        fc.integer({ min: 400, max: 599 }), // Generate HTTP error codes
        async (url, statusCode) => {
          mockFetch.mockResolvedValueOnce({
            ok: false,
            status: statusCode,
            headers: { get: () => null },
            text: async () => '<html><body>Error</body></html>'
          }  as unknown as Response);

          const result = await fetchFullText(url);
          
          // Property assertions:
          // 1. Should not throw
          expect(result).toBeDefined();
          
          // 2. Should have warnings for specific error codes
          if (statusCode === 403) {
            expect(result.warnings).toContain('Access forbidden (403)');
          } else if (statusCode === 429) {
            expect(result.warnings).toContain('Rate limited (429)');
          } else {
            expect(result.warnings.some(w => w.includes('HTTP error'))).toBe(true);
          }
          
          // 3. Should still attempt to extract content (graceful degradation)
          expect(result).toHaveProperty('cleanedText');
          expect(result).toHaveProperty('extraction_method');
        }
      ),
      { numRuns: 15 }
    );
  });
});
