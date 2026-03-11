/**
 * Evidence Quality Filter Tests
 * 
 * Tests for the isGenericPage function
 */

import { describe, it, expect } from 'vitest';

// Copy of the isGenericPage function for testing
function isGenericPage(url: string, title: string): boolean {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();
    const titleLower = title.toLowerCase();
    
    // Homepage patterns
    if (path === '/' || path === '/index.html' || path === '/index.php') {
      return true;
    }
    
    // Category page patterns
    if (path.includes('/category/') || path.includes('/categories/') || 
        path.includes('/section/') || path.includes('/sections/')) {
      return true;
    }
    
    // Tag page patterns
    if (path.includes('/tag/') || path.includes('/tags/') || 
        path.includes('/topic/') || path.includes('/topics/')) {
      return true;
    }
    
    // Search page patterns
    if (path.includes('/search') || urlObj.search.includes('?s=') || 
        urlObj.search.includes('?q=') || urlObj.search.includes('search=')) {
      return true;
    }
    
    // Latest news / archive patterns (only if it's just /news/ or /latest/ or /archive/ without specific article)
    const pathParts = path.split('/').filter(p => p.length > 0);
    if ((path.includes('/latest') || path.includes('/archive')) && pathParts.length <= 1) {
      return true;
    }
    // /news/ is only generic if it's exactly /news or /news/ (no article path after)
    if (path === '/news' || path === '/news/') {
      return true;
    }
    
    // Title-based detection for generic pages
    if (titleLower.includes('home page') || titleLower.includes('homepage') ||
        titleLower === 'home' || titleLower.includes('latest news') ||
        titleLower.includes('search results')) {
      return true;
    }
    
    return false;
  } catch {
    // If URL parsing fails, don't filter it out
    return false;
  }
}

describe('isGenericPage', () => {
  it('identifies homepage URLs', () => {
    expect(isGenericPage('https://example.com/', 'Example Homepage')).toBe(true);
    expect(isGenericPage('https://example.com/index.html', 'Home')).toBe(true);
    expect(isGenericPage('https://example.com/index.php', 'Home')).toBe(true);
  });

  it('identifies category page URLs', () => {
    expect(isGenericPage('https://example.com/category/news', 'News Category')).toBe(true);
    expect(isGenericPage('https://example.com/categories/tech', 'Tech')).toBe(true);
    expect(isGenericPage('https://example.com/section/sports', 'Sports')).toBe(true);
  });

  it('identifies tag page URLs', () => {
    expect(isGenericPage('https://example.com/tag/politics', 'Politics Tag')).toBe(true);
    expect(isGenericPage('https://example.com/tags/election', 'Election')).toBe(true);
    expect(isGenericPage('https://example.com/topic/climate', 'Climate')).toBe(true);
  });

  it('identifies search page URLs', () => {
    expect(isGenericPage('https://example.com/search?q=test', 'Search Results')).toBe(true);
    expect(isGenericPage('https://example.com/?s=query', 'Search')).toBe(true);
    expect(isGenericPage('https://example.com/search', 'Search')).toBe(true);
  });

  it('identifies generic titles', () => {
    expect(isGenericPage('https://example.com/some-path', 'Home Page')).toBe(true);
    expect(isGenericPage('https://example.com/some-path', 'Homepage')).toBe(true);
    expect(isGenericPage('https://example.com/some-path', 'Latest News')).toBe(true);
    expect(isGenericPage('https://example.com/some-path', 'Search Results')).toBe(true);
  });

  it('does not filter specific article URLs', () => {
    expect(isGenericPage('https://example.com/article', 'Specific Article')).toBe(false);
    expect(isGenericPage('https://example.com/2024/01/story', 'Breaking Story')).toBe(false);
    expect(isGenericPage('https://example.com/news/breaking-story', 'Breaking Story')).toBe(false);
  });

  it('handles invalid URLs gracefully', () => {
    expect(isGenericPage('not-a-url', 'Title')).toBe(false);
    expect(isGenericPage('', 'Title')).toBe(false);
  });
});
