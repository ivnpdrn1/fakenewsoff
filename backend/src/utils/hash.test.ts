/**
 * Unit Tests for Content Hashing Utilities
 * 
 * Tests normalization and hashing for deterministic content identification
 * Validates: Requirements 11.1
 */

import { normalizeContent, computeContentHash } from './hash';

describe('normalizeContent', () => {
  describe('basic normalization', () => {
    it('should convert to lowercase', () => {
      const input = 'Test Content With UPPERCASE';
      const result = normalizeContent(input);
      expect(result).toBe('test content with uppercase');
    });

    it('should trim leading whitespace', () => {
      const input = '   test content';
      const result = normalizeContent(input);
      expect(result).toBe('test content');
    });

    it('should trim trailing whitespace', () => {
      const input = 'test content   ';
      const result = normalizeContent(input);
      expect(result).toBe('test content');
    });

    it('should trim both leading and trailing whitespace', () => {
      const input = '   test content   ';
      const result = normalizeContent(input);
      expect(result).toBe('test content');
    });

    it('should normalize internal whitespace', () => {
      const input = 'test    content   with    spaces';
      const result = normalizeContent(input);
      expect(result).toBe('test content with spaces');
    });

    it('should handle tabs and newlines', () => {
      const input = 'test\t\tcontent\n\nwith\r\nwhitespace';
      const result = normalizeContent(input);
      expect(result).toBe('test content with whitespace');
    });

    it('should handle empty string', () => {
      const input = '';
      const result = normalizeContent(input);
      expect(result).toBe('');
    });

    it('should handle whitespace-only string', () => {
      const input = '   \t\n   ';
      const result = normalizeContent(input);
      expect(result).toBe('');
    });
  });

  describe('tracking parameter removal', () => {
    it('should remove utm_source parameter', () => {
      const input = 'https://example.com/article?utm_source=twitter';
      const result = normalizeContent(input);
      expect(result).toBe('https://example.com/article');
    });

    it('should remove utm_medium parameter', () => {
      const input = 'https://example.com/article?utm_medium=social';
      const result = normalizeContent(input);
      expect(result).toBe('https://example.com/article');
    });

    it('should remove utm_campaign parameter', () => {
      const input = 'https://example.com/article?utm_campaign=spring_sale';
      const result = normalizeContent(input);
      expect(result).toBe('https://example.com/article');
    });

    it('should remove utm_term parameter', () => {
      const input = 'https://example.com/article?utm_term=keyword';
      const result = normalizeContent(input);
      expect(result).toBe('https://example.com/article');
    });

    it('should remove utm_content parameter', () => {
      const input = 'https://example.com/article?utm_content=banner';
      const result = normalizeContent(input);
      expect(result).toBe('https://example.com/article');
    });

    it('should remove fbclid parameter', () => {
      const input = 'https://example.com/article?fbclid=IwAR123abc';
      const result = normalizeContent(input);
      expect(result).toBe('https://example.com/article');
    });

    it('should remove gclid parameter', () => {
      const input = 'https://example.com/article?gclid=Cj0KCQ123';
      const result = normalizeContent(input);
      expect(result).toBe('https://example.com/article');
    });

    it('should remove msclkid parameter', () => {
      const input = 'https://example.com/article?msclkid=abc123';
      const result = normalizeContent(input);
      expect(result).toBe('https://example.com/article');
    });

    it('should remove multiple tracking parameters', () => {
      const input = 'https://example.com/article?utm_source=twitter&utm_medium=social&fbclid=123';
      const result = normalizeContent(input);
      expect(result).toBe('https://example.com/article');
    });

    it('should preserve non-tracking parameters', () => {
      const input = 'https://example.com/article?id=123&page=2';
      const result = normalizeContent(input);
      expect(result).toBe('https://example.com/article?id=123&page=2');
    });

    it('should remove tracking params and preserve other params', () => {
      const input = 'https://example.com/article?id=123&utm_source=twitter&page=2';
      const result = normalizeContent(input);
      expect(result).toBe('https://example.com/article?id=123&page=2');
    });

    it('should handle tracking params at the end', () => {
      const input = 'https://example.com/article?id=123&utm_source=twitter';
      const result = normalizeContent(input);
      expect(result).toBe('https://example.com/article?id=123');
    });

    it('should handle tracking params at the beginning', () => {
      const input = 'https://example.com/article?utm_source=twitter&id=123';
      const result = normalizeContent(input);
      expect(result).toBe('https://example.com/article?id=123');
    });

    it('should handle tracking params in the middle', () => {
      const input = 'https://example.com/article?id=123&utm_source=twitter&page=2';
      const result = normalizeContent(input);
      expect(result).toBe('https://example.com/article?id=123&page=2');
    });

    it('should handle multiple URLs in content', () => {
      const input = 'Check https://example.com?utm_source=a and https://test.com?fbclid=b';
      const result = normalizeContent(input);
      expect(result).toBe('check https://example.com and https://test.com');
    });

    it('should remove _ga parameter', () => {
      const input = 'https://example.com/article?_ga=GA1.2.123456';
      const result = normalizeContent(input);
      expect(result).toBe('https://example.com/article');
    });

    it('should remove _gl parameter', () => {
      const input = 'https://example.com/article?_gl=1*abc123';
      const result = normalizeContent(input);
      expect(result).toBe('https://example.com/article');
    });

    it('should remove mc_eid parameter', () => {
      const input = 'https://example.com/article?mc_eid=abc123';
      const result = normalizeContent(input);
      expect(result).toBe('https://example.com/article');
    });

    it('should remove mc_cid parameter', () => {
      const input = 'https://example.com/article?mc_cid=xyz789';
      const result = normalizeContent(input);
      expect(result).toBe('https://example.com/article');
    });
  });

  describe('combined normalization', () => {
    it('should apply all normalizations together', () => {
      const input = '  Test   CONTENT\n\nhttps://example.com?utm_source=twitter  ';
      const result = normalizeContent(input);
      expect(result).toBe('test content https://example.com');
    });

    it('should handle complex real-world content', () => {
      const input = `
        Breaking News:  
        Read more at https://news.example.com/article?id=123&utm_source=newsletter&utm_campaign=daily
        Share: https://example.com/share?fbclid=abc123&gclid=xyz789
      `;
      const result = normalizeContent(input);
      expect(result).toContain('breaking news:');
      expect(result).toContain('https://news.example.com/article?id=123');
      expect(result).toContain('https://example.com/share');
      expect(result).not.toContain('utm_source');
      expect(result).not.toContain('fbclid');
    });
  });
});

