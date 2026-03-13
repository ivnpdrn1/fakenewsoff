# V4 Production Validation Plan

## Deployment Commands

```powershell
# 1. Build
cd backend
sam build

# 2. Verify V4 markers in build artifact
.\scripts\verify-v4.ps1

# 3. Deploy
sam deploy --no-confirm-changeset

# 4. Test live API
.\scripts\verify-v4.ps1 -ApiUrl "https://your-api-url"
```

---

## Part 1: CloudWatch Log Markers

### Cold Start Marker (Proves V4 is Deployed)

**Search for**: `LAMBDA_HANDLER_STARTUP_V4`

**Expected log**:
```json
{
  "timestamp": "2024-...",
  "level": "INFO",
  "event": "LAMBDA_HANDLER_STARTUP_V4",
  "build_fix_version": "v4",
  "handler_file": "lambda.ts",
  "orchestration_method": "groundSingleQuery",
  "fix_description": "Query generation diagnosis + provider failure visibility"
}
```

**If missing**: V4 is NOT deployed. Redeploy.

---

### Orchestration Path Marker (Proves V4 Code Path is Active)

**Search for**: `LAMBDA_FIX_PATH_ACTIVE_V4`

**Expected log**:
```json
{
  "timestamp": "2024-...",
  "level": "INFO",
  "event": "LAMBDA_FIX_PATH_ACTIVE_V4",
  "handler": "analyze_orchestration",
  "fix_version": "v4",
  "orchestration_method": "groundSingleQuery",
  "text_length": 30
}
```

**If missing**: Request is not using orchestration path. Check `ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED` env var.

---

### Orchestration Result Marker (Shows Query/Subclaim Counts)

**Search for**: `ORCHESTRATION_RESULT_RECEIVED_V4`

**Expected log**:
```json
{
  "timestamp": "2024-...",
  "level": "INFO",
  "event": "ORCHESTRATION_RESULT_RECEIVED_V4",
  "has_queries": true,
  "queries_count": 3,
  "queries_preview": ["Russia Ukraine war latest", "Ukraine conflict news", "Russia military action"],
  "subclaim_count": 1,
  "subclaim_preview": ["Russia Ukraine war latest news"],
  "providers_succeeded": [],
  "providers_attempted": ["mediastack", "gdelt"],
  "providers_failed": ["mediastack", "gdelt"],
  "evidence_count": 0,
  "has_failure_details": true,
  "failure_details_count": 2,
  "fix_version": "v4"
}
```

**Key fields**:
- `queries_count`: Number of queries generated (should be 3-6 if decomposition works)
- `subclaim_count`: Number of subclaims (should be 2-5 if decomposition works, 1 if it fails)
- `providers_failed`: List of failed providers
- `has_failure_details`: Whether failure details are present
- `failure_details_count`: Number of provider failures

---

### Decomposition Error Marker (If Subclaim Count = 1)

**Search for**: `decomposition_error`

**Expected log** (if decomposition fails):
```json
{
  "timestamp": "2024-...",
  "level": "ERROR",
  "event": "decomposition_error",
  "claim_preview": "Russia Ukraine war latest news",
  "error_message": "Request timeout after 15000ms",
  "error_stack": "Error: Request timeout...",
  "fallback_strategy": "single_subclaim"
}
```

**If present**: NOVA decomposition is failing. See "Decomposition Failure Decision Tree" below.

---

## Part 2: API Response `_debug_fix_v4` Fields

### Field Inspection Order

**1. Check `fix_version` first**:
```json
"_debug_fix_v4": {
  "fix_version": "v4"
}
```
- If NOT "v4": V4 is not deployed. Redeploy.

**2. Check `subclaim_count`**:
```json
"subclaim_count": 1
```
- If `1`: Decomposition failed. Check CloudWatch for `decomposition_error`.
- If `2-5`: Decomposition succeeded.

