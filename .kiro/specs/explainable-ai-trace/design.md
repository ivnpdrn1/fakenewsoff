# Design Document: Explainable AI Trace

## Overview

The Explainable AI Trace feature provides transparent, step-by-step visibility into how NOVA processes claims through its 11-stage verification pipeline. This feature addresses the critical need for transparency in AI-driven fact-checking by exposing the execution flow while maintaining security through careful filtering of sensitive information.

### Design Goals

1. **Transparency**: Users can see exactly how NOVA reached its verdict
2. **Security**: No exposure of internal prompts, chain-of-thought reasoning, secrets, or credentials
3. **Production-Ready**: Works across production, degraded, and demo modes
4. **Performance**: Trace overhead < 5% of total request latency
5. **Compatibility**: Backward-compatible with existing clients
6. **User-Friendly**: Understandable to normal users, not just technical judges

### Key Design Decisions

**Trace as First-Class Citizen**: The trace is not an afterthought or debug feature. It's a core part of the API response that provides value to end users by explaining the verification process.

**Safe Summaries Only**: Each trace step includes a user-facing summary that describes what happened without exposing implementation details. This balances transparency with security.

**Inline Collection**: Trace events are collected inline during pipeline execution rather than reconstructed afterward. This ensures accuracy and completeness while minimizing performance overhead.

**Graceful Degradation**: The frontend handles missing or malformed trace data gracefully, ensuring the feature never breaks the user experience.

## Architecture

### System Context

```
┌─────────────┐
│   Frontend  │
│  (React)    │
└──────┬──────┘
       │ POST /analyze
       │ { text: "claim" }
       ▼
┌─────────────────────────────────────────────────────────┐
│                    Lambda Handler                        │
│                  (backend/src/lambda.ts)                 │
└──────┬──────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│          Iterative Orchestration Pipeline                │
│   (backend/src/orchestration/                            │
│    iterativeOrchestrationPipeline.ts)                    │
│                                                           │
│  ┌─────────────────────────────────────────────┐        │
│  │         Trace Collector (NEW)               │        │
│  │  - Collects trace steps inline              │        │
│  │  - Filters sensitive information            │        │
│  │  - Tracks timing and status                 │        │
│  └─────────────────────────────────────────────┘        │
│                                                           │
│  11-Stage Pipeline:                                      │
│  1. Claim Intake                                         │
│  2. Claim Framing                                        │
│  3. Evidence Cache Check ◄─── Cache Service             │
│  4. Evidence Retrieval   ◄─── Grounding Service         │
│  5. Retrieval Status Evaluation                          │
│  6. Source Screening                                     │
│  7. Credibility Assessment                               │
│  8. Evidence Stance Classification                       │
│  9. Bedrock Reasoning    ◄─── AWS Bedrock               │
│  10. Verdict Generation                                  │
│  11. Response Packaging                                  │
└──────┬──────────────────────────────────────────────────┘
       │
       │ Returns API Response with trace
       ▼
┌─────────────────────────────────────────────────────────┐
│                    API Response                          │
│  {                                                        │
│    request_id: "uuid",                                   │
│    status_label: "Supported",                            │
│    confidence_score: 85,                                 │
│    ...                                                   │
│    trace: {                                              │
│      request_id: "uuid",                                 │
│      mode: "production",                                 │
│      provider: "aws_bedrock",                            │
│      pipeline: "nova",                                   │
│      steps: [ ... ],                                     │
│      decision_summary: { ... }                           │
│    }                                                     │
│  }                                                       │
└──────┬──────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│                Frontend Trace Panel                      │
│              (Results.tsx component)                     │
│                                                           │
│  "How NOVA Reached This Result"                         │
│  ✓ Claim Intake (12ms)                                  │
│  ✓ Claim Framing (234ms)                                │
│  ✓ Evidence Cache Check (5ms) - Cache hit               │
│  ✓ Evidence Retrieval (0ms) - Used cached evidence      │
│  ...                                                     │
└─────────────────────────────────────────────────────────┘
```

### Trace Flow Architecture

The trace is built incrementally as the pipeline executes:

1. **Pipeline Start**: Initialize trace collector with request metadata
2. **Each Stage**: 
   - Record stage start time
   - Execute stage logic
   - Record stage completion with status and safe summary
   - Add trace step to collector
3. **Pipeline End**: Attach complete trace to API response
4. **Frontend**: Parse and render trace in UI

### Integration Points

**Orchestration Pipeline** (`iterativeOrchestrationPipeline.ts`):
- Main integration point for trace collection
- Wraps each pipeline stage with trace instrumentation
- Collects timing, status, and safe summaries

**Grounding Service** (`groundingService.ts`):
- Reports cache hit/miss status
- Reports provider used (GDELT, Bing, demo)
- Reports throttling delays

**Grounding Cache** (`groundingCache.ts`):
- Exposes cache hit/miss information
- Provides cache age for trace metadata

**Lambda Handler** (`lambda.ts`):
- Attaches trace to API response
- Handles trace serialization
- Ensures backward compatibility

