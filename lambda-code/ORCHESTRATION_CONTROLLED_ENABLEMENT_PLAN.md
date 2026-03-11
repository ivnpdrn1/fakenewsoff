# Iterative Evidence Orchestration - Controlled Enablement Plan

**Date**: 2026-03-10  
**Feature**: Iterative Evidence Orchestration Pipeline  
**Feature Flag**: `ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED`  
**Current Status**: Code validated and pushed to GitHub  
**Target**: Controlled rollout to dev/test environments

---

## Executive Summary

This document provides the exact deployment steps, verification procedures, and safety checklists needed to enable the iterative evidence orchestration pipeline in dev/test environments. The feature is production-ready but will be enabled gradually with comprehensive monitoring and fallback procedures.

**Key Points**:
- Feature flag defaults to `false` (disabled) - safe by design
- Automatic fallback to legacy pipeline on any error
- No frontend changes required - backward compatible
- Comprehensive smoke tests included
- Clear rollback procedure defined

---

## Current Deployment Status

### Production Environment
- **Stack Name**: `fakenewsoff-backend`
- **Region**: `us-east-1`
- **Account ID**: `794289527784`
- **API URL**: `https://fnd9pknygc.execute-api.us-east-1.amazonaws.com`
- **Current Feature Flag**: `ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED=false` (disabled)

### Code Status
- ✅ All 297 tests passing
- ✅ Code pushed to GitHub
- ✅ Build validated
- ✅ No security concerns

---

## Phase 1: Environment Preparation

### Step 1.1: Verify Current Deployment


**Purpose**: Confirm current production deployment is healthy before enabling new feature.

```powershell
# 1. Check stack status
aws cloudformation describe-stacks `
  --stack-name fakenewsoff-backend `
  --region us-east-1 `
  --query 'Stacks[0].StackStatus' `
  --output text

# Expected: UPDATE_COMPLETE or CREATE_COMPLETE

# 2. Test health endpoint
curl https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/health

# Expected: {"status":"healthy","timestamp":"..."}

# 3. Test grounding health
curl https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/health/grounding

# Expected: {"status":"healthy","providers":[...]}

# 4. Test legacy analyze endpoint
curl -X POST https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/analyze `
  -H "Content-Type: application/json" `
  -d '{"text": "The sky is blue"}'

# Expected: Valid analysis response with status_label, confidence_score, etc.
```

**Success Criteria**:
- [ ] Stack status is healthy
- [ ] Health endpoint returns 200
- [ ] Grounding health returns 200
- [ ] Analyze endpoint returns valid response
- [ ] No errors in CloudWatch logs

---

### Step 1.2: Review Current Environment Variables

**Purpose**: Document current configuration before making changes.

```powershell
# Get current Lambda configuration
aws lambda get-function-configuration `
  --function-name fakenewsoff-backend-AnalyzeFunction-XXXXX `
  --region us-east-1 `
  --query 'Environment.Variables' `
  --output json
```

**Expected Variables**:
- `GROUNDING_ENABLED=true`
- `GROUNDING_PROVIDER_ORDER=bing,gdelt`
- `ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED` (may not exist yet, defaults to false)

**Action**: Save current configuration to file for rollback reference.

```powershell
aws lambda get-function-configuration `
  --function-name fakenewsoff-backend-AnalyzeFunction-XXXXX `
  --region us-east-1 > current-lambda-config-backup.json
```

---

## Phase 2: Backend Deployment with Feature Flag

### Step 2.1: Update SAM Template (Optional)

**Purpose**: Add feature flag to template for infrastructure-as-code tracking.

**File**: `backend/template.yaml`

**Change** (optional - can also set via AWS Console):
```yaml
Globals:
  Function:
    Timeout: 30
    MemorySize: 512
    Runtime: nodejs22.x
    Environment:
      Variables:
        GROUNDING_ENABLED: 'true'
        GROUNDING_PROVIDER_ORDER: 'bing,gdelt'
        ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED: 'false'  # Add this line
```

**Note**: This step is optional. You can also set the environment variable directly via AWS Console or CLI without modifying the template.

