# Implementation Plan: Explainable AI Trace

## Overview

This implementation adds transparent, step-by-step visibility into NOVA's 11-stage verification pipeline through a trace system that collects execution data inline, filters sensitive information, and displays results in both API responses and frontend UI. The trace supports production, degraded, and demo modes while maintaining backward compatibility.

## Tasks

- [x] 1. Create backend trace infrastructure
  - [x] 1.1 Create trace type definitions and schemas
    - Create `backend/src/types/trace.ts` with TypeScript interfaces for TraceObject, TraceStepObject, DecisionSummary, and type aliases
    - Define OperationMode, StepStatus, Provider, and Pipeline types
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
  
  - [x] 1.2 Implement TraceCollector class
    - Create `backend/src/utils/traceCollector.ts` with methods to initialize trace, start/complete/fail/skip steps, and generate final trace object
    - Track timing with Date.now() for each step
    - Generate UUIDs for step_id and use ISO8601 timestamps
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 10.1, 10.2, 10.3, 10.4_
  
  - [x] 1.3 Implement TraceSanitizer class
    - Create `backend/src/utils/traceSanitizer.ts` with methods to scan, validate, and sanitize trace summaries
    - Implement pattern detection for prompts, secrets (API keys, tokens), chain-of-thought markers, and internal variable names
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [x]* 1.4 Write unit tests for TraceCollector
    - Test step lifecycle (start, complete, fail, skip)
    - Test timing accuracy and step ordering
    - Test trace object generation
    - _Requirements: 12.1, 12.2_
  
  - [x]* 1.5 Write unit tests for TraceSanitizer
    - Test detection of prompts, secrets, chain-of-thought content
    - Test safe summary validation
    - Test edge cases (empty strings, special characters)
    - _Requirements: 12.5_

- [ ] 2. Integrate trace collection into orchestration pipeline
  - [ ] 2.1 Add trace collector initialization to iterativeOrchestrationPipeline
    - Initialize TraceCollector at pipeline start with request_id and operation mode
    - Pass trace collector through pipeline stages
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [ ] 2.2 Instrument all 11 pipeline stages with trace steps
    - Add trace.startStep() and trace.completeStep() calls for: Claim Intake, Claim Framing, Evidence Cache Check, Evidence Retrieval, Retrieval Status Evaluation, Source Screening, Credibility Assessment, Evidence Stance Classification, Bedrock Reasoning, Verdict Generation, Response Packaging
    - Generate safe summaries for each step following design guidelines
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_
  
  - [ ] 2.3 Add cache hit/miss tracking to Evidence Cache Check step
    - Detect cache hit/miss from grounding service response
    - Include cache status and age in step summary and metadata
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [ ] 2.4 Add provider and throttling tracking to Evidence Retrieval step
    - Capture provider used (GDELT, Bing, demo) from grounding service
    - Detect and report throttling delays in summary and metadata
    - _Requirements: 4.1, 4.2, 9.1, 9.2, 9.4_
  
  - [ ] 2.5 Add degraded mode detection to trace
    - Set mode to "degraded" when retrieval fails or returns insufficient evidence
    - Mark affected steps as "failed" or "skipped" with appropriate summaries
    - _Requirements: 5.1, 5.2, 5.3, 9.3_
  
  - [ ] 2.6 Add Bedrock Reasoning trace step
    - Instrument Bedrock API call with trace step
    - Include model name (Claude 3 Haiku) and evidence count in summary
    - Ensure no prompts or chain-of-thought content in summary
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ] 2.7 Generate decision summary from verdict
    - Extract verdict, confidence, rationale, and evidence count
    - Add decision_summary to trace object
    - _Requirements: 1.7, 10.5_
  
  - [ ]* 2.8 Write integration tests for pipeline trace collection
    - Test complete pipeline execution produces valid trace
    - Test cache hit/miss scenarios
    - Test degraded mode scenarios
    - Test timing accuracy (within 10% tolerance)
    - _Requirements: 12.3, 12.4, 10.4_

- [ ] 3. Checkpoint - Verify backend trace collection
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Add trace to API response
  - [ ] 4.1 Attach trace to orchestration result
    - Modify `analyzeWithIterativeOrchestration` to return trace object
    - Add trace to OrchestrationResult type in `backend/src/types/orchestration.ts`
    - _Requirements: 1.1, 10.1_
  
  - [ ] 4.2 Include trace in lambda handler response
    - Extract trace from orchestration result in lambda.ts handler
    - Add trace field to API response JSON (orchestration path only)
    - Ensure backward compatibility (trace is optional)
    - _Requirements: 1.1, 9.1_
  
  - [ ] 4.3 Add trace support to demo mode
    - Generate synthetic trace for demo responses
    - Use "demo" mode and mark steps as completed with demo-appropriate summaries
    - _Requirements: 1.3, 5.1_
  
  - [ ]* 4.4 Write integration tests for API response trace
    - Test trace appears in /analyze response
    - Test trace structure matches schema
    - Test demo mode trace generation
    - _Requirements: 12.1, 12.2_