describe('computeContentHash', () => {
  describe('hash stability', () => {
    it('should produce same hash for same input', async () => {
      const content = 'Test content for hashing';
      
      const hash1 = await computeContentHash(content);
      const hash2 = await computeContentHash(content);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce same hash when called multiple times', async () => {
      const content = 'Consistent hashing test';
      
      const hashes = await Promise.all([
        computeContentHash(content),
        computeContentHash(content),
        computeContentHash(content),
        computeContentHash(content),
        computeContentHash(content),
      ]);
      
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1);
    });

    it('should return 64-character hex string', async () => {
      const content = 'Test';
      const hash = await computeContentHash(content);
      
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('normalization effectiveness', () => {
    it('should produce same hash for different case', async () => {
      const content1 = 'Test Content';
      const content2 = 'test content';
      
      const hash1 = await computeContentHash(content1);
      const hash2 = await computeContentHash(content2);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce same hash for different whitespace', async () => {
      const content1 = 'Test   Content';
      const content2 = 'test content';
      
      const hash1 = await computeContentHash(content1);
      const hash2 = await computeContentHash(content2);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce same hash with leading/trailing whitespace', async () => {
      const content1 = '  Test Content  ';
      const content2 = 'test content';
      
      const hash1 = await computeContentHash(content1);
      const hash2 = await computeContentHash(content2);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce same hash with tabs and newlines', async () => {
      const content1 = 'Test\t\tContent\n\nHere';
      const content2 = 'test content here';
      
      const hash1 = await computeContentHash(content1);
      const hash2 = await computeContentHash(content2);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce same hash with tracking parameters removed', async () => {
      const content1 = 'https://example.com/article?utm_source=twitter';
      const content2 = 'https://example.com/article';
      
      const hash1 = await computeContentHash(content1);
      const hash2 = await computeContentHash(content2);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce same hash with multiple tracking params removed', async () => {
      const content1 = 'https://example.com/article?utm_source=twitter&utm_medium=social&fbclid=123';
      const content2 = 'https://example.com/article';
      
      const hash1 = await computeContentHash(content1);
      const hash2 = await computeContentHash(content2);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce same hash for complex normalized content', async () => {
      const content1 = '  Breaking NEWS:  https://example.com?utm_source=twitter  ';
      const content2 = 'breaking news: https://example.com';
      
      const hash1 = await computeContentHash(content1);
      const hash2 = await computeContentHash(content2);
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('hash uniqueness', () => {
    it('should produce different hashes for different content', async () => {
      const content1 = 'First content';
      const content2 = 'Second content';
      
      const hash1 = await computeContentHash(content1);
      const hash2 = await computeContentHash(content2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for similar content', async () => {
      const content1 = 'Test content here';
      const content2 = 'Test content there';
      
      const hash1 = await computeContentHash(content1);
      const hash2 = await computeContentHash(content2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for content with different URLs', async () => {
      const content1 = 'https://example.com/article1';
      const content2 = 'https://example.com/article2';
      
      const hash1 = await computeContentHash(content1);
      const hash2 = await computeContentHash(content2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for content with different non-tracking params', async () => {
      const content1 = 'https://example.com/article?id=1';
      const content2 = 'https://example.com/article?id=2';
      
      const hash1 = await computeContentHash(content1);
      const hash2 = await computeContentHash(content2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', async () => {
      const content = '';
      const hash = await computeContentHash(content);
      
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should handle whitespace-only string', async () => {
      const content = '   \t\n   ';
      const hash = await computeContentHash(content);
      
      // Should produce same hash as empty string (after normalization)
      const emptyHash = await computeContentHash('');
      expect(hash).toBe(emptyHash);
    });

    it('should handle very long content', async () => {
      const content = 'a'.repeat(100000);
      const hash = await computeContentHash(content);
      
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should handle unicode characters', async () => {
      const content = 'Hello 世界 🌍';
      const hash = await computeContentHash(content);
      
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should handle special characters', async () => {
      const content = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const hash = await computeContentHash(content);
      
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should produce consistent hash for unicode content', async () => {
      const content1 = 'Hello 世界';
      const content2 = 'HELLO 世界';
      
      const hash1 = await computeContentHash(content1);
      const hash2 = await computeContentHash(content2);
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('real-world use cases', () => {
    it('should hash retrieval query payload consistently', async () => {
      const query1 = 'What is the capital of France?';
      const query2 = 'what is the capital of france?';
      
      const hash1 = await computeContentHash(query1);
      const hash2 = await computeContentHash(query2);
      
      expect(hash1).toBe(hash2);
    });

    it('should hash RAG assembled context consistently', async () => {
      const context1 = `
        Source 1: Paris is the capital of France.
        Source 2: The city has a population of 2.2 million.
      `;
      const context2 = 'source 1: paris is the capital of france. source 2: the city has a population of 2.2 million.';
      
      const hash1 = await computeContentHash(context1);
      const hash2 = await computeContentHash(context2);
      
      expect(hash1).toBe(hash2);
    });

    it('should hash final prompts consistently', async () => {
      const prompt1 = `
        Analyze the following content:
        https://example.com/article?utm_source=twitter
      `;
      const prompt2 = 'analyze the following content: https://example.com/article';
      
      const hash1 = await computeContentHash(prompt1);
      const hash2 = await computeContentHash(prompt2);
      
      expect(hash1).toBe(hash2);
    });

    it('should enable request deduplication', async () => {
      const request1 = {
        url: 'https://example.com/article?utm_source=twitter',
        text: '  Breaking NEWS  ',
      };
      const request2 = {
        url: 'https://example.com/article',
        text: 'breaking news',
      };
      
      const content1 = `${request1.url} ${request1.text}`;
      const content2 = `${request2.url} ${request2.text}`;
      
      const hash1 = await computeContentHash(content1);
      const hash2 = await computeContentHash(content2);
      
      expect(hash1).toBe(hash2);
    });
  });
});