**Frontend** (`Results.tsx`, `backend-schemas.ts`):
- Parses trace from API response
- Renders trace panel UI
- Handles missing/malformed trace gracefully

## Components and Interfaces

### Backend Components

#### TraceCollector

**Purpose**: Collects trace steps during pipeline execution

**Location**: `backend/src/utils/traceCollector.ts`

**Responsibilities**:
- Initialize trace with request metadata
- Record trace steps with timing and status
- Filter sensitive information from summaries
- Generate final trace object

**Interface**:
```typescript
class TraceCollector {
  constructor(requestId: string, mode: OperationMode);
  
  startStep(name: string): void;
  completeStep(name: string, summary: string, status?: StepStatus): void;
  failStep(name: string, summary: string): void;
  skipStep(name: string, summary: string): void;
  
  getTrace(): TraceObject;
}
```

#### TraceSanitizer

**Purpose**: Ensures no sensitive information leaks into trace summaries

**Location**: `backend/src/utils/traceSanitizer.ts`

**Responsibilities**:
- Scan summaries for sensitive patterns
- Redact or reject summaries containing secrets
- Validate safe summary content

**Interface**:
```typescript
class TraceSanitizer {
  static sanitize(summary: string): string;
  static validate(summary: string): boolean;
  static containsSensitiveInfo(summary: string): boolean;
}
```

#### TraceSerializer

**Purpose**: Serializes trace objects to JSON for API responses

**Location**: `backend/src/utils/traceSerializer.ts`

**Responsibilities**:
- Convert TraceObject to JSON
- Ensure schema compliance
- Handle serialization errors gracefully

**Interface**:
```typescript
class TraceSerializer {
  static serialize(trace: TraceObject): string;
  static deserialize(json: string): TraceObject;
}
```

### Frontend Components

#### TracePanel

**Purpose**: Renders trace visualization in Results page

**Location**: `frontend/web/src/components/TracePanel.tsx`

**Responsibilities**:
- Display trace steps in sequence
- Show status icons (✓, ✕, ⚠)
- Display timing information
- Show safe summaries
- Handle missing trace gracefully

**Props**:
```typescript
interface TracePanelProps {
  trace?: TraceObject;
  className?: string;
}
```

#### TraceStep

**Purpose**: Renders individual trace step

**Location**: `frontend/web/src/components/TraceStep.tsx`

**Responsibilities**:
- Display step name and status icon
- Show duration
- Display safe summary
- Handle different status types

**Props**:
```typescript
interface TraceStepProps {
  step: TraceStepObject;
  index: number;
}
```

### Shared Types

#### TraceObject

**Location**: `backend/src/types/trace.ts` and `frontend/shared/schemas/backend-schemas.ts`

```typescript
interface TraceObject {
  request_id: string;
  mode: 'production' | 'degraded' | 'demo';
  provider: 'aws_bedrock';
  pipeline: 'nova';
  steps: TraceStepObject[];
  decision_summary: DecisionSummary;
  total_duration_ms: number;
}
```

#### TraceStepObject

```typescript
interface TraceStepObject {
  step_id: string;
  name: string;
  status: 'completed' | 'failed' | 'skipped';
  duration_ms: number;
  summary: string;
  timestamp: string; // ISO8601
}
```

#### DecisionSummary

```typescript
interface DecisionSummary {
  verdict: string;
  confidence: number;
  rationale: string;
  evidence_count: number;
}
```

## Data Models

### Trace Schema

The trace follows a strict schema to ensure consistency and enable validation:

```typescript
// backend/src/types/trace.ts

export type OperationMode = 'production' | 'degraded' | 'demo';
export type StepStatus = 'completed' | 'failed' | 'skipped';
export type Provider = 'aws_bedrock';
export type Pipeline = 'nova';

export interface TraceStepObject {
  step_id: string;           // Unique identifier (UUID)
  name: string;              // Human-readable step name
  status: StepStatus;        // Execution status
  duration_ms: number;       // Execution time in milliseconds
  summary: string;           // Safe, user-facing summary
  timestamp: string;         // ISO8601 timestamp
  metadata?: Record<string, unknown>; // Optional metadata (cache hit, etc.)
}

export interface DecisionSummary {
  verdict: string;           // Final verdict classification
  confidence: number;        // Confidence score (0-100)
  rationale: string;         // Verdict rationale
  evidence_count: number;    // Number of evidence sources used
}

export interface TraceObject {
  request_id: string;        // Request UUID
  mode: OperationMode;       // Operation mode
  provider: Provider;        // AI provider
  pipeline: Pipeline;        // Pipeline name
  steps: TraceStepObject[];  // Ordered trace steps
  decision_summary: DecisionSummary;
  total_duration_ms: number; // Total pipeline duration
}
```

### Zod Validation Schema