---

### Step 2.2: Deploy Backend to AWS

**Purpose**: Deploy the latest code with orchestration pipeline to AWS Lambda.

```powershell
# Navigate to backend directory
cd backend

# Run pre-deployment validation
npm test -- --runInBand

# Expected: All 297 tests pass

# Build with SAM
sam build

# Expected: Build successful

# Deploy to AWS (uses existing samconfig.toml)
sam deploy

# Expected: Deployment successful
```

**Deployment Output**:
```
Successfully created/updated stack - fakenewsoff-backend in us-east-1
```

**Verification**:
```powershell
# Verify deployment
aws cloudformation describe-stacks `
  --stack-name fakenewsoff-backend `
  --region us-east-1 `
  --query 'Stacks[0].StackStatus'

# Expected: UPDATE_COMPLETE
```

---

### Step 2.3: Verify Feature Flag is Disabled

**Purpose**: Confirm feature flag defaults to disabled after deployment.

```powershell
# Test analyze endpoint - should use legacy pipeline
curl -X POST https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/analyze `
  -H "Content-Type: application/json" `
  -d '{"text": "Test claim"}' | jq '.orchestration'

# Expected: null (orchestration field should not exist)
# This confirms legacy pipeline is active
```

**Success Criteria**:
- [ ] Response does not contain `orchestration` field
- [ ] Response contains all legacy fields (status_label, confidence_score, etc.)
- [ ] No errors in response

---

## Phase 3: Enable Feature Flag in Dev/Test

### Step 3.1: Enable Feature Flag via AWS Console

**Purpose**: Enable orchestration pipeline for testing.

**Method 1: AWS Console (Recommended for first-time)**

1. Navigate to AWS Lambda Console
2. Select function: `fakenewsoff-backend-AnalyzeFunction-XXXXX`
3. Go to "Configuration" tab
4. Select "Environment variables"
5. Click "Edit"
6. Add new variable:
   - **Key**: `ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED`
   - **Value**: `true`
7. Click "Save"

**Method 2: AWS CLI**

```powershell
# Get current function name
$FUNCTION_NAME = aws lambda list-functions `
  --region us-east-1 `
  --query "Functions[?starts_with(FunctionName, 'fakenewsoff-backend-AnalyzeFunction')].FunctionName" `
  --output text

# Enable feature flag
aws lambda update-function-configuration `
  --function-name $FUNCTION_NAME `
  --region us-east-1 `
  --environment "Variables={GROUNDING_ENABLED=true,GROUNDING_PROVIDER_ORDER=bing,gdelt,ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED=true}"

# Wait for update to complete
aws lambda wait function-updated `
  --function-name $FUNCTION_NAME `
  --region us-east-1

# Verify update
aws lambda get-function-configuration `
  --function-name $FUNCTION_NAME `
  --region us-east-1 `
  --query 'Environment.Variables.ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED'

# Expected: "true"
```

---

### Step 3.2: Verify Feature Flag is Enabled

**Purpose**: Confirm orchestration pipeline is now active.

```powershell
# Test text-only claim (should use orchestration)
curl -X POST https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/analyze `
  -H "Content-Type: application/json" `
  -d '{"text": "The Eiffel Tower is in Paris"}' | jq '.orchestration'

# Expected: {"enabled": true, "passes_executed": 1-3, ...}
```

**Success Criteria**:
- [ ] Response contains `orchestration` field
- [ ] `orchestration.enabled` is `true`
- [ ] `orchestration.passes_executed` is 1-3
- [ ] Response still contains all legacy fields
- [ ] No errors in response

---

## Phase 4: Post-Enable Smoke Tests

### Test Suite 1: Text-Only Claim Analysis (Orchestration Active)

**Purpose**: Verify orchestration pipeline works correctly for text-only claims.