**3. Check `queries_count`**:
```json
"queries_count": 3
```
- If `1`: Only 1 query generated (likely because subclaim_count = 1).
- If `3-6`: Normal query generation.

**4. Check `providers_failed`**:
```json
"providers_failed": ["mediastack", "gdelt"]
```
- If empty: All providers succeeded.
- If contains providers: Check `provider_failure_details` for reasons.

**5. Check `provider_failure_details`**:
```json
"provider_failure_details": [
  {
    "provider": "mediastack",
    "query": "Russia Ukraine war latest news",
    "reason": "timeout",
    "stage": "attempt_failed",
    "rawCount": 0,
    "normalizedCount": 0,
    "acceptedCount": 0,
    "errorMessage": "Request timeout after 5000ms"
  },
  {
    "provider": "gdelt",
    "query": "Russia Ukraine war latest news",
    "reason": "zero_results",
    "stage": "raw_result",
    "rawCount": 0,
    "normalizedCount": 0,
    "acceptedCount": 0
  }
]
```

---

## Part 3: Decision Trees

### Decision Tree 1: Subclaim Count Analysis

```
subclaim_count = ?
│
├─ subclaim_count = 1
│  │
│  ├─ Check CloudWatch for "decomposition_error"
│  │  │
│  │  ├─ Found "decomposition_error"
│  │  │  │
│  │  │  ├─ error_message contains "timeout"
│  │  │  │  └─ ROOT CAUSE: NOVA API timeout (15s)
│  │  │  │     NEXT CODE CHANGE: Increase NOVA timeout in novaClient.ts
│  │  │  │     FILE: backend/src/services/novaClient.ts
│  │  │  │     CHANGE: Increase timeout from 15000ms to 30000ms
│  │  │  │
│  │  │  ├─ error_message contains "unauthorized" or "credentials"
│  │  │  │  └─ ROOT CAUSE: NOVA API credentials issue
│  │  │  │     NEXT CODE CHANGE: Verify AWS_REGION and Bedrock permissions
│  │  │  │     FILE: backend/template.yaml
│  │  │  │     CHANGE: Check IAM role has bedrock:InvokeModel permission
│  │  │  │
│  │  │  ├─ error_message contains "rate limit" or "throttle"
│  │  │  │  └─ ROOT CAUSE: NOVA API rate limiting
│  │  │  │     NEXT CODE CHANGE: Add retry logic with exponential backoff
│  │  │  │     FILE: backend/src/services/novaClient.ts
│  │  │  │     CHANGE: Implement retry with backoff
│  │  │  │
│  │  │  └─ error_message contains "parse" or "JSON"
│  │  │     └─ ROOT CAUSE: NOVA response parsing failure
│  │  │        NEXT CODE CHANGE: Add response validation and error handling
│  │  │        FILE: backend/src/services/novaClient.ts
│  │  │        CHANGE: Add try-catch around JSON.parse with logging
│  │  │
│  │  └─ NOT Found "decomposition_error"
│  │     └─ ROOT CAUSE: Decomposition returned single subclaim intentionally
│  │        NEXT CODE CHANGE: None (claim is simple and doesn't need decomposition)
│  │
│  └─ subclaim_count = 2-5
│     └─ RESULT: Decomposition succeeded
│        NEXT STEP: Check provider failures
```

---

### Decision Tree 2: Provider Failure Analysis

