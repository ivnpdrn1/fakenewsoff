# Production Evidence Retrieval Fix Design

## Overview

The production evidence retrieval pipeline is failing because the MediastackClient exists but was never integrated into the grounding service provider chain. This design specifies how to integrate Mediastack as the primary news provider, add URL validation, update environment configuration, and update frontend schemas to support the 'mediastack' provider type. The fix is minimal and surgical - we add Mediastack to the existing provider fallback chain without modifying the core orchestration logic.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when production mode attempts to retrieve evidence but Mediastack is not in the provider chain
- **Property (P)**: The desired behavior when evidence retrieval is requested - Mediastack should be used as primary provider with GDELT as fallback
- **Preservation**: Existing GDELT, Bing News, Bing Web, demo mode, caching, throttling, and orchestration behavior that must remain unchanged
- **MediastackClient**: The existing client at `backend/src/clients/mediastackClient.ts` that provides Mediastack API integration
- **GroundingService**: The service at `backend/src/services/groundingService.ts` that orchestrates provider fallback
- **providerOrder**: The configuration array that determines which providers to try and in what order
- **normalizeMediastackArticles**: The new function to convert Mediastack API responses to NormalizedSource format

## Bug Details

### Bug Condition

The bug manifests when the grounding service attempts to retrieve evidence in production mode. The MediastackClient exists and MEDIASTACK_API_KEY is configured in the Lambda environment, but the client is never instantiated or called because it's not integrated into the provider fallback chain.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type GroundingRequest
  OUTPUT: boolean
  
  RETURN input.demoMode == false
         AND MEDIASTACK_API_KEY is configured
         AND MediastackClient exists in codebase
         AND MediastackClient NOT instantiated in GroundingService
         AND 'mediastack' NOT IN providerOrder