```powershell
# Test 1: Simple factual claim
curl -X POST https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/analyze `
  -H "Content-Type: application/json" `
  -d '{"text": "Water boils at 100 degrees Celsius at sea level"}'

# Expected:
# - status_label: "true" or "partially_true"
# - confidence_score: > 0.7
# - orchestration.enabled: true
# - text_grounding.sources: array with multiple sources
# - No errors

# Test 2: Complex political claim
curl -X POST https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/analyze `
  -H "Content-Type: application/json" `
  -d '{"text": "The 2024 US presidential election had record voter turnout"}'

# Expected:
# - status_label: valid classification
# - orchestration.enabled: true
# - orchestration.passes_executed: 1-3
# - text_grounding.sources: diverse sources
# - No errors

# Test 3: Ambiguous claim
curl -X POST https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/analyze `
  -H "Content-Type: application/json" `
  -d '{"text": "Coffee is good for health"}'

# Expected:
# - status_label: "partially_true" or "unverified"
# - orchestration.enabled: true
# - orchestration.contradictions_found: possibly true
# - No errors
```

**Success Criteria**:
- [ ] All 3 tests return valid responses
- [ ] All responses contain `orchestration.enabled: true`
- [ ] All responses contain legacy fields
- [ ] Source quality appears improved
- [ ] No 500 errors

---

### Test Suite 2: Legacy URL Analysis (Orchestration Bypassed)

**Purpose**: Verify claims with URLs still use legacy pipeline.

```powershell
# Test 4: Claim with URL (should bypass orchestration)
curl -X POST https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/analyze `
  -H "Content-Type: application/json" `
  -d '{"text": "This article is fake", "url": "https://example.com/article"}'

# Expected:
# - status_label: valid classification
# - orchestration: null or undefined (not present)
# - text_grounding: null (URL analysis doesn't use text grounding)
# - No errors
```

**Success Criteria**:
- [ ] Response does NOT contain `orchestration` field
- [ ] Legacy URL analysis works correctly
- [ ] No errors

---

### Test Suite 3: Feature Flag Disabled Behavior

**Purpose**: Verify system works correctly when flag is disabled.

```powershell
# Disable feature flag
aws lambda update-function-configuration `
  --function-name $FUNCTION_NAME `
  --region us-east-1 `
  --environment "Variables={GROUNDING_ENABLED=true,GROUNDING_PROVIDER_ORDER=bing,gdelt,ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED=false}"

# Wait for update
aws lambda wait function-updated `
  --function-name $FUNCTION_NAME `
  --region us-east-1

# Test 5: Text-only claim with flag disabled
curl -X POST https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/analyze `
  -H "Content-Type: application/json" `
  -d '{"text": "The sky is blue"}'

# Expected:
# - status_label: valid classification
# - orchestration: null or undefined (not present)
# - Legacy pipeline used
# - No errors

# Re-enable feature flag for remaining tests
aws lambda update-function-configuration `
  --function-name $FUNCTION_NAME `
  --region us-east-1 `
  --environment "Variables={GROUNDING_ENABLED=true,GROUNDING_PROVIDER_ORDER=bing,gdelt,ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED=true}"

aws lambda wait function-updated `
  --function-name $FUNCTION_NAME `
  --region us-east-1
```

**Success Criteria**:
- [ ] Legacy pipeline works when flag disabled
- [ ] No orchestration metadata in response
- [ ] No errors

---

### Test Suite 4: Orchestration Fallback Behavior

**Purpose**: Verify automatic fallback to legacy pipeline on orchestration errors.

**Note**: This test is harder to trigger manually. Monitor CloudWatch logs for natural fallback occurrences.

```powershell
# Monitor CloudWatch logs for fallback events
aws logs tail /aws/lambda/fakenewsoff-backend-AnalyzeFunction-XXXXX `
  --follow `
  --filter-pattern "fallback"

# Look for log entries like:
# "Error in iterative orchestration: ... Falling back to legacy pipeline"
```

**Success Criteria**:
- [ ] Fallback logs appear when orchestration fails
- [ ] User still receives valid response (via legacy)
- [ ] No 500 errors exposed to user

---

### Test Suite 5: Frontend Verification

**Purpose**: Verify frontend displays orchestration results correctly.

**Manual Testing Steps**:

1. Navigate to: `https://fakenewsoff.com` (or your frontend URL)
2. Enter text-only claim: "The Earth orbits the Sun"
3. Click "Analyze"
4. Verify:
   - [ ] Results display correctly
   - [ ] Verdict classification shows
   - [ ] Confidence score displays
   - [ ] Rationale text appears
   - [ ] Source cards render
   - [ ] Claim Evidence Graph renders (if applicable)
   - [ ] No console errors
   - [ ] No visual glitches

5. Enter claim with URL: "This is fake" + URL
6. Verify:
   - [ ] Legacy URL analysis works
   - [ ] Results display correctly
   - [ ] No errors

**Browser Console Check**:
```javascript
// Open browser console (F12)
// Check for errors
console.log("No errors should appear");
```

---

## Phase 5: Monitoring & Observability

### Step 5.1: CloudWatch Logs Monitoring

**Purpose**: Monitor orchestration pipeline execution in real-time.

```powershell
# Tail Lambda logs
aws logs tail /aws/lambda/fakenewsoff-backend-AnalyzeFunction-XXXXX `
  --follow `
  --region us-east-1

# Filter for orchestration logs
aws logs filter-log-events `
  --log-group-name /aws/lambda/fakenewsoff-backend-AnalyzeFunction-XXXXX `
  --filter-pattern '"stage":"orchestration"' `
  --region us-east-1

# Filter for errors
aws logs filter-log-events `
  --log-group-name /aws/lambda/fakenewsoff-backend-AnalyzeFunction-XXXXX `
  --filter-pattern "ERROR" `
  --region us-east-1
```

**Key Log Patterns to Monitor**:
- `"stage":"decomposition"` - Claim decomposition
- `"stage":"query_generation"` - Query generation
- `"stage":"orchestration"` - Multi-pass retrieval
- `"stage":"contradiction"` - Contradiction search
- `"stage":"synthesis"` - Verdict synthesis
- `"Error in iterative orchestration"` - Fallback events
- `"Falling back to legacy pipeline"` - Fallback confirmation

---

### Step 5.2: Metrics to Track

**Purpose**: Establish baseline metrics for orchestration performance.

**Success Metrics**:
| Metric | Target | How to Measure |
|--------|--------|----------------|
| Orchestration success rate | >95% | Count responses with `orchestration.enabled: true` |
| Orchestration latency (p95) | <30s | Measure time from request to response |
| Fallback rate | <10% | Count fallback log entries |
| Error rate | <5% | Count 500 responses |
| Source quality | Improved | Compare `text_grounding.sources` quality |
| Source diversity | ≥2 classes | Check `orchestration.source_classes` |

**How to Collect**:
```powershell
# Get Lambda metrics
aws cloudwatch get-metric-statistics `
  --namespace AWS/Lambda `
  --metric-name Duration `
  --dimensions Name=FunctionName,Value=fakenewsoff-backend-AnalyzeFunction-XXXXX `
  --start-time (Get-Date).AddHours(-1).ToUniversalTime() `
  --end-time (Get-Date).ToUniversalTime() `
  --period 300 `
  --statistics Average,Maximum `
  --region us-east-1

# Get error count
aws cloudwatch get-metric-statistics `
  --namespace AWS/Lambda `
  --metric-name Errors `
  --dimensions Name=FunctionName,Value=fakenewsoff-backend-AnalyzeFunction-XXXXX `
  --start-time (Get-Date).AddHours(-1).ToUniversalTime() `
  --end-time (Get-Date).ToUniversalTime() `
  --period 300 `
  --statistics Sum `
  --region us-east-1
```

---

### Step 5.3: Cost Monitoring

**Purpose**: Track AWS costs for orchestration pipeline.

**Key Cost Drivers**:
- NOVA API calls (Bedrock)
- Lambda execution time (increased latency)
- Grounding API calls (Bing News)

**How to Monitor**:
```powershell
# Get Bedrock usage
aws ce get-cost-and-usage `
  --time-period Start=(Get-Date).AddDays(-1).ToString("yyyy-MM-dd"),End=(Get-Date).ToString("yyyy-MM-dd") `
  --granularity DAILY `
  --metrics BlendedCost `
  --filter file://bedrock-filter.json `
  --region us-east-1