```
provider_failure_details[i].reason = ?
│
├─ reason = "timeout"
│  │
│  ├─ provider = "mediastack"
│  │  └─ ROOT CAUSE: Mediastack API timeout (5000ms)
│  │     NEXT CODE CHANGE: Increase Mediastack timeout
│  │     FILE: backend/src/clients/mediastackClient.ts
│  │     CHANGE: Increase timeout from 5000ms to 10000ms
│  │     OR: Check Mediastack API status at https://mediastack.com/status
│  │
│  ├─ provider = "gdelt"
│  │  └─ ROOT CAUSE: GDELT API timeout (3500ms)
│  │     NEXT CODE CHANGE: Increase GDELT timeout
│  │     FILE: backend/src/clients/gdeltClient.ts
│  │     CHANGE: Increase timeout from 3500ms to 7000ms
│  │     OR: Check GDELT API status
│  │
│  └─ provider = "bing"
│     └─ ROOT CAUSE: Bing API timeout
│        NEXT CODE CHANGE: Increase Bing timeout
│        FILE: backend/src/clients/bingNewsClient.ts or bingWebClient.ts
│        CHANGE: Increase timeout
│
├─ reason = "unauthorized" or "invalid_key"
│  │
│  ├─ provider = "mediastack"
│  │  └─ ROOT CAUSE: Invalid MEDIASTACK_API_KEY
│  │     NEXT CODE CHANGE: Verify API key in AWS Console
│  │     FILE: AWS Lambda Environment Variables
│  │     CHANGE: Update MEDIASTACK_API_KEY
│  │
│  ├─ provider = "gdelt"
│  │  └─ ROOT CAUSE: GDELT doesn't require API key (should not happen)
│  │     NEXT CODE CHANGE: Investigate GDELT client error handling
│  │     FILE: backend/src/clients/gdeltClient.ts
│  │
│  └─ provider = "bing"
│     └─ ROOT CAUSE: Invalid BING_NEWS_KEY or BING_WEB_KEY
│        NEXT CODE CHANGE: Verify API key in AWS Console
│        FILE: AWS Lambda Environment Variables
│        CHANGE: Update BING_NEWS_KEY or BING_WEB_KEY
│
├─ reason = "zero_results"
│  │
│  ├─ stage = "raw_result"
│  │  └─ ROOT CAUSE: Provider API returned 0 results
│  │     NEXT CODE CHANGE: Review query parameters
│  │     FILE: backend/src/clients/{provider}Client.ts
│  │     CHANGE: Adjust query parameters (keywords, language, date filters)
│  │     OR: Test provider API directly with same query
│  │
│  ├─ stage = "normalized_result"
│  │  └─ ROOT CAUSE: All results filtered out during normalization
│  │     NEXT CODE CHANGE: Review normalization logic
│  │     FILE: backend/src/services/sourceNormalizer.ts
│  │     CHANGE: Check URL validation, domain extraction logic
│  │     DIAGNOSTIC: rawCount > 0 but normalizedCount = 0
│  │
│  └─ stage = "filter_result"
│     └─ ROOT CAUSE: All results filtered out by quality filter
│        NEXT CODE CHANGE: Review filter thresholds
│        FILE: backend/src/orchestration/evidenceFilter.ts
│        CHANGE: Lower minEvidenceScore threshold
│        DIAGNOSTIC: normalizedCount > 0 but acceptedCount = 0
│
├─ reason = "rate_limit"
│  │
│  ├─ provider = "mediastack"
│  │  └─ ROOT CAUSE: Mediastack rate limit exceeded
│  │     NEXT CODE CHANGE: Add rate limiting or upgrade plan
│  │     FILE: backend/src/clients/mediastackClient.ts
│  │     CHANGE: Add request throttling
│  │
│  ├─ provider = "gdelt"
│  │  └─ ROOT CAUSE: GDELT throttling too aggressive
│  │     NEXT CODE CHANGE: Adjust GDELT throttle settings
│  │     FILE: backend/src/services/gdeltThrottle.ts
│  │     CHANGE: Increase throttle interval
│  │
│  └─ provider = "bing"
│     └─ ROOT CAUSE: Bing rate limit exceeded
│        NEXT CODE CHANGE: Add rate limiting or upgrade plan
│        FILE: backend/src/clients/bingNewsClient.ts or bingWebClient.ts
│        CHANGE: Add request throttling
│
└─ reason = "error" or other
   └─ ROOT CAUSE: Unexpected error
      NEXT CODE CHANGE: Check errorMessage field for details
      FILE: Depends on errorMessage
      CHANGE: Add error handling or fix bug
```

---

