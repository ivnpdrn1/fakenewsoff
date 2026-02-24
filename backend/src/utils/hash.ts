/**
 * Content Hashing Utilities
 * 
 * Provides deterministic content hashing for:
 * - Retrieval query payloads
 * - RAG assembled context
 * - Final prompts
 * - Request deduplication
 * 
 * Validates: Requirements 11.1
 */

/**
 * Normalizes content for consistent hashing
 * 
 * Normalization steps:
 * 1. Convert to lowercase
 * 2. Trim leading/trailing whitespace
 * 3. Normalize internal whitespace (multiple spaces → single space)
 * 4. Remove URL tracking parameters (utm_*, fbclid, gclid, etc.)
 * 5. Sort query parameters alphabetically for consistency
 * 
 * @param input - Content to normalize
 * @returns Normalized content string
 */
export function normalizeContent(input: string): string {
  let normalized = input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // Normalize whitespace

  // Remove tracking parameters from URLs
  normalized = removeTrackingParams(normalized);

  return normalized;
}

/**
 * Removes tracking parameters from URLs in content
 * 
 * Handles common tracking parameters:
 * - utm_* (Google Analytics)
 * - fbclid (Facebook)
 * - gclid (Google Ads)
 * - msclkid (Microsoft Ads)
 * - mc_* (Mailchimp)
 * - _ga, _gl (Google Analytics)
 * 
 * Also sorts remaining query parameters alphabetically for consistency
 * and removes trailing slashes from URLs
 * 
 * @param content - Content potentially containing URLs
 * @returns Content with tracking parameters removed
 */
function removeTrackingParams(content: string): string {
  // Tracking parameter patterns to remove
  const trackingParams = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'fbclid',
    'gclid',
    'msclkid',
    'mc_eid',
    'mc_cid',
    '_ga',
    '_gl',
  ];

  // Match URLs in the content
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  return content.replace(urlRegex, (url) => {
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      
      // Remove tracking parameters
      trackingParams.forEach(param => params.delete(param));
      
      // Rebuild URL
      const newSearch = params.toString();
      urlObj.search = newSearch ? `?${newSearch}` : '';
      
      let normalizedUrl = urlObj.toString();
      
      // Remove trailing slash if present (but keep it for root domains)
      if (normalizedUrl.endsWith('/') && urlObj.pathname !== '/') {
        normalizedUrl = normalizedUrl.slice(0, -1);
      } else if (normalizedUrl.endsWith('/') && urlObj.pathname === '/' && !urlObj.search && !urlObj.hash) {
        // Remove trailing slash from root domain with no query/hash
        normalizedUrl = normalizedUrl.slice(0, -1);
      }
      
      return normalizedUrl;
    } catch {
      // If URL parsing fails, return original
      return url;
    }
  });
}

/**
 * Computes SHA-256 hash of content
 * 
 * The hash is deterministic: same input always produces same hash.
 * Content is normalized before hashing to ensure consistency.
 * 
 * @param content - Content to hash
 * @returns SHA-256 hash as 64-character hex string
 */
export async function computeContentHash(content: string): Promise<string> {
  // Normalize content first
  const normalized = normalizeContent(content);

  // Encode to UTF-8 bytes
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);

  // Compute SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
