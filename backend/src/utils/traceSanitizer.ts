/**
 * TraceSanitizer - Ensures no sensitive information leaks into trace summaries
 *
 * Responsibilities:
 * - Scan summaries for sensitive patterns
 * - Redact or reject summaries containing secrets
 * - Validate safe summary content
 *
 * Security Rules:
 * - No internal prompts or prompt templates
 * - No chain-of-thought reasoning steps
 * - No API keys, tokens, or credentials
 * - No raw model outputs or deliberation
 * - No internal variable names or code references
 * - No provider-specific implementation details
 */

/**
 * Patterns that indicate sensitive information
 */
const SENSITIVE_PATTERNS = [
  // API keys and tokens
  /\b[A-Za-z0-9]{20,}\b/g, // Long alphanumeric strings (potential keys)
  /\bsk_[A-Za-z0-9]+/gi, // Secret keys
  /\bapi[_-]?key/gi,
  /\btoken/gi,
  /\baccess[_-]?key/gi,
  /\bsecret/gi,

  // Prompt indicators
  /\bprompt:/gi,
  /\bsystem:/gi,
  /\buser:/gi,
  /\bassistant:/gi,
  /\byou are a/gi,
  /\binstruction:/gi,

  // Chain-of-thought markers
  /\blet me think/gi,
  /\bstep by step/gi,
  /\bfirst,?\s+i\s+(notice|see|observe)/gi,
  /\breasoning:/gi,
  /\bthought:/gi,
  /\banalysis:/gi,

  // Internal implementation details
  /\bfunction\s+\w+\s*\(/gi,
  /\bconst\s+\w+\s*=/gi,
  /\blet\s+\w+\s*=/gi,
  /\bvar\s+\w+\s*=/gi,
  /\breturn\s+/gi,

  // AWS/Provider internals
  /\barn:aws:/gi,
  /\baccount[_-]?id/gi,
  /\bregion:/gi,
  /\bendpoint:/gi,
];

/**
 * Phrases that are safe and commonly used in summaries
 */
const SAFE_PHRASES = [
  'analyzed',
  'retrieved',
  'found',
  'identified',
  'classified',
  'evaluated',
  'processed',
  'generated',
  'cache hit',
  'cache miss',
  'throttled',
  'completed',
  'failed',
  'skipped',
];

export class TraceSanitizer {
  /**
   * Sanitize a summary by removing or redacting sensitive information
   */
  static sanitize(summary: string): string {
    if (!summary || typeof summary !== 'string') {
      return 'Step completed';
    }

    // Trim whitespace
    let sanitized = summary.trim();

    // If summary is too long, truncate it
    if (sanitized.length > 500) {
      sanitized = sanitized.substring(0, 497) + '...';
    }

    // Check for sensitive patterns
    if (this.containsSensitiveInfo(sanitized)) {
      // Return a generic safe summary
      return 'Step completed';
    }

    return sanitized;
  }

  /**
   * Validate that a summary is safe for public display
   */
  static validate(summary: string): boolean {
    if (!summary || typeof summary !== 'string') {
      return false;
    }

    // Check length
    if (summary.length === 0 || summary.length > 500) {
      return false;
    }

    // Check for sensitive information
    if (this.containsSensitiveInfo(summary)) {
      return false;
    }

    return true;
  }

  /**
   * Check if a summary contains sensitive information
   */
  static containsSensitiveInfo(summary: string): boolean {
    if (!summary || typeof summary !== 'string') {
      return false;
    }

    const lowerSummary = summary.toLowerCase();

    // Check for sensitive patterns
    for (const pattern of SENSITIVE_PATTERNS) {
      // Reset regex lastIndex to avoid state issues
      pattern.lastIndex = 0;

      if (pattern.test(summary)) {
        // Check if it's a false positive by looking for safe context
        const hasSafeContext = SAFE_PHRASES.some((phrase) => lowerSummary.includes(phrase));

        // If it matches a sensitive pattern and doesn't have safe context, flag it
        if (!hasSafeContext) {
          return true;
        }
      }
    }

    return false;
  }
}
