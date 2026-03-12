/**
 * Source Normalization and Ranking
 *
 * Normalizes, deduplicates, and ranks news sources from API providers
 *
 * Validates: Requirements FR3.1, FR3.2, FR3.3, FR3.4, FR3.5
 */

import psl from 'psl';
import urlParse from 'url-parse';
import { BingNewsArticle, GDELTArticle, NormalizedSource } from '../types/grounding';
import { getDomainTier } from '../utils/domainTiers';
import type { BingWebResult } from '../clients/bingWebClient';

/**
 * Tracking parameters to remove from URLs
 */
const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  '_ga',
  '_gid',
  '_hsenc',
  '_hsmi',
  'hsCtaTracking',
];

/**
 * Normalize URL by removing tracking parameters and normalizing protocol
 *
 * @param url - URL to normalize
 * @returns Normalized URL
 *
 * @example
 * normalizeUrl("https://example.com/article?utm_source=twitter") // "https://example.com/article"
 */
export function normalizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  try {
    const parsed = urlParse(url, true);

    // Remove tracking parameters
    const query = parsed.query as Record<string, string>;
    const cleanQuery: Record<string, string> = {};

    for (const [key, value] of Object.entries(query)) {
      if (!TRACKING_PARAMS.includes(key.toLowerCase())) {
        cleanQuery[key] = value;
      }
    }

    // Rebuild URL
    parsed.set('query', cleanQuery);

    // Normalize protocol to lowercase
    let normalized = parsed.toString();
    normalized = normalized.replace(/^HTTP:/, 'http:').replace(/^HTTPS:/, 'https:');

    // Remove trailing slash
    if (normalized.endsWith('/') && normalized.length > 8) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  } catch {
    // Return original URL if parsing fails
    return url;
  }
}

/**
 * Extract registrable domain (eTLD+1) from URL
 *
 * @param url - URL to extract domain from
 * @returns Registrable domain or null if invalid
 *
 * @example
 * extractDomain("https://www.bbc.co.uk/news/article") // "bbc.co.uk"
 * extractDomain("https://news.google.com/article") // "google.com"
 */
export function extractDomain(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const parsed = urlParse(url);
    const hostname = parsed.hostname;

    if (!hostname) {
      return null;
    }

    // Handle localhost and IP addresses
    if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return hostname;
    }

    // Use psl to get registrable domain
    const parsedDomain = psl.parse(hostname);

    if ('error' in parsedDomain || !('domain' in parsedDomain) || !parsedDomain.domain) {
      return hostname; // Fallback to hostname
    }

    return parsedDomain.domain;
  } catch {
    return null;
  }
}

/**
 * Normalize Bing News articles to common format
 *
 * @param articles - Bing News articles
 * @returns Normalized sources
 */
export function normalizeBingArticles(articles: BingNewsArticle[]): NormalizedSource[] {
  return articles
    .map((article) => {
      const url = normalizeUrl(article.url);
      const domain = extractDomain(url) || 'unknown';
      const snippet =
        article.description.length > 200
          ? article.description.substring(0, 197) + '...'
          : article.description;

      return {
        url,
        title: article.name,
        snippet,
        publishDate: article.datePublished,
        domain,
        score: 0, // Will be calculated later
      };
    })
    .filter((source) => source.url && source.domain !== 'unknown');
}

/**
 * Normalize GDELT articles to common format
 *
 * @param articles - GDELT articles
 * @returns Normalized sources
 */
export function normalizeGDELTArticles(articles: GDELTArticle[]): NormalizedSource[] {
  return articles
    .map((article) => {
      const url = normalizeUrl(article.url);
      const domain = extractDomain(url) || article.domain || 'unknown';

      // Convert GDELT seendate (YYYYMMDDHHMMSS) to ISO8601
      const seendate = article.seendate;
      let publishDate: string;
      try {
        const year = seendate.substring(0, 4);
        const month = seendate.substring(4, 6);
        const day = seendate.substring(6, 8);
        const hour = seendate.substring(8, 10);
        const minute = seendate.substring(10, 12);
        const second = seendate.substring(12, 14);
        publishDate = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
      } catch {
        publishDate = new Date().toISOString();
      }

      const snippet =
        article.title.length > 200 ? article.title.substring(0, 197) + '...' : article.title;

      return {
        url,
        title: article.title,
        snippet,
        publishDate,
        domain,
        score: 0, // Will be calculated later
      };
    })
    .filter((source) => source.url && source.domain !== 'unknown');
}

/**
 * Normalize Bing Web Search results to common format
 *
 * @param results - Bing Web Search results
 * @returns Normalized sources
 */
export function normalizeBingWebResults(results: BingWebResult[]): NormalizedSource[] {
  return results
    .map((result) => {
      const url = normalizeUrl(result.url);
      const domain = extractDomain(url) || 'unknown';

      // Use dateLastCrawled if available, otherwise use current date
      const publishDate = result.dateLastCrawled || new Date().toISOString();

      const snippet =
        result.snippet.length > 200
          ? result.snippet.substring(0, 197) + '...'
          : result.snippet;

      return {
        url,
        title: result.name,
        snippet,
        publishDate,
        domain,
        score: 0, // Will be calculated later
      };
    })
    .filter((source) => source.url && source.domain !== 'unknown');
}

/**
 * Deduplicate sources by URL and domain
 *
 * @param sources - Sources to deduplicate
 * @returns Deduplicated sources
 */
