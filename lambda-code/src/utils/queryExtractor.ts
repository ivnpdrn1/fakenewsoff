/**
 * Query Extraction and Normalization
 *
 * Extracts searchable queries from headlines and normalizes them for caching
 *
 * Validates: Requirements FR1.3, FR1.4
 */

/**
 * Common English stop words to remove from queries
 */
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'he',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'that',
  'the',
  'to',
  'was',
  'were',
  'will',
  'with',
  'this',
  'these',
  'those',
  'been',
  'being',
  'have',
  'had',
  'do',
  'does',
  'did',
  'but',
  'if',
  'or',
  'because',
  'as',
  'until',
  'while',
  'about',
  'against',
  'between',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'up',
  'down',
  'out',
  'off',
  'over',
  'under',
  'again',
  'further',
  'then',
  'once',
  'here',
  'there',
  'when',
  'where',
  'why',
  'how',
  'all',
  'both',
  'each',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'nor',
  'not',
  'only',
  'own',
  'same',
  'so',
  'than',
  'too',
  'very',
  's',
  't',
  'can',
  'just',
  'should',
  'now',
]);

/**
 * Extract searchable query from headline text
 *
 * Removes stop words, normalizes whitespace, and prepares text for search
 *
 * @param headline - Headline text to extract query from
 * @returns Extracted query string
 *
 * @example
 * extractQuery("Breaking: Major storm hits coast") // "breaking major storm hits coast"
 * extractQuery("The president announces new policy") // "president announces new policy"
 */
export function extractQuery(headline: string): string {
  if (!headline || typeof headline !== 'string') {
    return '';
  }

  // Normalize whitespace and lowercase
  const normalized = headline.trim().toLowerCase();

  // Remove special characters except spaces and hyphens
  const cleaned = normalized.replace(/[^\w\s-]/g, ' ');

  // Split into words
  const words = cleaned.split(/\s+/).filter((word) => word.length > 0);

  // Remove stop words
  const filtered = words.filter((word) => !STOP_WORDS.has(word));

  // Join back into query
  const query = filtered.join(' ').trim();

  // If query is empty after filtering, return original cleaned text
  return query.length > 0 ? query : cleaned.trim();
}

/**
 * Normalize query for cache key consistency
 *
 * Ensures semantically equivalent queries produce the same cache key
 *
 * @param query - Query string to normalize
 * @returns Normalized query string
 *
 * @example
 * normalizeQuery("  Climate   Change  ") // "climate change"
 * normalizeQuery("CLIMATE CHANGE") // "climate change"
 */
export function normalizeQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    return '';
  }

  // Lowercase and trim
  let normalized = query.toLowerCase().trim();

  // Normalize whitespace (multiple spaces to single space)
  normalized = normalized.replace(/\s+/g, ' ');

  // Remove special characters except spaces and hyphens
  normalized = normalized.replace(/[^\w\s-]/g, ' ');

  // Trim again after character removal
  normalized = normalized.trim();

  // Normalize multiple spaces again
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized;
}
