# Real-time News Grounding - Design

## Overview

This design implements production-ready real-time news grounding for FakeNewsOff, enabling evidence-based fact verification by retrieving recent news articles from external APIs and synthesizing them into structured SIFT (Stop, Investigate, Find, Trace) guidance using AWS Bedrock NOVA.

### Key Components

1. **News API Clients**: Bing News Search (primary) and GDELT Document API (fallback)
2. **Grounding Service**: Orchestrates retrieval, normalization, deduplication, and ranking
3. **Cache Layer**: In-memory LRU/TTL cache for grounding results
4. **NOVA Synthesis**: Enhanced prompt engineering for evidence-based SIFT generation
5. **API Extension**: Backward-compatible response schema with new grounding fields

### Design Goals

- **Reliability**: Graceful degradation with fallback chain (Bing → GDELT → empty sources)
- **Performance**: Sub-4s grounding with caching to reduce redundant API calls
- **Observability**: Structured logging for provider selection, latency, and errors
- **Testability**: Mockable clients, deterministic demo mode, property-based testing
- **Maintainability**: Modular architecture for easy provider addition

## Architecture

### System Context

```
┌─────────────────────────────────────────────────────────────────┐
│                      Client Request                              │
│              (headline + optional URL)                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Grounding Service                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Extract query from headline                           │  │
│  │ 2. Check grounding cache (LRU/TTL)                       │  │
│  │ 3. If miss: Fetch from news APIs                         │  │
│  │ 4. Normalize, deduplicate, rank sources                  │  │
│  │ 5. Store in cache                                        │  │
│  │ 6. Return grounding bundle                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
┌───────────────────────────┐  ┌──────────────────────────┐
│   Bing News Search API    │  │   GDELT Document API     │
│   (Primary Provider)      │  │   (Fallback Provider)    │
│                           │  │                          │
│ • /v7.0/news/search       │  │ • /api/v2/doc/doc        │
│ • Requires API key        │  │ • No auth required       │
│ • 3500ms timeout          │  │ • 3500ms timeout         │
│ • Structured metadata     │  │ • Structured metadata    │
└───────────────────────────┘  └──────────────────────────┘
                │                         │
                └────────────┬────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Grounding Bundle                                │
│  • Normalized sources (URL, title, snippet, date, domain)       │
│  • Provider metadata (which API used, latency, errors)           │
│  • Ranked by recency, domain tier, lexical similarity           │
│  • Deduplicated by URL and domain                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  NOVA Synthesis                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Enhanced prompt with grounding bundle                     │  │
│  │ • Generate status_label with evidence                     │  │
│  │ • Populate SIFT object with summaries + evidence_urls     │  │
│  │ • Extract credible_sources (top 5)                        │  │
│  │ • Include debug metadata (provider, sources_count)        │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Extended API Response                           │
│  • Existing fields (status_label, confidence_score, etc.)        │
│  • NEW: credible_sources[] (top 5 with evidence)                 │
│  • NEW: sift object (Stop/Investigate/Find/Trace details)        │
│  • NEW: grounding metadata (provider, sources_count, errors)     │
└─────────────────────────────────────────────────────────────────┘
```

### Component Interactions

1. **Query Extraction**: Extract searchable query from headline text (remove stop words, normalize)
2. **Cache Lookup**: Check in-memory cache by normalized query (15-minute TTL)
3. **Provider Selection**: Try Bing first (if API key available), fallback to GDELT on error/empty
4. **Source Normalization**: Normalize URLs, extract domains, parse dates
5. **Deduplication**: Remove duplicate URLs and keep highest-scored per domain
6. **Ranking**: Score by recency + domain tier + lexical similarity, cap at top 10
7. **NOVA Synthesis**: Pass grounding bundle to enhanced prompt for structured output
8. **Response Assembly**: Merge NOVA output with grounding metadata

### Fallback Chain

```
Bing News API
    ↓ (on error, timeout, or zero results)
GDELT Document API
    ↓ (on error, timeout, or zero results)
Empty Sources (graceful degradation)
```

## Components and Interfaces

### 1. News API Clients

#### BingNewsClient

