# Mediastack Integration Deployment Guide

## Pre-Deployment Checklist

### 1. Verify Build Artifacts

Run these commands to confirm all changes are included:

```bash
# Navigate to backend directory
cd backend

# Clean and rebuild
npm run build

# Verify TypeScript compilation succeeds
# Should complete with no errors

# Run tests to ensure nothing broke
npm test -- --testPathPattern="groundingService" --no-coverage
```

**Expected:** All tests pass, TypeScript compiles successfully.

### 2. Verify Changed Files Are Included

Check that these files are in the build output (`backend/dist/`):

- `types/grounding.js` (includes 'mediastack' type)
- `utils/envValidation.js` (includes MEDIASTACK_API_KEY validation)
- `services/sourceNormalizer.js` (includes normalizeMediastackArticles)
- `services/groundingService.js` (includes MediastackClient integration)
- `clients/mediastackClient.js` (Mediastack API client)

```bash
# Check if files exist in dist
ls dist/types/grounding.js
ls dist/utils/envValidation.js
ls dist/services/sourceNormalizer.js
ls dist/services/groundingService.js
ls dist/clients/mediastackClient.js
```

### 3. Verify template.yaml Configuration

```bash
# Check template.yaml has correct values
cat template.yaml | grep -A 2 "GROUNDING_PROVIDER_ORDER"
cat template.yaml | grep -A 2 "MEDIASTACK"
```

**Expected output:**
```yaml
GROUNDING_PROVIDER_ORDER: 'mediastack,gdelt'
MEDIASTACK_API_KEY: ''
MEDIASTACK_TIMEOUT_MS: '5000'
```

## Deployment Steps

### Option 1: Using SAM CLI (Recommended)

```bash
# Navigate to backend directory
cd backend

# Build the application
sam build

# Deploy to AWS
sam deploy --guided

# Or if you have existing config:
sam deploy
```

### Option 2: Using Deployment Script

```bash
# From project root
./scripts/deploy-backend.ps1
```

### Option 3: Manual AWS CLI

```bash
cd backend

# Package the application
sam package \
  --template-file template.yaml \
  --output-template-file packaged.yaml \
  --s3-bucket your-deployment-bucket

# Deploy the packaged application
sam deploy \
  --template-file packaged.yaml \
  --stack-name fakenewsoff-backend \
  --capabilities CAPABILITY_IAM
```

## Post-Deployment Configuration

### 1. Set MEDIASTACK_API_KEY

**Via AWS Console:**
1. Navigate to AWS Lambda Console
2. Find function: `fakenewsoff-backend-AnalyzeFunction-*`
3. Go to Configuration → Environment variables
4. Edit `MEDIASTACK_API_KEY`
5. Set value to your Mediastack API key
6. Save

**Via AWS CLI:**
```bash
# Get the function name
FUNCTION_NAME=$(aws lambda list-functions --query "Functions[?contains(FunctionName, 'AnalyzeFunction')].FunctionName" --output text)

# Get current environment variables
aws lambda get-function-configuration --function-name $FUNCTION_NAME --query 'Environment.Variables' > current-env.json

# Update with your Mediastack API key
# Edit current-env.json to add: "MEDIASTACK_API_KEY": "your_key_here"

# Update the function
aws lambda update-function-configuration \
  --function-name $FUNCTION_NAME \
  --environment file://current-env.json
```

### 2. Verify Runtime Configuration

```bash
# Check deployed environment variables
aws lambda get-function-configuration \
  --function-name $FUNCTION_NAME \
  --query 'Environment.Variables' \
  --output json
```

**Verify these values:**
- `MEDIASTACK_API_KEY`: Set to your API key (not empty)
- `MEDIASTACK_TIMEOUT_MS`: '5000'
- `GROUNDING_PROVIDER_ORDER`: 'mediastack,gdelt'
- `DEMO_MODE`: 'false'
- `GROUNDING_ENABLED`: 'true'

## Verification Tests

### 1. Health Check

```bash
# Get API URL
API_URL=$(cat api-url.txt)

# Test health endpoint
curl "${API_URL}/health/grounding"
```

**Expected response should include:**
```json
{
  "ok": true,
  "mediastack_configured": true,
  "provider_order": ["mediastack", "gdelt"],
  ...
}
```

### 2. Test Claim: "Ronald Reagan is dead"

```bash
# Test via API
curl -X POST "${API_URL}/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Ronald Reagan is dead",
    "demo_mode": false
  }' | jq '.'
```

**Expected:**
- `sources` array has items
- `sources[].provider` includes "mediastack" or attempted providers includes "mediastack"
- `sources[].url` are real URLs (not placeholder)
- No fake nytimes.com/washingtonpost.com/reuters.com placeholders
- `verdict` is "Supported" or "Disputed" (not "Unverified" with empty sources)

### 3. Test Claim: "The Eiffel Tower is located in Paris"

