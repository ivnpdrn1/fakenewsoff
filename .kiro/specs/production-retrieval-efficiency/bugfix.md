# Bugfix Requirements Document

## Introduction

The production evidence retrieval system exhibits inefficient and unreliable behavior that wastes API quota and causes unnecessary failures. Despite having available provider capacity (only 17/100 Mediastack requests used this month), the system returns zero sources due to inefficient provider usage patterns. The system sends all 6 generated queries to all providers without budgeting, lacks provider cooldown/throttling logic, has no short-term caching, and doesn't use staged execution. This bugfix implements production-grade retrieval behavior with efficient query budgeting, provider health tracking, short-term caching, and staged execution to maximize reliability while minimizing unnecessary API calls.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the system generates 6 queries for a claim THEN the system sends all 6 queries to all providers (Mediastack and GDELT) without budgeting or prioritization

1.2 WHEN a provider returns a rate-limit, quota, throttling, 429, or subscription-limit error THEN the system continues attempting to call that provider within the same request

1.3 WHEN the same claim is submitted multiple times within minutes THEN the system makes fresh external API calls to providers each time without checking for cached results

1.4 WHEN providers are called THEN the system uses a fan-out strategy that attempts all queries simultaneously without staged execution

1.5 WHEN provider failures occur THEN the system does not consistently populate provider_failure_details in the response or debug fields

1.6 WHEN provider calls complete THEN the system does not track or report provider budget usage, cooldown states, cache hit sources, or staged retrieval phases

### Expected Behavior (Correct)

2.1 WHEN the system generates queries for a claim THEN the system SHALL rank queries by relevance and use only the top 1-2 queries initially per provider (Mediastack max 1 query first pass, GDELT max 1 query first pass)

2.2 WHEN a provider returns a rate-limit, quota, throttling, 429, or subscription-limit error THEN the system SHALL mark that provider as temporarily unavailable with a cooldown timestamp and SHALL NOT attempt further calls to that provider within the same request

2.3 WHEN the same claim is submitted within the cache TTL window THEN the system SHALL return cached results without making new external API calls (successful evidence cached for 5-15 minutes, provider rate-limit cooldown cached for 2-5 minutes)

2.4 WHEN retrieving evidence THEN the system SHALL use staged execution: Stage 1 (best 1 query with Mediastack), Stage 2 (if zero usable evidence, try GDELT with 1 query), Stage 3 (if still zero, try one additional ranked query)

2.5 WHEN provider failures occur THEN the system SHALL populate provider_failure_details in both retrieval_status.providerFailureDetails and _debug_fix_v4.provider_failure_details with: provider, query, reason, stage, latency, raw_count, normalized_count, accepted_count, http_status, error_message

2.6 WHEN provider calls complete THEN the system SHALL include provider health summary in response/debug fields with: provider_budget_used, provider_cooldowns_active, cache_hit_source, staged_retrieval_phase_reached

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the system successfully retrieves valid evidence sources THEN the system SHALL CONTINUE TO return properly formatted sources with correct URLs and metadata

3.2 WHEN no valid evidence is found after all retrieval attempts THEN the system SHALL CONTINUE TO return sourcesCount of 0 without fabricating sources

3.3 WHEN query generation produces valid queries THEN the system SHALL CONTINUE TO use those queries for evidence retrieval

3.4 WHEN the orchestration path executes THEN the system SHALL CONTINUE TO attempt both Mediastack and GDELT providers as configured

3.5 WHEN evidence is normalized and classified THEN the system SHALL CONTINUE TO apply the same quality filters and acceptance criteria
