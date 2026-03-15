# Cloud Validation Guide - Full Production Path Test

## Overview

This guide helps you run the full production path integration test in a cloud environment with working Serper connectivity.

## Prerequisites

Required environment variables:
- `AWS_REGION` (e.g., us-east-1)
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `BEDROCK_MODEL_ID` (optional, defaults to amazon.nova-lite-v1:0)
- `SERPER_API_KEY`

## Option 1: AWS Lambda (Recommended)

### Step 1: Package the test
```bash
cd backend
npm install
```

### Step 2: Create a Lambda function
1. Go to AWS Lambda Console
2. Create new function: "fakenewsoff-production-test"
3. Runtime: Node.js 18.x or later
4. Architecture: x86_64

### Step 3: Set environment variables
In Lambda configuration, add:
- AWS_REGION
- BEDROCK_MODEL_ID
- SERPER_API_KEY

### Step 4: Upload code
```bash
# Create deployment package
zip -r function.zip . -x "*.git*" "node_modules/@aws-sdk/*"
```

### Step 5: Invoke
```bash
aws lambda invoke \
  --function-name fakenewsoff-production-test \
  --payload '{}' \
  response.json
```

## Option 2: AWS EC2 / Cloud VM

### Step 1: Launch EC2 instance
```bash
# Amazon Linux 2 or Ubuntu
# t3.small or larger
# Ensure outbound HTTPS is allowed
```

### Step 2: Install Node.js
```bash
# Amazon Linux 2
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# Ubuntu
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 3: Clone and setup
```bash
git clone <your-repo>
cd fakenewsoff/backend
npm install
```

### Step 4: Set environment variables
```bash
export AWS_REGION="us-east-1"
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
export BEDROCK_MODEL_ID="amazon.nova-lite-v1:0"
export SERPER_API_KEY="your-serper-key"
```

### Step 5: Run test
```bash
npx tsx test-full-production-path.ts
```

## Option 3: GitHub Actions / CI

### Create .github/workflows/production-test.yml
```yaml
name: Production Path Test

on:
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd backend
          npm install
      - name: Run production test
        env:
          AWS_REGION: ${{ secrets.AWS_REGION }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          BEDROCK_MODEL_ID: ${{ secrets.BEDROCK_MODEL_ID }}
          SERPER_API_KEY: ${{ secrets.SERPER_API_KEY }}
        run: |
          cd backend
          npx tsx test-full-production-path.ts
```

## Expected Output

When successful, you should see:

```
================================================================================
FULL PRODUCTION PATH INTEGRATION TEST
================================================================================

STEP 1: Environment Verification
  AWS_REGION: ✅ SET
  AWS_ACCESS_KEY_ID: ✅ SET
  AWS_SECRET_ACCESS_KEY: ✅ SET
  SERPER_API_KEY: ✅ SET

STEP 2: Claim Input
  Claim: "Russia invaded Ukraine in February 2022"

STEP 3: Query Generation
  Generated 3 search queries

STEP 4: Live Serper Retrieval
  ✅ Retrieved 10+ results
  Top domains: reuters.com, bbc.com, apnews.com, ...

STEP 5: Evidence Normalization
  Normalizing 10 evidence sources

STEP 6: Stance Classification
  Supporting: 3+
  Contradicting: 0
  Mentions: 7
  Unclear: 0

STEP 7: Credibility Scoring
  Trusted domains found: 3+

STEP 8: Real Bedrock/NOVA Reasoning
  ✅ Bedrock invocation SUCCEEDED

STEP 9: Validation Checks
  ✅ PASS: A. Live retrieval returned at least 2 usable sources
  ✅ PASS: B. Supporting evidence count > 0
  ✅ PASS: C. At least one trusted domain present
  ✅ PASS: D. Bedrock invocation succeeded
  ✅ PASS: E. Final verdict is not low-confidence unverified
  ✅ PASS: F. Target expected behavior (true/partially_true + confidence >= 0.75)

STEP 10: Final Summary
  Total sources retrieved: 10+
  Supporting: 3+
  Contradicting: 0
  Context: 7
  Trusted domains found: 3+

Final Bedrock Verdict:
  Classification: true
  Confidence: 85-95%
  Rationale: Multiple credible sources confirm...

================================================================================
✅ ALL VALIDATIONS PASSED
================================================================================

The verification logic fix is working correctly in the full production path.
```

## Validation Criteria

The test passes if:
1. ✅ Live Serper retrieval returns 2+ sources
2. ✅ Supporting evidence count > 0
3. ✅ At least one trusted domain (tier-1 or tier-2)
4. ✅ Bedrock invocation succeeds
5. ✅ Final verdict is not low-confidence unverified
6. ✅ Classification is "true" or "partially_true" with confidence >= 75%

## Troubleshooting

### Serper API fails
- Check API key is valid
- Check API quota/rate limits
- Verify outbound HTTPS (port 443) is allowed

### Bedrock fails
- Check AWS credentials are valid
- Check region supports Bedrock
- Check IAM permissions for bedrock:InvokeModel

### Test times out
- Increase Lambda timeout to 5 minutes
- Check network latency
- Verify all services are reachable

## Next Steps

After successful validation:
1. Capture full output
2. Document results in PRODUCTION_VALIDATION_COMPLETE.md
3. Confirm verification logic fix is working end-to-end

