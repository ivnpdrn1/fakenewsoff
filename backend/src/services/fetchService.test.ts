import { fetchFullText, clearFetchCache } from './fetchService';
import fetch from 'node-fetch';
import { Response } from 'node-fetch';

// Mock node-fetch
jest.mock('node-fetch');
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// HTML Fixtures
const HTML_WITH_ARTICLE = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Article Title</title>
  <script>console.log('should be removed');</script>
  <style>.test { color: red; }</style>
</head>
<body>
  <nav>Navigation menu</nav>
  <article>
    <h1>Main Article Content</h1>
    <p>This is the main article text that should be extracted.</p>
  </article>
  <footer>Footer content</footer>
</body>
</html>
`;

const HTML_WITHOUT_ARTICLE = `
<!DOCTYPE html>
<html>
<head>
  <title>Body Only Page</title>
</head>
<body>
  <div>
    <h1>Page Content</h1>
    <p>This content is in the body but not in an article tag.</p>
  </div>
</body>
</html>
`;

const HTML_WITH_PAYWALL = `
<!DOCTYPE html>
<html>
<head><title>Paywalled Article</title></head>
<body>
  <article>
    <p>Preview text...</p>
    <div class="paywall">Subscribe to read more</div>
  </article>
</body>
</html>
`;

const LARGE_HTML = 'x'.repeat(3 * 1024 * 1024); // 3MB

describe('fetchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearFetchCache();
  });

  describe('HTML parsing with fixtures', () => {
    it('should extract text from <article> tag', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null
        },
        text: async () => HTML_WITH_ARTICLE
      }  as unknown as Response);

      const result = await fetchFullText('https://example.com/article');

      expect(result.extraction_method).toBe('article');
      expect(result.cleanedText).toContain('Main Article Content');
      expect(result.cleanedText).toContain('main article text');
      expect(result.title).toBe('Test Article Title');
      expect(result.warnings).toHaveLength(0);
    });

    it('should fallback to <body> when no article tag exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null
        },
        text: async () => HTML_WITHOUT_ARTICLE
      }  as unknown as Response);

      const result = await fetchFullText('https://example.com/page');

      expect(result.extraction_method).toBe('body');
      expect(result.cleanedText).toContain('Page Content');
      expect(result.cleanedText).toContain('body but not in an article');
      expect(result.title).toBe('Body Only Page');
    });

    it('should extract title from <title> tag', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null
        },
        text: async () => HTML_WITH_ARTICLE
      }  as unknown as Response);

      const result = await fetchFullText('https://example.com/article');

      expect(result.title).toBe('Test Article Title');
    });

    it('should remove script, style, nav, and footer elements', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null
        },
        text: async () => HTML_WITH_ARTICLE
      }  as unknown as Response);

      const result = await fetchFullText('https://example.com/article');

      expect(result.cleanedText).not.toContain('should be removed');
      expect(result.cleanedText).not.toContain('color: red');
      expect(result.cleanedText).not.toContain('Navigation menu');
      expect(result.cleanedText).not.toContain('Footer content');
    });
  });

  describe('Size limit enforcement', () => {
    it('should reject HTML larger than 2MB', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null
        },
        text: async () => LARGE_HTML
      }  as unknown as Response);

      const result = await fetchFullText('https://example.com/large');

      expect(result.cleanedText).toBe('');
      expect(result.warnings).toContain('HTML exceeds 2MB limit');
    });

    it('should reject when content-length header exceeds 2MB', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => name === 'content-length' ? '3000000' : null
        },
        text: async () => '<html><body>Test</body></html>'
      }  as unknown as Response);

      const result = await fetchFullText('https://example.com/large-header');

      expect(result.cleanedText).toBe('');
      expect(result.warnings).toContain('Content exceeds 2MB limit');
    });
  });

  describe('Timeout handling', () => {
    it('should timeout after 8000ms and add warning', async () => {
      jest.useFakeTimers();
      
      mockFetch.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              headers: { get: () => null },
              text: async () => '<html><body>Test</body></html>'
            }  as unknown as Response);
          }, 10000); // 10 seconds - longer than timeout
        });
      });

      const fetchPromise = fetchFullText('https://example.com/slow');
      
      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(8000);
      
      const result = await fetchPromise;

      expect(result.cleanedText).toBe('');
      expect(result.warnings).toContain('Request timeout');
      
      jest.useRealTimers();
    });
  });

  describe('Paywall and HTTP error handling', () => {
    it('should add warning for 403 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: {
          get: () => null
        },
        text: async () => '<html><body>Forbidden</body></html>'
      }  as unknown as Response);

      const result = await fetchFullText('https://example.com/forbidden');

      expect(result.warnings).toContain('Access forbidden (403)');
    });

    it('should add warning for 429 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: () => null
        },
        text: async () => '<html><body>Rate limited</body></html>'
      }  as unknown as Response);

      const result = await fetchFullText('https://example.com/rate-limited');

      expect(result.warnings).toContain('Rate limited (429)');
    });

    it('should detect paywall in HTML content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null
        },
        text: async () => HTML_WITH_PAYWALL
      }  as unknown as Response);

      const result = await fetchFullText('https://example.com/paywalled');

      expect(result.warnings).toContain('Possible paywall detected');
    });

    it('should detect "subscribe to read" paywall pattern', async () => {
      const htmlWithSubscribe = `
        <html>
          <body>
            <article>
              <p>Preview...</p>
              <div>subscribe to read the full article</div>
            </article>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null
        },
        text: async () => htmlWithSubscribe
      }  as unknown as Response);

      const result = await fetchFullText('https://example.com/subscribe');

      expect(result.warnings).toContain('Possible paywall detected');
    });
  });

  describe('LRU cache behavior', () => {
    it('should return cached result on cache hit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null
        },
        text: async () => HTML_WITH_ARTICLE
      }  as unknown as Response);

      // Spy on console.log to verify cache hit logging
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // First call - should fetch
      const result1 = await fetchFullText('https://example.com/cached');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Verify fetch_miss event was logged
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"event":"fetch_miss"')
      );
      consoleLogSpy.mockClear();

      // Second call - should use cache
      const result2 = await fetchFullText('https://example.com/cached');
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1, not called again
      
      // Verify cache_hit event was logged
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"event":"cache_hit"')
      );
      
      expect(result1).toEqual(result2);
      
      consoleLogSpy.mockRestore();
    });

    it('should fetch new content on cache miss', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: async () => HTML_WITH_ARTICLE
        }  as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: async () => HTML_WITHOUT_ARTICLE
        }  as unknown as Response);

      // First URL
      await fetchFullText('https://example.com/page1');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Different URL - cache miss
      await fetchFullText('https://example.com/page2');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should expire cache after TTL', async () => {
      jest.useFakeTimers();
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: async () => HTML_WITH_ARTICLE
        }  as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: async () => HTML_WITH_ARTICLE
        }  as unknown as Response);

      // First call
      await fetchFullText('https://example.com/expiry');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance time beyond TTL (1 hour + 1ms)
      jest.advanceTimersByTime(60 * 60 * 1000 + 1);

      // Second call after expiry - should fetch again
      await fetchFullText('https://example.com/expiry');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      jest.useRealTimers();
    });
  });

  describe('Error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchFullText('https://example.com/error');

      expect(result.cleanedText).toBe('');
      expect(result.warnings).toContain('Fetch error: Network error');
    });

    it('should handle abort errors as timeout', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await fetchFullText('https://example.com/abort');

      expect(result.cleanedText).toBe('');
      expect(result.warnings).toContain('Request timeout');
    });
  });
});