```typescript
interface BingNewsClient {
  /**
   * Search Bing News API for articles matching query
   * 
   * @param query - Search query string
   * @param options - Search options (count, freshness, market)
   * @returns Promise resolving to array of news articles
   * @throws BingNewsError on API errors (with retry logic)
   */
  search(query: string, options?: BingSearchOptions): Promise<BingNewsArticle[]>;
}

interface BingSearchOptions {
  count?: number;        // Max results (default: 10)
  freshness?: 'Day' | 'Week' | 'Month'; // Recency filter (default: 'Week')
  market?: string;       // Market code (default: 'en-US')
  safeSearch?: 'Off' | 'Moderate' | 'Strict'; // Safe search (default: 'Moderate')
}

interface BingNewsArticle {
  name: string;          // Article title
  url: string;           // Article URL
  description: string;   // Article snippet
  datePublished: string; // ISO8601 date
  provider: Array<{ name: string }>; // Publisher info
}
```

**Implementation Notes**:
- Use `node-fetch` for HTTP requests
- Set `Ocp-Apim-Subscription-Key` header with API key
- Timeout: 3500ms (configurable via `GROUNDING_TIMEOUT_MS`)
- Retry: 2 attempts with exponential backoff (200ms, 400ms)
- Error handling: Catch network errors, parse errors, rate limits

#### GDELTClient

```typescript
interface GDELTClient {
  /**
   * Search GDELT Document API for articles matching query
   * 
   * @param query - Search query string
   * @param options - Search options (maxrecords, timespan, mode)
   * @returns Promise resolving to array of news articles
   * @throws GDELTError on API errors (with retry logic)
   */
  search(query: string, options?: GDELTSearchOptions): Promise<GDELTArticle[]>;
}

interface GDELTSearchOptions {
  maxrecords?: number;   // Max results (default: 10)
  timespan?: string;     // Time range (default: '7d' for 7 days)
  mode?: 'artlist';      // Mode (default: 'artlist')
  format?: 'json';       // Format (default: 'json')
}

interface GDELTArticle {
  url: string;           // Article URL
  title: string;         // Article title
  seendate: string;      // Date seen (YYYYMMDDHHMMSS format)
  domain: string;        // Publisher domain
  language: string;      // Language code
}
```

**Implementation Notes**:
- Use `node-fetch` for HTTP requests
- No authentication required (public API)
- Timeout: 3500ms (configurable via `GROUNDING_TIMEOUT_MS`)
- Retry: 2 attempts with exponential backoff (200ms, 400ms)
- Error handling: Catch network errors, parse errors, empty results

### 2. Grounding Service

```typescript
interface GroundingService {
  /**
   * Ground a headline with real-time news sources
   * 
   * @param headline - Headline text to ground
   * @param url - Optional URL for context
   * @returns Promise resolving to grounding bundle
   */
  ground(headline: string, url?: string): Promise<GroundingBundle>;
}

interface GroundingBundle {
  sources: NormalizedSource[];      // Normalized, deduplicated, ranked sources
  providerUsed: 'bing' | 'gdelt' | 'none'; // Which provider was used
  query: string;                    // Normalized query used for search
  latencyMs: number;                // Total grounding latency
  errors?: string[];                // Any errors encountered (non-fatal)
}

interface NormalizedSource {
  url: string;                      // Normalized URL (no tracking params)
  title: string;                    // Article title
  snippet: string;                  // Article snippet/description
  publishDate: string;              // ISO8601 date
  domain: string;                   // Registrable domain (eTLD+1)
  score: number;                    // Ranking score (0-1)
}
```

**Implementation Notes**:
- Extract query: Remove stop words, normalize whitespace, lowercase
- Cache lookup: Check in-memory cache by normalized query
- Provider selection: Try Bing first (if `BING_NEWS_KEY` set), fallback to GDELT
- Normalization: Use `url-parse` for URL normalization, `psl` for domain extraction
- Deduplication: Remove exact URL duplicates, keep highest-scored per domain
- Ranking: Combine recency score (0-1), domain tier score (0-1), lexical similarity (0-1)
- Caching: Store in LRU cache with 15-minute TTL

### 3. Cache Layer

```typescript
interface GroundingCache {
  /**
   * Get cached grounding bundle by query
   * 
   * @param query - Normalized query string
   * @returns Cached bundle or null if not found/expired
   */
  get(query: string): GroundingBundle | null;
  
  /**
   * Store grounding bundle in cache
   * 
   * @param query - Normalized query string
   * @param bundle - Grounding bundle to cache
   */
  set(query: string, bundle: GroundingBundle): void;
  
  /**
   * Clear all cached entries
   */
  clear(): void;
}
```

