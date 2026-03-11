/**
 * Grounding Cache Service
 *
 * In-memory LRU/TTL cache for grounding results
 *
 * Validates: Requirements FR4.1, FR4.2, FR4.3, FR4.4
 */

import { LRUCache } from 'lru-cache';
import { GroundingBundle } from '../types/grounding';
import { getEnv } from '../utils/envValidation';

/**
 * Grounding cache with LRU and TTL eviction
 */
export class GroundingCache {
  private cache: LRUCache<string, GroundingBundle>;
  private readonly ttl: number;

  constructor() {
    const env = getEnv();
    this.ttl = parseInt(env.GROUNDING_CACHE_TTL_SECONDS || '900', 10) * 1000; // Convert to ms
    const maxEntries = 1000; // Default max entries

    this.cache = new LRUCache<string, GroundingBundle>({
      max: maxEntries,
      ttl: this.ttl,
      updateAgeOnGet: true, // Update age on cache hit (LRU behavior)
      updateAgeOnHas: false,
    });
  }

  /**
   * Get cached grounding bundle by query
   *
   * @param query - Normalized query string
   * @returns Cached bundle or undefined if not found/expired
   */
  get(query: string): GroundingBundle | undefined {
    if (!query || typeof query !== 'string') {
      return undefined;
    }

    const normalized = query.toLowerCase().trim();
    return this.cache.get(normalized);
  }

  /**
   * Store grounding bundle in cache
   *
   * @param query - Normalized query string
   * @param bundle - Grounding bundle to cache
   */
  set(query: string, bundle: GroundingBundle): void {
    if (!query || typeof query !== 'string' || !bundle) {
      return;
    }

    const normalized = query.toLowerCase().trim();
    this.cache.set(normalized, bundle);
  }

  /**
   * Check if query is in cache
   *
   * @param query - Normalized query string
   * @returns True if query is in cache
   */
  has(query: string): boolean {
    if (!query || typeof query !== 'string') {
      return false;
    }

    const normalized = query.toLowerCase().trim();
    return this.cache.has(normalized);
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   *
   * @returns Number of entries in cache
   */
  size(): number {
    return this.cache.size;
  }
}

// Singleton instance
let cacheInstance: GroundingCache | null = null;

/**
 * Get singleton cache instance
 *
 * @returns Grounding cache instance
 */
export function getGroundingCache(): GroundingCache {
  if (!cacheInstance) {
    cacheInstance = new GroundingCache();
  }
  return cacheInstance;
}

/**
 * Reset cache instance (for testing)
 */
export function resetGroundingCache(): void {
  cacheInstance = null;
}
