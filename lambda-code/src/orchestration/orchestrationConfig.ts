/**
 * Orchestration Configuration
 *
 * Configuration loading and validation for iterative evidence orchestration pipeline.
 * Supports environment variable overrides with sensible defaults.
 */

import { OrchestrationConfig } from '../types/orchestration';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: OrchestrationConfig = {
  // Minimum composite quality score to accept evidence (0-1)
  minEvidenceScore: 0.6,

  // Minimum number of source classes required for diversity
  minSourceDiversity: 2,

  // Maximum number of retrieval passes before stopping
  maxRetrievalPasses: 3,

  // Require primary source when available for official events
  requirePrimarySourceWhenAvailable: true,

  // Reject generic pages (homepage, category, tag, search)
  rejectGenericPages: true,

  // Require contradiction search before finalizing verdict
  contradictionSearchRequired: true,

  // Maximum NOVA calls per analysis (rate limiting)
  maxNovaCalls: 20,

  // Maximum tokens per NOVA call
  maxTokensPerCall: 4000,
};

/**
 * Load configuration from environment variables with defaults
 */
export function loadConfig(): OrchestrationConfig {
  return {
    minEvidenceScore: parseFloat(
      process.env.ORCHESTRATION_MIN_EVIDENCE_SCORE || String(DEFAULT_CONFIG.minEvidenceScore)
    ),
    minSourceDiversity: parseInt(
      process.env.ORCHESTRATION_MIN_SOURCE_DIVERSITY || String(DEFAULT_CONFIG.minSourceDiversity),
      10
    ),
    maxRetrievalPasses: parseInt(
      process.env.ORCHESTRATION_MAX_RETRIEVAL_PASSES || String(DEFAULT_CONFIG.maxRetrievalPasses),
      10
    ),
    requirePrimarySourceWhenAvailable:
      process.env.ORCHESTRATION_REQUIRE_PRIMARY_SOURCE === 'false'
        ? false
        : DEFAULT_CONFIG.requirePrimarySourceWhenAvailable,
    rejectGenericPages:
      process.env.ORCHESTRATION_REJECT_GENERIC_PAGES === 'false'
        ? false
        : DEFAULT_CONFIG.rejectGenericPages,
    contradictionSearchRequired:
      process.env.ORCHESTRATION_CONTRADICTION_SEARCH === 'false'
        ? false
        : DEFAULT_CONFIG.contradictionSearchRequired,
    maxNovaCalls: parseInt(
      process.env.ORCHESTRATION_MAX_NOVA_CALLS || String(DEFAULT_CONFIG.maxNovaCalls),
      10
    ),
    maxTokensPerCall: parseInt(
      process.env.ORCHESTRATION_MAX_TOKENS_PER_CALL || String(DEFAULT_CONFIG.maxTokensPerCall),
      10
    ),
  };
}

/**
 * Validate configuration values are within acceptable ranges
 */
export function validateConfig(config: OrchestrationConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate minEvidenceScore (0-1)
  if (config.minEvidenceScore < 0 || config.minEvidenceScore > 1) {
    errors.push(`minEvidenceScore must be between 0 and 1, got ${config.minEvidenceScore}`);
  }

  // Validate minSourceDiversity (1-7, max number of source classes)
  if (config.minSourceDiversity < 1 || config.minSourceDiversity > 7) {
    errors.push(`minSourceDiversity must be between 1 and 7, got ${config.minSourceDiversity}`);
  }

  // Validate maxRetrievalPasses (1-10)
  if (config.maxRetrievalPasses < 1 || config.maxRetrievalPasses > 10) {
    errors.push(`maxRetrievalPasses must be between 1 and 10, got ${config.maxRetrievalPasses}`);
  }

  // Validate maxNovaCalls (1-100)
  if (config.maxNovaCalls < 1 || config.maxNovaCalls > 100) {
    errors.push(`maxNovaCalls must be between 1 and 100, got ${config.maxNovaCalls}`);
  }

  // Validate maxTokensPerCall (100-10000)
  if (config.maxTokensPerCall < 100 || config.maxTokensPerCall > 10000) {
    errors.push(`maxTokensPerCall must be between 100 and 10000, got ${config.maxTokensPerCall}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get validated configuration
 * Throws error if configuration is invalid
 */
export function getConfig(): OrchestrationConfig {
  const config = loadConfig();
  const validation = validateConfig(config);

  if (!validation.valid) {
    throw new Error(
      `Invalid orchestration configuration:\n${validation.errors.join('\n')}`
    );
  }

  return config;
}