### Decision Tree 3: Stage Analysis

```
provider_failure_details[i].stage = ?
│
├─ stage = "attempt_failed"
│  └─ MEANING: Provider API call failed before returning results
│     DIAGNOSTIC: Check errorMessage field
│     COMMON CAUSES: timeout, unauthorized, network error, API down
│     COUNTS: rawCount = 0, normalizedCount = 0, acceptedCount = 0
│
├─ stage = "raw_result"
│  └─ MEANING: Provider API returned 0 results
│     DIAGNOSTIC: Query might be too constrained
│     COMMON CAUSES: No matching articles, query too specific, date filters too narrow
│     COUNTS: rawCount = 0, normalizedCount = 0, acceptedCount = 0
│
├─ stage = "normalized_result"
│  └─ MEANING: Provider returned results but all filtered during normalization
│     DIAGNOSTIC: Check normalization logic (URL validation, domain extraction)
│     COMMON CAUSES: Invalid URLs, unknown domains, missing required fields
│     COUNTS: rawCount > 0, normalizedCount = 0, acceptedCount = 0
│
└─ stage = "filter_result"
   └─ MEANING: Provider returned normalized results but all filtered by quality filter
      DIAGNOSTIC: Check filter thresholds and quality scores
      COMMON CAUSES: Low relevance scores, low authority scores, stale articles
      COUNTS: rawCount > 0, normalizedCount > 0, acceptedCount = 0
```

---

## Part 4: Exact Code Changes by Failure Signature

### Signature 1: `subclaim_count = 1` + `decomposition_error` with "timeout"

**ROOT CAUSE**: NOVA API timeout (15 seconds)

**FILE**: `backend/src/services/novaClient.ts`

**EXACT CHANGE**:
```typescript
// BEFORE
const timeout = 15000; // 15 seconds

// AFTER
const timeout = 30000; // 30 seconds
```

**VERIFICATION**: Redeploy and check if `subclaim_count` increases to 2-5.

---

### Signature 2: `provider = "mediastack"` + `reason = "timeout"` + `stage = "attempt_failed"`

**ROOT CAUSE**: Mediastack API timeout (5000ms)

**FILE**: `backend/src/clients/mediastackClient.ts`

**EXACT CHANGE**:
```typescript
// BEFORE
const timeout = parseInt(env.MEDIASTACK_TIMEOUT_MS || '5000', 10);

// AFTER
const timeout = parseInt(env.MEDIASTACK_TIMEOUT_MS || '10000', 10);
```

**OR UPDATE ENV VAR**: Set `MEDIASTACK_TIMEOUT_MS=10000` in Lambda environment

**VERIFICATION**: Redeploy and check if `providers_failed` no longer contains "mediastack".

---

### Signature 3: `provider = "gdelt"` + `reason = "zero_results"` + `stage = "raw_result"`

**ROOT CAUSE**: GDELT API returned 0 results (query too constrained)

**FILE**: `backend/src/clients/gdeltClient.ts`

**EXACT CHANGE**: Review query parameters in `searchNews()` method:
```typescript
// Check if date filters are too narrow
// Check if keyword filters are too specific
// Check if language filters are excluding results
```

**ALTERNATIVE**: Test GDELT API directly:
```bash
curl "https://api.gdeltproject.org/api/v2/doc/doc?query=YOUR_QUERY&mode=artlist&maxrecords=10&format=json"
```

**VERIFICATION**: Check if `rawCount` increases in `provider_failure_details`.

---

### Signature 4: `provider = "mediastack"` + `reason = "zero_results"` + `stage = "normalized_result"` + `rawCount > 0`

**ROOT CAUSE**: Mediastack returned results but all filtered during normalization (invalid URLs)

**FILE**: `backend/src/services/sourceNormalizer.ts`

**EXACT CHANGE**: Review `normalizeMediastackArticles()` function:
```typescript
// Check URL validation logic
// Check domain extraction logic
// Add logging to see which URLs are being rejected
```

