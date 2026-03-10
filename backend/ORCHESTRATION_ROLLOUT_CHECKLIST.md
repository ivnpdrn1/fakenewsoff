# Orchestration Rollout Checklist

**Quick reference for controlled enablement of iterative evidence orchestration pipeline**

---

## Pre-Deployment Checklist

- [ ] All 297 tests passing locally (`npm test`)
- [ ] Code pushed to GitHub
- [ ] Team notified of planned rollout
- [ ] Rollback procedure reviewed
- [ ] Current Lambda config backed up

**Command to backup config**:
```powershell
aws lambda get-function-configuration `
  --function-name fakenewsoff-backend-AnalyzeFunction-XXXXX `
  --region us-east-1 > lambda-config-backup.json
```

---

## Deployment Steps

### 1. Deploy Backend

```powershell
cd backend
npm test -- --runInBand  # Verify tests pass
sam build                 # Build Lambda package
sam deploy                # Deploy to AWS
```

**Expected**: `Successfully created/updated stack - fakenewsoff-backend`

### 2. Verify Deployment

```powershell
# Check stack status
aws cloudformation describe-stacks `
  --stack-name fakenewsoff-backend `
  --region us-east-1 `
  --query 'Stacks[0].StackStatus'

# Expected: UPDATE_COMPLETE
```

### 3. Test Legacy Pipeline (Pre-Enable)

```powershell
curl -X POST https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/analyze `
  -H "Content-Type: application/json" `
  -d '{"text": "Test"}' | jq '.orchestration'

# Expected: null (orchestration not enabled yet)
```

---

## Enable Feature Flag

### Get Lambda Function Name

```powershell
$FUNCTION_NAME = aws lambda list-functions `
  --region us-east-1 `
  --query "Functions[?starts_with(FunctionName, 'fakenewsoff-backend-AnalyzeFunction')].FunctionName" `
  --output text

echo $FUNCTION_NAME
```

### Enable Orchestration

```powershell
aws lambda update-function-configuration `
  --function-name $FUNCTION_NAME `
  --region us-east-1 `
  --environment "Variables={GROUNDING_ENABLED=true,GROUNDING_PROVIDER_ORDER=bing,gdelt,ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED=true}"

# Wait for update to complete
aws lambda wait function-updated `
  --function-name $FUNCTION_NAME `
  --region us-east-1
```

### Verify Feature Flag

```powershell
aws lambda get-function-configuration `
  --function-name $FUNCTION_NAME `
  --region us-east-1 `
  --query 'Environment.Variables.ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED'

# Expected: "true"
```

---

## Post-Enable Verification

### Quick Smoke Test

```powershell
# Run automated smoke tests
cd backend/scripts
./smoke-orchestration.ps1  # Windows
# OR
./smoke-orchestration.sh   # Linux/Mac

# Expected: All tests pass
```

### Manual Verification

```powershell
# Test orchestration is active
curl -X POST https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/analyze `
  -H "Content-Type: application/json" `
  -d '{"text": "The Eiffel Tower is in Paris"}' | jq '.orchestration'

# Expected: {"enabled": true, "passes_executed": 1-3, ...}
```

---

## Monitoring (First Hour)

### Watch CloudWatch Logs

```powershell
aws logs tail /aws/lambda/$FUNCTION_NAME --follow --region us-east-1
```

**Look for**:
- ✅ `"stage":"orchestration"` - Pipeline executing
- ✅ `"stage":"synthesis"` - Verdicts being generated
- ⚠️ `"Error in iterative orchestration"` - Fallback events (should be <10%)
- ❌ `ERROR` - Critical errors (should be 0)

### Check Metrics

```powershell
# Get error count
aws cloudwatch get-metric-statistics `
  --namespace AWS/Lambda `
  --metric-name Errors `
  --dimensions Name=FunctionName,Value=$FUNCTION_NAME `
  --start-time (Get-Date).AddHours(-1).ToUniversalTime() `
  --end-time (Get-Date).ToUniversalTime() `
  --period 300 `
  --statistics Sum `
  --region us-east-1

# Expected: Sum = 0 or very low
```

---

## Go/No-Go Decision Points

### ✅ GO Criteria (Continue)

- [ ] All smoke tests passing
- [ ] Orchestration metadata present in responses
- [ ] Error rate <5%
- [ ] Fallback rate <10%
- [ ] Latency <30s (p95)
- [ ] No 500 errors
- [ ] Frontend displays correctly
- [ ] No critical bugs

### ❌ NO-GO Criteria (Rollback)

- [ ] Error rate >10%
- [ ] Any 500 errors
- [ ] Frontend broken
- [ ] Latency >60s
- [ ] Fallback rate >25%
- [ ] Critical bugs found

---

## Emergency Rollback

**If NO-GO criteria met, execute immediately:**

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

# Verify rollback
curl -X POST https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/analyze `
  -H "Content-Type: application/json" `
  -d '{"text": "Test"}' | jq '.orchestration'

# Expected: null (orchestration disabled)
```

**Rollback time**: <2 minutes

---

## 24-Hour Review Checklist

**After 24 hours of operation:**

- [ ] Orchestration success rate >95%
- [ ] Error rate <5%
- [ ] Fallback rate <10%
- [ ] Latency p95 <30s
- [ ] No user complaints
- [ ] Source quality improved or equal
- [ ] Cost within budget (+20% acceptable)
- [ ] No security incidents

**If all checked**: Proceed to next rollout phase  
**If any unchecked**: Investigate and consider rollback

---

## Quick Reference Commands

### Check Feature Status
```powershell
curl -X POST https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/analyze `
  -H "Content-Type: application/json" `
  -d '{"text": "test"}' | jq '.orchestration.enabled'
```

### Enable Feature
```powershell
aws lambda update-function-configuration `
  --function-name $FUNCTION_NAME `
  --environment "Variables={...,ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED=true}"
```

### Disable Feature
```powershell
aws lambda update-function-configuration `
  --function-name $FUNCTION_NAME `
  --environment "Variables={...,ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED=false}"
```

### Monitor Logs
```powershell
aws logs tail /aws/lambda/$FUNCTION_NAME --follow
```

### Filter Errors
```powershell
aws logs filter-log-events `
  --log-group-name /aws/lambda/$FUNCTION_NAME `
  --filter-pattern "ERROR"
```

---

## Contact Information

**For Issues**:
- Engineering Lead: [Your Name]
- On-Call: [On-Call Contact]
- Slack: #fakenewsoff-alerts

**Escalation**:
1. Check this checklist
2. Check CloudWatch logs
3. Contact on-call
4. Consider rollback if critical

---

## Sign-Off

- [ ] Pre-deployment checklist complete
- [ ] Deployment successful
- [ ] Feature flag enabled
- [ ] Post-enable verification complete
- [ ] Monitoring active
- [ ] Team notified

**Deployed By**: _______________  
**Date**: _______________  
**Time**: _______________

---

**END OF CHECKLIST**
