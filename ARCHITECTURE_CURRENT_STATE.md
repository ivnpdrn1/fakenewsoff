# FakeNewsOff - Current Production Architecture

**Last Updated**: 2026-03-10 (Post Phase 1 Orchestration Rollout)  
**Status**: Production - Orchestration Pipeline Enabled  
**Version**: 2.0 (Iterative Evidence Orchestration)

---

## Executive Summary

FakeNewsOff is a real-time misinformation intelligence platform that uses AWS Bedrock Nova 2 to analyze claims and synthesize evidence from credible sources. As of Phase 1 rollout (2026-03-10), the system now features **dual-pipeline architecture** with feature flag control:

1. **Legacy Pipeline**: Original single-pass evidence retrieval (URL-based claims)
2. **Orchestration Pipeline**: Multi-stage iterative evidence orchestration (text-only claims)

The orchestration pipeline is currently **enabled in production** (`ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED=true`) and actively processing text-only claim analysis requests.

---

## System Overview

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS Cloud                                │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              API Gateway (HTTP API)                        │ │
│  │         https://fnd9pknygc.execute-api.us-east-1...        │ │
│  │                                                            │ │
│  │  Endpoints:                                                │ │
│  │  • POST /analyze      - Main analysis endpoint            │ │
│  │  • GET  /health       - Health check                      │ │
│  │  • GET  /health/grounding - Grounding health             │ │
│  │  • POST /internal/grounding-selftest - Diagnostics       │ │
│  └────────────────────────┬───────────────────────────────────┘ │
│                           │                                      │
│                           ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │         Lambda Function (Node.js 22.x)                     │ │
│  │   fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe        │ │
│  │                                                            │ │
│  │  Configuration:                                            │ │
│  │  • Timeout: 30s                                            │ │
│  │  • Memory: 512MB                                           │ │
│  │  • Runtime: nodejs22.x                                     │ │
│  │                                                            │ │
│  │  Environment Variables:                                    │ │
│  │  • GROUNDING_ENABLED=true                                  │ │
│  │  • GROUNDING_PROVIDER_ORDER=bing,gdelt                     │ │
│  │  • ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED=true ✅        │ │
│  └────────────────────────┬───────────────────────────────────┘ │
│                           │                                      │
│                           ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              AWS Bedrock (Nova 2)                          │ │
│  │  • amazon.nova-lite-v1:0 (LLM)                             │ │
│  │  • amazon.nova-embed-v1:0 (Embeddings)                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │           External APIs (Grounding)                        │ │
│  │  • Bing News API (news.bing.com)                           │ │
│  │  • GDELT API (api.gdeltproject.org)                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Stack Information
- **Stack Name**: fakenewsoff-backend
- **Region**: us-east-1
- **Account**: 794289527784
- **API URL**: https://fnd9pknygc.execute-api.us-east-1.amazonaws.com

---

## Request Flow

### High-Level Flow Diagram


```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ POST /analyze
       │ {"text": "claim", "url": "..."}
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│              API Gateway + Lambda Handler                     │
│                  (lambda.ts:handler)                          │
└──────┬───────────────────────────────────────────────────────┘
       │
       │ Parse request
       │ Validate input
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                  Feature Flag Check                           │
│                                                               │
│  Has URL parameter?                                           │
│  ├─ YES → Legacy Pipeline                                     │
│  └─ NO  → Check ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED     │
│           ├─ true  → Orchestration Pipeline ✅                │
│           └─ false → Legacy Pipeline                          │
└──────┬───────────────────────────────────────────────────────┘
       │
       ├─────────────────────┬─────────────────────────────────┐
       │                     │                                 │
       ▼                     ▼                                 ▼
┌─────────────┐    ┌──────────────────┐         ┌──────────────────┐
│   Legacy    │    │  Orchestration   │         │  Error Handler   │
│  Pipeline   │    │    Pipeline      │         │   (Fallback)     │
└─────────────┘    └──────────────────┘         └──────────────────┘
       │                     │                           │
       │                     │                           │
       └─────────────────────┴───────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Format Response│
                    │  (Backward      │
                    │   Compatible)   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Return JSON     │
                    │ + CORS Headers  │
                    └─────────────────┘
```

---

## Feature Flag Behavior

### Current Configuration

**Environment Variable**: `ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED=true` ✅

### Routing Logic

