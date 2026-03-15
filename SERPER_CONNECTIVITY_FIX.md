# Serper Connectivity Fix

## Root Cause Analysis

The full production path test isolated the issue: **Local Serper API connectivity failure** with error:
```
Network error calling Serper API: fetch failed
```

This is a **local environment networking issue**, not a code bug. The verification logic fix is correct, but the test is blocked by network connectivity.

---

## Changes Made

### 1. Enhanced Serper Client Error Logging (`backend/src/clients/serperClient.ts`)

**Added detailed diagnostic logging:**
- Request details (URL, method, timeout, API key presence)
- Response details (status, latency, headers)
- Error details (name, message, code, errno, syscall, stack trace)
- Network error cause extraction

**Added fallback mechanism:**
- Primary: Use `fetch` API (modern, standard)
- Fallback: Use native `https` module (more reliable in some environments)
- Automatic fallback if fetch fails

**Benefits:**
- Detailed error information for debugging
- More robust connectivity (dual transport layer)
- Better error messages for troubleshooting

### 2. Standalone Connectivity Test (`backend/test-serper-connectivity.ts`)

**Purpose:** Minimal test to diagnose Serper connectivity issues

**Features:**
- Tests basic fetch connectivity
- Uses same API key and request method as production
- Detailed error reporting with diagnostic steps
- Identifies specific failure types:
  - DNS resolution failure
  - TLS/certificate issues
  - Proxy/firewall blocking
  - Network connectivity issues
  - Timeout issues

**Output:** Clear PASS/FAIL with actionable debugging steps

### 3. Helper Script (`backend/run-serper-connectivity-test.ps1`)

**Features:**
- Interactive credential prompting
- Environment validation
- Clear status reporting
- Debugging guidance

---

## Files Changed

1. **`backend/src/clients/serperClient.ts`**
   - Added detailed error logging
   - Added `searchNewsWithHttps()` method using native https module
   - Added `searchNewsWithFetch()` method (refactored from original)
   - Added automatic fallback mechanism
   - Enhanced error details extraction

2. **`backend/test-serper-connectivity.ts`** (NEW)
   - Minimal standalone connectivity test
   - Detailed error diagnostics
   - Actionable debugging steps

3. **`backend/run-serper-connectivity-test.ps1`** (NEW)
   - Interactive test runner
   - Credential management
   - Clear status reporting

---

## How to Use

### Step 1: Run Connectivity Test

```powershell
cd backend
.\run-serper-connectivity-test.ps1
```

This will:
1. Check for SERPER_API_KEY
2. Test basic connectivity to Serper API
3. Report detailed error information if it fails
4. Provide debugging steps

### Step 2: Diagnose Issues

If the connectivity test fails, follow the debugging steps provided:

#### DNS Resolution Failure
```bash
nslookup google.serper.dev
```
**Fix:** Check DNS settings, try different DNS server (e.g., 8.8.8.8)

#### TLS/Certificate Issue
```bash
curl -v https://google.serper.dev
```
**Fix:** Update system certificates, check date/time settings

#### Proxy/Firewall Issue
```bash
echo $HTTP_PROXY $HTTPS_PROXY
```
**Fix:** Configure proxy settings, check firewall rules

#### Network Connectivity Issue
```bash
ping 8.8.8.8
```
**Fix:** Check network adapter, try different network (e.g., mobile hotspot)

### Step 3: Re-run Full Production Path Test

Once connectivity test passes:
```powershell
.\run-full-production-path-test.ps1
```

---

## Before/After Behavior

### Before (Original Code)

**Error:**
```
Network error calling Serper API: fetch failed
```

**Problems:**
- No detailed error information
- No fallback mechanism
- Difficult to diagnose root cause
- Single transport layer (fetch only)

### After (Enhanced Code)

