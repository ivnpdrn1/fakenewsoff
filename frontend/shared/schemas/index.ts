/**
 * Zod Schemas and Type Definitions
 * 
 * Re-exports backend Zod schemas for frontend use.
 * Ensures type safety and runtime validation across web UI and browser extension.
 * 
 * Validates: Requirements 10.2, 11.1-11.5
 */

// Re-export all schemas and types from local backend schemas copy
export {
  // Schemas
  StatusLabelSchema,
  MediaRiskSchema,
  ProgressStageStatusSchema,
  MisinformationTypeSchema,
  ProgressStageSchema,
  CredibleSourceSchema,
  AnalysisResponseSchema,
  EvidenceSourceSchema,
  SIFTStepSchema,
  SIFTDetailsSchema,
  GroundingMetadataSchema,
  StanceSchema,
  ReasonCodeSchema,
  NormalizedSourceWithStanceSchema,
  TextGroundingBundleSchema,
  TraceStepSchema,
  DecisionSummarySchema,
  TraceObjectSchema,
  
  // Types
  type StatusLabel,
  type MediaRisk,
  type ProgressStageStatus,
  type MisinformationType,
  type ProgressStage,
  type CredibleSource,
  type AnalysisResponse,
  type EvidenceSource,
  type SIFTStep,
  type SIFTDetails,
  type GroundingMetadata,
  type Stance,
  type ReasonCode,
  type NormalizedSourceWithStance,
  type TextGroundingBundle,
  type TraceStep,
  type DecisionSummary,
  type TraceObject,
  
  // Validation functions
  validateAnalysisResponse
} from './backend-schemas.js';
