# FakeNewsOff Production Operation Audit

**Date**: 2026-03-11  
**Goal**: Convert from demo-first to production-first operation

---

## ROOT CAUSE ANALYSIS

### Why the app behaves like a demo:

1. **Frontend Demo Mode Default** ✅ JUST FIXED
   - `DemoModeContext.tsx` was defaulting to `false` when localStorage empty
   - Changed to default to `true` 
   - **NEEDS REVERT**: Must default to `false` for production

2. **Backend Fallback to Demo Responses**
   - `lambda.ts` line 235-250: Falls back to `getDemoResponseForContent()` when orchestration fails
   - This means ANY orchestration error = demo response
   - **FIX NEEDED**: Remove demo fallback, return honest error

3. **Missing AWS Credentials in Lambda**
   - Lambda env vars: Only `GROUNDING_ENABLED`, `GROUNDING_PROVIDER_ORDER`, `ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED`
   - Missing: `BING_NEWS_KEY`, `BEDROCK_MODEL_ID`, `AWS_REGION`, all Bedrock credentials
   - **FIX NEEDED**: Add credentials to Lambda via template.yaml or parameter store

4. **Orchestration Returns Unverified Without Evidence**
   - When grounding returns 0 sources, orchestration still synthesizes a verdict
   - Verdict is always "Unverified" with 30% confidence
   - **CURRENT BEHAVIOR**: Honest but not useful
   - **FIX NEEDED**: Return clear operational message when evidence retrieval fails

5. **No Error Transparency**
   - When grounding fails (no API keys, timeout, provider error), user sees generic "Unverified"
   - **FIX NEEDED**: Add reason codes and user-friendly error messages

---

## CURRENT CONTROL FLOW

### User submits claim with demo_mode=false:

1. Frontend sends `{ text, demo_mode: false }` to `/analyze`
2. Backend checks `request.demo_mode` → false
3. Backend checks `ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED` → true
4. Backend calls `analyzeWithIterativeOrchestration(text)`
5. Orchestration calls `groundTextOnly(text, requestId, false)`
6. Grounding service tries Bing (no API key) → fails
7. Grounding service tries GDELT → may succeed or fail
8. If 0 sources: orchestration synthesizes "Unverified" verdict
9. Backend returns 200 with "Unverified" status
10. User sees "Unverified" with no explanation

### User submits claim with demo_mode=true:

1. Frontend sends `{ text, demo_mode: true }` to `/analyze`
2. Backend checks `request.demo_mode` → true
3. Backend calls `getDemoResponseForContent(text)`
4. Returns keyword-matched synthetic response
5. User sees fake "Supported/Disputed/Unverified" with fake sources

---

## FIXES REQUIRED

### 1. Frontend: Default to Production Mode ❌ NEEDS REVERT
- **File**: `frontend/web/src/context/DemoModeContext.tsx`
- **Current**: Defaults to `true` (demo mode ON)
- **Required**: Default to `false` (production mode)
- **Change**: `return stored === null ? false : stored === 'true';`

### 2. Backend: Remove Demo Fallback ❌ CRITICAL
- **File**: `backend/src/lambda.ts` lines 235-250
- **Current**: Falls back to `getDemoResponseForContent()` on orchestration error
- **Required**: Return honest error response with reason codes
- **Change**: Replace fallback with proper error handling

### 3. Backend: Add API Keys to Lambda ❌ CRITICAL
- **File**: `backend/template.yaml`
- **Current**: Only 3 env vars set
- **Required**: Add `BING_NEWS_KEY` from AWS Systems Manager Parameter Store
- **Change**: Add environment variable reference in template

### 4. Backend: Improve Zero-Evidence Handling ❌ NEEDED
- **File**: `backend/src/lambda.ts`
- **Current**: Returns "Unverified" with no explanation
- **Required**: Return clear message: "Unable to retrieve sufficient evidence"
- **Change**: Check evidence count, add reason codes to response

### 5. Frontend: Handle Operational Errors ❌ NEEDED
- **File**: `frontend/web/src/pages/Results.tsx`
- **Current**: Shows "Unverified" status without context
- **Required**: Show operational message when evidence retrieval fails
- **Change**: Add UI for reason codes and operational messages

### 6. Remove Jury-Centric UX ✅ ALREADY CLEAN
- UI is already production-ready
- No hackathon-specific language
- SIFT guidance is product feature, not demo artifact

---

## DEPLOYMENT REQUIREMENTS

### AWS Credentials Needed:
1. **Bing News API Key** (optional but recommended)
   - Store in AWS Systems Manager Parameter Store: `/fakenewsoff/bing-news-key`
   - Or set as Lambda environment variable
   - Without this: GDELT only (free but less reliable)

2. **AWS Bedrock Access** (NOT CURRENTLY USED)
   - Orchestration doesn't use Bedrock yet
   - Nova models are for future LLM-based synthesis
   - Can skip for now

### Current Provider Status:
- **GDELT**: Free, no auth, always available ✅
- **Bing News**: Requires API key, not configured ❌

---

## EXECUTION PLAN

### Phase 1: Fix Frontend Default (REVERT)
1. Change `DemoModeContext.tsx` to default to `false`
2. Test, build, deploy frontend
3. Verify deployed site has demo mode OFF by default

### Phase 2: Fix Backend Fallback Logic
1. Remove demo fallback in `lambda.ts`
2. Add proper error handling for orchestration failures
3. Add reason codes to response schema
4. Test all paths
5. Deploy backend

### Phase 3: Add Bing News API Key (OPTIONAL)
1. Get Bing News API key from Azure
2. Store in Parameter Store or Lambda env var
3. Update template.yaml to reference it
4. Deploy backend
5. Test grounding with real Bing data

### Phase 4: Improve Zero-Evidence UX
1. Update frontend to show operational messages
2. Add reason code handling
3. Test and deploy

### Phase 5: End-to-End Validation
1. Test with real claims (not examples)
2. Verify GDELT grounding works
3. Verify honest "no evidence" responses
4. Verify demo mode is OFF by default
5. Document operational status

---

## DECISION POINT

**Question for user**: Do you have a Bing News API key available, or should we proceed with GDELT-only grounding?

- **With Bing**: Better coverage, more reliable, requires API key
- **GDELT-only**: Free, no auth, less reliable but functional

I can proceed with GDELT-only immediately, or wait for Bing key to be provided.
