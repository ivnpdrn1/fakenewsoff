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
    return { success: true, data: parsed as T };
  } catch {
    // Continue to repair attempt
  }

  // Step 2: Attempt repair
  const repaired = repairJsonResponse(responseText);
  if (repaired) {
    try {
      const parsed = JSON.parse(repaired);
      logRepairSuccess(responseText.length, repaired.length);
      return { success: true, data: parsed as T };
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
 * @param text - Raw response text
 * @returns Repaired JSON string or null if repair failed
 */
function repairJsonResponse(text: string): string | null {
  let repaired = text.trim();

  // Remove markdown code blocks
  repaired = repaired.replace(/```json\s*/gi, '');
  repaired = repaired.replace(/```\s*/g, '');

  // Try to extract JSON by finding all possible { and [ positions
  // and attempting to extract from each one
  // Prefer objects over arrays

  // Try all object positions
  for (let i = 0; i < repaired.length; i++) {
    if (repaired[i] === '{') {
      const extracted = extractJsonStructure(repaired.substring(i), '{', '}');
      if (extracted) {
        const cleaned = extracted.replace(/,(\s*[}\]])/g, '$1');
        // Try to parse it to verify it's valid JSON
        try {
          JSON.parse(cleaned);
          return cleaned;
        } catch {
          // Not valid, try next position
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
          JSON.parse(cleaned);
          return cleaned;
        } catch {
          // Not valid, try next position
        }
      }
    }
  }

  return null;
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
