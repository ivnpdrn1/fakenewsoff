/**
 * Claim Normalizer
 *
 * Normalizes user claim text for cache key generation
 */

/**
 * Normalize claim text for cache key generation
 *
 * Normalization steps:
 * 1. Convert to lowercase
 * 2. Trim whitespace
 * 3. Collapse repeated spaces
 * 4. Remove surrounding punctuation
 *
 * @param claim - User claim text
 * @returns Normalized claim text
 */
export function normalizeClaimForCache(claim: string): string {
  if (!claim || typeof claim !== 'string') {
    return '';
  }

  let normalized = claim
    .toLowerCase() // Convert to lowercase
    .trim() // Trim whitespace
    .replace(/\s+/g, ' '); // Collapse repeated spaces

  // Remove surrounding punctuation (but keep internal punctuation)
  normalized = normalized.replace(/^[^\w\s]+|[^\w\s]+$/g, '');

  return normalized;
}

/**
 * Generate cache key from normalized claim
 *
 * @param claim - User claim text
 * @returns Cache key
 */
export function generateCacheKey(claim: string): string {
  const normalized = normalizeClaimForCache(claim);
  return `evidence:${normalized}`;
}
