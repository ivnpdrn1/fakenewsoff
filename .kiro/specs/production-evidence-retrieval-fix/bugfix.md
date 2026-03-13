# Bugfix Requirements Document

## Introduction

The production evidence retrieval pipeline is failing to return real evidence for verifiable factual claims. The system returns empty evidence or "Unverified" verdicts for obvious claims like "Ronald Reagan is dead" that should be easily verifiable with real news sources. The root cause is that the Mediastack news provider client exists but was never integrated into the grounding service pipeline. The GROUNDING_PROVIDER_ORDER is currently set to "gdelt" only, and there is no normalization logic for Mediastack responses. This bugfix integrates the existing MediastackClient into the retrieval pipeline to restore proper evidence retrieval functionality.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user submits an obvious factual claim like "Ronald Reagan is dead" in production mode THEN the system returns empty evidence or "Unverified" verdict

1.2 WHEN the grounding service attempts to retrieve evidence THEN Mediastack provider is not used even though MEDIASTACK_API_KEY is configured in Lambda environment

1.3 WHEN groundingService.ts executes provider orchestration THEN MediastackClient is not instantiated or called despite existing at `backend/src/clients/mediastackClient.ts`

1.4 WHEN sourceNormalizer.ts processes provider responses THEN there is no normalizeMediastackArticles() function to handle Mediastack API responses

1.5 WHEN template.yaml defines GROUNDING_PROVIDER_ORDER THEN it is set to "gdelt" only instead of "mediastack,gdelt"

1.6 WHEN the system returns sources THEN invalid or placeholder URLs may be included without validation

### Expected Behavior (Correct)

2.1 WHEN a user submits an obvious factual claim like "Ronald Reagan is dead" in production mode THEN the system SHALL return "Supported" verdict with real sources from Mediastack

2.2 WHEN the grounding service attempts to retrieve evidence THEN Mediastack SHALL be used as the primary provider with GDELT as fallback

2.3 WHEN groundingService.ts executes provider orchestration THEN MediastackClient SHALL be instantiated and called in the provider fallback chain

2.4 WHEN sourceNormalizer.ts processes Mediastack responses THEN normalizeMediastackArticles() function SHALL convert Mediastack API format to NormalizedSource format

2.5 WHEN template.yaml defines GROUNDING_PROVIDER_ORDER THEN it SHALL be set to "mediastack,gdelt" to prioritize Mediastack

2.6 WHEN the system returns sources THEN all URLs SHALL be validated as real http/https URLs before inclusion

### Unchanged Behavior (Regression Prevention)

3.1 WHEN GDELT provider is used THEN the system SHALL CONTINUE TO retrieve and normalize GDELT articles correctly

3.2 WHEN Bing News provider is configured THEN the system SHALL CONTINUE TO use Bing as a provider option

3.3 WHEN demo mode is enabled THEN the system SHALL CONTINUE TO return deterministic demo bundles

3.4 WHEN grounding cache has a cached result THEN the system SHALL CONTINUE TO return cached bundle

3.5 WHEN provider fallback logic executes THEN the system SHALL CONTINUE TO try providers in configured order

3.6 WHEN source deduplication runs THEN the system SHALL CONTINUE TO remove duplicate URLs and domains

3.7 WHEN source ranking executes THEN the system SHALL CONTINUE TO score sources by recency, domain tier, and lexical similarity

3.8 WHEN historical claim detection identifies a historical claim THEN the system SHALL CONTINUE TO use adaptive freshness strategies

3.9 WHEN web search fallback is triggered THEN the system SHALL CONTINUE TO use Bing Web Search for historical claims