**Implementation Notes**:
- Use `lru-cache` library (already in dependencies)
- Max entries: 1000 (configurable via `GROUNDING_CACHE_MAX_ENTRIES`)
- TTL: 900 seconds (15 minutes, configurable via `GROUNDING_CACHE_TTL_SECONDS`)
- LRU eviction: Automatically evict least recently used when full
- Thread-safe: Single-threaded Node.js, no locking needed

### 4. Source Normalization & Ranking

```typescript
interface SourceNormalizer {
  /**
   * Normalize raw API articles to common format
   * 
   * @param articles - Raw articles from Bing or GDELT
   * @param provider - Which provider the articles came from
   * @returns Normalized sources
   */
  normalize(articles: BingNewsArticle[] | GDELTArticle[], provider: 'bing' | 'gdelt'): NormalizedSource[];
  
  /**
   * Deduplicate sources by URL and domain
   * 
   * @param sources - Normalized sources
   * @returns Deduplicated sources
   */
  deduplicate(sources: NormalizedSource[]): NormalizedSource[];
  
  /**
   * Rank sources by recency, domain tier, and lexical similarity
   * 
   * @param sources - Normalized sources
   * @param query - Original query for lexical similarity
   * @returns Ranked sources (highest score first)
   */
  rank(sources: NormalizedSource[], query: string): NormalizedSource[];
}
```

**Normalization Steps**:
1. Extract URL, title, snippet, date, domain from raw article
2. Normalize URL: Remove tracking params (`utm_*`, `fbclid`, etc.), lowercase protocol
3. Extract domain: Use `psl` library to get eTLD+1 (e.g., `bbc.co.uk` from `www.bbc.co.uk`)
4. Parse date: Convert to ISO8601 format
5. Truncate snippet: Max 200 characters

**Deduplication Steps**:
1. Remove exact URL duplicates (keep first occurrence)
2. Group by domain, keep highest-scored per domain (max 1 per domain)

**Ranking Algorithm**:
```
score = (0.4 * recency_score) + (0.4 * domain_tier_score) + (0.2 * lexical_similarity)

recency_score = 1.0 - (age_in_days / 30)  // Linear decay over 30 days
domain_tier_score = tier_map[domain] || 0.5  // Trusted domains get 1.0, unknown get 0.5
lexical_similarity = jaccard_similarity(query_tokens, title_tokens)  // Token overlap
```

**Domain Tier Map** (trusted news sources):
- Tier 1.0 (highly trusted): reuters.com, apnews.com, bbc.com, npr.org, pbs.org
- Tier 0.8 (trusted): nytimes.com, washingtonpost.com, theguardian.com, wsj.com
- Tier 0.6 (mainstream): cnn.com, foxnews.com, nbcnews.com, abcnews.go.com
- Tier 0.5 (default): All other domains

### 5. NOVA Synthesis Enhancement

#### Enhanced Prompt Structure

```typescript
interface NOVASynthesisInput {
  headline: string;
  groundingBundle: GroundingBundle;
  existingClaims?: ExtractedClaim[];  // From existing claim extraction
}

interface NOVASynthesisOutput {
  status_label: StatusLabel;
  confidence_score: number;
  recommendation: string;
  credible_sources: EvidenceSource[];  // Top 5 sources with evidence
  sift: SIFTDetails;                   // Structured SIFT object
  debug: {
    providerUsed: string;
    sources_count: number;
    errors?: string[];
  };
}

interface EvidenceSource {
  url: string;
  title: string;
  snippet: string;
  why: string;                         // Why this source is credible
  domain: string;
}

interface SIFTDetails {
  stop: {
    summary: string;                   // Stop step summary
    evidence_urls: string[];           // Supporting evidence URLs
  };
  investigate: {
    summary: string;                   // Investigate step summary
    evidence_urls: string[];           // Supporting evidence URLs
  };
  find: {
    summary: string;                   // Find step summary
    evidence_urls: string[];           // Supporting evidence URLs
  };
  trace: {
    summary: string;                   // Trace step summary
    evidence_urls: string[];           // Supporting evidence URLs
    earliest_source?: string;          // Earliest source URL if available
  };
}
```

#### Prompt Engineering

**System Prompt Addition**:
```
You are analyzing a headline with real-time news grounding from {providerUsed}.

Available sources ({sources_count} total):
{formatted_sources}

Your task:
1. Determine status_label based on evidence from sources
2. Generate SIFT guidance with specific evidence from sources
3. Extract top 5 credible sources with explanations
4. Provide confidence_score and recommendation

SIFT Framework:
- Stop: Initial assessment - should user stop and verify?
- Investigate: What to investigate about the source and claim?
- Find: Where to find better coverage or authoritative sources?
- Trace: Can we trace the claim to its original source?

For each SIFT step, provide:
- summary: 1-2 sentence guidance
- evidence_urls: Array of relevant source URLs (0-3 per step)

For Trace step, also include:
- earliest_source: URL of earliest source if identifiable

Output strict JSON matching schema.
```