END FUNCTION
```

### Examples

- **Example 1**: User submits "Ronald Reagan is dead" in production mode → System returns empty evidence or "Unverified" verdict (ACTUAL) vs "Supported" verdict with real Mediastack sources (EXPECTED)
- **Example 2**: GroundingService constructor executes → Only BingNewsClient and GDELTClient are instantiated (ACTUAL) vs MediastackClient should also be instantiated (EXPECTED)
- **Example 3**: Provider fallback chain executes → Only tries 'bing' and 'gdelt' providers (ACTUAL) vs Should try 'mediastack' as primary provider (EXPECTED)
- **Edge Case**: MEDIASTACK_API_KEY not configured → Should gracefully skip Mediastack and fall back to GDELT (EXPECTED)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- GDELT provider must continue to retrieve and normalize GDELT articles correctly
- Bing News provider must continue to work when BING_NEWS_KEY is configured
- Bing Web Search fallback must continue to work for historical claims
- Demo mode must continue to return deterministic demo bundles
- Grounding cache must continue to return cached bundles when available
- Provider fallback logic must continue to try providers in configured order
- Source deduplication must continue to remove duplicate URLs and domains
- Source ranking must continue to score sources by recency, domain tier, and lexical similarity
- Historical claim detection must continue to use adaptive freshness strategies
- GDELT throttling must continue to enforce minimum interval between requests

**Scope:**
All inputs that do NOT involve production mode evidence retrieval should be completely unaffected by this fix. This includes:
- Demo mode requests (should continue using demo bundles)
- Cached requests (should continue returning cached results)
- Requests when MEDIASTACK_API_KEY is not configured (should fall back to GDELT)

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is clear:

1. **Missing Client Instantiation**: The GroundingService constructor does not instantiate MediastackClient, even though the client exists and is fully implemented

2. **Missing Provider Configuration**: The GROUNDING_PROVIDER_ORDER in template.yaml is set to "gdelt" only, excluding Mediastack from the provider chain

3. **Missing Normalization Function**: The sourceNormalizer.ts file has normalizeBingArticles() and normalizeGDELTArticles() but no normalizeMediastackArticles() function

4. **Missing Environment Validation**: The envValidation.ts file does not include MEDIASTACK_API_KEY or MEDIASTACK_TIMEOUT_MS in the schema

5. **Missing Frontend Schema Support**: The frontend schemas define providerUsed as enum(['bing', 'gdelt', 'none', 'demo', 'orchestrated']) but do not include 'mediastack'

6. **Missing URL Validation**: The system does not validate URLs before returning them, potentially including invalid or placeholder URLs

## Correctness Properties

Property 1: Bug Condition - Mediastack Integration

_For any_ grounding request in production mode where MEDIASTACK_API_KEY is configured, the fixed GroundingService SHALL instantiate MediastackClient and attempt to retrieve evidence from Mediastack as the primary provider, falling back to GDELT if Mediastack fails or returns zero results.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - Existing Provider Behavior

_For any_ grounding request that uses GDELT, Bing News, Bing Web, demo mode, or cached results, the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality for provider fallback, caching, throttling, deduplication, ranking, and orchestration.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9**

Property 3: URL Validation

_For any_ grounding response that includes sources, the fixed code SHALL validate all URLs to ensure they are real http/https URLs before inclusion, filtering out invalid or placeholder URLs.

**Validates: Requirements 2.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File 1**: `backend/src/utils/envValidation.ts`

**Changes**:
1. **Add MEDIASTACK_API_KEY to schema**: Add optional string field for Mediastack API key
2. **Add MEDIASTACK_TIMEOUT_MS to schema**: Add optional string field for Mediastack timeout (default: 5000ms)
3. **Add warning log**: Log warning if MEDIASTACK_API_KEY not set (similar to BING_NEWS_KEY warning)

**File 2**: `backend/src/services/sourceNormalizer.ts`

**Changes**:
1. **Import MediastackArticle type**: Add import from mediastackClient
2. **Add normalizeMediastackArticles function**: Convert Mediastack API responses to NormalizedSource format
   - Map `title` → `title`
   - Map `url` → `url` (with normalizeUrl)
   - Map `description` → `snippet` (truncate to 200 chars)
   - Map `published_at` → `publishDate`
   - Map `source` → `domain` (extract domain from URL)
   - Filter out sources with invalid URLs or unknown domains
3. **Add URL validation to all normalize functions**: Use isValidUrl() from mediastackClient to filter sources

**File 3**: `backend/src/services/groundingService.ts`

**Changes**:
1. **Import MediastackClient and MediastackError**: Add imports from mediastackClient
2. **Import normalizeMediastackArticles**: Add import from sourceNormalizer
3. **Add mediastackClient property**: Add `private mediastackClient: MediastackClient | null = null;` to class
4. **Instantiate MediastackClient in constructor**: Try to instantiate MediastackClient, set to null if API key missing
5. **Update providerOrder parsing**: Add 'mediastack' to valid provider list in filter
6. **Add Mediastack case to tryProviders**: Add provider fallback logic for 'mediastack' (similar to 'bing' case)
7. **Add Mediastack case to tryProvidersWithFreshness**: Add freshness-aware provider logic for 'mediastack'
8. **Update health status**: Add `mediastack_configured` field to getHealthStatus() return value

**File 4**: `backend/template.yaml`

**Changes**:
1. **Update GROUNDING_PROVIDER_ORDER**: Change from 'gdelt' to 'mediastack,gdelt'
2. **Add MEDIASTACK_API_KEY**: Add environment variable (value will be set via AWS Console/CLI)
3. **Add MEDIASTACK_TIMEOUT_MS**: Add environment variable with default '5000'

**File 5**: `frontend/shared/schemas/backend-schemas.ts`

**Changes**:
1. **Update GroundingMetadataSchema**: Add 'mediastack' and 'bing_web' to providerUsed enum
2. **Update NormalizedSourceWithStanceSchema**: Add 'mediastack' and 'bing_web' to provider enum
3. **Update TextGroundingBundleSchema**: Add 'mediastack' and 'bing_web' to providerUsed array enum

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that Mediastack is not being used even when configured.

**Test Plan**: Write tests that mock MEDIASTACK_API_KEY environment variable and verify that MediastackClient is instantiated and called. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Mediastack Client Not Instantiated**: Verify GroundingService constructor does not create MediastackClient (will fail on unfixed code)
2. **Mediastack Not in Provider Order**: Verify 'mediastack' is not in providerOrder array (will fail on unfixed code)
3. **Mediastack Not Called**: Mock MediastackClient.searchNews() and verify it's never called (will fail on unfixed code)
4. **Empty Evidence Returned**: Submit "Ronald Reagan is dead" and verify empty evidence is returned (will fail on unfixed code)

**Expected Counterexamples**:
- MediastackClient is not instantiated even when MEDIASTACK_API_KEY is set
- Provider fallback chain only tries 'bing' and 'gdelt', never 'mediastack'
- Obvious factual claims return empty evidence or "Unverified" verdict

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL request WHERE isBugCondition(request) DO
  result := groundingService_fixed.ground(request)
  ASSERT result.providerUsed == 'mediastack' OR result.attemptedProviders CONTAINS 'mediastack'
  ASSERT result.sources.length > 0 OR result.errors CONTAINS 'Mediastack'
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL request WHERE NOT isBugCondition(request) DO
  ASSERT groundingService_original.ground(request) = groundingService_fixed.ground(request)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for demo mode, cached requests, and GDELT-only requests, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Demo Mode Preservation**: Verify demo mode continues to return deterministic bundles
2. **Cache Preservation**: Verify cached requests continue to return cached results
3. **GDELT Preservation**: Verify GDELT provider continues to work when Mediastack fails
4. **Bing News Preservation**: Verify Bing News provider continues to work when configured
5. **Historical Claims Preservation**: Verify web search fallback continues to work for historical claims
6. **Throttling Preservation**: Verify GDELT throttling continues to enforce minimum interval

### Unit Tests

- Test MediastackClient instantiation with and without API key
- Test normalizeMediastackArticles() function with valid and invalid inputs
- Test URL validation filters out invalid URLs
- Test provider fallback chain includes Mediastack
- Test Mediastack provider logic with mocked client responses
- Test environment validation includes MEDIASTACK_API_KEY

### Property-Based Tests

- Generate random Mediastack API responses and verify normalization produces valid NormalizedSource objects
- Generate random grounding requests and verify Mediastack is attempted when configured
- Generate random provider configurations and verify fallback chain works correctly
- Test that all URLs in responses are valid http/https URLs

### Integration Tests

- Test full grounding flow with real Mediastack API (requires API key)
- Test provider fallback from Mediastack to GDELT when Mediastack fails
- Test that obvious factual claims return real evidence from Mediastack
- Test that frontend schemas accept 'mediastack' provider type
