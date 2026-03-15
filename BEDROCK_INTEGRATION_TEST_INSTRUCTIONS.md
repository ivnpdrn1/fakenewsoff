# Bedrock Integration Test - Quick Start Instructions

## What This Test Does

This test validates the verification logic fix end-to-end with **REAL AWS Bedrock/NOVA invocation**:

1. ✅ Stance classification (semantic date equivalence)
2. ✅ Credibility scoring (tier-1 domain recognition)
3. ✅ **REAL Bedrock/NOVA reasoning** (verdict synthesis)
4. ✅ Result validation

## Quick Start

### Step 1: Navigate to Backend Directory

```powershell
cd backend
```

### Step 2: Run the Test Script

```powershell
.\run-bedrock-integration-test.ps1
```

The script will:
- Check if AWS credentials are set
- Prompt for credentials if needed (temporary for session)
- Run the integration test
- Display results and validation

### Step 3: Enter AWS Credentials When Prompted

If credentials are not set, the script will prompt:

```
Options:
  1. Enter credentials now (temporary for this session)
  2. Set credentials in environment and re-run
  3. Cancel

Choose option (1-3):
```

Choose option 1 and enter:
- AWS Region (e.g., `us-east-1`)
- AWS Access Key ID
- AWS Secret Access Key

### Step 4: Review Results

The test will output:
- Stance classification results (should show 3 "supports")
- Credibility tier assignments (should show tier-1 for Reuters/BBC/AP)
- **Bedrock invocation status** (should show "✅ SUCCEEDED")
- Final verdict (should show "true" with 85-95% confidence)
- Validation results (should show all ✅ PASS)

## Expected Results

### ✅ Success Criteria

```
✅ PASS: Stance classification - supporting evidence found
✅ PASS: Trusted domains - 3 sources from tier-1 domains
✅ PASS: Verdict classification - "true" (expected)
✅ PASS: Confidence score - 90% (>= 75%)

✅ ALL VALIDATIONS PASSED
```

### ❌ Failure Indicators

If you see:
- "❌ FAIL: Stance classification" → Stance classifier not working
- "❌ FAIL: Trusted domains" → Credibility scoring not working
- "❌ FAIL: Confidence score" → Verdict synthesis prompt not working
- "❌ Bedrock invocation FAILED" → AWS credentials or permissions issue

## Troubleshooting

### No AWS Credentials

**Error**: "Missing required environment variables"

**Solution**: Run the script and choose option 1 to enter credentials

### Bedrock Access Denied

**Error**: "AccessDeniedException"

**Solution**: 
1. Go to AWS Console → Bedrock → Model access
2. Request access to `amazon.nova-lite-v1:0`
3. Wait for approval (usually instant)

### Invalid Credentials

**Error**: "Nova invocation failed: Unknown error"

**Solution**: Verify your AWS credentials are correct

## Alternative: Manual Test

If you prefer to set credentials manually:

```powershell
# Set credentials
$env:AWS_REGION="us-east-1"
$env:AWS_ACCESS_KEY_ID="your_key"
$env:AWS_SECRET_ACCESS_KEY="your_secret"

# Run test
npx ts-node test-bedrock-integration.ts
```

## What Happens Next

After successful validation:
1. The fix is confirmed working with real Bedrock/NOVA
2. Results should be documented in the final report
3. The fix is ready for production deployment

## Need Help?

See `backend/BEDROCK_INTEGRATION_TEST_GUIDE.md` for detailed troubleshooting and setup instructions.