**Formatted Sources Template**:
```
Source 1: {title}
URL: {url}
Domain: {domain}
Published: {publishDate}
Snippet: {snippet}

Source 2: ...
```

## Data Models

### Request Schema Extension

```typescript
interface AnalysisRequest {
  text: string;                        // Headline text (required)
  url?: string;                        // Optional URL for context
  selectedText?: string;               // Optional selected text
  title?: string;                      // Optional page title
  imageUrl?: string;                   // Optional image URL
  demo_mode?: boolean;                 // Optional demo mode flag
  cache_bypass?: boolean;              // Optional cache bypass flag
}
```

No changes to existing request schema - fully backward compatible.

### Response Schema Extension

```typescript
interface AnalysisResponse {
  // Existing fields (unchanged)
  request_id: string;
  status_label: StatusLabel;
  confidence_score: number;
  recommendation: string;
  progress_stages: ProgressStage[];
  sources: CredibleSource[];           // DEPRECATED: Use credible_sources instead
  media_risk: MediaRisk | null;
  misinformation_type: MisinformationType | null;
  sift_guidance: string;               // DEPRECATED: Use sift object instead
  timestamp: string;
  cached?: boolean;
  
  // NEW fields
  credible_sources: EvidenceSource[];  // Top 5 sources with evidence
  sift: SIFTDetails;                   // Structured SIFT object
  grounding: {
    providerUsed: 'bing' | 'gdelt' | 'none';
    sources_count: number;
    latencyMs: number;
    errors?: string[];
  };
}
```

**Backward Compatibility**:
- Existing `sources` field remains populated (for old clients)
- Existing `sift_guidance` field remains populated (for old clients)
- New clients should use `credible_sources` and `sift` object
- Deprecation warnings in API documentation

### Zod Schema Definitions

```typescript
// Evidence Source Schema (new)
export const EvidenceSourceSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  snippet: z.string(),
  why: z.string(),
  domain: z.string()
});

// SIFT Step Schema (new)
export const SIFTStepSchema = z.object({
  summary: z.string(),
  evidence_urls: z.array(z.string().url()).max(3)
});

// SIFT Details Schema (new)
export const SIFTDetailsSchema = z.object({
  stop: SIFTStepSchema,
  investigate: SIFTStepSchema,
  find: SIFTStepSchema,
  trace: SIFTStepSchema.extend({
    earliest_source: z.string().url().optional()
  })
});

// Grounding Metadata Schema (new)
export const GroundingMetadataSchema = z.object({
  providerUsed: z.enum(['bing', 'gdelt', 'none']),
  sources_count: z.number().min(0),
  latencyMs: z.number().min(0),
  errors: z.array(z.string()).optional()
});

// Extended Analysis Response Schema
export const AnalysisResponseSchema = z.object({
  // ... existing fields ...
  credible_sources: z.array(EvidenceSourceSchema).max(5),
  sift: SIFTDetailsSchema,
  grounding: GroundingMetadataSchema
});
```

### Demo Mode Support

