# Bedrock Integration Test - Ready to Run

## Status: ✅ Test Infrastructure Complete

The end-to-end Bedrock integration test is ready to run. All necessary files have been created.

## What Was Created

### 1. Integration Test Script
**File**: `backend/test-bedrock-integration.ts`

A comprehensive end-to-end test that:
- Simulates evidence retrieval with realistic sources (Reuters, BBC, AP News)
- Runs stance classification with the semantic date equivalence fix
- Performs credibility tier assignment
- **Invokes REAL AWS Bedrock/NOVA** for verdict synthesis
- Validates all results against expected criteria

### 2. PowerShell Helper Script
**File**: `backend/run-bedrock-integration-test.ps1`

An interactive script that:
- Checks for AWS credentials
- Prompts for credentials if not set (temporary for session)
- Runs the integration test
- Displays formatted results

### 3. Detailed Guide
**File**: `backend/BEDROCK_INTEGRATION_TEST_GUIDE.md`

Complete documentation including:
- Prerequisites and AWS account requirements
- Multiple ways to run the test
- Expected output examples
- Troubleshooting guide
- Validation criteria

### 4. Quick Start Instructions
**File**: `BEDROCK_INTEGRATION_TEST_INSTRUCTIONS.md`

Quick reference for running the test with minimal setup.

## How to Run

### Simplest Method

```powershell
cd backend
.\run-bedrock-integration-test.ps1
```

The script will guide you through:
1. Checking credentials
2. Prompting for credentials if needed
3. Running the test
4. Displaying results

### What You Need

**Required**:
- AWS Region (e.g., `us-east-1`)
- AWS Access Key ID
- AWS Secret Access Key
- Bedrock model access enabled in your AWS account

**Optional**:
- BEDROCK_MODEL_ID (defaults to `amazon.nova-lite-v1:0`)

## Expected Results

### Test Claim
"Russia invaded Ukraine in February 2022"

### Expected Evidence
- 3 sources: Reuters, BBC, AP News
- All with snippets containing "February 24, 2022"

### Expected Stance Classification
```
reuters.com: stance=supports, confidence=0.75, tier=1
bbc.com: stance=supports, confidence=0.75, tier=1
apnews.com: stance=supports, confidence=0.75, tier=1
```

### Expected Verdict (from Bedrock/NOVA)
```
Classification: true
Confidence: 0.85-0.95 (85-95%)
Rationale: Multiple credible sources support the claim
```

### Expected Validation
```
✅ PASS: Stance classification - supporting evidence found
✅ PASS: Trusted domains - 3 sources from tier-1 domains
✅ PASS: Verdict classification - "true" (expected)
✅ PASS: Confidence score - 90% (>= 75%)
```

## What This Validates

### 1. Stance Classifier Fix ✅
- Semantic date equivalence working
- "February 24, 2022" correctly supports "in February 2022"
- Abbreviated months handled correctly

### 2. Credibility Scoring ✅
- Trusted domains correctly assigned to tier-1
- Reuters, BBC, AP News = tier 1

### 3. Bedrock/NOVA Integration ✅
- Real API call to AWS Bedrock
- NOVA model invoked successfully
- Verdict synthesis with improved prompt

### 4. End-to-End Pipeline ✅
- Complete flow from evidence to verdict
- All components working together
- High confidence verdict for well-supported claims

## Next Steps

1. **Run the test** using the PowerShell script
2. **Verify all validations pass** (4/4 ✅)
3. **Document results** in the final report
4. **Confirm fix is complete** and ready for production

## Troubleshooting

### Common Issues

**"Missing required environment variables"**
→ Run the script and choose option 1 to enter credentials

**"AccessDeniedException"**
→ Enable Bedrock model access in AWS Console

**"Nova invocation failed"**
→ Verify credentials and region are correct

See `backend/BEDROCK_INTEGRATION_TEST_GUIDE.md` for detailed troubleshooting.

## Files Summary

```
backend/
├── test-bedrock-integration.ts              # Main test script
├── run-bedrock-integration-test.ps1         # Helper script
├── BEDROCK_INTEGRATION_TEST_GUIDE.md        # Detailed guide
└── test-stance-classifier.ts                # Unit test (already passing)

BEDROCK_INTEGRATION_TEST_INSTRUCTIONS.md     # Quick start
BEDROCK_INTEGRATION_TEST_READY.md            # This file
```

## Ready to Proceed

The test infrastructure is complete and ready to run. Please execute the test to validate the verification logic fix with real Bedrock/NOVA invocation.

**Command to run**:
```powershell
cd backend
.\run-bedrock-integration-test.ps1
```

The test will confirm that the stance classifier fix works correctly with the real LLM reasoning path, not just unit tests.
