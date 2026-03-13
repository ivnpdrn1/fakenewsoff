# Bugfix Requirements Document: Provider Failure Detail Propagation

## Introduction

Production evidence retrieval is working correctly (multiQuery orchestration with 6 queries), but provider failure diagnostics are not reaching the API response. When providers like mediastack and gdelt fail, the `provider_failure_details` field remains empty in both `retrieval_status.providerFailureDetails` and `_debug_fix_v4.provider_failure_details`, making it impossible to diagnose why providers are failing (rate limits, quota exceeded, zero results, etc.).

The grounding service correctly captures failure details in `GroundingBundle.providerFailureDetails`, but this data is lost during propagation through the orchestrator to the final lambda response.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN providers fail during evidence retrieval THEN the system captures failure details in `GroundingBundle.providerFailureDetails` at the grounding layer but loses this data during orchestration

1.2 WHEN the orchestrator builds the `retrievalStatus` object THEN the system omits `providerFailureDetails` from the returned structure

1.3 WHEN the lambda constructs the API response THEN the system returns empty arrays for both `retrieval_status.providerFailureDetails` and `_debug_fix_v4.provider_failure_details`

1.4 WHEN multiple providers fail with different reasons (rate_limit, quota_exceeded, zero_raw_results) THEN the system provides no diagnostic information about which failure type occurred

1.5 WHEN a provider is rate-limited or quota-exceeded THEN the system continues retrying the same provider in subsequent requests instead of activating cooldown

### Expected Behavior (Correct)

2.1 WHEN providers fail during evidence retrieval THEN the system SHALL preserve failure details through the entire pipeline: grounding service → orchestrator → orchestration result → lambda response

2.2 WHEN the orchestrator builds the `retrievalStatus` object THEN the system SHALL include `providerFailureDetails` array with complete diagnostic information

2.3 WHEN the lambda constructs the API response THEN the system SHALL populate both `retrieval_status.providerFailureDetails` and `_debug_fix_v4.provider_failure_details` with non-empty arrays when providers fail

2.4 WHEN each provider fails THEN the system SHALL include: provider name, query, reason (rate_limit/quota_exceeded/timeout/zero_raw_results/normalization_zero/filtered_to_zero), stage, latency_ms, raw_count, normalized_count, accepted_count, http_status (if available), and error_message

2.5 WHEN a provider returns rate_limit, quota_exceeded, or 429 status THEN the system SHALL stop retrying that provider in the same request and activate provider cooldown

2.6 WHEN failure details are propagated THEN the system SHALL log "PROVIDER_FAILURE_DETAILS_PROPAGATED" with entry count and provider names

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the multi-query orchestration path is active THEN the system SHALL CONTINUE TO use orchestration_method_used = "multiQuery"

3.2 WHEN text-only grounding is used THEN the system SHALL CONTINUE TO use ground_method_used = "groundTextOnly"

3.3 WHEN queries are generated THEN the system SHALL CONTINUE TO generate 6 queries (queries_count = 6)

3.4 WHEN any provider returns usable evidence THEN the system SHALL CONTINUE TO populate sourcesCount > 0

3.5 WHEN providers succeed THEN the system SHALL CONTINUE TO return evidence sources without failure details
