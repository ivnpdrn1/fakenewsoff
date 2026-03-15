# Bugfix Requirements Document

## Introduction

The evidence filter is rejecting 100% of evidence in production due to invoking Claude 3 Haiku (`anthropic.claude-3-haiku-20240307-v1:0`) instead of Amazon NOVA Lite. CloudWatch logs show providers successfully retrieve evidence (6 sources from Mediastack, 3 from Serper), but the evidenceFilter fails with "Model use case details have not been submitted for this account" when calling Claude, causing all evidence to be rejected and resulting in `sourcesCount=0` in the final response.

The root cause is in `backend/src/services/novaClient.ts` line 73, where `CLAUDE_MODEL_ID` environment variable overrides the NOVA model:
```typescript
const BEDROCK_MODEL_ID = process.env.CLAUDE_MODEL_ID || 'amazon.nova-lite-v1:0';
```

This bug prevents the application from functioning in production, as no evidence reaches the final analysis stage.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `CLAUDE_MODEL_ID` environment variable is set in Lambda THEN the system uses `anthropic.claude-3-haiku-20240307-v1:0` instead of `amazon.nova-lite-v1:0` for evidence filtering

1.2 WHEN evidenceFilter invokes Claude 3 Haiku for page type classification THEN the system fails with "Model use case details have not been submitted for this account"

1.3 WHEN evidenceFilter invokes Claude 3 Haiku for quality scoring THEN the system fails with "Model use case details have not been submitted for this account"

1.4 WHEN evidenceFilter invokes Claude 3 Haiku for content verification THEN the system fails with "Model use case details have not been submitted for this account"

1.5 WHEN all NOVA function calls fail due to Claude invocation errors THEN the system rejects all evidence candidates (100% rejection rate)

1.6 WHEN all evidence is rejected THEN the system returns `sourcesCount=0` in the final response despite providers successfully retrieving 9 sources

### Expected Behavior (Correct)

2.1 WHEN evidenceFilter needs to classify page types THEN the system SHALL use Amazon NOVA Lite (`amazon.nova-lite-v1:0`) regardless of `CLAUDE_MODEL_ID` environment variable

2.2 WHEN evidenceFilter needs to score evidence quality THEN the system SHALL use Amazon NOVA Lite (`amazon.nova-lite-v1:0`) regardless of `CLAUDE_MODEL_ID` environment variable

2.3 WHEN evidenceFilter needs to verify content relevance THEN the system SHALL use Amazon NOVA Lite (`amazon.nova-lite-v1:0`) regardless of `CLAUDE_MODEL_ID` environment variable

2.4 WHEN NOVA model invocation fails for any reason THEN the system SHALL fall back to pass-through mode with neutral quality scores (0.7) and preserve the evidence

2.5 WHEN providers successfully retrieve evidence (e.g., 9 sources) THEN the system SHALL preserve at least some evidence through filtering and return `sourcesCount > 0`

2.6 WHEN `CLAUDE_MODEL_ID` environment variable is set THEN the system SHALL ignore it for NOVA-based operations

### Unchanged Behavior (Regression Prevention)

3.1 WHEN evidenceFilter successfully classifies a page as generic (homepage, category, tag, search, unavailable) THEN the system SHALL CONTINUE TO reject that evidence with appropriate rejection reason

3.2 WHEN evidenceFilter successfully scores evidence below the quality threshold (< 0.6) THEN the system SHALL CONTINUE TO reject that evidence with "LOW_RELEVANCE" reason

3.3 WHEN evidenceFilter successfully verifies content as unrelated THEN the system SHALL CONTINUE TO reject that evidence with "UNRELATED" reason

3.4 WHEN evidenceFilter successfully validates high-quality relevant evidence THEN the system SHALL CONTINUE TO pass that evidence with quality scores

3.5 WHEN all evidence legitimately fails quality checks THEN the system SHALL CONTINUE TO return `sourcesCount=0` (this is correct behavior when evidence is genuinely low quality)

3.6 WHEN NOVA model is available and functioning THEN the system SHALL CONTINUE TO use NOVA-based classification and scoring (not pass-through mode)

3.7 WHEN providers fail to retrieve evidence THEN the system SHALL CONTINUE TO handle provider failures gracefully with appropriate error logging

3.8 WHEN the system operates in demo mode THEN the system SHALL CONTINUE TO use demo data without invoking NOVA
