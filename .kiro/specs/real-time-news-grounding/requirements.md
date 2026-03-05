# Real-time News Grounding - Requirements

## Overview
Implement production-ready real-time news grounding for FakeNewsOff using Bing News Search API (primary) with GDELT fallback, synthesized by AWS Bedrock NOVA for evidence-based fact verification.

## Functional Requirements

### FR1: Input Support
- **FR1.1**: Accept headline text (required)
- **FR1.2**: Accept optional URL for context
- **FR1.3**: Extract searchable query from input text
- **FR1.4**: Normalize query for cache key consistency

### FR2: News Grounding Retrieval
- **FR2.1**: Primary provider: Bing News Search API
  - Use `/v7.0/news/search` endpoint
  - Include timeout (3500ms default)
  - Return structured news articles with metadata
- **FR2.2**: Fallback provider: GDELT Document API
  - Use `/api/v2/doc/doc` endpoint
  - Activate on Bing failure or zero results
  - Return structured news articles with metadata
- **FR2.3**: Provider selection logic:
  - Try Bing first if API key available
  - Fall back to GDELT on error, timeout, or empty results
  - Log provider used for observability
- **FR2.4**: Graceful degradation:
  - Never throw errors to user
  - Return empty sources with error metadata
  - Continue analysis with available data

### FR3: Source Normalization & Ranking
- **FR3.1**: Normalize URLs (remove tracking params, normalize protocol)
- **FR3.2**: Extract domain (eTLD+1 format)
- **FR3.3**: Deduplicate sources:
  - By normalized URL
  - By domain (keep highest scored per domain)
- **FR3.4**: Score sources using:
  - Recency score (newer = higher)
  - Domain tier score (trusted domains = higher)
  - Lexical similarity to query (fallback)
- **FR3.5**: Rank and cap results (default: top 10)

### FR4: Caching
- **FR4.1**: Cache grounding results by normalized query
- **FR4.2**: TTL: 900 seconds (15 minutes) default
- **FR4.3**: LRU eviction when cache full
- **FR4.4**: Cache hit/miss logging

### FR5: NOVA Synthesis
- **FR5.1**: Accept grounding bundle as input
- **FR5.2**: Generate strict JSON response with:
  - `status_label`: "Corroborated" | "Reported" | "Unverified"
  - `confidence_score`: 0-100
  - `recommendation`: string
  - `credible_sources`: array of top sources
  - `sift`: object with Stop/Investigate/Find/Trace details
    - Each step: `summary` + `evidence_urls[]`
    - Trace includes `earliest_source` if available
  - `debug`: provider metadata
- **FR5.3**: Use existing JSON repair/parseStrictJson pipeline
- **FR5.4**: Fallback to safe defaults on parse failure

### FR6: API Contract (Backward Compatible)
- **FR6.1**: Extend `/analyze` response with:
  - `grounding`: { providerUsed, sources_count, errors? }
  - `credible_sources`: EvidenceSource[] (top 5)
  - `sift`: populated object (not placeholder string)
- **FR6.2**: Keep all existing fields unchanged
- **FR6.3**: Existing consumers continue to work

### FR7: Demo Mode
- **FR7.1**: Return deterministic grounding bundle
- **FR7.2**: No external API calls
- **FR7.3**: Realistic mock sources with metadata
- **FR7.4**: Consistent with demo response patterns

### FR8: Frontend Integration
- **FR8.1**: Render credible sources list:
  - Title, publisher, date, link
  - Show "No sources" message if empty
- **FR8.2**: SIFT tile modals show:
  - Summary text from `sift.<step>.summary`
  - Evidence URLs (clickable)
  - Earliest source for Trace step
- **FR8.3**: Display transparency metadata:
  - "Search terms used"
  - "Provider used" (Bing/GDELT)

## Non-Functional Requirements

### NFR1: Performance
- **NFR1.1**: Grounding timeout: 3500ms default (configurable)
- **NFR1.2**: Total analysis time: <10s for 90th percentile
- **NFR1.3**: Cache hit rate: >60% for common queries

### NFR2: Reliability
- **NFR2.1**: Graceful degradation on provider failure
- **NFR2.2**: No user-facing errors from grounding failures
- **NFR2.3**: Fallback chain: Bing → GDELT → empty sources

### NFR3: Observability
- **NFR3.1**: Log structured events:
  - `grounding_provider_used`
  - `grounding_results_count`
  - `grounding_latency_ms`
  - `grounding_fallback`
  - `grounding_error`
  - `grounding_cache_hit`
- **NFR3.2**: Include request_id in all logs

### NFR4: Security
- **NFR4.1**: Validate API keys at startup
- **NFR4.2**: Sanitize user input before API calls
- **NFR4.3**: Rate limit external API calls (future)

### NFR5: Testability
- **NFR5.1**: All provider clients mockable
- **NFR5.2**: No network calls in unit tests
- **NFR5.3**: Deterministic test fixtures
- **NFR5.4**: >80% code coverage for new modules

### NFR6: Maintainability
- **NFR6.1**: Follow existing code patterns
- **NFR6.2**: Comprehensive JSDoc comments
- **NFR6.3**: Type-safe interfaces
- **NFR6.4**: Modular architecture (easy to add providers)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BING_NEWS_ENDPOINT` | No | `https://api.bing.microsoft.com/v7.0/news/search` | Bing News API endpoint |
| `BING_NEWS_KEY` | Prod only | - | Bing News API subscription key |
| `GDELT_DOC_ENDPOINT` | No | `https://api.gdeltproject.org/api/v2/doc/doc` | GDELT Document API endpoint |
| `GROUNDING_TIMEOUT_MS` | No | `3500` | Timeout for grounding requests |
| `GROUNDING_CACHE_TTL_SECONDS` | No | `900` | Cache TTL (15 minutes) |
| `GROUNDING_MAX_RESULTS` | No | `10` | Max sources to return |

## Success Criteria

1. Bing News API integration working with real API key
2. GDELT fallback activates on Bing failure
3. Sources normalized, deduplicated, and ranked correctly
4. Cache reduces redundant API calls
5. NOVA generates structured SIFT details with evidence
6. Frontend displays sources and SIFT modals correctly
7. Demo mode works without API keys
8. All validation gates pass (typecheck, lint, test, build)
9. Backward compatibility maintained
10. Observability logs present and useful

## Out of Scope (Future Enhancements)

- Additional news providers (NewsAPI, etc.)
- Advanced NLP for claim extraction
- Fact-checking database integration
- User feedback loop
- Rate limiting per user
- Persistent cache (Redis)
