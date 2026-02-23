/**
 * Unit Tests for Storage Policy
 * 
 * Tests truncation functions, size estimation, and logging
 * 
 * Validates: Requirements 11.1, 11.2
 */

import {
  MAX_STORED_TEXT_CHARS,
  truncateForStorage,
  truncateSnippets,
  truncateWhyFields,
  estimateItemSize,
  exceedsDynamoDBLimit,
  logTruncation
} from './storagePolicy';
import { CredibleSource } from './schemaValidators';

describe('storagePolicy', () => {
  describe('truncateForStorage', () => {
    it('should not truncate text shorter than max length', () => {
      const text = 'Short text';
      expect(truncateForStorage(text)).toBe(text);
    });

    it('should truncate text longer than max length', () => {
      const text = 'a'.repeat(MAX_STORED_TEXT_CHARS + 100);
      const result = truncateForStorage(text);
      
      expect(result.length).toBeLessThan(MAX_STORED_TEXT_CHARS);
      expect(result).toContain('[truncated]');
    });

    it('should preserve word boundaries when truncating', () => {
      const text = 'word '.repeat(5000); // Creates text with spaces
      const result = truncateForStorage(text, 100);
      
      // Should not end with partial word (unless it's the truncation indicator)
      expect(result).toMatch(/\s\[truncated\]$/);
    });

    it('should handle text with no spaces', () => {
      const text = 'a'.repeat(1000);
      const result = truncateForStorage(text, 100);
      
      expect(result.length).toBeLessThanOrEqual(100);
      expect(result).toContain('[truncated]');
    });

    it('should be deterministic', () => {
      const text = 'This is a long text that needs truncation. '.repeat(1000);
      const result1 = truncateForStorage(text, 500);
      const result2 = truncateForStorage(text, 500);
      
      expect(result1).toBe(result2);
    });

    it('should handle empty string', () => {
      expect(truncateForStorage('')).toBe('');
    });

    it('should handle custom max length', () => {
      const text = 'a'.repeat(1000);
      const result = truncateForStorage(text, 50);
      
      expect(result.length).toBeLessThanOrEqual(50);
    });

    it('should preserve meaning by keeping first N characters', () => {
      const text = 'Important information at the start. ' + 'filler '.repeat(5000);
      const result = truncateForStorage(text, 100);
      
      expect(result).toContain('Important information');
    });
  });

  describe('truncateSnippets', () => {
    it('should truncate all snippets in array', () => {
      const snippets = [
        'a'.repeat(600),
        'b'.repeat(700),
        'c'.repeat(800)
      ];
      
      const result = truncateSnippets(snippets);
      
      expect(result).toHaveLength(3);
      result.forEach(snippet => {
        expect(snippet.length).toBeLessThanOrEqual(500);
        expect(snippet).toContain('[truncated]');
      });
    });

    it('should not truncate short snippets', () => {
      const snippets = ['short', 'snippets', 'here'];
      const result = truncateSnippets(snippets);
      
      expect(result).toEqual(snippets);
    });

    it('should handle empty array', () => {
      expect(truncateSnippets([])).toEqual([]);
    });

    it('should preserve array structure', () => {
      const snippets = ['first', 'second', 'third'];
      const result = truncateSnippets(snippets);
      
      expect(result).toHaveLength(snippets.length);
    });
  });

  describe('truncateWhyFields', () => {
    it('should truncate snippet and why fields in sources', () => {
      const sources: CredibleSource[] = [
        {
          url: 'https://example.com/1',
          title: 'Source 1',
          snippet: 'a'.repeat(600),
          why: 'b'.repeat(400),
          domain: 'example.com'
        },
        {
          url: 'https://example.com/2',
          title: 'Source 2',
          snippet: 'c'.repeat(700),
          why: 'd'.repeat(500),
          domain: 'example.com'
        }
      ];
      
      const result = truncateWhyFields(sources);
      
      expect(result).toHaveLength(2);
      result.forEach(source => {
        expect(source.snippet.length).toBeLessThanOrEqual(500);
        expect(source.why.length).toBeLessThanOrEqual(300);
        expect(source.snippet).toContain('[truncated]');
        expect(source.why).toContain('[truncated]');
      });
    });

    it('should not truncate short fields', () => {
      const sources: CredibleSource[] = [
        {
          url: 'https://example.com',
          title: 'Source',
          snippet: 'Short snippet',
          why: 'Short explanation',
          domain: 'example.com'
        }
      ];
      
      const result = truncateWhyFields(sources);
      
      expect(result[0].snippet).toBe('Short snippet');
      expect(result[0].why).toBe('Short explanation');
    });

    it('should preserve other source fields', () => {
      const sources: CredibleSource[] = [
        {
          url: 'https://example.com',
          title: 'Test Source',
          snippet: 'a'.repeat(600),
          why: 'b'.repeat(400),
          domain: 'example.com'
        }
      ];
      
      const result = truncateWhyFields(sources);
      
      expect(result[0].url).toBe('https://example.com');
      expect(result[0].title).toBe('Test Source');
      expect(result[0].domain).toBe('example.com');
    });

    it('should handle empty array', () => {
      expect(truncateWhyFields([])).toEqual([]);
    });
  });

  describe('estimateItemSize', () => {
    it('should estimate size of simple object', () => {
      const obj = { key: 'value' };
      const size = estimateItemSize(obj);
      
      expect(size).toBeGreaterThan(0);
      expect(size).toBeLessThan(100);
    });

    it('should estimate larger size for larger objects', () => {
      const smallObj = { key: 'value' };
      const largeObj = { key: 'a'.repeat(10000) };
      
      const smallSize = estimateItemSize(smallObj);
      const largeSize = estimateItemSize(largeObj);
      
      expect(largeSize).toBeGreaterThan(smallSize);
    });

    it('should handle nested objects', () => {
      const obj = {
        level1: {
          level2: {
            level3: 'deep value'
          }
        }
      };
      
      const size = estimateItemSize(obj);
      expect(size).toBeGreaterThan(0);
    });

    it('should handle arrays', () => {
      const obj = {
        items: ['item1', 'item2', 'item3']
      };
      
      const size = estimateItemSize(obj);
      expect(size).toBeGreaterThan(0);
    });
  });

  describe('exceedsDynamoDBLimit', () => {
    it('should return false for small objects', () => {
      const obj = { key: 'value' };
      expect(exceedsDynamoDBLimit(obj)).toBe(false);
    });

    it('should return true for objects exceeding 400KB', () => {
      const largeText = 'a'.repeat(500 * 1024); // 500KB of text
      const obj = { text: largeText };
      
      expect(exceedsDynamoDBLimit(obj)).toBe(true);
    });

    it('should return false for objects near but under limit', () => {
      const text = 'a'.repeat(300 * 1024); // 300KB of text
      const obj = { text };
      
      expect(exceedsDynamoDBLimit(obj)).toBe(false);
    });
  });

  describe('logTruncation', () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should log truncation event with structured data', () => {
      logTruncation('text', 10000, 5000, 'test-request-id');
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.event).toBe('content_truncated');
      expect(loggedData.field).toBe('text');
      expect(loggedData.original_length).toBe(10000);
      expect(loggedData.truncated_length).toBe(5000);
      expect(loggedData.reduction_percent).toBe(50);
      expect(loggedData.request_id).toBe('test-request-id');
      expect(loggedData.timestamp).toBeDefined();
    });

    it('should work without request_id', () => {
      logTruncation('snippet', 1000, 500);
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.request_id).toBeUndefined();
    });

    it('should calculate reduction percentage correctly', () => {
      logTruncation('field', 1000, 250);
      
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.reduction_percent).toBe(75);
    });
  });
});