```typescript
// Pseudo-code from lambda.ts

if (request.url) {
  // URL-based claim → Always use legacy pipeline
  return legacyPipeline(request);
}

if (ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED && isTextOnly) {
  try {
    // Text-only claim → Use orchestration pipeline
    return orchestrationPipeline(request.text);
  } catch (error) {
    // Error → Automatic fallback to legacy
    console.error('Orchestration error, falling back to legacy');
    return legacyPipeline(request);
  }
}

// Default → Legacy pipeline
return legacyPipeline(request);
```

### Routing Matrix

| Request Type | Flag Enabled | Flag Disabled | Error Occurs |
|--------------|--------------|---------------|--------------|
| Text-only claim | Orchestration | Legacy | Fallback to Legacy |
| Claim with URL | Legacy | Legacy | Legacy |
| Demo mode | Legacy + Demo | Legacy + Demo | Legacy + Demo |

### Rollback Procedure

To disable orchestration (rollback to legacy):

```powershell
$FUNCTION_NAME = "fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe"
aws lambda update-function-configuration `
  --function-name $FUNCTION_NAME `
  --region us-east-1 `
  --environment '{\"Variables\":{\"GROUNDING_ENABLED\":\"true\",\"GROUNDING_PROVIDER_ORDER\":\"bing,gdelt\",\"ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED\":\"false\"}}'