```bash
curl -X POST "${API_URL}/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "The Eiffel Tower is located in Paris",
    "demo_mode": false
  }' | jq '.'
```

**Expected:**
- Valid retrieval flow
- Real sources if available
- No schema errors

### 4. Test Weak Claim

```bash
curl -X POST "${API_URL}/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "A completely obscure and unverifiable claim about nothing",
    "demo_mode": false
  }' | jq '.'
```

**Expected:**
- May return empty sources (acceptable)
- No fabricated URLs
- No broken links

## CloudWatch Logs Verification

### View Recent Logs

```bash
# Get log group name
LOG_GROUP="/aws/lambda/$(aws lambda list-functions --query "Functions[?contains(FunctionName, 'AnalyzeFunction')].FunctionName" --output text)"

# Get recent log streams
aws logs describe-log-streams \
  --log-group-name $LOG_GROUP \
  --order-by LastEventTime \
  --descending \
  --max-items 5

# Tail logs (requires log stream name from above)
aws logs tail $LOG_GROUP --follow
```

### What to Look For in Logs

**Successful Mediastack Usage:**
```json
{
  "event": "provider_attempt",
  "provider": "mediastack",
  "timeout_ms": 5000
}
{
  "event": "provider_success",
  "provider": "mediastack",
  "sources_raw": 5,
  "sources_returned": 3
}
```

**Fallback to GDELT:**
```json
{
  "event": "provider_failure",
  "provider": "mediastack",
  "error_code": "..."
}
{
  "event": "provider_attempt",
  "provider": "gdelt"
}
```

**Provider Order:**
```json
{
  "event": "grounding_start",
  "provider_order": ["mediastack", "gdelt"]
}
```

### Check for Issues

**❌ Bad - API Key Not Set:**
```
⚠️  MEDIASTACK_API_KEY not set - Mediastack provider will not be available
```

**❌ Bad - Old Provider Order:**
```json
{
  "provider_order": ["bing", "gdelt"]  // Missing mediastack
}
```

**✅ Good - Mediastack Working:**
```json
{
  "event": "provider_success",
  "provider": "mediastack",
  "sources_returned": 3
}
```

## Frontend Verification

### 1. Test via Web UI

1. Navigate to your deployed web app
2. Enter claim: "Ronald Reagan is dead"
3. Submit

**Verify:**
- Sources appear in results
- Source cards show real URLs
- Claim Evidence Graph renders
- No "Page Not Found" when clicking source links
- No schema validation errors in browser console

### 2. Check Browser Console

Open Developer Tools → Console

**❌ Bad - Schema Error:**
```
Error: Invalid provider type: mediastack
```

**✅ Good - No Errors:**
```
(no schema errors related to provider types)
```

## Troubleshooting

### Issue: Mediastack Not Being Used

**Check:**
1. Is MEDIASTACK_API_KEY set in Lambda environment?
2. Is GROUNDING_PROVIDER_ORDER set to 'mediastack,gdelt'?
3. Check CloudWatch logs for "mediastack_configured": true

**Fix:**
```bash
# Verify and update environment variables
aws lambda update-function-configuration \
  --function-name $FUNCTION_NAME \
  --environment Variables="{MEDIASTACK_API_KEY=your_key,GROUNDING_PROVIDER_ORDER=mediastack,gdelt,...}"
```

### Issue: Still Getting Empty Evidence

**Check:**
1. Is Mediastack API key valid?
2. Are you hitting rate limits?
3. Check CloudWatch logs for Mediastack errors

**Test Mediastack API directly:**
```bash
curl "http://api.mediastack.com/v1/news?access_key=YOUR_KEY&keywords=test&limit=1"
```

### Issue: Frontend Schema Errors

**Check:**
1. Is frontend deployed with updated schemas?
2. Clear browser cache
3. Check frontend/shared/schemas/backend-schemas.ts includes 'mediastack'

**Fix:**
```bash
# Redeploy frontend
cd frontend
npm run build
# Deploy to S3/CloudFront
```

## Rollback Plan

If issues occur, rollback to previous version:

```bash
# Via AWS Console:
# Lambda → Versions → Select previous version → Publish

# Via AWS CLI:
aws lambda update-alias \
  --function-name $FUNCTION_NAME \
  --name PROD \
  --function-version <previous-version>
```

## Success Criteria

✅ **Deployment Successful When:**
1. Lambda function updated with new code
2. MEDIASTACK_API_KEY environment variable set
3. GROUNDING_PROVIDER_ORDER = 'mediastack,gdelt'
4. Health endpoint shows mediastack_configured: true
5. Test claims return real sources
6. CloudWatch logs show Mediastack provider attempts
7. Frontend renders sources without errors
8. No fabricated URLs in responses

## Next Steps After Verification

1. Monitor CloudWatch logs for 24 hours
2. Check error rates and latency
3. Verify Mediastack API usage/costs
4. Update documentation with deployment date
5. Notify team of successful deployment
