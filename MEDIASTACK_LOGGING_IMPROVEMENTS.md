# Mediastack Provider Logging Improvements

## Issue
Runtime logs showed that Mediastack provider was not being attempted in some requests, even though:
- MEDIASTACK_API_KEY was present
- GROUNDING_PROVIDER_ORDER = "mediastack,gdelt"

CloudWatch logs showed misleading warning:
```
⚠️  BING_NEWS_KEY not set - will use GDELT API only for news grounding
```

This suggested the evidence retrieval logic contained a guard that disabled news providers when BING_NEWS_KEY was missing, which was incorrect.

## Root Cause Analysis
1. The warning message in `envValidation.ts` was misleading - it implied GDELT would be the only provider when BING_NEWS_KEY was missing
2. There was no dependency between BING_NEWS_KEY and Mediastack in the code
3. Logging was insufficient to diagnose provider selection issues:
   - No log when a provider was skipped due to missing client
   - No log showing which providers were actually initialized
   - No log showing provider availability at startup

## Changes Made

### 1. Updated Environment Validation Warnings (`backend/src/utils/envValidation.ts`)

**Before:**
```typescript
// Log warning if BING_NEWS_KEY not set (will use GDELT only)
if (!isDemoMode && !parsed.BING_NEWS_KEY) {
  console.warn('⚠️  BING_NEWS_KEY not set - will use GDELT API only for news grounding');
}

// Log warning if MEDIASTACK_API_KEY not set
if (!isDemoMode && !parsed.MEDIASTACK_API_KEY) {
  console.warn('⚠️  MEDIASTACK_API_KEY not set - Mediastack provider will not be available');
}
```

**After:**
```typescript
// Log provider availability warnings
if (!isDemoMode) {
  const availableProviders: string[] = [];
  
  if (parsed.MEDIASTACK_API_KEY) {
    availableProviders.push('Mediastack');
  } else {
    console.warn('⚠️  MEDIASTACK_API_KEY not set - Mediastack provider will not be available');
  }
  
  if (parsed.BING_NEWS_KEY) {
    availableProviders.push('Bing News');
  } else {
    console.warn('⚠️  BING_NEWS_KEY not set - Bing News provider will not be available');
  }
  
  // GDELT is always available (no API key required)
  availableProviders.push('GDELT');
  
  console.log(`✓ Available news providers: ${availableProviders.join(', ')}`);
}
```

**Benefits:**
- Clear, accurate messaging about which providers are available
- Positive confirmation of available providers (not just warnings)
- No misleading implications about provider dependencies

### 2. Enhanced GroundingService Constructor Logging (`backend/src/services/groundingService.ts`)

**Added comprehensive initialization logging:**

```typescript
logger.info('Initializing GroundingService', {
  event: 'grounding_service_init',
  enabled: this.enabled,
  provider_order_configured: this.providerOrder,
});

// For each provider initialization:
logger.info('Mediastack client initialized', {
  event: 'provider_init_success',
  provider: 'mediastack',
});

// Or if initialization fails:
logger.info('Mediastack client not available (no API key)', {
  event: 'provider_init_skipped',
  provider: 'mediastack',
  reason: 'missing_api_key',
});

// Final summary:
logger.info('GroundingService initialization complete', {
  event: 'grounding_service_ready',
  enabled: this.enabled,
  provider_order_configured: this.providerOrder,
  providers_available: availableProviders,
  max_results: this.maxResults,
});
```

**Benefits:**
- Clear visibility into which providers successfully initialized
- Explicit logging when a provider is skipped (with reason)
- Summary of final provider availability at startup

### 3. Enhanced Provider Attempt Logging

**Added explicit skip logging in provider loops:**

```typescript
if (provider === 'mediastack') {
  if (!this.mediastackClient) {
    logger.info('Skipping Mediastack provider (client not initialized)', {
      event: 'provider_attempt_skipped',
      requestId,
      provider: 'mediastack',
      reason: 'client_not_initialized',
    });
    continue;
  }

  attemptedProviders.push('mediastack');
  logger.info('Attempting Mediastack provider', {
    event: 'provider_attempt_start',
    requestId,
    provider: 'mediastack',
    timeout_ms: 5000,
  });
  // ... provider logic
}
```

**Benefits:**
- Explicit log when a provider is skipped (not just silence)
- Clear distinction between "provider_attempt_start" and "provider_attempt_skipped"
- Reason code for why provider was skipped

## Log Events Reference

### Startup Events
- `grounding_service_init` - Service initialization started
- `provider_init_success` - Provider client successfully initialized
- `provider_init_skipped` - Provider client not initialized (with reason)
- `grounding_service_ready` - Service initialization complete with summary

### Runtime Events
- `provider_attempt_start` - Provider is being attempted
- `provider_attempt_skipped` - Provider skipped (with reason)
- `provider_success` - Provider returned results
- `provider_failure` - Provider failed or returned zero results

## Verification

### Expected Startup Logs (with Mediastack configured)
```
✓ Available news providers: Mediastack, GDELT
{"event":"grounding_service_init","enabled":true,"provider_order_configured":["mediastack","gdelt"]}
{"event":"provider_init_skipped","provider":"bing","reason":"missing_api_key"}
{"event":"provider_init_skipped","provider":"bing_web","reason":"missing_api_key"}
{"event":"provider_init_success","provider":"mediastack"}
{"event":"provider_init_success","provider":"gdelt"}
{"event":"grounding_service_ready","providers_available":["mediastack","gdelt"]}
```

### Expected Runtime Logs (Mediastack attempt)
```
{"event":"provider_attempt_start","provider":"mediastack","timeout_ms":5000}
{"event":"provider_success","provider":"mediastack","sources_returned":5}
```

### Expected Runtime Logs (Mediastack skipped)
```
{"event":"provider_attempt_skipped","provider":"mediastack","reason":"client_not_initialized"}
{"event":"provider_attempt_start","provider":"gdelt"}
```

## Testing

All tests pass:
- Bug condition tests: 5/5 ✓
- Preservation tests: 7/7 ✓
- TypeScript compilation: Success ✓

## Deployment

After deploying these changes, CloudWatch logs will clearly show:
1. Which providers are available at startup
2. Which provider is being attempted for each request
3. Why a provider was skipped (if applicable)
4. Which provider successfully returned results

This makes it trivial to diagnose provider selection issues in production.