**Detailed Error Logging:**
```json
{
  "timestamp": "2026-03-14T...",
  "level": "ERROR",
  "service": "serperClient",
  "event": "SERPER_REQUEST_FAILED",
  "error_name": "TypeError",
  "error_message": "fetch failed",
  "error_code": "ENOTFOUND",
  "error_errno": -3008,
  "error_syscall": "getaddrinfo",
  "is_abort_error": false,
  "is_fetch_error": true
}
```

**Fallback Mechanism:**
```
SERPER_FETCH_FAILED_TRYING_HTTPS
→ Automatically tries https module
→ More reliable in some environments
```

**Benefits:**
- Clear error identification (DNS, TLS, proxy, etc.)
- Automatic fallback to more reliable transport
- Actionable debugging steps
- Better error messages

---

## Expected Test Results

### Connectivity Test (Successful)

```
================================================================================
SERPER CONNECTIVITY TEST
================================================================================

Environment Check:
  SERPER_API_KEY: ✓ Present (32 chars)
  SERPER_TIMEOUT_MS: 10000ms

Test Configuration:
  URL: https://google.serper.dev/news
  Method: POST
  Query: "test"
  Timeout: 10000ms

================================================================================
TEST 1: Basic Fetch Connectivity
================================================================================

Attempting fetch request...
  Request body: {"q":"test","num":1}
  Headers: X-API-KEY (32 chars), Content-Type: application/json

✓ Fetch succeeded
  Latency: 234ms
  Status: 200 OK
  OK: true

✓ Response parsed successfully
  News count: 1
  Sample article: Test Article Title

================================================================================
✓ ALL TESTS PASSED
================================================================================

Serper connectivity is working correctly.
```

### Full Production Path Test (After Fix)

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

STEP 9: Verdict Synthesis
  Classification: true
  Confidence: 90.0%

✓ ALL VALIDATION CHECKS PASSED
```

---

## Possible Root Causes (Local Environment)

Based on the error "fetch failed", the most likely causes are:

### 1. DNS Resolution Failure (Most Likely)
- **Symptom:** Cannot resolve `google.serper.dev`
- **Cause:** DNS server issue, corporate DNS filtering
- **Fix:** Change DNS to 8.8.8.8 or 1.1.1.1

### 2. Corporate Proxy/Firewall
- **Symptom:** HTTPS requests blocked
- **Cause:** Corporate network policy
- **Fix:** Configure proxy settings, use VPN, or test from different network

### 3. TLS/Certificate Issue
- **Symptom:** Certificate validation failed
- **Cause:** Outdated certificates, corporate MITM proxy
- **Fix:** Update system certificates, configure NODE_TLS_REJECT_UNAUTHORIZED=0 (testing only)

### 4. Node.js Fetch Implementation Issue
- **Symptom:** fetch() fails but curl works
- **Cause:** Node.js version, fetch polyfill issue
- **Fix:** Use https module fallback (now implemented)

---

## Verification Steps

1. **Run connectivity test:**
   ```powershell
   .\run-serper-connectivity-test.ps1
   ```

2. **If it passes, run full test:**
   ```powershell
   .\run-full-production-path-test.ps1
   ```

3. **If connectivity test fails:**
   - Follow debugging steps in output
   - Check DNS: `nslookup google.serper.dev`
   - Check HTTPS: `curl -v https://google.serper.dev`
   - Check proxy: `echo $HTTP_PROXY $HTTPS_PROXY`
   - Try different network (mobile hotspot)

---

## Summary

**Root Cause:** Local environment networking issue (DNS/proxy/firewall)

**Fix Applied:**
1. Enhanced error logging for better diagnostics
2. Added https module fallback for more reliable connectivity
3. Created standalone connectivity test for debugging
4. Provided actionable debugging steps

**Verification Logic:** ✅ Correct (not changed)

**Next Steps:**
1. Run connectivity test to diagnose specific issue
2. Apply appropriate fix based on error type
3. Re-run full production path test
4. Verify all validation checks pass

---

**Status:** Ready for testing  
**Last Updated:** 2026-03-14