```

**Rollback Time**: <2 minutes

---

## Pipeline Comparison

### Legacy Pipeline (Original)

**Used For**: URL-based claims, fallback scenarios

**Flow**:
1. Extract claims from content
2. Fetch sources (single-pass)
3. Synthesize evidence
4. Determine verdict

**Characteristics**:
- Single-pass retrieval
- No quality filtering
- No source diversity enforcement
- No contradiction search
- Faster (~10-15s)
- Lower cost (fewer API calls)

### Orchestration Pipeline (New)

**Used For**: Text-only claims (when flag enabled)

**Flow**:
1. **Claim Decomposition**: Break claim into subclaims
2. **Query Generation**: Generate diverse search queries
3. **Multi-Pass Orchestration**: Iterative evidence retrieval
   - Pass 1: Broad retrieval
   - Pass 2: Targeted refinement (if needed)
   - Pass 3: Contradiction/primary sources (if needed)
4. **Evidence Filtering**: Quality scoring and filtering
5. **Source Classification**: Classify by source type
6. **Contradiction Search**: Safety-first contradiction detection
7. **Verdict Synthesis**: Final verdict with evidence

**Characteristics**:
- Multi-pass retrieval (1-3 passes)
- Quality filtering (min score: 0.6)
- Source diversity enforcement (≥2 classes)
- Contradiction-first safety check
- Slower (~7-15s)
- Higher cost (more API calls)
- Better quality evidence

---

## Service Responsibilities

### Lambda Handler (`lambda.ts`)

**Responsibilities**:
- HTTP request/response handling
- CORS header management
- Feature flag evaluation
- Pipeline routing (legacy vs orchestration)
- Error handling and fallback
- Response formatting

**Key Functions**:
- `handler()`: Main Lambda entry point
- Routes to appropriate pipeline based on request type and feature flag

### Orchestration Pipeline (`iterativeOrchestrationPipeline.ts`)

**Responsibilities**:
- Coordinate all orchestration components
- Execute multi-stage pipeline
- Collect metrics and logs
- Handle errors gracefully

**Key Functions**:
- `analyzeWithIterativeOrchestration()`: Main pipeline orchestrator

**Components**:
1. **ClaimDecomposer**: Break claims into subclaims
2. **QueryGenerator**: Generate diverse search queries
3. **EvidenceOrchestrator**: Multi-pass evidence retrieval
4. **EvidenceFilter**: Quality filtering and page type classification
5. **SourceClassifier**: Domain and content-based classification
6. **ContradictionSearcher**: Contradiction-first safety check
7. **VerdictSynthesizer**: Final verdict synthesis

### Grounding Service (`groundingService.ts`)

**Responsibilities**:
- Real-time news retrieval
- Provider management (Bing News, GDELT)
- Retry logic and timeout handling
- Source normalization

**Key Functions**:
- `groundTextOnly()`: Retrieve news sources for text-only claims
- `getHealthStatus()`: Provider health check
- `runSelfTest()`: Diagnostic self-test

**Providers**:
- **Bing News API**: Primary news source
- **GDELT API**: Secondary news source (fallback)

### NOVA Client (`novaClient.ts`)

**Responsibilities**:
- AWS Bedrock Nova 2 integration
- LLM reasoning operations
- JSON parsing with repair
- Timeout protection

**Key Functions** (Orchestration):
- `decomposeClaimToSubclaims()`: Claim decomposition
- `generateQueriesFromSubclaims()`: Query generation
- `classifyEvidencePageType()`: Page type classification
- `scoreEvidenceQuality()`: Evidence quality scoring
- `verifyEvidenceContent()`: Content verification
- `synthesizeVerdict()`: Verdict synthesis

**Key Functions** (Legacy):
- `extractClaims()`: Extract claims from content
- `synthesizeEvidence()`: Analyze sources
- `determineLabel()`: Classify content

---

## Evidence Retrieval Pipeline

### Orchestration Pipeline Detail

```
┌─────────────────────────────────────────────────────────────────┐
│                    Stage 1: Claim Decomposition                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Input: "The Eiffel Tower is in Paris"                    │  │
│  │ NOVA: Decompose into subclaims                           │  │
│  │ Output: [                                                │  │
│  │   {type: "location", text: "Eiffel Tower in Paris"}     │  │
│  │ ]                                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Stage 2: Query Generation                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Input: Subclaims                                         │  │
│  │ NOVA: Generate diverse queries                           │  │
│  │ Output: [                                                │  │
│  │   {type: "exact", text: "Eiffel Tower Paris location"}  │  │
│  │   {type: "broad", text: "Eiffel Tower France"}          │  │
│  │ ]                                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Stage 3: Multi-Pass Orchestration                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Pass 1: Broad Retrieval                                  │  │
│  │  • Execute all queries                                   │  │
│  │  • Retrieve sources from Bing/GDELT                      │  │
│  │  • Filter by quality (min score: 0.6)                    │  │
│  │  • Classify by source type                               │  │
│  │  • Check if threshold met (min evidence: 3)             │  │
│  │                                                          │  │
│  │ Pass 2: Targeted Refinement (if needed)                  │  │
│  │  • Generate refined queries                              │  │
│  │  • Target underrepresented source classes                │  │
│  │  • Retrieve additional sources                           │  │
│  │                                                          │  │
│  │ Pass 3: Contradiction/Primary (if needed)                │  │
│  │  • Search for contradictions                             │  │
│  │  • Prioritize primary sources                            │  │
│  │  • Final quality check                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Stage 4: Evidence Filtering                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ For each source:                                         │  │
│  │  1. Classify page type (article/homepage/category/etc)  │  │
│  │  2. Score quality (relevance, credibility, freshness)    │  │
│  │  3. Verify content (extract key facts)                   │  │
│  │  4. Reject if:                                           │  │
│  │     • Generic page (homepage, category, tag, search)     │  │
│  │     • Broken link (404, timeout, unavailable)            │  │
│  │     • Low quality (score < 0.6)                          │  │
│  │     • Unrelated content                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                Stage 5: Source Classification                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Classify each source by:                                 │  │
│  │  • Domain (known sources: nytimes.com, bbc.com, etc)     │  │
│  │  • Content (unknown sources: analyze via NOVA)           │  │
│  │                                                          │  │
│  │ Source Classes:                                          │  │
│  │  • news_media (mainstream news)                          │  │
│  │  • government (official sources)                         │  │
│  │  • academic (research institutions)                      │  │
│  │  • fact_checker (fact-checking orgs)                     │  │
│  │  • primary (eyewitness, original documents)              │  │
│  │  • secondary (analysis, commentary)                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               Stage 6: Contradiction Search                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Safety-first contradiction detection:                    │  │
│  │  1. Generate contradiction queries                       │  │
│  │  2. Search for contradictory evidence                    │  │
│  │  3. Filter and classify contradictions                   │  │
│  │  4. Include in final analysis                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Stage 7: Verdict Synthesis                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Input: Evidence buckets (supporting/contradicting/context)│ │
│  │ NOVA: Synthesize final verdict                           │  │
│  │ Output:                                                  │  │
│  │  • Classification (true/false/misleading/etc)            │  │
│  │  • Confidence (0-1)                                      │  │
│  │  • Rationale (explanation)                               │  │
│  │  • Supported/unsupported subclaims                       │  │
│  │  • Best evidence selection                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Stopping Conditions

The orchestration pipeline stops when:
1. **Threshold Met**: Sufficient high-quality evidence collected (≥3 sources, avg quality ≥0.6)
2. **Max Passes**: Reached maximum passes (3)
3. **No Improvement**: No new evidence found in current pass

---

## Monitoring & Logging

### Structured Logging

All orchestration stages emit structured JSON logs:

```json
{
  "timestamp": "2026-03-10T02:00:00.000Z",
  "level": "INFO",
  "service": "evidenceOrchestrator",
  "event": "orchestration_complete",
  "passes_executed": 2,
  "total_evidence": 5,
  "source_classes": ["news_media", "fact_checker"],
  "average_quality": 0.75,
  "threshold_met": true
}
```

