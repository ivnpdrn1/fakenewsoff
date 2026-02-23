/**
 * Schema Validators
 * 
 * Provides runtime type validation using Zod for API contracts and internal data structures.
 * Ensures type safety and data integrity throughout the analysis pipeline.
 * 
 * Validates: Requirements 12.3, 12.4
 */

import { z } from 'zod';

// ============================================================================
// Status Label and Media Risk Types
// ============================================================================

export const StatusLabelSchema = z.enum([
  "Supported",
  "Disputed",
  "Unverified",
  "Manipulated",
  "Biased framing"
]);

export const MediaRiskSchema = z.enum(["low", "medium", "high"]);

export const ProgressStageStatusSchema = z.enum(["completed", "in_progress", "pending"]);

export const MisinformationTypeSchema = z.enum([
  "Satire or Parody",
  "Misleading Content",
  "Imposter Content",
  "Fabricated Content",
  "False Connection",
  "False Context",
  "Manipulated Content"
]).nullable();

// ============================================================================
// Progress Stage Schema
// ============================================================================

export const ProgressStageSchema = z.object({
  stage: z.string(),
  status: ProgressStageStatusSchema,
  timestamp: z.string().nullable() // ISO8601 or null for pending stages
});

// ============================================================================
// Credible Source Schema
// ============================================================================

export const CredibleSourceSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  snippet: z.string(),
  why: z.string(),
  domain: z.string() // Registrable domain (eTLD+1)
});

// ============================================================================
// Analysis Response Schema
// ============================================================================

export const AnalysisResponseSchema = z.object({
  request_id: z.string().uuid(),
  status_label: StatusLabelSchema,
  confidence_score: z.number().min(0).max(100),
  recommendation: z.string(),
  progress_stages: z.array(ProgressStageSchema),
  sources: z.array(CredibleSourceSchema).min(0).max(3), // 0-3 sources
  media_risk: MediaRiskSchema.nullable(),
  misinformation_type: MisinformationTypeSchema,
  sift_guidance: z.string(),
  timestamp: z.string(), // ISO8601
  cached: z.boolean().optional() // Optional flag indicating cached response
});

// ============================================================================
// Extracted Claim Schema
// ============================================================================

export const ExtractedClaimSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1), // 0-1 confidence
  category: z.enum(["factual", "opinion"])
});

// ============================================================================
// Claim Extraction Result Schema
// ============================================================================

export const ClaimExtractionResultSchema = z.object({
  claims: z.array(ExtractedClaimSchema).min(0).max(5), // 0-5 claims
  summary: z.string()
});

// ============================================================================
// Search Result Schema
// ============================================================================

export const SearchResultSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  snippet: z.string(),
  domain: z.string(),
  publishDate: z.string().optional()
});

// ============================================================================
// Search Response Schema
// ============================================================================

export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema).min(0), // 5+ results per claim
  query: z.string()
});

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type StatusLabel = z.infer<typeof StatusLabelSchema>;
export type MediaRisk = z.infer<typeof MediaRiskSchema>;
export type ProgressStageStatus = z.infer<typeof ProgressStageStatusSchema>;
export type MisinformationType = z.infer<typeof MisinformationTypeSchema>;
export type ProgressStage = z.infer<typeof ProgressStageSchema>;
export type CredibleSource = z.infer<typeof CredibleSourceSchema>;
export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;
export type ExtractedClaim = z.infer<typeof ExtractedClaimSchema>;
export type ClaimExtractionResult = z.infer<typeof ClaimExtractionResultSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate AnalysisResponse data
 * 
 * @param data - Data to validate
 * @returns Validation result with parsed data or error
 */
export function validateAnalysisResponse(data: unknown): {
  success: boolean;
  data?: AnalysisResponse;
  error?: string;
} {
  try {
    const parsed = AnalysisResponseSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: formatZodError(error)
      };
    }
    return {
      success: false,
      error: 'Unknown validation error'
    };
  }
}

/**
 * Validate ClaimExtractionResult data
 * 
 * @param data - Data to validate
 * @returns Validation result with parsed data or error
 */
export function validateClaimExtractionResult(data: unknown): {
  success: boolean;
  data?: ClaimExtractionResult;
  error?: string;
} {
  try {
    const parsed = ClaimExtractionResultSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: formatZodError(error)
      };
    }
    return {
      success: false,
      error: 'Unknown validation error'
    };
  }
}

/**
 * Validate SearchResponse data
 * 
 * @param data - Data to validate
 * @returns Validation result with parsed data or error
 */
export function validateSearchResponse(data: unknown): {
  success: boolean;
  data?: SearchResponse;
  error?: string;
} {
  try {
    const parsed = SearchResponseSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: formatZodError(error)
      };
    }
    return {
      success: false,
      error: 'Unknown validation error'
    };
  }
}

/**
 * Format Zod validation errors into readable messages
 * 
 * @param error - Zod validation error
 * @returns Formatted error message
 */
function formatZodError(error: z.ZodError): string {
  const issues = error.issues.map((issue: z.ZodIssue) => {
    const path = issue.path.join('.');
    return `${path}: ${issue.message}`;
  });
  return `Validation failed: ${issues.join(', ')}`;
}

/**
 * Safe parse with default fallback
 * 
 * Attempts to parse data with schema, returns default value on failure
 * 
 * @param schema - Zod schema to use
 * @param data - Data to parse
 * @param defaultValue - Default value to return on failure
 * @returns Parsed data or default value
 */
export function safeParseWithDefault<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  defaultValue: T
): T {
  const result = schema.safeParse(data);
  return result.success ? result.data : defaultValue;
}
