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

export const StatusLabelSchema = z.union([
  z.enum([
    "Supported",
    "Disputed",
    "Unverified",
    "Manipulated",
    "Biased framing"
  ]),
  z.enum([
    "supported",
    "disputed",
    "unverified",
    "manipulated",
    "biased framing"
  ])
]).transform((val) => {
  // Normalize to capitalized format
  const normalized = val.toLowerCase();
  switch (normalized) {
    case 'supported': return 'Supported';
    case 'disputed': return 'Disputed';
    case 'unverified': return 'Unverified';
    case 'manipulated': return 'Manipulated';
    case 'biased framing': return 'Biased framing';
    default: return val as any;
  }
});

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
// Grounding Schemas (Real-time News Grounding)
// ============================================================================

export const EvidenceSourceSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  snippet: z.string(),
  why: z.string(),
  domain: z.string()
});

export const SIFTStepSchema = z.object({
  summary: z.string(),
  evidence_urls: z.array(z.string().url()).max(3)
});

export const SIFTDetailsSchema = z.object({
  stop: SIFTStepSchema,
  investigate: SIFTStepSchema,
  find: SIFTStepSchema,
  trace: SIFTStepSchema.extend({
    earliest_source: z.string().url().optional()
  })
});

export const GroundingMetadataSchema = z.object({
  providerUsed: z.enum(['bing', 'gdelt', 'none', 'demo', 'orchestrated']),
  sources_count: z.number().min(0),
  latencyMs: z.number().min(0),
  errors: z.array(z.string()).optional(),
  attemptedProviders: z.array(z.string()).optional(),
  sourcesCountRaw: z.number().min(0).optional(),
  sourcesCountReturned: z.number().min(0).optional(),
  cacheHit: z.boolean().optional()
});

// ============================================================================
// Text-Only Grounding Schemas (must be defined before AnalysisResponseSchema)
// ============================================================================

export const StanceSchema = z.enum(['supports', 'contradicts', 'mentions', 'unclear']);

export const ReasonCodeSchema = z.enum([
  'PROVIDER_EMPTY',
  'QUERY_TOO_VAGUE',
  'KEYS_MISSING',
  'TIMEOUT',
  'ERROR'
]);

export const NormalizedSourceWithStanceSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  snippet: z.string(),
  publishDate: z.string(), // ISO8601
  domain: z.string(),
  score: z.number().min(0).max(1),
  stance: StanceSchema,
  stanceJustification: z.string().optional(),
  provider: z.enum(['bing', 'gdelt', 'none', 'demo', 'orchestrated']),
  credibilityTier: z.union([z.literal(1), z.literal(2), z.literal(3)])
});

export const TextGroundingBundleSchema = z.object({
  sources: z.array(NormalizedSourceWithStanceSchema).min(0).max(6),
  queries: z.array(z.string()).min(0),
  providerUsed: z.array(z.enum(['bing', 'gdelt', 'none', 'demo', 'orchestrated'])),
  sourcesCount: z.number().min(0),
  cacheHit: z.boolean(),
  latencyMs: z.number().min(0),
  reasonCodes: z.array(ReasonCodeSchema).optional(),
  errors: z.array(z.string()).optional()
});

// ============================================================================
// Orchestration Metadata Schema (Iterative Evidence Orchestration)
// ============================================================================

export const OrchestrationMetadataSchema = z.object({
  enabled: z.boolean(),
  passes_executed: z.number().min(1).max(3),
  source_classes: z.number().min(0),
  average_quality: z.number().min(0).max(1),
  contradictions_found: z.boolean()
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
  sources: z.array(CredibleSourceSchema).min(0).max(3), // 0-3 sources (deprecated, use credible_sources)
  media_risk: MediaRiskSchema.nullable(),
  misinformation_type: MisinformationTypeSchema,
  sift_guidance: z.string(), // Deprecated, use sift object
  timestamp: z.string(), // ISO8601
  cached: z.boolean().optional(), // Optional flag indicating cached response
  // New fields for real-time news grounding
  credible_sources: z.array(EvidenceSourceSchema).max(5).optional(), // Top 5 sources with evidence
  sift: SIFTDetailsSchema.optional(), // Structured SIFT object
  grounding: GroundingMetadataSchema.optional(), // Grounding metadata
  text_grounding: TextGroundingBundleSchema.optional(), // Text-only grounding with stance-classified sources
  // Orchestration metadata (optional, present when orchestration pipeline used)
  orchestration: OrchestrationMetadataSchema.optional()
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
export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;
export type SIFTStep = z.infer<typeof SIFTStepSchema>;
export type SIFTDetails = z.infer<typeof SIFTDetailsSchema>;
export type GroundingMetadata = z.infer<typeof GroundingMetadataSchema>;
export type OrchestrationMetadata = z.infer<typeof OrchestrationMetadataSchema>;

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

// ============================================================================
// Extended Analysis Response Schema (with text-only grounding)
// ============================================================================

export const ExtendedAnalysisResponseSchema = AnalysisResponseSchema.extend({
  // Text-only grounding fields
  text_grounding: TextGroundingBundleSchema.optional()
});

// ============================================================================
// Type Exports (text-only grounding)
// ============================================================================

export type Stance = z.infer<typeof StanceSchema>;
export type ReasonCode = z.infer<typeof ReasonCodeSchema>;
export type NormalizedSourceWithStance = z.infer<typeof NormalizedSourceWithStanceSchema>;
export type TextGroundingBundle = z.infer<typeof TextGroundingBundleSchema>;
export type ExtendedAnalysisResponse = z.infer<typeof ExtendedAnalysisResponseSchema>;

// ============================================================================
// Validation Functions (text-only grounding)
// ============================================================================

/**
 * Validate TextGroundingBundle data
 * 
 * @param data - Data to validate
 * @returns Validation result with parsed data or error
 */
export function validateTextGroundingBundle(data: unknown): {
  success: boolean;
  data?: TextGroundingBundle;
  error?: string;
} {
  try {
    const parsed = TextGroundingBundleSchema.parse(data);
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
 * Validate ExtendedAnalysisResponse data
 * 
 * @param data - Data to validate
 * @returns Validation result with parsed data or error
 */
export function validateExtendedAnalysisResponse(data: unknown): {
  success: boolean;
  data?: ExtendedAnalysisResponse;
  error?: string;
} {
  try {
    const parsed = ExtendedAnalysisResponseSchema.parse(data);
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