### Log Stages

- `pipeline`: Overall pipeline events
- `decomposition`: Claim decomposition
- `query_generation`: Query generation
- `orchestration`: Multi-pass orchestration
- `contradiction`: Contradiction search
- `synthesis`: Verdict synthesis

### CloudWatch Logs

**Log Group**: `/aws/lambda/fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe`

**Key Metrics**:
- Orchestration success rate
- Passes executed per request
- Evidence quality scores
- Source diversity metrics
- Latency per stage
- Error rates
- Fallback events

### Monitoring Commands

```powershell
# Tail logs
aws logs tail /aws/lambda/fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe --follow

# Filter orchestration logs
aws logs filter-log-events `
  --log-group-name /aws/lambda/fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe `
  --filter-pattern '"orchestration"'

# Filter errors
aws logs filter-log-events `
  --log-group-name /aws/lambda/fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe `
  --filter-pattern "ERROR"
```

---

## Response Schema

### Backward Compatible Response

All responses maintain backward compatibility with legacy schema:

```json
{
  "status_label": "true",
  "confidence_score": 85,
  "rationale": "Evidence strongly supports the claim...",
  "text_grounding": {
    "sources": [
      {
        "url": "https://example.com/article",
        "title": "Article Title",
        "snippet": "Relevant excerpt...",
        "domain": "example.com",
        "publishDate": "2026-03-10",
        "score": 0.85,
        "stance": "supports",
        "provider": "bing",
        "credibilityTier": "high"
      }
    ],
    "queries": 3,
    "providerUsed": ["orchestrated"],
    "sourcesCount": 5,
    "cacheHit": false,
    "latencyMs": 7565
  },
  "orchestration": {
    "enabled": true,
    "passes_executed": 2,
    "source_classes": 2,
    "average_quality": 0.75,
    "contradictions_found": false
  }
}
```

### Legacy Fields (Required)

- `status_label`: Verdict classification
- `confidence_score`: Confidence (0-100)
- `rationale`: Explanation text
- `text_grounding`: Grounding metadata
  - `sources`: Array of source objects
  - `queries`: Query count
  - `providerUsed`: Provider array
  - `sourcesCount`: Total sources
  - `cacheHit`: Cache status
  - `latencyMs`: Latency metric

### Orchestration Metadata (Optional)

- `orchestration.enabled`: Boolean flag
- `orchestration.passes_executed`: Pass count (1-3)
- `orchestration.source_classes`: Diversity metric
- `orchestration.average_quality`: Quality metric
- `orchestration.contradictions_found`: Boolean flag

---

## Configuration

### Environment Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `GROUNDING_ENABLED` | `true` | Enable real-time news grounding |
| `GROUNDING_PROVIDER_ORDER` | `bing,gdelt` | Provider priority order |
| `ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED` | `true` ✅ | Enable orchestration pipeline |

### Orchestration Configuration

Default configuration (can be overridden via environment):

```typescript
DEFAULT_CONFIG = {
  minEvidenceScore: 0.6,              // Quality threshold
  minSourceDiversity: 2,              // Diversity requirement
  maxRetrievalPasses: 3,              // Max iterations
  requirePrimarySourceWhenAvailable: true,  // Primary source priority
  rejectGenericPages: true,           // Filter generic pages
  contradictionSearchRequired: true,  // Safety check
  maxNovaCalls: 20,                   // Rate limiting
  maxTokensPerCall: 4000,             // Token limit
}
```

---

## Deployment Architecture

### Infrastructure as Code

**File**: `backend/template.yaml` (AWS SAM)

```yaml
Resources:
  FakeNewsOffApi:
    Type: AWS::Serverless::HttpApi
    Properties:
      CorsConfiguration:
        AllowOrigins: ['*']
        AllowMethods: [GET, POST, OPTIONS]

  AnalyzeFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: ./
      Handler: dist/lambda.handler
      Runtime: nodejs22.x
      Timeout: 30
      MemorySize: 512
      Environment:
        Variables:
          GROUNDING_ENABLED: 'true'
          GROUNDING_PROVIDER_ORDER: 'bing,gdelt'
```

### Deployment Process

```powershell
# 1. Run tests
cd backend
npm test -- --runInBand

# 2. Build with SAM
sam build

# 3. Deploy to AWS
sam deploy

# 4. Enable feature flag (if needed)
aws lambda update-function-configuration `
  --function-name fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe `
  --environment '{\"Variables\":{...}}'
```

### Deployment Scripts

- `scripts/deploy-backend.ps1`: Automated backend deployment
- `scripts/deploy-web.ps1`: Frontend deployment

