/**
 * Cache Service
 *
 * Provides caching functionality for analysis requests to reduce costs and improve response times.
 * Uses DynamoDB GSI (content_hash-index) to lookup cached results within 24-hour TTL window.
 *
 * Cache Bypass Options:
 * - Global: Set CACHE_DISABLE=true environment variable
 * - Per-request: Include cache_bypass: true in request payload
 *
 * Validates: Requirements 4.6
 */

import { computeContentHash } from '../utils/hash';
import {
  queryByContentHash,
  storeAnalysisRecord,
  AnalysisRecord,
  AnalysisRequest,
} from '../utils/dynamodb';
import { AnalysisResponse } from '../utils/schemaValidators';

/**
 * Test event buffer for capturing cache events during tests.
 * In test mode (NODE_ENV === 'test'), events are stored here instead of logged to console.
 * This prevents "Cannot log after tests are done" errors while preserving audit trail in production.
 */
let testEventBuffer: any[] = [];

/**
 * Log cache event to console (production) or buffer (test mode).
 *
 * In production: Logs event to console as JSON string for audit trail
 * In test mode: Stores event in testEventBuffer to prevent async logging issues
 *
 * @param event - Cache event object to log
 */
function logCacheEvent(event: any): void {
  if (process.env.NODE_ENV === 'test') {
    testEventBuffer.push(event);
  } else {
    console.log(JSON.stringify(event));
  }
}

/**
 * Get all cached events from test buffer (test-only accessor).
 *
 * @returns Array of all logged events during test execution
 */
export function __getTestEvents(): any[] {
  return [...testEventBuffer];
}

/**
 * Reset test event buffer (test-only accessor).
 * Should be called in beforeEach() to ensure clean state between tests.
 */
export function __resetTestEvents(): void {
  testEventBuffer = [];
}

/**
 * Extended AnalysisRequest with cache_bypass option
 */
export interface AnalysisRequestWithCache extends AnalysisRequest {
  cache_bypass?: boolean;
}

/**
 * Cached result with cached flag and timestamp
 */
export interface CachedResult {
  response: AnalysisResponse & { cache_timestamp: string };
  cached: true;
  cache_age_hours: number;
}

/**
 * Check cache for existing analysis result
 *
 * Cache Lookup Process:
 * 1. Check if caching is disabled (CACHE_DISABLE env var or cache_bypass in request)
 * 2. Compute content_hash from normalized request content
 * 3. Query DynamoDB GSI for records with matching content_hash within 24-hour TTL
 * 4. If found, return cached response with cached=true flag
 * 5. If not found, return null to proceed with normal analysis
 *
 * @param request - Analysis request to check cache for
 * @returns Promise that resolves to cached result or null if not found
 */
export async function checkCache(request: AnalysisRequestWithCache): Promise<CachedResult | null> {
  // Check global cache disable flag
  const cacheDisabled = process.env.CACHE_DISABLE === 'true';
  if (cacheDisabled) {
    logCacheEvent({
      event: 'cache_bypassed',
      reason: 'global_disable',
      timestamp: new Date().toISOString(),
    });
    return null;
  }

  // Check per-request cache bypass flag
  if (request.cache_bypass === true) {
    logCacheEvent({
      event: 'cache_bypassed',
      reason: 'request_bypass',
      timestamp: new Date().toISOString(),
    });
    return null;
  }

  // Compute content hash from request
  const contentHash = await computeRequestHash(request);

  // Query GSI for cached results within 24-hour TTL
  const cachedRecords = await queryByContentHash(contentHash, 24);

  if (cachedRecords.length === 0) {
    logCacheEvent({
      event: 'cache_miss',
      content_hash: contentHash,
      timestamp: new Date().toISOString(),
    });
    return null;
  }

  // Return most recent cached result
  const mostRecent = cachedRecords.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  // Calculate cache age in hours
  const cacheAgeMs = Date.now() - new Date(mostRecent.created_at).getTime();
  const cacheAgeHours = cacheAgeMs / (1000 * 60 * 60);

  logCacheEvent({
    event: 'cache_hit',
    content_hash: contentHash,
    cache_age_hours: cacheAgeHours.toFixed(2),
    cached_request_id: mostRecent.request_id,
    timestamp: new Date().toISOString(),
  });

  // Return cached response with cached flag and cache_timestamp
  return {
    response: {
      ...mostRecent.response,
      cached: true,
      cache_timestamp: mostRecent.created_at,
    },
    cached: true,
    cache_age_hours: cacheAgeHours,
  };
}

/**
 * Store analysis result in cache
 *
 * Storage Process:
 * 1. Compute content_hash from normalized request content
 * 2. Create AnalysisRecord with content_hash
 * 3. Store in DynamoDB (automatically indexed in GSI)
 * 4. Set TTL for automatic cleanup after 30 days
 *
 * @param request - Original analysis request
 * @param response - Analysis response to cache
 * @returns Promise that resolves when storage is complete
 */
export async function storeInCache(
  request: AnalysisRequest,
  response: AnalysisResponse
): Promise<void> {
  // Compute content hash
  const contentHash = await computeRequestHash(request);

  // Calculate TTL (30 days from now)
  const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  // Create analysis record
  const record: AnalysisRecord = {
    request_id: response.request_id,
    request,
    response,
    created_at: response.timestamp,
    updated_at: response.timestamp,
    content_hash: contentHash,
    ttl,
  };

  // Store in DynamoDB
  await storeAnalysisRecord(record);

  logCacheEvent({
    event: 'cache_stored',
    request_id: response.request_id,
    content_hash: contentHash,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Compute content hash from analysis request
 *
 * Hash Computation:
 * 1. Combine relevant fields: text, selectedText, url, title
 * 2. Normalize content (lowercase, trim, remove tracking params)
 * 3. Compute SHA-256 hash
 *
 * Note: imageUrl is excluded from hash to avoid cache misses for same text with different images
 *
 * @param request - Analysis request
 * @returns Promise that resolves to SHA-256 hash string
 */
async function computeRequestHash(request: AnalysisRequest): Promise<string> {
  // Combine relevant fields for hashing
  // Note: imageUrl excluded to allow caching of same text with different images
  const combinedContent = [
    request.text || '',
    request.selectedText || '',
    request.url || '',
    request.title || '',
  ].join('|||'); // Use delimiter to prevent collision

  // Compute hash
  return await computeContentHash(combinedContent);
}
