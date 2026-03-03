/**
 * Backend Schema Definitions (Copied from backend)
 * 
 * This file contains Zod schemas copied from backend/src/utils/schemaValidators.ts
 * to avoid cross-package import issues.
 * 
 * NOTE: Keep this file in sync with backend schemas.
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
// Type Exports (inferred from schemas)
// ============================================================================

export type StatusLabel = z.infer<typeof StatusLabelSchema>;
export type MediaRisk = z.infer<typeof MediaRiskSchema>;
export type ProgressStageStatus = z.infer<typeof ProgressStageStatusSchema>;
export type MisinformationType = z.infer<typeof MisinformationTypeSchema>;
export type ProgressStage = z.infer<typeof ProgressStageSchema>;
export type CredibleSource = z.infer<typeof CredibleSourceSchema>;
export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;

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
