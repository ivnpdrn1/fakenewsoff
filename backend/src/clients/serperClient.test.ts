/**
 * Serper Client Tests
 */

import { SerperClient, SerperError } from './serperClient';

// Mock environment
process.env.SERPER_API_KEY = 'test-api-key';
process.env.SERPER_TIMEOUT_MS = '5000';

describe('SerperClient', () => {
  let client: SerperClient;

  beforeEach(() => {
    client = new SerperClient();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should throw error if SERPER_API_KEY is not set', () => {
      delete process.env.SERPER_API_KEY;
      expect(() => new SerperClient()).toThrow('SERPER_API_KEY environment variable is required');
      process.env.SERPER_API_KEY = 'test-api-key';
    });

    it('should initialize with API key and timeout', () => {
      expect(client).toBeDefined();
    });
  });

  describe('searchNews', () => {
    it('should successfully search news', async () => {
      const mockResponse = {
        news: [
          {
            title: 'Test Article',
            link: 'https://example.com/article',
            snippet: 'Test snippet',
            date: '2026-03-13',
            source: 'Example News',
          },
        ],
        searchParameters: {
          q: 'test query',
          type: 'news',
          engine: 'google',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.searchNews({ q: 'test query', num: 10 });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://google.serper.dev/news',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'X-API-KEY': 'test-api-key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ q: 'test query', num: 10 }),
        })
      );
    });

    it('should handle 401 unauthorized error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Unauthorized' }),
      });

      await expect(client.searchNews({ q: 'test', num: 10 })).rejects.toThrow(
        'Unauthorized: Invalid Serper API key'
      );
    });

    it('should handle 403 forbidden error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ message: 'Forbidden' }),
      });

      await expect(client.searchNews({ q: 'test', num: 10 })).rejects.toThrow(
        'Forbidden: Serper API access denied'
      );
    });

    it('should handle 429 rate limit error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ message: 'Rate limit exceeded' }),
      });

      await expect(client.searchNews({ q: 'test', num: 10 })).rejects.toThrow(
        'Rate limit exceeded for Serper API'
      );
    });

    it('should handle timeout', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          }, 100);
        });
      });

      await expect(client.searchNews({ q: 'test', num: 10 })).rejects.toThrow(
        'Serper API request timed out'
      );
    });

    it('should handle invalid response structure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' }),
      });

      await expect(client.searchNews({ q: 'test', num: 10 })).rejects.toThrow(
        'Invalid response structure from Serper API'
      );
    });

    it('should include optional parameters', async () => {
      const mockResponse = {
        news: [],
        searchParameters: {
          q: 'test',
          type: 'news',
          engine: 'google',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await client.searchNews({
        q: 'test',
        num: 5,
        tbs: 'qdr:w',
        location: 'United States',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://google.serper.dev/news',
        expect.objectContaining({
          body: JSON.stringify({
            q: 'test',
            num: 5,
            tbs: 'qdr:w',
            location: 'United States',
          }),
        })
      );
    });
  });

  describe('healthCheck', () => {
    it('should return true when API is accessible', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ news: [] }),
      });

      const result = await client.healthCheck();
      expect(result).toBe(true);
    });

    it('should return false when API is not accessible', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await client.healthCheck();
      expect(result).toBe(false);
    });
  });
});