```typescript
// frontend/shared/schemas/backend-schemas.ts

export const TraceStepSchema = z.object({
  step_id: z.string().uuid(),
  name: z.string(),
  status: z.enum(['completed', 'failed', 'skipped']),
  duration_ms: z.number().min(0),
  summary: z.string(),
  timestamp: z.string(), // ISO8601
  metadata: z.record(z.unknown()).optional()
});

export const DecisionSummarySchema = z.object({
  verdict: z.string(),
  confidence: z.number().min(0).max(100),
  rationale: z.string(),
  evidence_count: z.number().min(0)
});

export const TraceObjectSchema = z.object({
  request_id: z.string().uuid(),
  mode: z.enum(['production', 'degraded', 'demo']),
  provider: z.literal('aws_bedrock'),
  pipeline: z.literal('nova'),
  steps: z.array(TraceStepSchema),
  decision_summary: DecisionSummarySchema,
  total_duration_ms: z.number().min(0)
});

export type TraceStep = z.infer<typeof TraceStepSchema>;
export type DecisionSummary = z.infer<typeof DecisionSummarySchema>;
export type TraceObject = z.infer<typeof TraceObjectSchema>;
```

### Extended API Response Schema

The existing `AnalysisResponseSchema` is extended to include the optional trace field:

```typescript
export const AnalysisResponseSchema = z.object({
  request_id: z.string().uuid(),
  status_label: StatusLabelSchema,
  confidence_score: z.number().min(0).max(100),
  recommendation: z.string(),
  progress_stages: z.array(ProgressStageSchema),
  sources: z.array(CredibleSourceSchema).min(0).max(3),
  media_risk: MediaRiskSchema.nullable(),
  misinformation_type: MisinformationTypeSchema,
  sift_guidance: z.string(),
  timestamp: z.string(),
  cached: z.boolean().optional(),
  credible_sources: z.array(EvidenceSourceSchema).max(5).optional(),
  sift: SIFTDetailsSchema.optional(),
  grounding: GroundingMetadataSchema.optional(),
  text_grounding: TextGroundingBundleSchema.optional(),
  orchestration: OrchestrationMetadataSchema.optional(),
  trace: TraceObjectSchema.optional() // NEW
});
```

### 11-Stage Pipeline Mapping

Each pipeline stage maps to a specific trace step:

| Stage # | Pipeline Stage | Trace Step Name | Key Information |
|---------|---------------|-----------------|-----------------|
| 1 | Claim intake | Claim Intake | Claim length, validation |
| 2 | Claim decomposition | Claim Framing | Subclaim count |
| 3 | Cache check | Evidence Cache Check | Cache hit/miss, cache age |
| 4 | Evidence retrieval | Evidence Retrieval | Provider used, source count, throttling |
| 5 | Retrieval evaluation | Retrieval Status Evaluation | Mode (production/degraded), status |
| 6 | Source screening | Source Screening | Sources filtered, rejection reasons |
| 7 | Credibility assessment | Credibility Assessment | Quality scores, authority levels |
| 8 | Stance classification | Evidence Stance Classification | Stance distribution |
| 9 | Bedrock reasoning | Bedrock Reasoning | Model used, evidence analyzed |
| 10 | Verdict synthesis | Verdict Generation | Classification, confidence |
| 11 | Response packaging | Response Packaging | Final response assembly |

### Safe Summary Guidelines

Each trace step summary must follow these rules:

**DO Include**:
- High-level description of what happened
- Counts and statistics (e.g., "Found 5 sources")
- Status information (e.g., "Cache hit", "Throttled")
- User-facing outcomes (e.g., "Classified as Supported")

**DO NOT Include**:
- Internal prompts or prompt templates
- Chain-of-thought reasoning steps
- API keys, tokens, or credentials
- Raw model outputs or deliberation
- Internal variable names or code references
- Provider-specific implementation details

**Examples**:

✅ Good: "Analyzed claim and identified 3 key subclaims for verification"
❌ Bad: "Executed prompt: 'Decompose the following claim...' and got response: [...]"

✅ Good: "Retrieved 5 news sources from GDELT (cache hit, 2 minutes old)"
❌ Bad: "Called GDELT API with key sk_xxx... and got 200 response with JSON: [...]"

✅ Good: "AI model analyzed evidence and generated verdict (Claude 3 Haiku)"
❌ Bad: "Bedrock reasoning: Let me think step by step. First, I notice..."

### Trace Step Metadata

Optional metadata can be attached to trace steps for additional context:

```typescript
// Evidence Cache Check metadata
{
  cache_hit: true,
  cache_age_ms: 120000, // 2 minutes
  cache_key: "normalized_query_hash"
}

// Evidence Retrieval metadata
{
  provider: "gdelt",
  throttled: true,
  throttle_delay_ms: 5000,
  sources_retrieved: 5,
  sources_after_filtering: 3
}

// Bedrock Reasoning metadata
{
  model: "claude-3-haiku",
  tokens_used: 1234,
  evidence_analyzed: 5
}
```

This metadata is optional and should only include non-sensitive information that adds value for debugging or transparency.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Trace Object Structure Completeness

*For any* API response from the /analyze endpoint, if a trace is present, it must contain all required fields: request_id matching the respons