- [ ] 5. Add frontend trace schema and parsing
  - [ ] 5.1 Add trace schemas to frontend shared schemas
    - Add TraceStepSchema, DecisionSummarySchema, and TraceObjectSchema to `frontend/shared/schemas/backend-schemas.ts` using Zod
    - Add trace field to AnalysisResponseSchema as optional
    - Export TypeScript types from Zod schemas
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  
  - [ ]* 5.2 Write property tests for trace schema round-trip
    - **Property 1: Round-trip consistency**
    - **Validates: Requirements 11.5**
    - Test that parsing then serializing then parsing produces equivalent object
    - Use fast-check to generate random valid trace objects
  
  - [ ]* 5.3 Write unit tests for trace schema validation
    - Test valid trace objects pass validation
    - Test invalid objects produce descriptive errors
    - Test schema violations are caught
    - _Requirements: 11.6, 11.7_

- [ ] 6. Implement frontend TracePanel component
  - [ ] 6.1 Create TraceStep component
    - Create `frontend/web/src/components/TraceStep.tsx` to render individual trace step
    - Display step name, status icon (✓ for completed, ✕ for failed, ⚠ for skipped/degraded), duration, and summary
    - Style with appropriate colors for different statuses
    - _Requirements: 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_
  
  - [ ] 6.2 Create TracePanel component
    - Create `frontend/web/src/components/TracePanel.tsx` to render complete trace
    - Display title "How NOVA Reached This Result"
    - Render all trace steps in sequence using TraceStep component
    - Display decision summary at the end
    - Handle missing trace gracefully (don't render panel if trace absent)
    - _Requirements: 8.1, 8.2, 8.3, 8.9_
  
  - [ ] 6.3 Integrate TracePanel into Results page
    - Add TracePanel to `frontend/web/src/pages/Results.tsx` below ResultsCard
    - Pass trace from API response to TracePanel
    - Ensure layout works on mobile and desktop
    - _Requirements: 8.1_
  
  - [ ]* 6.4 Write unit tests for TraceStep component
    - Test rendering with completed, failed, and skipped statuses
    - Test icon display for each status
    - Test duration formatting
    - _Requirements: 12.7_
  
  - [ ]* 6.5 Write unit tests for TracePanel component
    - Test rendering with valid trace
    - Test graceful handling of missing trace
    - Test graceful handling of malformed trace
    - Test decision summary display
    - _Requirements: 12.6, 12.9_

- [ ] 7. Add CSS styling for trace components
  - [ ] 7.1 Create TracePanel styles
    - Create `frontend/web/src/components/TracePanel.css` with styles for panel container, title, step list, and decision summary
    - Use consistent spacing and colors matching existing UI
    - Ensure responsive design for mobile
    - _Requirements: 8.1, 8.2_
  
  - [ ] 7.2 Create TraceStep styles
    - Create `frontend/web/src/components/TraceStep.css` with styles for step container, icon, name, duration, and summary
    - Use color coding: green for completed, red for failed, yellow/orange for skipped/degraded
    - _Requirements: 8.4, 8.5, 8.6_

- [ ] 8. End-to-end integration and testing
  - [ ] 8.1 Test complete flow with production mode
    - Submit claim through frontend
    - Verify trace appears in API response
    - Verify TracePanel renders correctly
    - Verify all 11 steps appear in correct order
    - _Requirements: 9.1, 10.1, 10.2_
  
  - [ ] 8.2 Test cache hit scenario
    - Submit same claim twice
    - Verify second request shows cache hit in trace
    - Verify Evidence Retrieval step indicates cached evidence
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 9.2_
  
  - [ ] 8.3 Test degraded mode scenario
    - Trigger degraded mode (simulate provider failure or insufficient evidence)
    - Verify mode is "degraded" in trace
    - Verify affected steps show appropriate status and warnings
    - _Requirements: 5.1, 5.2, 5.3, 9.3_
  
  - [ ] 8.4 Test demo mode trace
    - Submit claim with demo mode enabled
    - Verify trace shows "demo" mode
    - Verify all steps marked as completed with demo summaries
    - _Requirements: 1.3, 9.1_
  
  - [ ]* 8.5 Write smoke tests for trace feature
    - Test /analyze endpoint returns trace in response
    - Test frontend renders TracePanel without errors
    - Test trace data matches expected structure
    - _Requirements: 12.10_

- [ ] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Trace collection is inline during pipeline execution to ensure accuracy
- Safe summaries must never expose prompts, secrets, or chain-of-thought reasoning
- The trace feature is backward-compatible (trace field is optional in API response)
- Frontend gracefully handles missing or malformed trace data
- Checkpoints ensure incremental validation at key milestones