```typescript
interface DemoGroundingBundle {
  sources: NormalizedSource[];
  providerUsed: 'demo';
  query: string;
  latencyMs: 0;
  errors: undefined;
}

function getDemoGroundingBundle(headline: string): DemoGroundingBundle {
  // Return deterministic mock sources based on headline keywords
  // Example: "climate change" → 3 mock sources from reuters, bbc, npr
  // No external API calls
  // Consistent with demo response patterns
}
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Input Validation Accepts Valid Requests

For any analysis request with non-empty headline text and optional URL, the grounding service should accept and process the request without throwing validation errors.

**Validates: Requirements FR1.1, FR1.2**

### Property 2: Query Extraction Produces Non-Empty Normalized Queries

For any non-empty headline text, extracting a searchable query should produce a non-empty, normalized string that contains relevant terms from the original text.

**Validates: Requirements FR1.3**

### Property 3: Query Normalization Is Idempotent

For any query string, normalizing it multiple times should produce the same result, and semantically equivalent queries (differing only in whitespace, case, or stop words) should produce the same normalized form.

**Validates: Requirements FR1.4**

### Property 4: Bing Client Returns Structured Articles

For any valid search query, the Bing News client should return an array of articles where each article has all required metadata fields (url, title, snippet, publishDate, domain).

**Validates: Requirements FR2.1**

### Property 5: GDELT Client Returns Structured Articles

For any valid search query, the GDELT client should return an array of articles where each article has all required metadata fields (url, title, snippet, publishDate, domain).

**Validates: Requirements FR2.2**

### Property 6: Graceful Error Handling Never Throws to User

For any provider error (network timeout, API error, parse error), the grounding service should never throw exceptions to the user and should return a valid response with error metadata in the grounding object.

**Validates: Requirements FR2.4, NFR2.1, NFR2.2**

### Property 7: URL Normalization Is Idempotent

For any URL string, normalizing it multiple times should produce the same result, and URLs differing only in tracking parameters (utm_*, fbclid, etc.) should normalize to the same base URL.

**Validates: Requirements FR3.1**

### Property 8: Domain Extraction Produces eTLD+1 Format

For any valid URL, the extracted domain should be in eTLD+1 format (e.g., "bbc.co.uk" not "www.bbc.co.uk"), containing exactly one dot for most TLDs or two dots for country-code TLDs.

**Validates: Requirements FR3.2**

### Property 9: Deduplication Removes Duplicates

For any list of sources, deduplication should remove exact URL duplicates and ensure at most one source per domain (keeping the highest scored), and the output should have length less than or equal to the input.

**Validates: Requirements FR3.3**

### Property 10: Source Scores Are Bounded and Ordered

For any list of sources with scoring applied, all scores should be in the range [0, 1], newer sources should score higher than older sources (all else equal), and trusted domains should score higher than unknown domains (all else equal).

**Validates: Requirements FR3.4**

### Property 11: Ranking Produces Sorted and Capped Results

For any list of sources after ranking, the results should be sorted by score in descending order, and the result count should never exceed the configured maximum (default 10).

**Validates: Requirements FR3.5**

### Property 12: Cache Round-Trip Preserves Bundles

For any grounding bundle and normalized query, storing the bundle in cache and then retrieving it by the same query should return an equivalent bundle (same sources, provider, query).

**Validates: Requirements FR4.1**

### Property 13: Structured Logging Includes Required Fields

For any grounding operation (cache hit, cache miss, provider used, error), the logged event should be valid JSON and include required fields (event type, timestamp, request_id).

**Validates: Requirements FR4.4, NFR3.1, NFR3.2**

### Property 14: NOVA Synthesis Accepts Grounding Bundle

For any valid grounding bundle, the NOVA synthesis function should accept it as input and return a response with all required fields (status_label, confidence_score, credible_sources, sift, grounding).

**Validates: Requirements FR5.1**

### Property 15: NOVA Output Conforms to Schema

For any NOVA synthesis output, it should validate against the AnalysisResponseSchema with all required fields present and correctly typed (status_label is enum, confidence_score is 0-100, sift has all four steps, etc.).

**Validates: Requirements FR5.2**

### Property 16: JSON Repair Handles Malformed Output

For any malformed JSON string (truncated, missing braces, invalid escapes), the JSON repair pipeline should either successfully parse it into a valid object or return a safe default response without throwing.

**Validates: Requirements FR5.3, FR5.4**

### Property 17: Response Schema Backward Compatibility

For any analysis response with new grounding fields, it should validate against both the old schema (without grounding, credible_sources, sift required) and the new schema, ensuring existing consumers continue to work.

**Validates: Requirements FR6.1, FR6.2, FR6.3**

### Property 18: Demo Mode Is Deterministic

For any headline text, calling the demo mode grounding function multiple times with the same input should return identical grounding bundles (same sources, same order, same metadata).

**Validates: Requirements FR7.1**

### Property 19: Demo Sources Have Required Metadata

For any demo grounding bundle, all sources should have all required metadata fields (url, title, snippet, publishDate, domain) with realistic, non-empty values.

**Validates: Requirements FR7.3, FR7.4**

### Property 20: Frontend Renders All Source Fields

For any credible source object, rendering it to the UI should produce output that contains all required fields (title, publisher/domain, date, link/URL).

**Validates: Requirements FR8.1**

### Property 21: SIFT Modals Render All Step Details

For any SIFT details object, rendering each step (Stop, Investigate, Find, Trace) should produce output that contains the summary text and all evidence URLs.

**Validates: Requirements FR8.2**

### Property 22: Transparency Metadata Is Displayed

For any grounding metadata object, rendering it to the UI should produce output that includes the search query used and the provider name (Bing/GDELT/none).

**Validates: Requirements FR8.3**

### Property 23: Input Sanitization Removes Injection Attempts

For any user input string containing special characters or potential injection patterns (SQL, NoSQL, command injection), sanitization should remove or escape dangerous characters before passing to external APIs.

**Validates: Requirements NFR4.2**

## Error Handling

### Error Categories

1. **Network Errors**: Timeouts, connection failures, DNS errors
2. **API Errors**: Rate limits, authentication failures, invalid responses
3. **Parse Errors**: Malformed JSON, missing required fields
4. **Validation Errors**: Invalid input, schema violations

### Error Handling Strategy

#### Network Errors
- **Timeout**: 3500ms for all external API calls
- **Retry**: 2 attempts with exponential backoff (200ms, 400ms)
- **Fallback**: Try next provider in chain (Bing → GDELT → empty)
- **Logging**: Log error with provider, latency, error message

#### API Errors
- **Rate Limit**: Log warning, fallback to next provider
- **Auth Failure**: Log error, fallback to next provider (or empty if no fallback)
- **Invalid Response**: Log error, attempt to parse partial data, fallback if needed
- **Logging**: Log error with provider, status code, error message

#### Parse Errors
- **Malformed JSON**: Use JSON repair pipeline (existing)
- **Missing Fields**: Use safe defaults for missing fields
- **Type Errors**: Coerce to expected type or use default
- **Logging**: Log warning with parse error details

#### Validation Errors
- **Invalid Input**: Return 400 error with validation message
- **Schema Violation**: Use safe defaults, log warning
- **Logging**: Log validation error with field name and reason

### Error Response Format

```typescript
interface ErrorResponse {
  error: string;                       // Human-readable error message
  error_code: string;                  // Machine-readable error code
  request_id: string;                  // Request ID for tracing
  timestamp: string;                   // ISO8601 timestamp
}
```

### Graceful Degradation

When grounding fails completely (all providers fail or timeout):
1. Return empty sources array
2. Set `providerUsed: 'none'`
3. Include error details in `grounding.errors`
4. Continue with NOVA synthesis using empty sources
5. NOVA should generate appropriate guidance for unverified content
6. Never throw errors to user - always return valid response

### Logging Strategy

All errors should be logged with structured JSON:

```typescript
{
  event: 'grounding_error',
  request_id: string,
  provider: 'bing' | 'gdelt' | 'none',
  error_type: 'network' | 'api' | 'parse' | 'validation',
  error_message: string,
  latency_ms: number,
  timestamp: string
}
```

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

Both are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide range of inputs.

### Property-Based Testing

**Library**: fast-check (already in dependencies)

**Configuration**:
- Minimum 100 iterations per property test (due to randomization)
- Each test tagged with comment referencing design property
- Tag format: `// Feature: real-time-news-grounding, Property {number}: {property_text}`

