/**
 * Storage Policy
 *
 * Provides deterministic truncation utilities to ensure DynamoDB items stay within the 400KB limit.
 * Large article text and source snippets can exceed this limit, so we truncate intelligently
 * while preserving meaning and adding truncation indicators.
 *
 * Validates: Requirements 11.1, 11.2
 */

import { CredibleSource } from './schemaValidators';

/**
 * Maximum characters to store for text content
 * This limit ensures we stay well under DynamoDB's 400KB item size limit
 */
export const MAX_STORED_TEXT_CHARS = 20_000;

/**
 * Maximum characters for individual snippets
 */
const MAX_SNIPPET_CHARS = 500;

/**
 * Maximum characters for "why" fields in sources
 */
const MAX_WHY_CHARS = 300;

/**
 * Truncation indicator appended to truncated text
 */
const TRUNCATION_INDICATOR = '... [truncated]';

/**
 * Truncate text to a maximum length while preserving word boundaries
 *
 * @param text - Text to truncate
 * @param maxChars - Maximum number of characters (default: MAX_STORED_TEXT_CHARS)
 * @returns Truncated text with indicator if truncated
 */
export function truncateForStorage(text: string, maxChars: number = MAX_STORED_TEXT_CHARS): string {
  if (!text || text.length <= maxChars) {
    return text;
  }

  // Find the last space before maxChars to avoid cutting mid-word
  // Ensure final result is strictly less than maxChars
  const truncateAt = maxChars - TRUNCATION_INDICATOR.length - 1;
  let cutPoint = text.lastIndexOf(' ', truncateAt);

  // If no space found (very long word), just cut at the limit
  if (cutPoint === -1 || cutPoint < truncateAt * 0.8) {
    cutPoint = truncateAt;
  }

  return text.substring(0, cutPoint).trim() + TRUNCATION_INDICATOR;
}

/**
 * Truncate an array of snippets to reasonable lengths
 *
 * @param snippets - Array of snippet strings
 * @returns Array of truncated snippets
 */
export function truncateSnippets(snippets: string[]): string[] {
  return snippets.map((snippet) => truncateForStorage(snippet, MAX_SNIPPET_CHARS));
}

/**
 * Truncate "why" fields in credible sources
 *
 * @param sources - Array of credible sources
 * @returns Array of sources with truncated "why" fields
 */
export function truncateWhyFields(sources: CredibleSource[]): CredibleSource[] {
  return sources.map((source) => ({
    ...source,
    snippet: truncateForStorage(source.snippet, MAX_SNIPPET_CHARS),
    why: truncateForStorage(source.why, MAX_WHY_CHARS),
  }));
}

/**
 * Calculate approximate size of an object in bytes
 * Used to estimate DynamoDB item size
 *
 * @param obj - Object to measure
 * @returns Approximate size in bytes
 */
export function estimateItemSize(obj: unknown): number {
  const jsonString = JSON.stringify(obj);
  // UTF-8 encoding: most characters are 1 byte, some are 2-4 bytes
  // This is a conservative estimate
  return new Blob([jsonString]).size;
}

/**
 * Check if an object would exceed DynamoDB's 400KB limit
 *
 * @param obj - Object to check
 * @returns True if object is too large
 */
export function exceedsDynamoDBLimit(obj: unknown): boolean {
  const DYNAMODB_ITEM_SIZE_LIMIT = 400 * 1024; // 400KB in bytes
  return estimateItemSize(obj) > DYNAMODB_ITEM_SIZE_LIMIT;
}

/**
 * Log truncation event with structured logging
 *
 * @param field - Field name that was truncated
 * @param originalLength - Original length in characters
 * @param truncatedLength - Truncated length in characters
 * @param requestId - Optional request ID for tracking
 */
export function logTruncation(
  field: string,
  originalLength: number,
  truncatedLength: number,
  requestId?: string
): void {
  console.log(
    JSON.stringify({
      event: 'content_truncated',
      field,
      original_length: originalLength,
      truncated_length: truncatedLength,
      reduction_percent: Math.round((1 - truncatedLength / originalLength) * 100),
      request_id: requestId,
      timestamp: new Date().toISOString(),
    })
  );
}
