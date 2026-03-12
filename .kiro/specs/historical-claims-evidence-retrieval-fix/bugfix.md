# Bugfix Requirements Document

## Introduction

The FakeNewsOff system currently fails to retrieve evidence for well-documented historical claims, returning "No Evidence Sources Found" and "Unverified" verdicts for factual statements like "Ronald Reagan is dead". This is a critical product quality issue that undermines user trust and limits the system to only recent breaking news within a 7-day window.

The bug stems from hardcoded freshness parameters in evidence providers (Bing News API and GDELT API), lack of typo tolerance in claim normalization, absence of fallback retrieval strategies, and potential recency scoring bias that penalizes older but credible sources.

This fix will enable the system to handle both recent breaking news AND historical factual claims, while preserving existing demo mode functionality and maintaining performance requirements.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user submits a well-documented historical claim like "Ronald Reagan is dead" THEN the system returns verdict "Unverified" with empty evidence array

1.2 WHEN a user submits a historical claim with minor typos like "Ronald Regan is dead" THEN the system returns verdict "Unverified" with empty evidence array without attempting normalization

1.3 WHEN Bing News API and GDELT API return no results for historical claims (due to hardcoded 7-day freshness parameters) THEN the system provides no fallback retrieval strategy and returns empty evidence

1.4 WHEN evidence providers are queried for historical claims THEN the system uses hardcoded freshness parameters (`freshness: 'Week'` in Bing, `timespan: '7d'` in GDELT) that exclude older sources

1.5 WHEN the results page renders for historical claims THEN it displays the empty evidence state with "No Evidence Sources Found" message

### Expected Behavior (Correct)

2.1 WHEN a user submits a well-documented historical claim like "Ronald Reagan is dead" THEN the system SHALL return verdict "Supported" with credible evidence sources (obituaries, biographical articles, news archives)

2.2 WHEN a user submits a historical claim with minor typos like "Ronald Regan is dead" THEN the system SHALL normalize the claim using typo-tolerant techniques and return verdict "Supported" with credible evidence sources

2.3 WHEN Bing News API and GDELT API return no results for historical claims THEN the system SHALL employ a fallback retrieval strategy (broader search, historical knowledge base, or alternative providers) to find credible sources

2.4 WHEN evidence providers are queried for historical claims THEN the system SHALL use configurable freshness parameters that allow retrieval of older but credible sources when appropriate

2.5 WHEN the results page renders for historical claims with evidence THEN it SHALL display the evidence graph with supporting sources and appropriate trace information indicating the retrieval strategy used

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user submits a recent breaking-news style claim within the 7-day window THEN the system SHALL CONTINUE TO return appropriate verdicts (Supported/Disputed) with recent sources using existing freshness parameters

3.2 WHEN demo mode is active with deterministic example claims THEN the system SHALL CONTINUE TO return deterministic results without modification to existing hackathon examples

3.3 WHEN a claim has no real evidence available (neither recent nor historical) THEN the system SHALL CONTINUE TO return verdict "Unverified" with empty evidence array

3.4 WHEN the system processes any claim THEN it SHALL CONTINUE TO maintain explainable AI trace functionality showing retrieval decisions and strategies

3.5 WHEN the system processes any claim THEN it SHALL CONTINUE TO complete within the performance budget of less than 5 seconds

3.6 WHEN evidence filtering and scoring occurs THEN the system SHALL CONTINUE TO apply credibility and relevance criteria to ensure quality sources

3.7 WHEN the results page renders for claims with no evidence THEN it SHALL CONTINUE TO display the empty evidence state appropriately
