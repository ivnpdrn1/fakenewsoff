# Bedrock Integration Test Guide

This guide explains how to run the end-to-end Bedrock integration test to validate the verification logic fix.

## Overview

The integration test validates the complete pipeline:
1. Evidence retrieval (simulated with realistic sources)
2. Stance classification (semantic date equivalence)
3. Credibility scoring (tier-1 domain recognition)
4. **REAL Bedrock/NOVA invocation** (verdict synthesis)
5. Result validation

## Prerequisites

### Required AWS Credentials

You need the following AWS credentials:
- `AWS_REGION` (e.g., `us-east-1`)
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### AWS Account Requirements

1. **Bedrock Access**: Your AWS account must have access to Amazon Bedrock
2. **Model Access**: The Nova Lite model must be enabled in your account
   - Go to AWS Console → Bedrock → Model access
   - Request access to `amazon.nova-lite-v1:0` if not already enabled
3. **IAM Permissions**: Your credentials must have `bedrock:InvokeModel` permission

### Optional Environment Variables

- `BEDROCK_MODEL_ID` (default: `amazon.nova-lite-v1:0`)
- `SERPER_API_KEY` (not required for this test - evidence is simulated)

## Running the Test

### Option 1: Using PowerShell Script (Recommended)

The PowerShell script will guide you through setting up credentials:

```powershell
cd backend
.\run-bedrock-integration-test.ps1
```

The script will:
1. Check if credentials are already set
2. Prompt for credentials if needed (temporary for session)
3. Run the integration test
4. Display results and validation

### Option 2: Manual Setup

Set environment variables manually:

```powershell
# Set AWS credentials
$env:AWS_REGION="us-east-1"
$env:AWS_ACCESS_KEY_ID="your_access_key_here"
$env:AWS_SECRET_ACCESS_KEY="your_secret_key_here"
$env:BEDROCK_MODEL_ID="amazon.nova-lite-v1:0"

# Run the test
cd backend
npx ts-node test-bedrock-integration.ts
```

### Option 3: Using .env File

Create a `.env` file in the `backend` directory:

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
```

Then load it before running:

```powershell
# Load .env file (requires dotenv or similar)
# Or manually set variables from .env
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
    }
}

# Run the test
npx ts-node test-bedrock-integration.ts
```

## Expected Output

### Successful Test Output

```
================================================================================
BEDROCK INTEGRATION TEST - Russia-Ukraine Claim
================================================================================

Claim: "Russia invaded Ukraine in February 2022"

Step 1: Claim Decomposition
--------------------------------------------------------------------------------
Subclaims: 4
  1. [actor] Russia (importance: 1)
  2. [action] invaded (importance: 1)
  3. [object] Ukraine (importance: 1)
  4. [time] in February 2022 (importance: 0.9)

Step 2: Evidence Retrieval (Simulated)
--------------------------------------------------------------------------------
Retrieved 3 evidence sources:
  1. reuters.com - "Russia invades Ukraine"
  2. bbc.com - "Russia attacks Ukraine"
  3. apnews.com - "Russia launches invasion of Ukraine"

Step 3: Stance Classification
--------------------------------------------------------------------------------
reuters.com:
  Stance: supports
  Confidence: 0.75
  Credibility Tier: 1
  Justification: Source provides factual evidence supporting the claim

bbc.com:
  Stance: supports
  Confidence: 0.75
  Credibility Tier: 1
  Justification: Source provides factual evidence supporting the claim

apnews.com:
  Stance: supports
  Confidence: 0.75
  Credibility Tier: 1
  Justification: Source provides factual evidence supporting the claim

Supporting evidence count: 3

Step 4: Evidence Buckets
--------------------------------------------------------------------------------
Supporting: 3
Contradicting: 0
Context: 0
Rejected: 0

Step 5: Verdict Synthesis (REAL BEDROCK INVOCATION)
--------------------------------------------------------------------------------
Invoking AWS Bedrock with NOVA model...
✅ Bedrock invocation SUCCEEDED

================================================================================
RESULTS
================================================================================

Verdict:
  Classification: true
  Confidence: 0.90 (90%)
  Rationale: Multiple credible sources (Reuters, BBC, AP News) support the claim

Subclaims:
  Supported: 4
    1. Russia
    2. invaded
    3. Ukraine
    4. in February 2022
  Unsupported: 0

Evidence:
  Best evidence count: 3
    1. reuters.com - Russia invades Ukraine
    2. bbc.com - Russia attacks Ukraine
    3. apnews.com - Russia launches invasion of Ukraine

Performance:
  Duration: 2500ms

================================================================================
VALIDATION
================================================================================

✅ PASS: Stance classification - supporting evidence found
✅ PASS: Trusted domains - 3 sources from tier-1 domains
✅ PASS: Verdict classification - "true" (expected)
✅ PASS: Confidence score - 90% (>= 75%)

================================================================================
✅ ALL VALIDATIONS PASSED
================================================================================

The verification logic fix is working correctly with real Bedrock/NOVA.
```

## Validation Criteria

The test validates the following:

1. **Stance Classification**: At least one source classified as "supports"
   - ✅ Expected: 3 sources with stance="supports"
   
2. **Trusted Domains**: At least one tier-1 domain source
   - ✅ Expected: Reuters, BBC, AP News (all tier-1)
   
3. **Verdict Classification**: Classification should be "true"
   - ✅ Expected: "true" (well-supported claim)
   
4. **Confidence Score**: Confidence should be >= 75%
   - ✅ Expected: 85-95% (3 tier-1 sources, no contradictions)

## Troubleshooting

### Error: "Missing required environment variables"

**Solution**: Set AWS credentials as described in the "Running the Test" section.

### Error: "Nova invocation failed: Unknown error"

**Possible causes**:
1. Invalid AWS credentials
2. Bedrock not available in your region
3. Model access not enabled

**Solution**:
1. Verify credentials are correct
2. Use a Bedrock-supported region (us-east-1, us-west-2)
3. Enable model access in AWS Console → Bedrock → Model access

### Error: "AccessDeniedException"

**Cause**: IAM user/role lacks Bedrock permissions

**Solution**: Add the following IAM policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "arn:aws:bedrock:*::foundation-model/amazon.nova-lite-v1:0"
    }
  ]
}
```

### Error: "ThrottlingException"

**Cause**: Too many requests to Bedrock

**Solution**: Wait a few seconds and retry

### Unexpected Verdict Classification

If the verdict is not "true" but confidence is still high:
- This may be acceptable depending on LLM reasoning
- Check the rationale field for explanation
- The stance classification fix is still working if stance="supports"

### Low Confidence Score

If confidence is < 75%:
- Check if stance classification returned "supports" (should be 3/3)
- Check if credibility tiers are correct (should be tier-1)
- Review the LLM's rationale for explanation
- This indicates the prompt improvements may need adjustment

## Next Steps

After successful validation:

1. **Document Results**: Save the test output for reference
2. **Update Summary**: Add results to `VERIFICATION_LOGIC_FIX_SUMMARY.md`
3. **Deploy to Production**: The fix is validated and ready for deployment
4. **Monitor Production**: Track stance classification and confidence scores

## Files

- `test-bedrock-integration.ts` - Integration test script
- `run-bedrock-integration-test.ps1` - PowerShell helper script
- `BEDROCK_INTEGRATION_TEST_GUIDE.md` - This guide

## Support

If you encounter issues not covered in this guide:
1. Check AWS CloudWatch logs for detailed error messages
2. Verify Bedrock service status in AWS Health Dashboard
3. Review AWS Bedrock documentation for model-specific requirements
