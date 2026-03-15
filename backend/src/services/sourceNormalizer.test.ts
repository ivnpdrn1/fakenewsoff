/**
 * Source Normalizer Tests
 */

import { normalizeSerperArticles } from './sourceNormalizer';
import type { SerperNewsArticle } from '../clients/serperClient';

describe('normalizeSerperArticles', () => {
  it('should normalize valid Serper articles', () => {
    const articles: SerperNewsArticle[] = [
      {
        title: 'Test Article',
        link: 'https://example.com/article',
        snippet: 'This is a test snippet',
        date: '2026-03-13T10:00:00Z',
        source: 'Example News',
      },
    ];

    const result = normalizeSerperArticles(articles);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: 'Test Article',
      url: 'https://example.com/article',
      snippet: 'This is a test snippet',
      domain: 'example.com',
      score: 0,
    });
    expect(result[0].publishDate).toBeDefined();
  });

  it('should filter out invalid URLs', () => {
    const articles: SerperNewsArticle[] = [
      {
        title: 'Valid Article',
        link: 'https://example.com/article',
        snippet: 'Valid snippet',
        date: '2026-03-13',
        source: 'Example',
      },
      {
        title: 'Invalid Article',
        link: 'not-a-url',
        snippet: 'Invalid snippet',
        date: '2026-03-13',
        source: 'Example',
      },
    ];

    const result = normalizeSerperArticles(articles);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Valid Article');
  });

  it('should handle various date formats', () => {
    const articles: SerperNewsArticle[] = [
      {
        title: 'Article 1',
        link: 'https://example.com/1',
        snippet: 'Snippet 1',
        date: '2026-03-13T10:00:00Z',
        source: 'Example',
      },
      {
        title: 'Article 2',
        link: 'https://example.com/2',
        snippet: 'Snippet 2',
        date: '2026-03-13',
        source: 'Example',
      },
      {
        title: 'Article 3',
        link: 'https://example.com/3',
        snippet: 'Snippet 3',
        date: 'invalid-date',
        source: 'Example',
      },
    ];

    const result = normalizeSerperArticles(articles);

    expect(result).toHaveLength(3);
    // All should have valid ISO8601 dates
    result.forEach((article) => {
      expect(article.publishDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  it('should truncate long snippets', () => {
    const longSnippet = 'a'.repeat(250);
    const articles: SerperNewsArticle[] = [
      {
        title: 'Test Article',
        link: 'https://example.com/article',
        snippet: longSnippet,
        date: '2026-03-13',
        source: 'Example',
      },
    ];

    const result = normalizeSerperArticles(articles);

    expect(result[0].snippet.length).toBeLessThanOrEqual(200);
    expect(result[0].snippet).toContain('...');
  });

  it('should use title as fallback snippet', () => {
    const articles: SerperNewsArticle[] = [
      {
        title: 'Test Article Title',
        link: 'https://example.com/article',
        snippet: '',
        date: '2026-03-13',
        source: 'Example',
      },
    ];

    const result = normalizeSerperArticles(articles);

    expect(result[0].snippet).toBe('Test Article Title');
  });

  it('should extract domain from URL', () => {
    const articles: SerperNewsArticle[] = [
      {
        title: 'Test',
        link: 'https://www.bbc.co.uk/news/article',
        snippet: 'Test',
        date: '2026-03-13',
        source: 'BBC',
      },
      {
        title: 'Test 2',
        link: 'https://news.google.com/article',
        snippet: 'Test 2',
        date: '2026-03-13',
        source: 'Google',
      },
    ];

    const result = normalizeSerperArticles(articles);

    expect(result[0].domain).toBe('bbc.co.uk');
    expect(result[1].domain).toBe('google.com');
  });

  it('should handle empty array', () => {
    const result = normalizeSerperArticles([]);
    expect(result).toEqual([]);
  });

  it('should remove tracking parameters from URLs', () => {
    const articles: SerperNewsArticle[] = [
      {
        title: 'Test',
        link: 'https://example.com/article?utm_source=twitter&utm_campaign=test',
        snippet: 'Test',
        date: '2026-03-13',
        source: 'Example',
      },
    ];

    const result = normalizeSerperArticles(articles);

    expect(result[0].url).toBe('https://example.com/article');
  });
});
