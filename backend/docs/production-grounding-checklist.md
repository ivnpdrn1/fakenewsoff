# Production Grounding Checklist

This document provides a comprehensive checklist for deploying and validating the real-time news grounding feature in production.

## Pre-Deployment Checklist

### Environment Variables

Ensure all required environment variables are set in your production environment:

#### Required Variables
- `NODE_ENV=production` - Set environment to production
- `AWS_REGION` - AWS region for Lambda deployment
- `BEDROCK_MODEL_ID` - Amazon Bedrock model ID
- `DYNAMODB_TABLE_NAME` - DynamoDB table for caching

#### Grounding Variables (Optional but Recommended)
- `BING_NEWS_KEY` - Bing News Search API key (recommended for best results)
  - If not set, system will use GDELT API only
  - Get key from: https://www.microsoft.com/en-us/bing/apis/bing-news-search-api
- `GDELT_DOC_ENDPOINT` - GDELT Document API endpoint (default: https://api.gdeltproject.org/api/v2/doc/doc)
  - No API key required
  - Always available as fallback

#### Grounding Configuration
- `GROUNDING_ENABLED` - Enable/disable grounding (default: true in prod, false in demo)
- `GROUNDING_PROVIDER_ORDER` - Provider fallback order (default: "bing,gdelt")
- `GROUNDING_TIMEOUT_MS` - Timeout for provider requests (default: 3500ms)
- `GROUNDING_CACHE_TTL_SECONDS` - Cache TTL (default: 900s / 15 minutes)
- `GROUNDING_MAX_RESULTS` - Max sources to return (default: 10)
- `GROUNDING_MIN_SIMILARITY` - Minimum lexical similarity threshold (default: 0.55)

#### Diagnostics (Production Only)
- `INTERNAL_DIAGNOSTICS_TOKEN` - Secure token for self-test endpoint
  - Generate with: `openssl rand -hex 32`
  - Keep this secret and secure

### Build Validation

Run all validation gates before deployment:

```bash
cd backend

# Type checking
npm run typecheck

# Linting
npm run lint

# Format checking
npm run formatcheck

# All tests (273 tests should pass)
npm test

# Build
npm run build
```

All gates must pass before proceeding.

## Deployment

Deploy using the standard deployment script:

```bash
# From project root
./scripts/deploy-backend.ps1
```

Or manually:

```bash
cd backend
sam build
sam deploy --config-file samconfig.toml
```

## Post-Deployment Validation

### Step 1: Basic Health Check

Test the basic health endpoint:

```bash
curl https://your-api-url.amazonaws.com/health
```

Expected response:
```json
{
  "status": "ok",
  "demo_mode": false,
  "timestamp": "2026-03-03T12:00:00.000Z"
}
```

### Step 2: Grounding Health Check

Test the grounding health endpoint:

```bash
curl https://your-api-url.amazonaws.com/health/grounding
```

Expected response:
```json
{
  "ok": true,
  "bing_configured": true,
  "gdelt_configured": true,
  "timeout_ms": 3500,
  "cache_ttl_seconds": 900,
  "provider_enabled": true,
  "provider_order": ["bing", "gdelt"]
}
```

**Validation:**
- `ok` should be `true` if grounding is enabled
- `bing_configured` should be `true` if BING_NEWS_KEY is set
- `gdelt_configured` should always be `true`
- `provider_enabled` should match your GROUNDING_ENABLED setting

### Step 3: Self-Test (Requires Token)

Run the self-test endpoint to verify grounding works end-to-end:

```bash
curl -X POST https://your-api-url.amazonaws.com/internal/grounding-selftest \
  -H "Authorization: Bearer YOUR_DIAGNOSTICS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"breaking news"}'
```

Expected response:
```json
{
  "providerUsed": "bing",
  "resultsCountRaw": 15,
  "resultsCountAfterFilter": 10,
  "topDomains": ["bbc.com", "cnn.com", "reuters.com", "apnews.com", "theguardian.com"],
  "latencyMs": 1234,
  "errors": [],
  "attemptedProviders": ["bing"]
}
```

**Validation:**
- `providerUsed` should be "bing" (if configured) or "gdelt" (fallback)
- `resultsCountAfterFilter` should be > 0 (indicates sources were found)
- `latencyMs` should be < 5000ms (under timeout threshold)
- `errors` should be empty or contain only non-fatal warnings
- `attemptedProviders` shows which providers were tried

### Step 4: Automated Smoke Tests

Run the automated smoke test scripts:

**PowerShell:**
```powershell
$env:INTERNAL_DIAGNOSTICS_TOKEN = "your_token_here"
./backend/scripts/smoke-grounding.ps1 -ApiUrl "https://your-api-url.amazonaws.com"
```

**Bash:**
```bash
export INTERNAL_DIAGNOSTICS_TOKEN="your_token_here"
./backend/scripts/smoke-grounding.sh "https://your-api-url.amazonaws.com"
```

All tests should pass with green checkmarks.

### Step 5: End-to-End Test

Test the full `/analyze` endpoint with a real headline:

```bash
curl -X POST https://your-api-url.amazonaws.com/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Breaking: Major earthquake strikes California",
    "demo_mode": false
  }'
```

**Validation:**
- Response should include `grounding` object with:
  - `providerUsed`: "bing" or "gdelt"
  - `sources_count`: > 0
  - `latencyMs`: < 5000
- Response should include `credible_sources` array with news articles
- Each source should have: `url`, `title`, `snippet`, `domain`

## Troubleshooting

### Issue: "Unverified + no sources" in production

**Symptoms:**
- `/health/grounding` returns `ok: false`
- Self-test returns `providerUsed: "none"`
- No sources in `/analyze` responses

**Diagnosis:**
1. Check if GROUNDING_ENABLED is set to false
2. Check if BING_NEWS_KEY is missing or invalid
3. Check CloudWatch logs for grounding errors
4. Verify network egress is allowed to:
   - `api.bing.microsoft.com` (port 443)
   - `api.gdeltproject.org` (port 443)

**Solutions:**
- Set `GROUNDING_ENABLED=true` in Lambda environment
- Verify BING_NEWS_KEY is valid (test at https://www.bing.com/api/v7/news/search)
- Check Lambda VPC configuration allows outbound HTTPS
- Review CloudWatch logs for specific error messages

### Issue: High latency (> 5 seconds)

**Symptoms:**
- Self-test shows `latencyMs` > 5000
- `/analyze` requests timeout

**Diagnosis:**
1. Check GROUNDING_TIMEOUT_MS setting
2. Check network latency to provider APIs
3. Check if providers are rate-limiting requests

**Solutions:**
- Increase `GROUNDING_TIMEOUT_MS` (default: 3500ms)
- Verify Lambda has adequate memory (recommend 512MB+)
- Check provider API status pages
- Consider adjusting `GROUNDING_PROVIDER_ORDER` to prioritize faster provider

### Issue: Low quality sources

**Symptoms:**
- Sources returned are not relevant to query
- Too many low-tier domains

**Diagnosis:**
1. Check `GROUNDING_MIN_SIMILARITY` threshold
2. Review domain tier mappings in `backend/src/utils/domainTiers.ts`
3. Check query extraction logic

**Solutions:**
- Increase `GROUNDING_MIN_SIMILARITY` (default: 0.55, try 0.65-0.75)
- Adjust domain tier scores for specific publishers
- Review query normalization in `backend/src/utils/queryExtractor.ts`

### Issue: Cache not working

**Symptoms:**
- Every request shows `cacheHit: false`
- High latency on repeated queries

**Diagnosis:**
1. Check if cache is disabled via CACHE_DISABLE
2. Check GROUNDING_CACHE_TTL_SECONDS setting
3. Review CloudWatch logs for cache errors

**Solutions:**
- Ensure `CACHE_DISABLE` is not set to true
- Verify `GROUNDING_CACHE_TTL_SECONDS` is reasonable (default: 900s)
- Check Lambda memory is sufficient for cache (recommend 512MB+)

## Monitoring

### Key Metrics to Monitor

1. **Grounding Success Rate**
   - CloudWatch metric: `grounding_provider_used` events
   - Target: > 95% success (providerUsed != "none")

2. **Grounding Latency**
   - CloudWatch metric: `grounding_completed` latencyMs
   - Target: p50 < 2000ms, p99 < 4000ms

3. **Cache Hit Rate**
   - CloudWatch metric: `grounding_cache_hit` vs `grounding_cache_miss`
   - Target: > 30% cache hit rate

4. **Provider Distribution**
   - CloudWatch metric: `grounding_provider_used` by provider
   - Monitor: Bing vs GDELT usage ratio

### CloudWatch Log Insights Queries

**Grounding success rate:**
```
fields @timestamp, providerUsed
| filter event = "grounding_completed"
| stats count() by providerUsed
```

**Average latency by provider:**
```
fields @timestamp, providerUsed, latencyMs
| filter event = "grounding_completed"
| stats avg(latencyMs) by providerUsed
```

**Cache hit rate:**
```
fields @timestamp, event
| filter event in ["grounding_cache_hit", "grounding_cache_miss"]
| stats count() by event
```

**Error analysis:**
```
fields @timestamp, error
| filter event = "grounding_error"
| stats count() by error
```

## Security Considerations

1. **INTERNAL_DIAGNOSTICS_TOKEN**
   - Keep this token secret
   - Rotate regularly (monthly recommended)
   - Never commit to version control
   - Use AWS Secrets Manager or Parameter Store

2. **API Keys**
   - Store BING_NEWS_KEY in AWS Secrets Manager
   - Use IAM roles for Lambda execution
   - Never log API keys in CloudWatch

3. **Rate Limiting**
   - Bing News API: 1000 requests/month (free tier)
   - GDELT API: No official limit, but be respectful
   - Implement application-level rate limiting if needed

## Performance Optimization

1. **Cache Configuration**
   - Increase TTL for stable news topics (up to 1 hour)
   - Decrease TTL for breaking news (down to 5 minutes)
   - Monitor cache hit rate and adjust

2. **Provider Selection**
   - Use Bing for best quality (requires API key)
   - Use GDELT for cost-free fallback
   - Consider provider order based on your use case

3. **Timeout Tuning**
   - Default 3500ms is conservative
   - Can reduce to 2000ms for faster responses
   - Must be < Lambda timeout (recommend 5s buffer)

## Rollback Plan

If grounding causes issues in production:

1. **Immediate Mitigation:**
   ```bash
   # Disable grounding via environment variable
   aws lambda update-function-configuration \
     --function-name fakenewsoff-backend \
     --environment Variables={GROUNDING_ENABLED=false}
   ```

2. **Verify Rollback:**
   ```bash
   curl https://your-api-url.amazonaws.com/health/grounding
   # Should show: "ok": false
   ```

3. **System Behavior:**
   - `/analyze` will continue working
   - No sources will be returned (empty array)
   - No grounding metadata in responses
   - Backward compatible with existing clients

## Support

For issues or questions:
- Review CloudWatch logs: `/aws/lambda/fakenewsoff-backend`
- Check this document's troubleshooting section
- Review source code: `backend/src/services/groundingService.ts`
- Run diagnostics: `./backend/scripts/smoke-grounding.ps1`