# bedrock-filter.json:
# {
#   "Dimensions": {
#     "Key": "SERVICE",
#     "Values": ["Amazon Bedrock"]
#   }
# }
```

**Cost Targets**:
- NOVA calls per analysis: <20
- Cost per analysis: <$0.10 (estimate)
- Daily cost increase: <20% vs legacy

---

## Phase 6: Go/No-Go Checklist

### Pre-Enablement Checklist

**Before enabling feature flag in dev/test:**

- [ ] All 297 tests passing locally
- [ ] Code pushed to GitHub
- [ ] Backend deployed to AWS successfully
- [ ] Health endpoints returning 200
- [ ] Legacy analyze endpoint working
- [ ] Current Lambda config backed up
- [ ] Rollback procedure documented
- [ ] Team notified of enablement

**Go Criteria**: All items checked ✅

---

### Post-Enablement Checklist (First 1 Hour)

**After enabling feature flag:**

- [ ] Feature flag verified enabled
- [ ] Text-only claim returns orchestration metadata
- [ ] URL claim bypasses orchestration (legacy)
- [ ] No 500 errors in first 10 requests
- [ ] CloudWatch logs show orchestration stages
- [ ] No critical errors in logs
- [ ] Frontend displays results correctly
- [ ] Latency acceptable (<30s p95)

**Go Criteria**: All items checked ✅

**No-Go Criteria** (immediate rollback):
- ❌ Error rate >10%
- ❌ Any 500 errors
- ❌ Frontend broken
- ❌ Latency >60s
- ❌ Fallback rate >25%

---

### Post-Enablement Checklist (First 24 Hours)

**After 24 hours of operation:**

- [ ] Orchestration success rate >95%
- [ ] Error rate <5%
- [ ] Fallback rate <10%
- [ ] Latency p95 <30s
- [ ] No user complaints
- [ ] Source quality improved or equal
- [ ] Cost within budget
- [ ] No security incidents

**Go Criteria**: All items checked ✅

**No-Go Criteria** (rollback):
- ❌ Orchestration success rate <90%
- ❌ Error rate >10%
- ❌ User complaints about quality
- ❌ Cost increase >50%

---

## Phase 7: Rollback Procedure

### Emergency Rollback (Immediate)

**When to Use**: Critical issues, high error rate, user-facing problems.

**Steps**:

```powershell
# 1. Disable feature flag immediately
$FUNCTION_NAME = aws lambda list-functions `
  --region us-east-1 `
  --query "Functions[?starts_with(FunctionName, 'fakenewsoff-backend-AnalyzeFunction')].FunctionName" `
  --output text

aws lambda update-function-configuration `
  --function-name $FUNCTION_NAME `
  --region us-east-1 `
  --environment "Variables={GROUNDING_ENABLED=true,GROUNDING_PROVIDER_ORDER=bing,gdelt,ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED=false}"

# 2. Wait for update
aws lambda wait function-updated `
  --function-name $FUNCTION_NAME `
  --region us-east-1

# 3. Verify rollback
curl -X POST https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/analyze `
  -H "Content-Type: application/json" `
  -d '{"text": "Test"}' | jq '.orchestration'

# Expected: null (orchestration disabled)

# 4. Monitor logs for errors
aws logs tail /aws/lambda/fakenewsoff-backend-AnalyzeFunction-XXXXX `
  --follow `
  --filter-pattern "ERROR"