**DIAGNOSTIC**: Add logging before filtering:
```typescript
console.log('Mediastack raw articles:', articles.length);
console.log('Mediastack normalized articles:', normalized.length);
console.log('Rejected URLs:', rejectedUrls);
```

**VERIFICATION**: Check if `normalizedCount` increases in `provider_failure_details`.

---

### Signature 5: `provider = "mediastack"` + `reason = "zero_results"` + `stage = "filter_result"` + `normalizedCount > 0`

**ROOT CAUSE**: Mediastack returned normalized results but all filtered by quality filter

**FILE**: `backend/src/orchestration/evidenceFilter.ts`

**EXACT CHANGE**: Lower quality threshold:
```typescript
// BEFORE
const minEvidenceScore = 0.5;

// AFTER
const minEvidenceScore = 0.3;
```

**OR FILE**: `backend/src/orchestration/orchestrationConfig.ts`

**EXACT CHANGE**:
```typescript
// BEFORE
minEvidenceScore: 0.5,

// AFTER
minEvidenceScore: 0.3,
```

**VERIFICATION**: Check if `acceptedCount` increases in `provider_failure_details`.

---

### Signature 6: `provider = "mediastack"` + `reason = "unauthorized"` + `stage = "attempt_failed"`

**ROOT CAUSE**: Invalid MEDIASTACK_API_KEY

**FILE**: AWS Lambda Environment Variables (via AWS Console or CLI)

**EXACT CHANGE**:
1. Go to AWS Lambda Console
2. Select GroundingFunction
3. Configuration → Environment variables
4. Update `MEDIASTACK_API_KEY` with valid key

**VERIFICATION**: Redeploy and check if `providers_failed` no longer contains "mediastack".

---

## Part 5: Production Validation Checklist

After deploying V4, run this checklist:

### Step 1: Verify V4 Deployment

- [ ] Run `.\scripts\verify-v4.ps1` (build artifact check)
- [ ] CloudWatch shows `LAMBDA_HANDLER_STARTUP_V4` on cold start
- [ ] API response has `_debug_fix_v4.fix_version = "v4"`

### Step 2: Test Live API

```powershell
$response = Invoke-RestMethod -Uri "https://your-api-url/analyze" -Method POST -Body '{"text":"Russia Ukraine war latest news"}' -ContentType "application/json"
$response._debug_fix_v4 | ConvertTo-Json -Depth 10
```

### Step 3: Inspect `_debug_fix_v4` Fields

- [ ] `fix_version` = "v4"
- [ ] `subclaim_count` is present
- [ ] `queries_count` is present
- [ ] `providers_failed` is present (if providers fail)
- [ ] `provider_failure_details` is present (if providers fail)

### Step 4: Analyze Subclaim Count

- [ ] If `subclaim_count = 1`: Check CloudWatch for `decomposition_error`
- [ ] If `subclaim_count = 2-5`: Decomposition succeeded

### Step 5: Analyze Provider Failures

For each provider in `providers_failed`:
- [ ] Check `provider_failure_details` for that provider
- [ ] Note `reason`, `stage`, `rawCount`, `normalizedCount`, `acceptedCount`
- [ ] Follow decision tree to identify root cause
- [ ] Identify exact code change needed

### Step 6: Document Findings

Create a findings document with:
- Subclaim count and decomposition status
- Provider failure reasons and stages
- Root causes identified
- Exact code changes needed
- Priority order for fixes

---

## Part 6: Example Validation Session

### Test Claim
```
"Russia Ukraine war latest news"
```

