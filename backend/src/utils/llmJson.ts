/**
 * LLM JSON Parsing Utility
 *
 * Provides robust JSON parsing for LLM responses with repair and fallback mechanisms.
 * Prevents pipeline crashes from malformed LLM output.
 *
 * Validates: Requirements 6.8, 12.2
 */

/**
 * Test event buffer for test-safe logging
 *
 * In test mode (NODE_ENV === 'test'), log events are buffered here instead of written to console.
 * This prevents "Cannot log after tests are done" errors while preserving audit trail in production.
 */
let testEventBuffer: any[] = [];

/**
 * Log JSON parsing event with test-safe behavior
 *
 * In production: Logs event to console as JSON string for audit trail
 * In test mode: Stores event in testEventBuffer to prevent async logging issues
 *
 * @param event - JSON parsing event object to log
 */
function logJsonEvent(event: any): void {
  if (process.env.NODE_ENV === 'test') {
    testEventBuffer.push(event);
  } else {
    console.log(JSON.stringify(event));
  }
}

/**
 * Get buffered test events (test mode only)
 *
 * @returns Copy of test event buffer
 */
export function __getTestEvents(): any[] {
  return [...testEventBuffer];
}

/**
 * Reset test event buffer (test mode only)
 */
export function __resetTestEvents(): void {
  testEventBuffer = [];
}

/**
 * Result type for operations that can succeed or fail
 */
export type Result<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Fallback response structure for when parsing fails completely
 */
interface FallbackResponse {
  status_label: 'Unverified';
  confidence_score: 30;
  recommendation: string;
  sift_guidance: string;
  sources: [];
  misinformation_type: null;
}

/**
 * Parse JSON from LLM response with repair and fallback mechanisms
 *
 * @param responseText - Raw text response from LLM
 * @returns Result with parsed data or error
 *
 * Process:
 * 1. Try direct JSON.parse
 * 2. If fails, attempt repair (strip markdown, remove prose)
 * 3. If repair fails, return controlled fallback
 */
export function parseStrictJson<T>(responseText: string): Result<T> {
  // Step 1: Try direct parsing
  try {
    const parsed = JSON.parse(responseText);
    // Check if parsed result is an empty object - this is likely not what we want
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      Object.keys(parsed).length === 0
    ) {
      // Empty object, continue to repair/fallback
    } else {
      return { success: true, data: parsed as T };
    }
  } catch {
    // Continue to repair attempt
  }

  // Step 2: Attempt repair
  const repaired = repairJsonResponse(responseText);
  if (repaired) {
    try {
      const parsed = JSON.parse(repaired);
      // Check if repaired result is an empty object
      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        Object.keys(parsed).length === 0
      ) {
        // Empty object, continue to fallback
      } else {
        logRepairSuccess(responseText.length, repaired.length);
        return { success: true, data: parsed as T };
      }
    } catch {
      // Continue to fallback
    }
  }

  // Step 3: Return controlled fallback
  logParseFallback(responseText.substring(0, 200));

  const fallback = createFallbackResponse();
  return { success: true, data: fallback as T };
}

/**
 * Attempt to repair malformed JSON from LLM response
 *
 * Common issues:
 * - Markdown code blocks (```json ... ```)
 * - Prose before/after JSON
 * - Trailing commas
 * - Unescaped quotes
 *
 * Strategy:
 * 1. Extract all valid JSON candidates from the text
 * 2. Rank candidates by schema fitness (prefer rich objects with expected fields)
 * 3. Return the best candidate
 *
 * @param text - Raw response text
 * @returns Repaired JSON string or null if repair failed
 */
function repairJsonResponse(text: string): string | null {
  let repaired = text.trim();

  // Remove markdown code blocks
  repaired = repaired.replace(/```json\s*/gi, '');
  repaired = repaired.replace(/```\s*/g, '');

  // Collect all valid JSON candidates
  const candidates: Array<{ json: string; parsed: any; score: number }> = [];

  // Try all object positions
  for (let i = 0; i < repaired.length; i++) {
    if (repaired[i] === '{') {
      const extracted = extractJsonStructure(repaired.substring(i), '{', '}');
      if (extracted) {
        const cleaned = extracted.replace(/,(\s*[}\]])/g, '$1');
        // Try to parse it to verify it's valid JSON
        try {
          const parsed = JSON.parse(cleaned);
          const score = scoreCandidate(parsed);
          candidates.push({ json: cleaned, parsed, score });
        } catch {
          // Not valid, skip this candidate
        }
      }
    }
  }

  // Try all array positions if no object worked
  for (let i = 0; i < repaired.length; i++) {
    if (repaired[i] === '[') {
      const extracted = extractJsonStructure(repaired.substring(i), '[', ']');
      if (extracted) {
        const cleaned = extracted.replace(/,(\s*[}\]])/g, '$1');
        // Try to parse it to verify it's valid JSON
        try {
          const parsed = JSON.parse(cleaned);
          const score = scoreCandidate(parsed);
          candidates.push({ json: cleaned, parsed, score });
        } catch {
          // Not valid, skip this candidate
        }
      }
    }
  }

  // Return the best candidate (highest score)
  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].json;
}

