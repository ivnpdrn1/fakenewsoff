# Full Production Path Integration Test - Ready

## Status: ✅ READY TO RUN

The full production path integration test has been created and is ready to validate the verification logic fix with **LIVE Serper retrieval** and **REAL Bedrock/NOVA reasoning**.

---

## What Was Created

### 1. Test Script: `backend/test-full-production-path.ts`

A comprehensive end-to-end integration test that exercises the complete production pipeline:

**Test Flow:**
1. **Environment Verification** - Checks for required AWS and Serper credentials
2. **Claim Input** - Tests with: "Russia invaded Ukraine in February 2022"
3. **Query Generation** - Generates search queries from the claim
4. **LIVE Serper Retrieval** - Makes real API calls to Serper (NOT simulated)
5. **Evidence Normalization** - Normalizes retrieved sources
6. **Stance Classification** - Classifies evidence stance using enhanced classifier
7. **Credibility Scoring** - Assigns credibility tiers to sources
8. **REAL Bedrock/NOVA Reasoning** - Invokes AWS Bedrock for verdict synthesis
9. **Verdict Synthesis** - Generates final verdict with confidence
10. **Validation Checks** - Validates all expected behaviors

**Validation Criteria:**
- ✓ A. Live retrieval returned at least 2 usable sources
- ✓ B. Supporting evidence count > 0
- ✓ C. At least one trusted domain present
- ✓ D. Bedrock invocation succeeded
- ✓ E. Final verdict is not low-confidence unverified
- ✓ F. Classification should be supported/true with confidence >= 0.75

### 2. Helper Script: `backend/run-full-production-path-test.ps1`

Interactive PowerShell script that:
- Checks for required environment variables
- Prompts for missing credentials (with secure input for secrets)
- Displays current configuration
- Confirms before running (warns about API costs)
- Runs the test with proper error handling
- Shows clear PASS/FAIL status

---

## Required Environment Variables

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-aws-access-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret-key>
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
SERPER_API_KEY=<your-serper-api-key>
```

---

## How to Run

### Option 1: Using the Helper Script (Recommended)

```powershell
cd backend
.\run-full-production-path-test.ps1
```

The script will:
1. Check for required environment variables
2. Prompt for any missing credentials
3. Display current configuration
4. Ask for confirmation before running
5. Execute the test
6. Show clear PASS/FAIL status

### Option 2: Direct Execution

```bash
cd backend
npx tsx test-full-production-path.ts
```

**Note:** Ensure all environment variables are set before running directly.

---

## Expected Results

### ✅ Success Scenario

```
STEP 4: Live Serper Retrieval Results
  Total sources retrieved: 6
  Provider used: serper
  Retrieval mode: production
  Retrieval status: complete

STEP 6: Stance Classification Results
  Supporting: 3
  Contradicting: 0
  Context: 3

STEP 7: Credibility Scoring Results
  Tier 1 (highest credibility): 3
  Tier 2 (medium credibility): 0
  Tier 3 (default credibility): 3

STEP 9: Verdict Synthesis
  Classification: true
  Confidence: 90.0%
  Rationale: Multiple credible sources (reuters.com, bbc.com, apnews.com) confirm...

STEP 10: Validation Checks
  ✓ A. Live retrieval returned at least 2 usable sources
  ✓ B. Supporting evidence count > 0
  ✓ C. At least one trusted domain present
  ✓ D. Bedrock invocation succeeded
  ✓ E. Final verdict is not low-confidence unverified
  ✓ F. Classification should be supported/true with confidence >= 0.75

✓ ALL VALIDATION CHECKS PASSED
```

### Expected Verdict

- **Classification:** `true` or `supported`
- **Confidence:** 85-95% (based on 3+ tier-1 sources)
- **Supporting Sources:** Reuters, BBC, AP News (or similar tier-1 domains)
- **Stance:** All supporting sources should have `stance="supports"`
- **Credibility:** All supporting sources should be tier-1

---

## What This Test Validates

### 1. Live Serper Integration ✅
- Real API calls to Serper (not simulated)
- Actual news article retrieval
- Real-world data quality

### 2. Enhanced Stance Classification ✅
- Semantic date equivalence detection
- "February 2022" matches "February 24, 2022"
- Factual statement recognition without explicit support keywords

### 3. Credibility Scoring ✅
- Tier-1 domain recognition (reuters.com, bbc.com, apnews.com)
- Proper tier assignment
- Domain diversity

### 4. Real Bedrock/NOVA Reasoning ✅
- Actual AWS Bedrock invocation
- NOVA Lite model reasoning
- Confidence calculation based on source count and credibility

### 5. End-to-End Pipeline ✅
- Complete production path
- No simulated evidence
- No bypassed stages
- Real external service calls

---

## Troubleshooting

### Issue: Missing Environment Variables

**Solution:** Run the helper script, which will prompt for missing credentials:
```powershell
.\run-full-production-path-test.ps1
```

### Issue: Serper API Rate Limit

**Error:** `Serper: Rate limit exceeded`

**Solution:** Wait a few minutes and try again. Serper has rate limits on free tier.

### Issue: AWS Credentials Invalid

**Error:** `Bedrock invocation failed: Unauthorized`

**Solution:** Verify your AWS credentials:
```bash
aws sts get-caller-identity
```

### Issue: Low Confidence Result

**Symptom:** Confidence < 0.75 despite supporting evidence

**Possible Causes:**
1. Serper returned low-quality sources (not tier-1 domains)
2. Stance classifier didn't recognize semantic equivalence
3. NOVA reasoning didn't follow confidence guidelines

**Debug:** Check the detailed output for:
- Source domains (should include reuters.com, bbc.com, apnews.com)
- Stance classifications (should be "supports" not "mentions")
- Tier assignments (should be tier-1)

---

## Cost Considerations

### Serper API
- **Free Tier:** 2,500 searches/month
- **Cost per Test:** 1 search (negligible)

### AWS Bedrock
- **NOVA Lite:** ~$0.00006 per 1K input tokens, ~$0.00024 per 1K output tokens
- **Cost per Test:** ~$0.001-0.002 (less than 1 cent)

**Total Cost per Test Run:** < $0.01

---

## Next Steps

1. **Run the test** using the helper script
2. **Verify all validation checks pass**
3. **Review the detailed output** to confirm:
   - Live Serper retrieval succeeded
   - Stance classification correctly identified supporting evidence
   - Credibility scoring assigned tier-1 to trusted domains
   - Bedrock/NOVA generated high-confidence verdict
4. **Document the results** for the fix validation report

---

## Files Created

- `backend/test-full-production-path.ts` - Main test script
- `backend/run-full-production-path-test.ps1` - Interactive helper script
- `FULL_PRODUCTION_PATH_TEST_READY.md` - This documentation

---

## Related Files

- `backend/src/orchestration/iterativeOrchestrationPipeline.ts` - Main pipeline
- `backend/src/services/stanceClassifier.ts` - Enhanced stance classifier
- `backend/src/services/sourceNormalizer.ts` - Credibility scoring
- `backend/src/services/novaClient.ts` - Bedrock/NOVA client
- `backend/src/clients/serperClient.ts` - Serper API client

---

**Status:** Ready to run ✅  
**Last Updated:** 2026-03-14
