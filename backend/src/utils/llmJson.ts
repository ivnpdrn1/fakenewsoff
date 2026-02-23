/**
 * LLM JSON Parsing Utility
 * 
 * Provides robust JSON parsing for LLM responses with repair and fallback mechanisms.
 * Prevents pipeline crashes from malformed LLM output.
 * 
 * Validates: Requirements 6.8, 12.2
 */

/**
 * Result type for operations that can succeed or fail
 */
export type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Fallback response structure for when parsing fails completely
 */
interface FallbackResponse {
  status_label: "Unverified";
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
  } catch (directError) {
    // Continue to repair attempt
  }

  // Step 2: Attempt repair
  const repaired = repairJsonResponse(responseText);
  if (repaired) {
    try {
      const parsed = JSON.parse(repaired);
      logRepairSuccess(responseText.length, repaired.length);
      return { success: true, data: parsed as T };
    } catch (repairError) {
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

  // Extract JSON object/array from prose
  // Look for first { or [ and last } or ]
  // Prefer objects over arrays when both are present
  const firstBrace = repaired.indexOf('{');
  const firstBracket = repaired.indexOf('[');
  const lastBrace = repaired.lastIndexOf('}');
  const lastBracket = repaired.lastIndexOf(']');

  let start = -1;
  let end = -1;

  // Prefer objects over arrays
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    // Object found
    start = firstBrace;
    end = lastBrace;
  } else if (firstBracket !== -1 && lastBracket > firstBracket) {
    // Array found (only use if no object)
    start = firstBracket;
    end = lastBracket;
  }

  if (start !== -1 && end !== -1 && end > start) {
    repaired = repaired.substring(start, end + 1);
  } else {
    // No valid JSON structure found
    return null;
  }

  // Remove trailing commas before closing braces/brackets
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

  // Basic validation: must start with { or [ and end with } or ]
  if (
    (repaired.startsWith('{') && repaired.endsWith('}')) ||
    (repaired.startsWith('[') && repaired.endsWith(']'))
  ) {
    return repaired;
  }

  return null;
}

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
    status_label: "Unverified",
    confidence_score: 30,
    recommendation: "Verify before sharing. Unable to complete automated analysis. Apply SIFT framework manually: Stop, Investigate the source, Find better coverage, Trace claims to original sources.",
    sift_guidance: "Stop: Don't share immediately. Investigate the source: Check if the source is credible and has a good track record. Find better coverage: Search for reporting from multiple credible news sources. Trace claims: Look for the original source of the information.",
    sources: [],
    misinformation_type: null
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
    timestamp: new Date().toISOString()
  };
  console.log(JSON.stringify(logData));
}

/**
 * Log fallback usage (parsing failed completely)
 */
function logParseFallback(snippet: string): void {
  const logData = {
    event: 'json_parse_fallback',
    response_snippet: snippet,
    timestamp: new Date().toISOString()
  };
  console.log(JSON.stringify(logData));
}