---

## Error Handling & Fallback

### Automatic Fallback

The orchestration pipeline includes automatic fallback to legacy:

```typescript
try {
  // Attempt orchestration pipeline
  return await analyzeWithIterativeOrchestration(claim);
} catch (error) {
  console.error('Orchestration error, falling back to legacy');
  // Automatic fallback to legacy pipeline
  return await legacyPipeline(claim);
}
```

### Fallback Triggers

- NOVA API timeout
- NOVA API error
- Grounding service failure
- Unexpected exception
- Configuration error

### Fallback Behavior

- User receives valid response (via legacy)
- No 500 errors exposed
- Fallback logged for monitoring
- Transparent to user

---

## Performance Characteristics

### Latency (Current Production)

**Orchestration Pipeline**:
- Claim Decomposition: ~1-2s
- Query Generation: ~1-2s
- Multi-Pass Orchestration: ~3-8s
- Evidence Filtering: ~1-2s
- Contradiction Search: ~1-2s
- Verdict Synthesis: ~1-2s
- **Total**: ~7-15s

**Legacy Pipeline**:
- Claim Extraction: ~2-5s
- Source Fetching: ~3-8s
- Evidence Synthesis: ~5-10s
- **Total**: ~10-20s

### Success Metrics (Phase 1)

- **Orchestration Success Rate**: 100% (3/3 tests)
- **Error Rate**: 0%
- **Fallback Rate**: 0%
- **Average Latency**: ~7.5s
- **Passes Executed**: 2 (average)

---

## Security

### Implemented

- ✅ CORS configuration
- ✅ Input validation
- ✅ Timeout protection
- ✅ Error sanitization (no stack traces to user)
- ✅ Environment variable secrets
- ✅ IAM role-based access

### Future Enhancements

- [ ] API authentication
- [ ] Rate limiting per user/IP
- [ ] Request signing
- [ ] DDoS protection

---

## Future Roadmap

### Phase 2: Beta Users (Week 2)
- Identify 5-10 beta users
- A/B testing infrastructure
- Frontend testing with orchestration
- User feedback collection

### Phase 3: Production Canary (Week 3)
- 10% traffic to orchestration
- Metrics comparison (quality, latency, cost)
- Gradual rollout to 50%

### Phase 4: Full Rollout (Week 4+)
- 100% of text-only claims
- Remove feature flag
- Performance optimization
- Cost optimization

### Future Enhancements
- NOVA response caching
- Parallel query execution
- Round-trip verification
- Additional property-based tests
- Enhanced error handling
- Circuit breaker pattern

---

## Quick Reference

### Check Feature Flag Status

```powershell
curl -X POST https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/analyze `
  -H "Content-Type: application/json" `
  -d '{"text": "test"}' | jq '.orchestration.enabled'
```

### Enable Orchestration

```powershell
aws lambda update-function-configuration `
  --function-name fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe `
  --environment '{\"Variables\":{...,\"ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED\":\"true\"}}'
```

### Disable Orchestration (Rollback)

```powershell
aws lambda update-function-configuration `
  --function-name fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe `
  --environment '{\"Variables\":{...,\"ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED\":\"false\"}}'
```

### Monitor Logs

```powershell
aws logs tail /aws/lambda/fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe --follow
```

---

## Documentation

### Architecture Documents
- `ARCHITECTURE_CURRENT_STATE.md` - This document
- `backend/docs/architecture.md` - Original architecture (pre-orchestration)

### Orchestration Documentation
- `backend/ORCHESTRATION_PHASE1_RESULT.md` - Phase 1 rollout result
- `backend/ORCHESTRATION_ROLLOUT_INDEX.md` - Rollout documentation index
- `backend/ITERATIVE_ORCHESTRATION_RELEASE_READINESS.md` - Technical readiness

### Spec Documentation
- `.kiro/specs/iterative-evidence-orchestration/requirements.md` - Requirements
- `.kiro/specs/iterative-evidence-orchestration/design.md` - Design
- `.kiro/specs/iterative-evidence-orchestration/tasks.md` - Implementation tasks

---

## Contact & Support

**For Questions**:
- Review this document first
- Check rollout documentation in `backend/ORCHESTRATION_ROLLOUT_INDEX.md`
- Review CloudWatch logs for errors

**For Issues**:
- Check feature flag status
- Review error logs
- Consider rollback if critical

---

**Last Updated**: 2026-03-10  
**Version**: 2.0 (Post Phase 1 Orchestration Rollout)  
**Status**: Production - Orchestration Enabled ✅