**Property Test Examples**:

```typescript
// Feature: real-time-news-grounding, Property 3: Query Normalization Is Idempotent
it('should normalize queries idempotently', async () => {
  await fc.assert(
    fc.asyncProperty(fc.string(), async (query) => {
      const normalized1 = normalizeQuery(query);
      const normalized2 = normalizeQuery(normalized1);
      expect(normalized1).toBe(normalized2);
    }),
    { numRuns: 100 }
  );
});

// Feature: real-time-news-grounding, Property 7: URL Normalization Is Idempotent
it('should normalize URLs idempotently', async () => {
  await fc.assert(
    fc.asyncProperty(fc.webUrl(), async (url) => {
      const normalized1 = normalizeUrl(url);
      const normalized2 = normalizeUrl(normalized1);
      expect(normalized1).toBe(normalized2);
    }),
    { numRuns: 100 }
  );
});

// Feature: real-time-news-grounding, Property 10: Source Scores Are Bounded
it('should produce scores in range [0, 1]', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(arbitraryNormalizedSource()),
      fc.string(),
      async (sources, query) => {
        const scored = scoreAndRankSources(sources, query);
        scored.forEach(source => {
          expect(source.score).toBeGreaterThanOrEqual(0);
          expect(source.score).toBeLessThanOrEqual(1);
        });
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Testing

**Focus Areas**:
- Specific examples of query extraction (e.g., "Breaking: Storm hits coast" → "storm hits coast")
- Edge cases (empty sources, single source, all sources same domain)
- Error conditions (network timeout, API rate limit, malformed JSON)
- Integration points (cache service, NOVA client, demo mode)
- Fallback chain (Bing fails → GDELT succeeds)
- TTL expiration (cache entry expires after 15 minutes)
- LRU eviction (cache full, new entry evicts oldest)

**Unit Test Examples**:

```typescript
describe('GroundingService', () => {
  describe('Provider Fallback', () => {
    it('should fallback to GDELT when Bing fails', async () => {
      const bingClient = createMockBingClient({ shouldFail: true });
      const gdeltClient = createMockGDELTClient({ shouldSucceed: true });
      const service = new GroundingService(bingClient, gdeltClient);
      
      const bundle = await service.ground('test headline');
      
      expect(bundle.providerUsed).toBe('gdelt');
      expect(bundle.sources.length).toBeGreaterThan(0);
    });
    
    it('should return empty sources when all providers fail', async () => {
      const bingClient = createMockBingClient({ shouldFail: true });
      const gdeltClient = createMockGDELTClient({ shouldFail: true });
      const service = new GroundingService(bingClient, gdeltClient);
      
      const bundle = await service.ground('test headline');
      
      expect(bundle.providerUsed).toBe('none');
      expect(bundle.sources).toEqual([]);
      expect(bundle.errors).toBeDefined();
    });
  });
  
  describe('Cache TTL', () => {
    it('should return cached entry within TTL', async () => {
      const cache = new GroundingCache({ ttl: 900 });
      const bundle = createMockBundle();
      
      cache.set('test query', bundle);
      const retrieved = cache.get('test query');
      
      expect(retrieved).toEqual(bundle);
    });
    
    it('should return null after TTL expires', async () => {
      const cache = new GroundingCache({ ttl: 1 }); // 1 second TTL
      const bundle = createMockBundle();
      
      cache.set('test query', bundle);
      await sleep(1100); // Wait for TTL to expire
      const retrieved = cache.get('test query');
      
      expect(retrieved).toBeNull();
    });
  });
});
```

### Integration Testing

**Focus Areas**:
- End-to-end flow: headline → grounding → NOVA synthesis → response
- Real API calls (with test API keys in CI/CD)
- Cache integration with DynamoDB (if using persistent cache)
- Demo mode integration (no external calls)

**Integration Test Example**:

```typescript
describe('End-to-End Grounding', () => {
  it('should ground headline and synthesize SIFT details', async () => {
    const request = {
      text: 'Breaking: Major climate agreement signed by 50 nations',
      demo_mode: true // Use demo mode to avoid real API calls
    };
    
    const response = await analyzeContent(request);
    
    expect(response.grounding.providerUsed).toBe('demo');
    expect(response.credible_sources.length).toBeGreaterThan(0);
    expect(response.sift.stop.summary).toBeTruthy();
    expect(response.sift.investigate.summary).toBeTruthy();
    expect(response.sift.find.summary).toBeTruthy();
    expect(response.sift.trace.summary).toBeTruthy();
  });
});
```

### Test Coverage Goals

- **Overall**: >80% code coverage for new modules
- **Critical paths**: 100% coverage for error handling, fallback logic, normalization
- **Edge cases**: Comprehensive coverage for empty inputs, malformed data, timeouts

### Mocking Strategy

All external dependencies should be mockable:

```typescript
interface NewsAPIClient {
  search(query: string, options?: SearchOptions): Promise<Article[]>;
}

