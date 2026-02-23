import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

interface FetchResult {
  cleanedText: string;
  title?: string;
  extraction_method: 'article' | 'readability' | 'body';
  warnings: string[];
}

interface CacheEntry {
  data: FetchResult;
  timestamp: number;
}

// LRU Cache implementation
class LRUCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number, ttlMs: number) {
    this.maxSize = maxSize;
    this.ttl = ttlMs;
  }

  get(key: string): FetchResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  set(key: string, value: FetchResult): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value as string;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data: value,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

const cache = new LRUCache(100, 60 * 60 * 1000); // 100 entries, 1 hour TTL

// Export for testing
export function clearFetchCache(): void {
  cache.clear();
}

const MAX_HTML_SIZE = 2 * 1024 * 1024; // 2MB
const TIMEOUT_MS = 8000;
const USER_AGENT = 'Mozilla/5.0 (compatible; FakeNewsOff/1.0)';

export async function fetchFullText(url: string): Promise<FetchResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  // Check cache
  const cached = cache.get(url);
  if (cached) {
    logCacheHit(url, Date.now() - startTime);
    return cached;
  }

  try {
    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // Handle HTTP errors
    if (response.status === 403) {
      warnings.push('Access forbidden (403)');
    } else if (response.status === 429) {
      warnings.push('Rate limited (429)');
    } else if (!response.ok) {
      warnings.push(`HTTP error: ${response.status}`);
    }

    // Check content length
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_HTML_SIZE) {
      warnings.push('Content exceeds 2MB limit');
      const result: FetchResult = {
        cleanedText: '',
        extraction_method: 'body',
        warnings
      };
      logFetchMetrics(url, 0, 'body', warnings.length, Date.now() - startTime);
      return result;
    }

    const html = await response.text();

    // Check actual HTML size
    if (html.length > MAX_HTML_SIZE) {
      warnings.push('HTML exceeds 2MB limit');
      const result: FetchResult = {
        cleanedText: '',
        extraction_method: 'body',
        warnings
      };
      logFetchMetrics(url, html.length, 'body', warnings.length, Date.now() - startTime);
      return result;
    }

    // Detect paywall patterns
    if (html.includes('paywall') || html.includes('subscribe to read')) {
      warnings.push('Possible paywall detected');
    }

    // Parse HTML
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Remove unwanted elements
    const unwantedSelectors = ['script', 'style', 'nav', 'footer', 'aside'];
    unwantedSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach((el: Element) => el.remove());
    });

    // Extract title
    const titleElement = document.querySelector('title');
    const title = titleElement?.textContent?.trim();

    // Extract text with priority
    let cleanedText = '';
    let extraction_method: 'article' | 'readability' | 'body' = 'body';

    const article = document.querySelector('article');
    if (article) {
      cleanedText = article.textContent?.trim() || '';
      extraction_method = 'article';
    } else {
      const body = document.querySelector('body');
      cleanedText = body?.textContent?.trim() || '';
      extraction_method = 'body';
    }

    // Clean up whitespace
    cleanedText = cleanedText.replace(/\s+/g, ' ').trim();

    const result: FetchResult = {
      cleanedText,
      title,
      extraction_method,
      warnings
    };

    // Cache the result
    cache.set(url, result);

    // Log metrics
    logFetchMetrics(url, html.length, extraction_method, warnings.length, Date.now() - startTime);

    return result;

  } catch (error: any) {
    if (error.name === 'AbortError') {
      warnings.push('Request timeout');
    } else {
      warnings.push(`Fetch error: ${error.message}`);
    }

    const result: FetchResult = {
      cleanedText: '',
      extraction_method: 'body',
      warnings
    };

    logFetchMetrics(url, 0, 'body', warnings.length, Date.now() - startTime);
    return result;
  }
}

function logFetchMetrics(
  url: string,
  htmlBytes: number,
  extractionMethod: string,
  warningsCount: number,
  durationMs: number
): void {
  const urlDomain = new URL(url).hostname;
  const logData = {
    event: 'fetch_miss',
    url_domain: urlDomain,
    html_bytes: htmlBytes,
    extraction_method: extractionMethod,
    warnings_count: warningsCount,
    duration_ms: durationMs
  };
  console.log(JSON.stringify(logData));
}

function logCacheHit(url: string, durationMs: number): void {
  const urlDomain = new URL(url).hostname;
  const logData = {
    event: 'cache_hit',
    url_domain: urlDomain,
    duration_ms: durationMs
  };
  console.log(JSON.stringify(logData));
}