### Expected V4 Response Structure
```json
{
  "request_id": "...",
  "status_label": "Unverified",
  "text_grounding": {
    "queries": ["Russia Ukraine war latest", "Ukraine conflict news", "Russia military action"],
    "sourcesCount": 0,
    "providerUsed": ["orchestrated"]
  },
  "retrieval_status": {
    "mode": "degraded",
    "status": "failed",
    "providersAttempted": ["mediastack", "gdelt"],
    "providersSucceeded": [],
    "providersFailed": ["mediastack", "gdelt"]
  },
  "_debug_fix_v4": {
    "fix_version": "v4",
    "queries_count": 3,
    "subclaim_count": 1,
    "subclaims_preview": ["Russia Ukraine war latest news"],
    "providers_failed": ["mediastack", "gdelt"],
    "provider_failure_details": [
      {
        "provider": "mediastack",
        "query": "Russia Ukraine war latest news",
        "reason": "timeout",
        "stage": "attempt_failed",
        "rawCount": 0,
        "normalizedCount": 0,
        "acceptedCount": 0,
        "errorMessage": "Request timeout after 5000ms"
      },
      {
        "provider": "gdelt",
        "query": "Russia Ukraine war latest news",
        "reason": "zero_results",
        "stage": "raw_result",
        "rawCount": 0,
        "normalizedCount": 0,
        "acceptedCount": 0
      }
    ]
  }
}
```

### Analysis

**Subclaim Count**: 1
- **Interpretation**: Decomposition failed or claim is simple
- **Action**: Check CloudWatch for `decomposition_error`

**Provider Failures**:

1. **Mediastack**: `timeout` at `attempt_failed`
   - **Root Cause**: Mediastack API timeout (5000ms)
   - **Next Change**: Increase timeout to 10000ms in `mediastackClient.ts`

2. **GDELT**: `zero_results` at `raw_result`
   - **Root Cause**: GDELT API returned 0 results
   - **Next Change**: Test GDELT API directly with query, adjust parameters

**Priority**:
1. Fix Mediastack timeout (most likely to succeed)
2. Investigate GDELT zero results (may need query adjustment)
3. If subclaim_count = 1 due to decomposition error, fix NOVA timeout

---

## Part 7: Quick Reference

### CloudWatch Search Queries

```
# Verify V4 is deployed
fields @timestamp, @message
| filter @message like /LAMBDA_HANDLER_STARTUP_V4/
| sort @timestamp desc
| limit 1

# Check orchestration results
fields @timestamp, @message
| filter @message like /ORCHESTRATION_RESULT_RECEIVED_V4/
| sort @timestamp desc
| limit 10

# Check decomposition errors
fields @timestamp, @message
| filter @message like /decomposition_error/
| sort @timestamp desc
| limit 10
```

### PowerShell Quick Test

```powershell
# Test and extract debug info
$response = Invoke-RestMethod -Uri "https://your-api-url/analyze" -Method POST -Body '{"text":"Russia Ukraine war latest news"}' -ContentType "application/json"

# Show V4 debug info
Write-Host "Fix Version: $($response._debug_fix_v4.fix_version)"
Write-Host "Subclaim Count: $($response._debug_fix_v4.subclaim_count)"
Write-Host "Queries Count: $($response._debug_fix_v4.queries_count)"
Write-Host "Providers Failed: $($response._debug_fix_v4.providers_failed -join ', ')"

# Show failure details
$response._debug_fix_v4.provider_failure_details | ForEach-Object {
    Write-Host "`nProvider: $($_.provider)"
    Write-Host "  Reason: $($_.reason)"
    Write-Host "  Stage: $($_.stage)"
    Write-Host "  Counts: raw=$($_.rawCount), normalized=$($_.normalizedCount), accepted=$($_.acceptedCount)"
    if ($_.errorMessage) {
        Write-Host "  Error: $($_.errorMessage)"
    }
}
```

---

## Summary

This validation plan provides:

1. **Exact CloudWatch log markers** to search for V4 deployment proof
2. **Exact `_debug_fix_v4` fields** to inspect in order of priority
3. **Exact decision trees** for interpreting subclaim counts, provider failures, and stages
4. **Exact code changes** for each failure signature with file paths and line changes
5. **Production-focused validation checklist** with no generic summaries

Deploy V4, run the validation, and use the decision trees to identify the exact root cause and code change needed.