export function deduplicate(sources: NormalizedSource[]): NormalizedSource[] {
  // Remove exact URL duplicates (keep first occurrence)
  const seenUrls = new Set<string>();
  const uniqueByUrl = sources.filter((source) => {
    if (seenUrls.has(source.url)) {
      return false;
    }
    seenUrls.add(source.url);
    return true;
  });

  // Group by domain, keep highest-scored per domain
  const byDomain = new Map<string, NormalizedSource>();

  for (const source of uniqueByUrl) {
    const existing = byDomain.get(source.domain);
    if (!existing || source.score > existing.score) {
      byDomain.set(source.domain, source);
    }
  }

  return Array.from(byDomain.values());
}

/**
 * Calculate recency score (0-1) based on age in days
 *
 * @param publishDate - ISO8601 publish date
 * @returns Recency score (0-1)
 */
export function calculateRecencyScore(publishDate: string): number {
  try {
    const published = new Date(publishDate);
    const now = new Date();
    const ageInDays = (now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24);

    // Linear decay over 30 days
    const score = Math.max(0, 1.0 - ageInDays / 30);
    return score;
  } catch {
    return 0.5; // Default for invalid dates
  }
}

/**
 * Calculate lexical similarity between query and title using Jaccard similarity
 *
 * @param query - Search query
 * @param title - Article title
 * @returns Similarity score (0-1)
 */
export function calculateLexicalSimilarity(query: string, title: string): number {
  const queryTokens = new Set(query.toLowerCase().split(/\s+/));
  const titleTokens = new Set(title.toLowerCase().split(/\s+/));

  const intersection = new Set([...queryTokens].filter((token) => titleTokens.has(token)));
  const union = new Set([...queryTokens, ...titleTokens]);

  if (union.size === 0) {
    return 0;
  }

  return intersection.size / union.size;
}

/**
 * Score and rank sources
 *
 * @param sources - Sources to score and rank
 * @param query - Original query for lexical similarity
 * @returns Ranked sources (highest score first)
 */
export function scoreAndRank(sources: NormalizedSource[], query: string): NormalizedSource[] {
  // Calculate scores
  const scored = sources.map((source) => {
    const recencyScore = calculateRecencyScore(source.publishDate);
    const domainScore = getDomainTier(source.domain);
    const lexicalScore = calculateLexicalSimilarity(query, source.title);

    // Combined score: 0.4 * recency + 0.4 * domain + 0.2 * lexical
    const score = 0.4 * recencyScore + 0.4 * domainScore + 0.2 * lexicalScore;

    return {
      ...source,
      score,
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored;
}

/**
 * Rank sources and cap at max results
 *
 * @param sources - Sources to rank
 * @param query - Original query
 * @param maxResults - Maximum results to return
 * @returns Ranked and capped sources
 */
export function rankAndCap(
  sources: NormalizedSource[],
  query: string,
  maxResults: number
): NormalizedSource[] {
  const ranked = scoreAndRank(sources, query);
  return ranked.slice(0, maxResults);
}

/**
 * Credibility tier mapping for known domains
 * Tier 1: Highest credibility (major news organizations)
 * Tier 2: Medium credibility (regional news, specialized outlets)
 * Tier 3: Default credibility (all other domains)
 */
const TIER_1_DOMAINS = new Set([
  'reuters.com',
  'apnews.com',
  'bbc.com',
  'bbc.co.uk',
  'nytimes.com',
  'washingtonpost.com',
  'wsj.com',
  'npr.org',
]);

const TIER_2_DOMAINS = new Set([
  'cnn.com',
  'theguardian.com',
  'bloomberg.com',
  'politico.com',
  'axios.com',
  'nbcnews.com',
  'abcnews.go.com',
  'cbsnews.com',
  'usatoday.com',
  'latimes.com',
]);

/**
 * Assign credibility tier to a domain
 * 
 * @param domain - Registrable domain (eTLD+1)
 * @returns Credibility tier (1=highest, 3=lowest)
 */
export function assignCredibilityTier(domain: string): 1 | 2 | 3 {
  const domainLower = domain.toLowerCase();
  
  if (TIER_1_DOMAINS.has(domainLower)) {
    return 1;
  }
  
  if (TIER_2_DOMAINS.has(domainLower)) {
    return 2;
  }
  
  return 3;
}

/**
 * Calculate title similarity using Jaccard index
 * 
 * @param title1 - First title
 * @param title2 - Second title
 * @returns Similarity score (0-1)
 */
export function calculateTitleSimilarity(title1: string, title2: string): number {
  const tokens1 = new Set(title1.toLowerCase().split(/\s+/));
  const tokens2 = new Set(title2.toLowerCase().split(/\s+/));

  const intersection = new Set([...tokens1].filter((token) => tokens2.has(token)));
  const union = new Set([...tokens1, ...tokens2]);

  if (union.size === 0) {
    return 0;
  }

  return intersection.size / union.size;
}

/**
 * Deduplicate sources by title similarity
 * 
 * Removes sources with >80% title similarity and same publisher
 * 
 * @param sources - Sources to deduplicate
 * @param threshold - Similarity threshold (default: 0.8)
 * @returns Deduplicated sources
 */
export function deduplicateByTitleSimilarity(
  sources: NormalizedSource[],
  threshold: number = 0.8
): NormalizedSource[] {
  const result: NormalizedSource[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < sources.length; i++) {
    if (seen.has(i)) {
      continue;
    }

    result.push(sources[i]);

    // Check for similar titles with same domain
    for (let j = i + 1; j < sources.length; j++) {
      if (seen.has(j)) {
        continue;
      }

      if (sources[i].domain === sources[j].domain) {
        const similarity = calculateTitleSimilarity(sources[i].title, sources[j].title);
        if (similarity >= threshold) {
          seen.add(j); // Mark as duplicate
        }
      }
    }
  }

  return result;
}