# 5. Notify team
Write-Host "ROLLBACK COMPLETE - Orchestration disabled" -ForegroundColor Yellow
```

**Rollback Time**: <2 minutes

---

### Planned Rollback (Graceful)

**When to Use**: Non-critical issues, planned maintenance, testing complete.

**Steps**:

1. Announce rollback to team
2. Disable feature flag (same as emergency)
3. Verify legacy pipeline working
4. Document issues found
5. Plan fixes
6. Schedule re-enablement

---

## Phase 8: Success Criteria Summary

### Dev/Test Rollout Success

**Criteria for declaring dev/test rollout successful:**

1. ✅ Feature flag enabled without errors
2. ✅ All smoke tests passing
3. ✅ Orchestration success rate >95%
4. ✅ Error rate <5%
5. ✅ Fallback rate <10%
6. ✅ Latency p95 <30s
7. ✅ Frontend working correctly
8. ✅ No critical bugs found
9. ✅ Source quality improved or equal
10. ✅ Team confident in stability

**Next Step**: Proceed to staging/beta rollout

---

### Dev/Test Rollout Failure

**Criteria for declaring dev/test rollout failed:**

1. ❌ Error rate >10%
2. ❌ Orchestration success rate <90%
3. ❌ Critical bugs found
4. ❌ Frontend broken
5. ❌ Latency unacceptable (>60s)
6. ❌ Cost increase >50%

**Next Step**: Rollback, fix issues, retry

---

## Appendix A: Quick Reference Commands

### Enable Feature Flag
```powershell
aws lambda update-function-configuration `
  --function-name fakenewsoff-backend-AnalyzeFunction-XXXXX `
  --region us-east-1 `
  --environment "Variables={GROUNDING_ENABLED=true,GROUNDING_PROVIDER_ORDER=bing,gdelt,ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED=true}"
```

### Disable Feature Flag
```powershell
aws lambda update-function-configuration `
  --function-name fakenewsoff-backend-AnalyzeFunction-XXXXX `
  --region us-east-1 `
  --environment "Variables={GROUNDING_ENABLED=true,GROUNDING_PROVIDER_ORDER=bing,gdelt,ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED=false}"
```

### Check Feature Status
```powershell
curl -X POST https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/analyze `
  -H "Content-Type: application/json" `
  -d '{"text": "test"}' | jq '.orchestration.enabled'
```

### Monitor Logs
```powershell
aws logs tail /aws/lambda/fakenewsoff-backend-AnalyzeFunction-XXXXX --follow
```

### Get Lambda Function Name
```powershell
aws lambda list-functions `
  --region us-east-1 `
  --query "Functions[?starts_with(FunctionName, 'fakenewsoff-backend-AnalyzeFunction')].FunctionName" `
  --output text
```

---

## Appendix B: Troubleshooting

### Issue: Feature flag not taking effect

**Symptoms**: Response still shows `orchestration: null` after enabling flag.

**Solution**:
1. Verify Lambda environment variable is set correctly
2. Wait 30 seconds for Lambda to pick up new config
3. Try a fresh request (not cached)
4. Check CloudWatch logs for errors

### Issue: High error rate

**Symptoms**: Many 500 errors or fallback events.

**Solution**:
1. Check CloudWatch logs for error details
2. Verify NOVA API (Bedrock) is accessible
3. Verify grounding APIs (Bing, GDELT) are accessible
4. Check for rate limiting issues
5. Consider rollback if error rate >10%

### Issue: High latency

**Symptoms**: Requests taking >30s.

**Solution**:
1. Check orchestration pass count (should be 1-3)
2. Verify NOVA response times
3. Verify grounding API response times
4. Consider adjusting config (reduce max passes)
5. Monitor for improvement over time

### Issue: Frontend not displaying results

**Symptoms**: Frontend shows errors or blank results.

**Solution**:
1. Check browser console for errors
2. Verify API response schema matches expected format
3. Verify all legacy fields present in response
4. Check CORS headers
5. Test with curl to isolate frontend vs backend issue

---

## Appendix C: Contact Information

**For Issues During Rollout**:
- Engineering Lead: [Your Name]
- On-Call Engineer: [On-Call Contact]
- Slack Channel: #fakenewsoff-alerts

**Escalation Path**:
1. Check this document for troubleshooting
2. Check CloudWatch logs
3. Contact on-call engineer
4. Consider rollback if critical

---

## Sign-Off

**Prepared By**: Engineering Team  
**Date**: 2026-03-10  
**Approved By**: [Pending]  
**Rollout Date**: [Pending]

---

**END OF CONTROLLED ENABLEMENT PLAN**