// Mock implementations for testing
class MockBingClient implements NewsAPIClient {
  constructor(private behavior: MockBehavior) {}
  
  async search(query: string): Promise<Article[]> {
    if (this.behavior.shouldFail) {
      throw new Error('Mock API error');
    }
    return this.behavior.mockArticles || [];
  }
}
```

### Test Data Generators

Use fast-check arbitraries for property-based testing:

```typescript
// Arbitrary for normalized source
const arbitraryNormalizedSource = (): fc.Arbitrary<NormalizedSource> => {
  return fc.record({
    url: fc.webUrl(),
    title: fc.string({ minLength: 10, maxLength: 100 }),
    snippet: fc.string({ minLength: 50, maxLength: 200 }),
    publishDate: fc.date().map(d => d.toISOString()),
    domain: fc.domain(),
    score: fc.double({ min: 0, max: 1 })
  });
};

// Arbitrary for grounding bundle
const arbitraryGroundingBundle = (): fc.Arbitrary<GroundingBundle> => {
  return fc.record({
    sources: fc.array(arbitraryNormalizedSource(), { maxLength: 10 }),
    providerUsed: fc.constantFrom('bing', 'gdelt', 'none'),
    query: fc.string({ minLength: 1, maxLength: 100 }),
    latencyMs: fc.nat({ max: 5000 }),
    errors: fc.option(fc.array(fc.string()), { nil: undefined })
  });
};
```

### Demo Mode Testing

Demo mode should be tested to ensure:
- Deterministic output for same input
- No network calls (verify with network mocking)
- Realistic mock data (all required fields present)
- Consistent with existing demo patterns

```typescript
describe('Demo Mode', () => {
  it('should return deterministic output', () => {
    const headline = 'Test headline';
    
    const bundle1 = getDemoGroundingBundle(headline);
    const bundle2 = getDemoGroundingBundle(headline);
    
    expect(bundle1).toEqual(bundle2);
  });
  
  it('should not make network calls', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    
    await analyzeContent({ text: 'Test', demo_mode: true });
    
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
```

### Continuous Integration

All tests should run in CI/CD pipeline:
- Unit tests: Run on every commit
- Property tests: Run on every commit (with 100 iterations)
- Integration tests: Run on every PR (with demo mode)
- Coverage report: Fail if <80% coverage for new code

### Test Execution

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run property tests only
npm test -- --testNamePattern="Property"

# Run integration tests only
npm test -- --testNamePattern="Integration"
```

---

## Implementation Notes

### Dependencies

New dependencies required:
- `lru-cache`: In-memory LRU cache (already in dependencies)
- `psl`: Public Suffix List for domain extraction
- `url-parse`: URL parsing and normalization

Existing dependencies to use:
- `node-fetch`: HTTP requests (already in dependencies)
- `fast-check`: Property-based testing (already in dependencies)
- `zod`: Schema validation (already in dependencies)

### Configuration

Environment variables (see requirements for full list):
- `BING_NEWS_ENDPOINT`: Bing News API endpoint (default: https://api.bing.microsoft.com/v7.0/news/search)
- `BING_NEWS_KEY`: Bing News API key (required for production)
- `GDELT_DOC_ENDPOINT`: GDELT API endpoint (default: https://api.gdeltproject.org/api/v2/doc/doc)
- `GROUNDING_TIMEOUT_MS`: Timeout for grounding requests (default: 3500)
- `GROUNDING_CACHE_TTL_SECONDS`: Cache TTL (default: 900)
- `GROUNDING_MAX_RESULTS`: Max sources to return (default: 10)

### File Structure

```
backend/src/
├── services/
│   ├── groundingService.ts          # Main grounding orchestration
│   ├── groundingCache.ts            # LRU/TTL cache implementation
│   └── sourceNormalizer.ts          # Normalization, deduplication, ranking
├── clients/
│   ├── bingNewsClient.ts            # Bing News API client
│   └── gdeltClient.ts               # GDELT API client
├── utils/
│   ├── queryExtractor.ts            # Query extraction and normalization
│   └── domainTiers.ts               # Domain tier mapping
└── __tests__/
    ├── groundingService.test.ts     # Unit tests
    ├── groundingService.property.test.ts  # Property tests
    └── groundingService.integration.test.ts  # Integration tests
```

### Migration Path

1. **Phase 1**: Implement core grounding service with Bing + GDELT clients
2. **Phase 2**: Add caching layer and normalization logic
3. **Phase 3**: Enhance NOVA prompts with grounding bundle
4. **Phase 4**: Extend API response schema (backward compatible)
5. **Phase 5**: Update frontend to display new fields
6. **Phase 6**: Add demo mode support
7. **Phase 7**: Comprehensive testing and validation

### Backward Compatibility

To ensure existing consumers continue to work:
1. Keep existing `sources` field populated (copy from `credible_sources`)
2. Keep existing `sift_guidance` field populated (concatenate from `sift` object)
3. Make new fields optional in schema validation
4. Add deprecation warnings in API documentation
5. Plan migration timeline for clients to adopt new fields

### Performance Optimization

- **Parallel API calls**: If both Bing and GDELT are available, call in parallel and use fastest
- **Cache warming**: Pre-populate cache with common queries
- **Batch processing**: Process multiple headlines in single request (future)
- **CDN caching**: Cache responses at CDN layer for public content (future)

### Security Considerations

- **API key protection**: Never log or expose API keys
- **Input sanitization**: Remove SQL injection, XSS, command injection patterns
- **Rate limiting**: Implement rate limiting per IP/user (future)
- **CORS**: Configure CORS headers for frontend access
- **Content validation**: Validate all external API responses before processing