/**
 * Score a JSON candidate by schema fitness
 *
 * Higher scores indicate better matches to expected analysis response schema.
 * Empty objects or arrays get very low scores.
 *
 * Expected fields for analysis responses:
 * - request_id (high value)
 * - status_label (high value)
 * - confidence_score (high value)
 * - recommendation (medium value)
 * - progress_stages (medium value)
 * - sources (medium value)
 * - timestamp (low value)
 *
 * Expected fields for claim extraction:
 * - claims (high value)
 * - summary (high value)
 *
 * @param parsed - Parsed JSON object
 * @returns Fitness score (higher is better)
 */
function scoreCandidate(parsed: any): number {
  let score = 0;

  // Empty objects or arrays get very low score
  if (typeof parsed === 'object' && parsed !== null) {
    const keys = Object.keys(parsed);
    if (keys.length === 0) {
      return 1; // Very low score for empty objects
    }

    // Arrays get lower base score than objects
    if (Array.isArray(parsed)) {
      score = 10;
    } else {
      score = 20; // Base score for non-empty objects
    }

    // High-value fields (core analysis response fields)
    if ('request_id' in parsed) score += 100;
    if ('status_label' in parsed) score += 100;
    if ('confidence_score' in parsed) score += 100;

    // High-value fields (claim extraction)
    if ('claims' in parsed) score += 100;
    if ('summary' in parsed) score += 100;

    // Medium-value fields
    if ('recommendation' in parsed) score += 50;
    if ('progress_stages' in parsed) score += 50;
    if ('sources' in parsed) score += 50;
    if ('sift_guidance' in parsed) score += 50;

    // Low-value fields (common but not unique)
    if ('timestamp' in parsed) score += 10;
    if ('misinformation_type' in parsed) score += 10;
    if ('media_risk' in parsed) score += 10;

    // Bonus for having many fields (richer objects preferred)
    score += keys.length * 2;

    // Penalty for having only generic fields like "completion", "response", "data"
    // These are often wrapper objects, not the actual content
    const genericWrapperFields = ['completion', 'response', 'data', 'result', 'output'];
    const hasOnlyGenericFields = keys.length > 0 && keys.every((k) => genericWrapperFields.includes(k));
    if (hasOnlyGenericFields) {
      score = Math.max(1, score - 200); // Heavy penalty for wrapper objects
    }
  } else {
    // Primitives get very low score
    score = 1;
  }

  return score;
}

/**
 * Extract JSON structure using brace-matching
 *
 * @param text - Text to search
 * @param openChar - Opening character ('{' or '[')
 * @param closeChar - Closing character ('}' or ']')
 * @returns Extracted JSON string or null if not found
 */
function extractJsonStructure(text: string, openChar: string, closeChar: string): string | null {
  const start = text.indexOf(openChar);
  if (start === -1) {
    return null;
  }

  // Use brace-matching to find the true closing brace/bracket
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === openChar) {
        depth++;
      } else if (char === closeChar) {
        depth--;
        if (depth === 0) {
          // Found matching closing brace/bracket
          return text.substring(start, i + 1);
        }
      }
    }
  }

  return null;
}

/**
 * Check if a string has valid JSON structure
/**
 * Create a safe fallback response when parsing fails
 * 
 * Returns a minimal valid response with:
 * - status_label: "Unverified"
 * - confidence_score: 30 (low)
 * - SIFT-based guidance
 * - Empty sources array
 */
function createFallbackResponse(): FallbackResponse {
  return {
    status_label: 'Unverified',
    confidence_score: 30,
    recommendation:
      'Verify before sharing. Unable to complete automated analysis. Apply SIFT framework manually: Stop, Investigate the source, Find better coverage, Trace claims to original sources.',
    sift_guidance:
      "Stop: Don't share immediately. Investigate the source: Check if the source is credible and has a good track record. Find better coverage: Search for reporting from multiple credible news sources. Trace claims: Look for the original source of the information.",
    sources: [],
    misinformation_type: null,
  };
}

/**
 * Log successful repair operation
 */
function logRepairSuccess(originalLength: number, repairedLength: number): void {
  const logData = {
    event: 'json_repair_success',
    original_length: originalLength,
    repaired_length: repairedLength,
    timestamp: new Date().toISOString(),
  };
  logJsonEvent(logData);
}

/**
 * Log fallback usage (parsing failed completely)
 */
function logParseFallback(snippet: string): void {
  const logData = {
    event: 'json_parse_fallback',
    response_snippet: snippet,
    timestamp: new Date().toISOString(),
  };
  logJsonEvent(logData);
}
