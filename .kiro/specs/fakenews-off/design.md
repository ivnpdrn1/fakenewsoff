# Technical Design Document: FakeNewsOff

## Overview

FakeNewsOff is a Chrome MV3 browser extension with an AWS serverless backend that provides AI-powered misinformation detection. The system extracts content from web pages, analyzes it using AWS Bedrock Nova 2 Lite, retrieves credible sources through RAG (Retrieval-Augmented Generation), and presents results with confidence scores and educational guidance based on the SIFT framework.

The architecture consists of three main components:

1. **Chrome Extension (MV3)**: Content extraction, user interface (popup), and API communication
2. **Web UI**: Static React application providing detailed verification reports with transparency
3. **AWS Serverless Backend**: API Gateway, Lambda function, DynamoDB storage, and Bedrock AI services

The system emphasizes transparency, neutrality, and education over binary fact-checking. It distinguishes between factual falsity and bias/framing, provides actionable recommendations based on the SIFT framework, and exposes the verification process to build user trust.

### Performance Targets

The system is designed to provide a "real-time feel" with the following performance targets:

- **Progress Indicator**: Appears within 500ms of request submission
- **Typical Analysis Time**: 8-12 seconds end-to-end
- **Maximum Analysis Time**: 30 seconds (hard timeout enforced by Lambda)

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────┐      ┌──────────────────────────┐    │
│  │  Chrome Extension (MV3)  │      │      Web UI (React)      │    │
│  ├──────────────────────────┤      ├──────────────────────────┤    │
│  │  • Content Script        │      │  • URL/Text Input        │    │
│  │  • Background Worker     │      │  • Image Upload          │    │
│  │  • Popup UI              │      │  • Progress Timeline     │    │
│  │  • Fast Check Mode       │      │  • Detailed Report       │    │
│  └──────────┬───────────────┘      └──────────┬───────────────┘    │
│             │                                  │                     │
└─────────────┼──────────────────────────────────┼─────────────────────┘
              │                                  │
              │         HTTPS POST /analyze      │
              │         HTTPS GET /status/:id    │
              │                                  │
┌─────────────┴──────────────────────────────────┴─────────────────────┐
│                         AWS CLOUD LAYER                               │
├───────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      API Gateway (REST)                       │   │
│  │  • POST /analyze                                              │   │
│  │  • GET /status/{request_id} (optional)                        │   │
│  │  • CORS configuration                                         │   │
│  └────────────────────────────┬─────────────────────────────────┘   │
│                               │                                       │
│                               ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Lambda Function (TypeScript)                     │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │  Handler (handler.ts)                                   │  │   │
│  │  │  • Request validation                                   │  │   │
│  │  │  • UUID generation                                      │  │   │
│  │  │  • Service orchestration                                │  │   │
│  │  │  • Response formatting                                  │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  │                                                               │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │  Services Layer                                         │  │   │
│  │  │  ┌──────────────────────────────────────────────────┐  │  │   │
│  │  │  │  extractionService                               │  │  │   │
│  │  │  │  • Claim extraction (1-5 claims)                 │  │  │   │
│  │  │  │  • Uses Nova 2 Lite                              │  │  │   │
│  │  │  └──────────────────────────────────────────────────┘  │  │   │
│  │  │  ┌──────────────────────────────────────────────────┐  │  │   │
│  │  │  │  searchClient                                    │  │  │   │
│  │  │  │  • Query generation from claims                  │  │  │   │
│  │  │  │  • External search API integration               │  │  │   │
│  │  │  │  • Retrieves 5+ candidates per claim             │  │  │   │
│  │  │  └──────────────────────────────────────────────────┘  │  │   │
│  │  │  ┌──────────────────────────────────────────────────┐  │  │   │
│  │  │  │  ragService                                      │  │  │   │
│  │  │  │  • Document chunking (≤512 tokens)               │  │  │   │
│  │  │  │  • Embedding generation (Nova Embeddings)        │  │  │   │
│  │  │  │  • Similarity-based retrieval (top 5 chunks)     │  │  │   │
│  │  │  └──────────────────────────────────────────────────┘  │  │   │
│  │  │  ┌──────────────────────────────────────────────────┐  │  │   │
│  │  │  │  scoringService                                  │  │  │   │
│  │  │  │  • Domain authority scoring                      │  │  │   │
│  │  │  │  • Deduplication by domain                       │  │  │   │
│  │  │  │  • Returns 2-3 sources, ≥2 distinct domains      │  │  │   │
│  │  │  │  • Extracts snippet + why field                  │  │  │   │
│  │  │  └──────────────────────────────────────────────────┘  │  │   │
│  │  │  ┌──────────────────────────────────────────────────┐  │  │   │
│  │  │  │  novaClient                                      │  │  │   │
│  │  │  │  • Evidence synthesis                            │  │  │   │
│  │  │  │  • Status label determination                    │  │  │   │
│  │  │  │  • Recommendation generation                     │  │  │   │
│  │  │  │  • SIFT framework integration                    │  │  │   │
│  │  │  │  • FirstDraft type classification                │  │  │   │
│  │  │  └──────────────────────────────────────────────────┘  │  │   │
│  │  │  ┌──────────────────────────────────────────────────┐  │  │   │
│  │  │  │  mediaCheckService                               │  │  │   │
│  │  │  │  • Deepfake detection heuristics                 │  │  │   │
│  │  │  │  • Provenance metadata check (C2PA)              │  │  │   │
│  │  │  │  • Risk assessment (low/medium/high)             │  │  │   │
│  │  │  └──────────────────────────────────────────────────┘  │  │   │
│  │  │  ┌──────────────────────────────────────────────────┐  │  │   │
│  │  │  │  responseSchema                                  │  │  │   │
│  │  │  │  • JSON schema validation                        │  │  │   │
│  │  │  │  • Response formatting                           │  │  │   │
│  │  │  └──────────────────────────────────────────────────┘  │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  └───────────────────────────┬───────────────────────────────────┘   │
│                              │                                        │
│              ┌───────────────┼───────────────┐                       │
│              │               │               │                       │
│              ▼               ▼               ▼                       │
│  ┌─────────────────┐  ┌──────────┐  ┌──────────────┐               │
│  │   DynamoDB      │  │ Bedrock  │  │  S3 Bucket   │               │
│  │   Table         │  │ Services │  │  (Optional)  │               │
│  ├─────────────────┤  ├──────────┤  ├──────────────┤               │
│  │ PK: request_id  │  │ • Nova 2 │  │ • Media      │               │
│  │ • request       │  │   Lite   │  │   storage    │               │
│  │ • response      │  │ • Nova   │  │              │               │
│  │ • timestamps    │  │   Embed  │  │              │               │
│  │ • TTL (opt)     │  │          │  │              │               │
│  └─────────────────┘  └──────────┘  └──────────────┘               │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**Chrome Extension (MV3)**:
- On-demand Extraction Function: Extracts page title, URL, text, selected text, and top image (executed on-demand via chrome.scripting.executeScript when user clicks extension icon)
- Background Service Worker: Manages API communication with retry logic, executes extraction function on user click using activeTab permission
- Popup UI: Displays quick analysis results with status label, confidence, sources, and SIFT guidance

**Web UI (React + Vite)**:
- Provides input fields for URL, text, and image upload
- Displays detailed verification report with progress timeline
- Shows evidence snippets with "why" explanations for each source
- Renders SIFT guidance and actionable recommendations
- Supports permalink sharing for verification receipts

**API Gateway**:
- Exposes REST endpoints: POST /analyze and optional GET /status/{request_id}
- Handles CORS configuration for cross-origin requests
- Routes requests to Lambda function

**Lambda Function**:
- Validates incoming requests and generates UUID
- Orchestrates service calls in sequence
- Manages progress stage tracking
- Stores results in DynamoDB
- Returns formatted response within 30-second timeout

**Services**:
- extractionService: Identifies 1-5 factual claims using Nova 2 Lite
- searchClient: Generates search queries and retrieves candidate sources
- ragService: Chunks documents, generates embeddings, retrieves relevant context
- scoringService: Ranks sources by credibility, deduplicates, ensures domain diversity
- novaClient: Synthesizes evidence, determines status label, generates recommendations
- mediaCheckService: Detects manipulation indicators, checks provenance metadata
- responseSchema: Validates and formats API responses

**DynamoDB**:
- Stores analysis records indexed by request_id (UUID)
- Contains request payload, response payload, and timestamps
- Optional TTL for automatic cleanup

**AWS Bedrock**:
- Nova 2 Lite: Claim extraction, evidence synthesis, label determination
- Nova Embeddings: Document embedding for RAG retrieval

**S3 (Optional)**:
- Stores uploaded media files for analysis
- Provides URLs for media access

### Data Flow

1. User activates extension or submits content via Web UI
2. Background service worker executes on-demand extraction function using chrome.scripting.executeScript() with activeTab permission
3. Extraction function extracts page data (title, URL, text, image). If extraction fails (e.g., SPA, dynamic content, CSP restrictions), show user-friendly error message and suggest manual text paste as alternative
4. Service worker or Web UI sends POST /analyze request
5. API Gateway invokes Lambda function
6. Lambda validates request and generates request_id
7. Client immediately renders progress timeline with all stages in "pending" status
8. extractionService identifies 1-5 claims (progress stage: "Extracting claims" → "completed")
9. searchClient retrieves candidate sources (5+ per claim) (progress stage: "Finding better coverage" → "completed")
10. scoringService ranks sources (progress stage: "Ranking sources" → "completed")
11. ragService chunks documents, generates embeddings, and retrieves top 5 relevant chunks (progress stage: "Retrieving evidence" → "completed")
12. scoringService returns 0-3 sources; when 2+ sources returned, must be from at least 2 distinct registrable domains (eTLD+1). If 0-2 sources, returns "Unverified" with low confidence (30-40)
13. mediaCheckService analyzes image if provided (progress stage: "Media check" → "completed")
14. novaClient synthesizes evidence and determines status label (progress stage: "Synthesizing report" → "completed")
15. novaClient generates recommendation based on SIFT framework
16. Lambda stores record in DynamoDB
17. Lambda returns formatted response with request_id and completed progress_stages
18. Client updates progress timeline with completed timestamps and displays results (popup for quick check, Web UI for detailed report)

## Components and Interfaces

### Chrome Extension Structure

```
extension/
├── manifest.json              # MV3 manifest
├── package.json               # Dependencies and build scripts
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite build configuration for MV3
├── src/
│   ├── extractionFunction.ts  # On-demand page content extraction
│   ├── background.ts          # Service worker for API communication
│   ├── popup/
│   │   ├── popup.html         # Popup UI structure
│   │   ├── popup.ts           # Popup logic and rendering
│   │   └── popup.css          # Popup styling
│   ├── types/
│   │   └── api.ts             # TypeScript interfaces for API contracts
│   └── utils/
│       ├── extraction.ts      # Content extraction utilities
│       └── api.ts             # API client with retry logic
└── dist/                      # Build output (generated)
```

**manifest.json (MV3 format)**:
```json
{
  "manifest_version": 3,
  "name": "FakeNewsOff",
  "version": "1.0.0",
  "description": "AI-powered misinformation detection",
  "permissions": ["activeTab", "storage", "scripting"],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

**Extraction Function Interface**:
```typescript
interface ExtractedContent {
  url?: string;
  title?: string;
  text?: string;
  selectedText?: string;
  imageUrl?: string;
}

interface ExtractionError {
  error: string;
  reason: 'spa_content' | 'dynamic_content' | 'csp_blocked' | 'unknown';
  suggestion: string;
}

// Extraction executed on-demand via chrome.scripting.executeScript()
// when user clicks extension icon (activeTab permission)
// Returns either extracted content or error with fallback suggestion
function extractContent(): ExtractedContent | ExtractionError;
```

**Background Service Worker Interface**:
```typescript
interface RetryConfig {
  maxRetries: 3;
  backoffMultiplier: 2;
  initialDelay: 1000; // ms
}

// Triggered when user clicks extension icon
// Executes extraction function on-demand using chrome.scripting.executeScript()
// Handles extraction failures gracefully with user-friendly messages
async function onExtensionClick(tab: chrome.tabs.Tab): Promise<void>;

// Sends request with exponential backoff retry
async function sendAnalysisRequest(
  content: ExtractedContent
): Promise<AnalysisResponse>;

// Displays error message with manual paste suggestion
async function handleExtractionError(error: ExtractionError): Promise<void>;
```

### Web UI Structure

```
web_ui/
├── package.json               # Dependencies and build scripts
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite build configuration
├── index.html                 # Entry HTML
├── src/
│   ├── App.tsx                # Main application component
│   ├── main.tsx               # React entry point
│   ├── components/
│   │   ├── InputForm.tsx      # URL/text/image input
│   │   ├── ProgressTimeline.tsx  # Progress stages visualization
│   │   ├── ResultsDisplay.tsx    # Analysis results
│   │   ├── SourceCard.tsx     # Individual source display
│   │   └── ShareCard.tsx      # Share card generator
│   ├── api/
│   │   └── client.ts          # API client
│   ├── types/
│   │   └── api.ts             # TypeScript interfaces
│   └── styles/
│       └── main.css           # Global styles
└── dist/                      # Build output (generated)
```

**Web UI Components**:
- InputForm: Accepts URL, text, and optional image upload
- ProgressTimeline: Renders progress_stages as visual timeline
- ResultsDisplay: Shows status label, confidence, recommendation, SIFT guidance
- SourceCard: Displays individual source with snippet and "why" explanation
- ShareCard: Generates formatted text for sharing

### Backend Structure

```
backend/
├── package.json               # Dependencies and build scripts
├── tsconfig.json              # TypeScript configuration
├── src/
│   ├── handler.ts             # Lambda entry point
│   ├── services/
│   │   ├── extractionService.ts   # Claim extraction
│   │   ├── searchClient.ts        # Search API integration
│   │   ├── ragService.ts          # RAG pipeline
│   │   ├── scoringService.ts      # Source ranking
│   │   ├── novaClient.ts          # Bedrock Nova client
│   │   ├── mediaCheckService.ts   # Media verification
│   │   └── responseSchema.ts      # Response validation
│   ├── types/
│   │   └── api.ts             # TypeScript interfaces
│   ├── utils/
│   │   ├── validation.ts      # Request validation
│   │   ├── uuid.ts            # UUID generation
│   │   └── dynamodb.ts        # DynamoDB operations
│   └── prompts/
│       ├── claimExtraction.ts     # Claim extraction prompt
│       ├── queryGeneration.ts     # Search query prompt
│       ├── evidenceSynthesis.ts   # Evidence analysis prompt
│       └── labelRecommendation.ts # Label + recommendation prompt
├── infra/
│   └── template.yaml          # SAM template
└── dist/                      # Build output (generated)
```

### API Contracts

**POST /analyze**

Request:
```typescript
interface AnalysisRequest {
  url?: string;           // Optional: page URL
  text?: string;          // Optional: text content
  title?: string;         // Optional: page title
  imageUrl?: string;      // Optional: image URL
  selectedText?: string;  // Optional: user-selected text
}
```

Request JSON Example:
```json
{
  "url": "https://example.com/article",
  "text": "Full article text...",
  "title": "Article Title",
  "imageUrl": "https://example.com/image.jpg",
  "selectedText": "User selected this text"
}
```

Response:
```typescript
interface AnalysisResponse {
  request_id: string;                    // UUID
  status_label: StatusLabel;             // Classification result
  confidence_score: number;              // 0-100
  recommendation: string;                // Actionable guidance
  progress_stages: ProgressStage[];      // Analysis steps
  sources: CredibleSource[];             // 2-3 sources, ≥2 distinct domains
  media_risk: MediaRisk | null;          // Media analysis result
  misinformation_type: string | null;    // FirstDraft type
  sift_guidance: string;                 // SIFT framework guidance
  timestamp: string;                     // ISO8601
}

type StatusLabel = 
  | "Supported" 
  | "Disputed" 
  | "Unverified" 
  | "Manipulated" 
  | "Biased framing";

type MediaRisk = "low" | "medium" | "high";

interface ProgressStage {
  stage: string;                         // Stage name
  status: "completed" | "in_progress" | "pending";
  timestamp: string | null;              // ISO8601 or null for pending stages
}

// Progress stages are rendered immediately client-side with all stages in "pending" status
// Backend returns completed progress_stages in final response with timestamps
// Client updates timeline as stages complete
// Optional /status polling endpoint can provide live updates during processing

interface CredibleSource {
  url: string;                           // Source URL
  title: string;                         // Source title
  snippet: string;                       // Evidence snippet (excerpt or paraphrase with attribution)
  why: string;                           // Relevance explanation
  domain: string;                        // Registrable domain (eTLD+1)
}

// Sources: 0-3 sources returned
// When 2+ sources returned: must be from at least 2 distinct registrable domains (eTLD+1)
// When 0-2 sources: system returns "Unverified" status with low confidence (30-40)
```

Response JSON Example:
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "status_label": "Disputed",
  "confidence_score": 85,
  "recommendation": "Do not share yet. Multiple credible sources contradict the main claim. Check original sources before sharing.",
  "progress_stages": [
    {
      "stage": "Extracting claims",
      "status": "completed",
      "timestamp": "2024-01-15T10:30:00Z"
    },
    {
      "stage": "Finding better coverage",
      "status": "completed",
      "timestamp": "2024-01-15T10:30:05Z"
    },
    {
      "stage": "Ranking sources",
      "status": "completed",
      "timestamp": "2024-01-15T10:30:08Z"
    },
    {
      "stage": "Retrieving evidence",
      "status": "completed",
      "timestamp": "2024-01-15T10:30:15Z"
    },
    {
      "stage": "Media check",
      "status": "completed",
      "timestamp": "2024-01-15T10:30:20Z"
    },
    {
      "stage": "Synthesizing report",
      "status": "completed",
      "timestamp": "2024-01-15T10:30:25Z"
    }
  ],
  "sources": [
    {
      "url": "https://reuters.com/article/fact-check",
      "title": "Fact Check: Claim about X is false",
      "snippet": "Our investigation found no evidence supporting the claim that...",
      "why": "Reuters fact-checking team directly investigated this claim",
      "domain": "reuters.com"
    },
    {
      "url": "https://apnews.com/article/verification",
      "title": "AP verifies: Statement contradicts official records",
      "snippet": "Official records show that the actual figure was...",
      "why": "AP News verified against primary source documents",
      "domain": "apnews.com"
    }
  ],
  "media_risk": "low",
  "misinformation_type": "Misleading Content",
  "sift_guidance": "Stop: Don't share immediately. Investigate the source: Check if Reuters and AP News are credible (they are). Find better coverage: Both sources contradict the claim. Trace claims: Original claim lacks primary source evidence.",
  "timestamp": "2024-01-15T10:30:25Z"
}
```

**GET /status/{request_id}** (Optional)

Response:
```typescript
interface StatusResponse {
  request_id: string;
  progress_stages: ProgressStage[];
  status: "processing" | "completed" | "failed";
}
```

Response JSON Example:
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "progress_stages": [
    {
      "stage": "Extracting claims",
      "status": "completed",
      "timestamp": "2024-01-15T10:30:00Z"
    },
    {
      "stage": "Finding better coverage",
      "status": "in_progress",
      "timestamp": "2024-01-15T10:30:05Z"
    },
    {
      "stage": "Ranking sources",
      "status": "pending",
      "timestamp": null
    }
  ],
  "status": "processing"
}
```

## Data Models

### DynamoDB Table Schema

**Table Name**: `fakenews-off-analysis-records`

**Primary Key**:
- Partition Key: `request_id` (String, UUID)

**Attributes**:
```typescript
interface AnalysisRecord {
  request_id: string;              // PK: UUID
  request: AnalysisRequest;        // Original request payload
  response: AnalysisResponse;      // Analysis response payload
  created_at: string;              // ISO8601 timestamp
  updated_at: string;              // ISO8601 timestamp
  ttl?: number;                    // Optional: Unix timestamp for auto-deletion
}
```

**TTL Configuration (Optional)**:
- Attribute: `ttl`
- Behavior: Automatically delete records after 30 days
- Calculation: `created_at + 30 days`

### Internal Data Structures

**Extracted Claims**:
```typescript
interface ExtractedClaim {
  text: string;                    // Claim text
  confidence: number;              // 0-1 confidence
  category: "factual" | "opinion"; // Claim type
}

interface ClaimExtractionResult {
  claims: ExtractedClaim[];        // 1-5 claims
  summary: string;                 // Content summary
}
```

**Search Results**:
```typescript
interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  domain: string;
  publishDate?: string;
}

interface SearchResponse {
  results: SearchResult[];         // 5+ results per claim
  query: string;
}
```

**RAG Chunks**:
```typescript
interface DocumentChunk {
  text: string;                    // Chunk text (≤512 tokens)
  embedding: number[];             // Embedding vector
  sourceUrl: string;               // Source URL
  chunkIndex: number;              // Position in document
}

interface RetrievalResult {
  chunks: DocumentChunk[];         // Up to 5 chunks (1-5 based on availability)
  similarityScores: number[];      // Cosine similarity scores
}
```

**Scored Sources**:
```typescript
interface ScoredSource {
  url: string;
  title: string;
  snippet: string;
  why: string;                     // Relevance explanation
  domain: string;                  // Registrable domain (eTLD+1)
  credibilityScore: number;        // 0-100
  isDuplicate: boolean;
}

interface ScoringResult {
  rankedSources: ScoredSource[];   // 0-3 sources; when 2+ sources, from ≥2 distinct registrable domains (eTLD+1)
  totalCandidates: number;
}
```

**Media Analysis**:
```typescript
interface MediaAnalysisResult {
  risk: "low" | "medium" | "high";
  indicators: string[];            // Detected manipulation indicators
  provenanceData?: {
    hasC2PA: boolean;
    issuer?: string;
    timestamp?: string;
  };
  confidence: number;              // 0-100
}
```

**FirstDraft Misinformation Types**:
```typescript
type MisinformationType =
  | "Satire or Parody"
  | "Misleading Content"
  | "Imposter Content"
  | "Fabricated Content"
  | "False Connection"
  | "False Context"
  | "Manipulated Content"
  | null;  // When not applicable
```


## Nova Prompt Strategy

The system uses AWS Bedrock Nova 2 Lite for multiple analysis stages. Each stage has a specific prompt template designed to enforce requirements and maintain neutrality.

### 1. Claim Extraction Prompt

**Purpose**: Identify 1-5 factual claims from content

**Template**:
```
You are a fact-checking assistant. Analyze the following content and extract factual claims that can be verified.

Content Title: {title}
Content Text: {text}
Selected Text: {selectedText}

Instructions:
1. Identify factual claims (statements that can be verified as true or false)
2. Extract between 1 and 5 primary claims
3. Ignore opinions, predictions, and subjective statements
4. Focus on claims that are specific and verifiable
5. Return claims in order of importance

Return your response as JSON:
{
  "claims": [
    {
      "text": "The specific claim text",
      "confidence": 0.95,
      "category": "factual"
    }
  ],
  "summary": "Brief summary of the content"
}
```

**Constraints**:
- Must return 1-5 claims (no more, no less)
- Each claim must be independently verifiable
- Confidence score between 0 and 1
- Complete within 5 seconds

### 2. Search Query Generation Prompt

**Purpose**: Convert claims into effective search queries

**Template**:
```
You are a search query expert. Convert the following claims into effective search queries for finding credible sources.

Claims:
{claims}

Instructions:
1. Generate 1-2 search queries per claim
2. Focus on finding fact-checks, primary sources, and authoritative coverage
3. Include key entities, dates, and specific details
4. Optimize for finding contradictory and supporting evidence

Return your response as JSON:
{
  "queries": [
    {
      "claim": "Original claim text",
      "searchQuery": "optimized search query",
      "intent": "fact-check" | "primary-source" | "news-coverage"
    }
  ]
}
```

**Constraints**:
- Generate queries that find diverse perspectives
- Prioritize fact-checking sites and primary sources
- Include temporal context when relevant

### 3. Evidence Synthesis Prompt

**Purpose**: Analyze retrieved sources and synthesize evidence

**Template**:
```
You are a neutral fact-checking analyst. Analyze the following sources and synthesize evidence about the claims.

Original Claims:
{claims}

Retrieved Sources:
{sources}

Retrieved Evidence Chunks:
{ragChunks}

Instructions:
1. Analyze how each source relates to the claims
2. Identify supporting and contradicting evidence
3. Note the credibility and relevance of each source
4. Distinguish between factual errors and bias/framing
5. Maintain strict neutrality - do not advocate for any position
6. If evidence is mixed or unclear, acknowledge uncertainty

For each source, extract:
- A relevant snippet (either a very short excerpt when permitted OR a paraphrased summary, always with URL attribution)
- A "why" explanation (why this source is relevant to the claim)

Return your response as JSON:
{
  "synthesis": "Overall evidence assessment",
  "sourceAnalysis": [
    {
      "url": "source URL",
      "title": "source title",
      "snippet": "relevant evidence snippet",
      "why": "explanation of relevance",
      "stance": "supports" | "contradicts" | "neutral" | "unclear",
      "credibility": "high" | "medium" | "low"
    }
  ],
  "evidenceStrength": "strong" | "moderate" | "weak" | "insufficient"
}
```

**Constraints**:
- Must analyze all provided sources
- Snippet is either a very short excerpt when permitted OR a paraphrased summary, always with URL attribution
- Why field must explain specific relevance to claims
- Must distinguish bias from falsity
- Complete within 15 seconds

### 4. Label and Recommendation Prompt

**Purpose**: Determine status label, misinformation type, and generate recommendation

**Template**:
```
You are a neutral fact-checking system. Based on the evidence synthesis, determine the appropriate classification and recommendation.

Claims:
{claims}

Evidence Synthesis:
{synthesis}

Source Analysis:
{sourceAnalysis}

Media Analysis:
{mediaAnalysis}

Instructions:

STATUS LABEL - Choose exactly one:
1. "Supported" - Multiple credible sources confirm the claims with strong evidence
2. "Disputed" - Multiple credible sources contradict the claims with strong evidence
3. "Unverified" - Insufficient credible sources to confirm or deny
4. "Manipulated" - Evidence of media manipulation or fabricated content
5. "Biased framing" - Content is factually accurate but uses selective framing or bias (NOT false)

IMPORTANT: Distinguish between bias/framing and factual falsity. If content is biased but factually accurate, use "Biased framing", not "Disputed".

MISINFORMATION TYPE - If applicable, classify using FirstDraft's 7 types:
1. "Satire or Parody" - No intention to harm but potential to fool
2. "Misleading Content" - Misleading use of information to frame an issue or individual
3. "Imposter Content" - Impersonation of genuine sources
4. "Fabricated Content" - 100% false content designed to deceive
5. "False Connection" - Headlines, visuals, or captions don't support the content
6. "False Context" - Genuine content shared with false contextual information
7. "Manipulated Content" - Genuine information or imagery manipulated to deceive
8. null - If none apply or content is supported

CONFIDENCE SCORE:
- Calculate 0-100 based on:
  * Number of credible sources (more = higher)
  * Agreement between sources (consensus = higher)
  * Source credibility (authoritative = higher)
  * Evidence strength (direct = higher)
  * Domain diversity (≥2 distinct domains required)

RECOMMENDATION - Generate actionable guidance using SIFT framework:
- "Do not share yet" - for Disputed or Manipulated
- "Verify before sharing" - for Unverified
- "Check original source" - for False Context or Misleading Content
- "Read better coverage" - for Biased framing
- "Safe to share with context" - for Supported with caveats
- Avoid partisan language, maintain educational tone

SIFT GUIDANCE - Provide specific SIFT framework guidance:
- Stop: Remind user not to share immediately
- Investigate the source: Assess source credibility
- Find better coverage: Point to credible sources found
- Trace claims: Identify original source or lack thereof

Return your response as JSON:
{
  "status_label": "Supported" | "Disputed" | "Unverified" | "Manipulated" | "Biased framing",
  "confidence_score": 85,
  "misinformation_type": "Misleading Content" | null,
  "recommendation": "Specific actionable guidance",
  "sift_guidance": "Detailed SIFT framework application",
  "reasoning": "Brief explanation of classification decision"
}
```

**Constraints**:
- Must choose exactly one status label
- Must enforce 2-3 sources from ≥2 distinct registrable domains (eTLD+1)
- Confidence score must be 0-100
- Must distinguish bias from falsity
- Must maintain neutrality in language
- Must provide actionable recommendation
- Must apply SIFT framework explicitly
- Complete within 10 seconds

### Source Ranking and Selection Rules

The scoring service applies these rules before sources reach the Nova prompt:

**Domain Diversity**:
- Require at least 2 distinct registrable domains (eTLD+1) in final source set
- Example: reuters.com and apnews.com (valid), news.bbc.co.uk and www.bbc.co.uk both resolve to bbc.co.uk (invalid - same registrable domain)
- Extract registrable domain using Public Suffix List (eTLD+1): both "news.bbc.co.uk" and "www.bbc.co.uk" → "bbc.co.uk"

**Primary Source Preference**:
- Prioritize original reporting over aggregation
- Score boost for: government documents, academic papers, official statements
- Score boost for: investigative journalism, on-the-ground reporting
- Score penalty for: content farms, aggregators, social media

**Credibility Scoring Algorithm**:
```typescript
function calculateCredibilityScore(source: SearchResult): number {
  let score = 50; // Base score
  
  // Domain authority (0-30 points)
  if (isFactCheckingSite(source.domain)) score += 30;
  else if (isNewsAgency(source.domain)) score += 25;
  else if (isAcademicSource(source.domain)) score += 28;
  else if (isGovernmentSource(source.domain)) score += 27;
  else if (isEstablishedMedia(source.domain)) score += 20;
  
  // Recency (0-10 points)
  const daysSincePublish = getDaysSince(source.publishDate);
  if (daysSincePublish < 7) score += 10;
  else if (daysSincePublish < 30) score += 7;
  else if (daysSincePublish < 90) score += 5;
  
  // Content quality (0-10 points)
  if (hasDetailedEvidence(source.snippet)) score += 10;
  else if (hasModerateDetail(source.snippet)) score += 6;
  
  return Math.min(score, 100);
}

function extractRegistrableDomain(url: string): string {
  // Use Public Suffix List to extract eTLD+1 (registrable domain)
  // Example: "news.bbc.co.uk" → "bbc.co.uk"
  // Example: "www.reuters.com" → "reuters.com"
  const parsed = new URL(url);
  return psl.get(parsed.hostname); // Using 'psl' library
}
```

**Deduplication Rules**:
- Remove sources with identical registrable domains (eTLD+1)
- Keep highest-scoring source per registrable domain
- If tie, prefer more recent publication

**Final Selection**:
- Return 0-3 highest-scoring sources
- When returning 2+ sources: ensure at least 2 distinct registrable domains (eTLD+1)
- If insufficient distinct domains found (0-2 sources):
  * Set status_label = "Unverified"
  * Set confidence_score = low (30-40)
  * Use SIFT-based recommendation: "Verify before sharing" or "Find better coverage"
  * Return up to 1-2 sources if found
  * Clearly indicate "insufficient independent coverage" in response

### Media Check Approach

**Heuristic Checks**:
```typescript
interface ManipulationIndicators {
  // Visual inconsistencies
  edgeArtifacts: boolean;          // Unnatural edges or boundaries
  lightingInconsistencies: boolean; // Inconsistent lighting/shadows
  compressionAnomalies: boolean;    // Unusual compression patterns
  
  // Metadata checks
  missingExifData: boolean;         // No camera metadata
  modifiedTimestamp: boolean;       // Timestamp inconsistencies
  
  // Provenance
  hasC2PA: boolean;                 // Content Credentials present
  c2paValid: boolean;               // C2PA signature valid
}
```

**Risk Assessment Logic**:
```typescript
function assessMediaRisk(indicators: ManipulationIndicators): MediaRisk {
  let riskScore = 0;
  
  // High-risk indicators (+30 each)
  if (indicators.edgeArtifacts) riskScore += 30;
  if (indicators.lightingInconsistencies) riskScore += 30;
  
  // Medium-risk indicators (+20 each)
  if (indicators.compressionAnomalies) riskScore += 20;
  if (indicators.modifiedTimestamp) riskScore += 20;
  
  // Low-risk indicators (+10 each)
  if (indicators.missingExifData) riskScore += 10;
  
  // Provenance reduces risk
  if (indicators.hasC2PA && indicators.c2paValid) riskScore -= 40;
  
  if (riskScore >= 50) return "high";
  if (riskScore >= 25) return "medium";
  return "low";
}
```

**Safe Language Rules**:
- Never say "this is fake" or "this is real"
- Use "possible manipulation indicators detected"
- Use "no obvious manipulation indicators found"
- Acknowledge limitations: "This is a preliminary assessment"
- Recommend expert verification for high-risk cases

**Provenance Check**:
- Check for C2PA (Content Credentials) metadata
- Verify signature if present
- Extract issuer and timestamp information
- Note: C2PA presence increases confidence but doesn't guarantee authenticity


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified several areas of redundancy:

1. **UI Rendering Properties**: Many criteria (3.1-3.5, 3A.5-3A.10, 3D.4-3D.5) test that specific fields are displayed. These can be consolidated into comprehensive properties that verify all required fields are present.

2. **Service Timing Properties**: Multiple criteria specify timing constraints (1.6, 5.3, 6.9, 7.3, 8.4, 9.6, 10.5, 11.4). These are environment-dependent and better tested as integration tests rather than unit properties.

3. **Build Process Properties**: Criteria 13.1-13.4 and 14.1-14.4 test build processes. These can be consolidated into properties that verify build outputs rather than individual steps.

4. **Prompt Content Properties**: Criteria 6.2-6.7 all test that prompts contain specific requirements. These can be consolidated into a single comprehensive property.

5. **Duplicate Navigation**: Criteria 3.8 and 3C.3 are identical (opening Web UI with request_id).

6. **Documentation Existence**: Criteria 17.1-17.9 all test documentation existence. These are better as examples rather than individual properties.

The following properties represent the unique, testable behaviors after eliminating redundancy:

### Property 1: Content Extraction Completeness

*For any* web page with standard HTML structure, extracting content should return all available fields (title, URL, text, selectedText, imageUrl) that are present in the page.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

### Property 2: Analysis Request Construction

*For any* extracted content, constructing an Analysis_Request payload should produce a valid JSON object that conforms to the API contract schema.

**Validates: Requirements 2.1**

### Property 3: Retry with Exponential Backoff

*For any* failed API request, the service worker should retry up to 3 times with exponentially increasing delays (1s, 2s, 4s) before giving up.

**Validates: Requirements 2.3**

### Property 4: Error Propagation

*For any* API error after all retries are exhausted, the service worker should forward an error message to the popup UI.

**Validates: Requirements 2.5**

### Property 5: Popup UI Completeness

*For any* valid Analysis_Response, the popup UI should display all required fields: status_label, confidence_score, sources (0-3 sources; when 2+ sources, from ≥2 distinct registrable domains using eTLD+1), sift_guidance, and recommendation.

**Validates: Requirements 3.1, 3.3, 3.4, 3.5, 3D.5**

### Property 6: Conditional Misinformation Type Display

*For any* Analysis_Response where misinformation_type is not null, the popup UI should display the misinformation type classification.

**Validates: Requirements 3.2**

### Property 7: Safe Media Language

*For any* Analysis_Response with media_risk present, the UI should use cautious language (e.g., "possible manipulation indicators") and avoid absolute statements like "this is fake".

**Validates: Requirements 3.6, 3B.6**

### Property 8: Share Card Generation

*For any* Analysis_Response, generating a share card should produce a formatted text string containing status_label, confidence_score, and recommendation.

**Validates: Requirements 3.7**

### Property 9: Web UI Navigation with Request ID

*For any* request_id, opening the full report should navigate to the Web UI with the request_id as a URL parameter.

**Validates: Requirements 3.8, 3C.3**

### Property 10: Web UI Completeness

*For any* valid Analysis_Response, the Web UI should display all required fields: status_label, confidence_score, sources (0-3 sources; when 2+ sources, from ≥2 distinct registrable domains using eTLD+1 with snippet and why fields), sift_guidance, recommendation, and progress_stages as a timeline.

**Validates: Requirements 3A.5, 3A.6, 3A.7, 3A.9, 3A.10, 3B.2, 3D.4**

### Property 11: Request ID Retrieval

*For any* request_id stored in DynamoDB, the Web UI should be able to retrieve and display the corresponding analysis results.

**Validates: Requirements 3A.12**

### Property 12: Progress Stages Inclusion

*For any* Analysis_Response, the response should include progress_stages array with all analysis steps (extracting claims, finding better coverage, ranking sources, retrieving evidence, media check, synthesizing report).

**Validates: Requirements 3B.1**

### Property 13: Request Validation

*For any* malformed or invalid Analysis_Request, the Lambda function should return an error response with status code 400 and a descriptive message.

**Validates: Requirements 4.2, 4.3, 12.2**

### Property 14: UUID Generation Uniqueness

*For any* two consecutive analysis requests, the generated request_ids should be valid UUIDs and distinct from each other.

**Validates: Requirements 4.4**

### Property 15: Successful Response Structure

*For any* valid analysis request, the Lambda function should return an Analysis_Response with status code 200 containing a request_id field.

**Validates: Requirements 4.6**

### Property 16: Claim Count Constraint

*For any* content with verifiable claims, the Extraction_Service should return between 1 and 5 claims (inclusive).

**Validates: Requirements 5.2**

### Property 17: Empty Claims Handling

*For any* content without verifiable factual claims (e.g., pure opinion pieces), the Extraction_Service should return an empty claims list.

**Validates: Requirements 5.4**

### Property 18: Nova Prompt Completeness

*For any* request to Nova 2 Lite, the prompt should include all required elements: SIFT framework guidance, FirstDraft 7 types, status label options (Supported, Disputed, Unverified, Manipulated, Biased framing), source requirements (2-3 from ≥2 distinct registrable domains using eTLD+1), snippet and why field requirements, and recommendation generation instructions.

**Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**

### Property 19: Nova Response Parsing

*For any* valid JSON response from AWS Bedrock, the Nova_Client should parse it into a structured analysis object with all required fields.

**Validates: Requirements 6.8**

### Property 20: Search Result Count

*For any* extracted claim, the Search_Client should retrieve at least 5 candidate sources.

**Validates: Requirements 7.2**

### Property 21: Search Fallback

*For any* search API failure, if cached results are available, the Search_Client should return cached results instead of failing.

**Validates: Requirements 7.4**

### Property 22: RAG Chunk Size Constraint

*For any* source document, all chunks produced by the RAG_Service should contain 512 tokens or fewer.

**Validates: Requirements 8.1**

### Property 23: RAG Retrieval Count

*For any* query to the RAG_Service, up to 5 chunks should be retrieved based on embedding similarity (1-5 chunks depending on availability).

**Validates: Requirements 8.3**

### Property 24: Source Deduplication

*For any* set of candidate sources with duplicate registrable domains (eTLD+1), the Scoring_Service should remove duplicates and keep only the highest-scoring source per registrable domain.

**Validates: Requirements 9.2**

### Property 25: Source Count and Domain Diversity

*For any* set of scored sources, the Scoring_Service should return 0-3 sources; when 2+ sources are returned, they must be from at least 2 distinct registrable domains (eTLD+1). If insufficient distinct domains are found (0-2 sources), return "Unverified" status with low confidence (30-40) and up to 1-2 sources with appropriate SIFT-based guidance.

**Validates: Requirements 9.3**

### Property 26: Source Field Completeness

*For any* source returned by the Scoring_Service, the source should include all required fields: url, title, snippet (either a very short excerpt when permitted OR a paraphrased summary, always with URL attribution), why, and domain (registrable domain using eTLD+1).

**Validates: Requirements 9.4, 9.5**

### Property 27: Media Risk Assessment Values

*For any* media analysis result, the risk assessment should be one of the valid values: "low", "medium", or "high".

**Validates: Requirements 10.3**

### Property 28: Media Analysis Skipping

*For any* Analysis_Request without an imageUrl field, the Media_Check_Service should skip analysis and return null for media_risk.

**Validates: Requirements 10.4**

### Property 29: DynamoDB Storage Round Trip

*For any* Analysis_Request and Analysis_Response pair, storing them in DynamoDB and then retrieving by request_id should return equivalent objects.

**Validates: Requirements 11.1, 11.2**

### Property 30: Timestamp Inclusion

*For any* record stored in DynamoDB, the record should include both created_at and updated_at timestamps in ISO8601 format.

**Validates: Requirements 11.3**

### Property 31: JSON Serialization Round Trip

*For any* valid Analysis_Response object, serializing to JSON and then parsing should produce an equivalent object.

**Validates: Requirements 12.4**

### Property 32: Response Schema Conformance

*For any* Analysis_Response, the response should conform to the API contract schema with all required fields present and correctly typed.

**Validates: Requirements 12.3**

### Property 33: Extension Build Output Validity

*For any* successful extension build, the output should include a valid manifest.json file conforming to Chrome MV3 specification.

**Validates: Requirements 13.3**

### Property 34: Lambda Build Output Validity

*For any* successful Lambda build, the output should be a valid deployment package that can be uploaded to AWS Lambda.

**Validates: Requirements 14.3**

### Property 35: File Preservation

*For any* existing README.md, LICENSE, or .gitignore file, project initialization should not overwrite these files.

**Validates: Requirements 16.1, 16.2, 16.3**

### Property 36: README Augmentation

*For any* existing README.md file, project initialization should append a "Development" section without removing existing content.

**Validates: Requirements 16.4**

### Property 37: Neutral Language in Responses

*For any* Analysis_Response, the response text (recommendation, sift_guidance) should not contain partisan language or phrases that advocate for specific political viewpoints.

**Validates: Requirements 18.1, 18.3**

### Property 38: Bias vs Falsity Distinction

*For any* content that is factually accurate but uses selective framing or bias, the system should classify it as "Biased framing" rather than "Disputed".

**Validates: Requirements 18.2, 18.4**

### Property 39: Recommendation Phrase Conformance

*For any* Analysis_Response, the recommendation should use appropriate SIFT-based phrases such as "Do not share yet", "Verify before sharing", "Check original source", "Read better coverage", or "Safe to share with context".

**Validates: Requirements 3D.2, 3D.3**

### Property 40: Web UI Static Build Output

*For any* successful Web UI build, the output should consist of static HTML, CSS, and JavaScript files that can be served without a backend server.

**Validates: Requirements 19.2**

### Property 41: API Endpoint Consistency

*For any* API request from either the Extension or Web UI, both should call the same /analyze endpoint with the same request format.

**Validates: Requirements 19.4**


## Error Handling

### Error Categories

**1. Client-Side Errors (Extension/Web UI)**

**Network Errors**:
- Scenario: API Gateway unreachable, timeout, or network failure
- Handling: Retry up to 3 times with exponential backoff (1s, 2s, 4s)
- User Message: "Unable to connect to analysis service. Please check your internet connection and try again."
- Recovery: Allow user to retry manually

**Invalid Input Errors**:
- Scenario: User submits empty content or unsupported format
- Handling: Validate input before sending to API
- User Message: "Please provide a URL or text content to analyze."
- Recovery: Highlight invalid fields, allow correction

**Timeout Errors**:
- Scenario: Analysis takes longer than 30 seconds
- Handling: Display progress indicator, poll /status endpoint if available
- User Message: "Analysis is taking longer than expected. Please wait..."
- Recovery: Continue polling or allow cancellation

**2. API Gateway Errors**

**400 Bad Request**:
- Scenario: Malformed JSON, missing required fields, invalid data types
- Response: `{"error": "Invalid request", "details": "Missing required field: text or url"}`
- HTTP Status: 400
- Handling: Return descriptive error message

**429 Too Many Requests**:
- Scenario: Rate limit exceeded
- Response: `{"error": "Rate limit exceeded", "retry_after": 60}`
- HTTP Status: 429
- Handling: Include Retry-After header

**500 Internal Server Error**:
- Scenario: Lambda function crashes or times out
- Response: `{"error": "Internal server error", "request_id": "uuid"}`
- HTTP Status: 500
- Handling: Log error, return generic message to user

**3. Lambda Function Errors**

**Validation Errors**:
```typescript
class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Example usage
if (!request.url && !request.text) {
  throw new ValidationError(
    'Either url or text must be provided',
    'url,text'
  );
}
```

**Service Errors**:
```typescript
class ServiceError extends Error {
  constructor(
    message: string,
    public service: string,
    public retryable: boolean
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

// Example usage
try {
  const claims = await extractionService.extract(content);
} catch (error) {
  throw new ServiceError(
    'Failed to extract claims',
    'extractionService',
    true
  );
}
```

**Timeout Errors**:
```typescript
class TimeoutError extends Error {
  constructor(message: string, public service: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

// Example usage with timeout wrapper
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  service: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new TimeoutError(`${service} timed out`, service)),
      timeoutMs
    )
  );
  return Promise.race([promise, timeout]);
}
```

**4. External Service Errors**

**AWS Bedrock Errors**:
- Scenario: Model unavailable, throttling, invalid prompt
- Handling: Retry with backoff for throttling, fail fast for invalid prompts
- Logging: Log full error details for debugging
- User Impact: Return "Analysis temporarily unavailable" message

**Search API Errors**:
- Scenario: API key invalid, quota exceeded, service down
- Handling: Fall back to cached results if available
- Logging: Log error and trigger alert
- User Impact: Proceed with limited sources or return "Unable to retrieve sources"

**DynamoDB Errors**:
- Scenario: Throttling, table not found, network error
- Handling: Retry with exponential backoff for throttling
- Logging: Log error details
- User Impact: Analysis completes but storage fails (non-blocking)

**5. Data Quality Errors**

**No Claims Found**:
- Scenario: Content contains no verifiable factual claims
- Handling: Return response with empty claims list
- User Message: "No verifiable factual claims found in this content. This may be opinion, satire, or purely descriptive content."
- Status Label: "Unverified"

**Insufficient Sources**:
- Scenario: Search returns fewer than 2 distinct registrable domain (eTLD+1) sources
- Handling: Return response with fallback behavior instead of error
- Status Label: "Unverified"
- Confidence Score: Low (30-40)
- Recommendation: Use SIFT phrases like "Verify before sharing" or "Find better coverage"
- Sources: Return 0-2 sources if found
- User Message: Clearly indicate "insufficient independent coverage" in the response
- Recovery: User can manually search for additional sources

**Parsing Errors**:
- Scenario: Nova returns malformed JSON or unexpected structure
- Handling: Attempt to extract partial data, fall back to defaults
- Logging: Log full response for debugging
- User Impact: Return lower confidence result or error

### Error Response Format

All API errors follow this structure:

```typescript
interface ErrorResponse {
  error: string;              // Human-readable error message
  error_code: string;         // Machine-readable error code
  details?: string;           // Additional details
  request_id?: string;        // Request ID for tracking
  retry_after?: number;       // Seconds to wait before retry (for 429)
  timestamp: string;          // ISO8601 timestamp
}
```

Example:
```json
{
  "error": "Analysis failed",
  "error_code": "SERVICE_UNAVAILABLE",
  "details": "AWS Bedrock service is temporarily unavailable",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:30:25Z"
}
```

### Error Logging Strategy

**CloudWatch Logs Structure**:
```typescript
interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  request_id: string;
  service: string;
  message: string;
  error?: {
    name: string;
    message: string;
    stack: string;
  };
  context?: Record<string, any>;
}
```

**Log Levels**:
- INFO: Successful operations, progress updates
- WARN: Retryable errors, fallback usage, degraded performance
- ERROR: Non-retryable errors, service failures, data corruption

**Sensitive Data Handling**:
- Never log full content text (may contain PII)
- Log only metadata: content length, URL domain, claim count
- Redact API keys and credentials
- Hash user identifiers if needed

### Graceful Degradation

**Partial Results**:
- If media check fails, proceed without media analysis
- If only 1 source found, return with low confidence and warning
- If RAG fails, proceed with direct source snippets

**Feature Flags**:
```typescript
interface FeatureFlags {
  enableMediaCheck: boolean;      // Default: true
  enableRAG: boolean;              // Default: true
  enableStatusPolling: boolean;    // Default: false
  requireMinSources: number;       // Default: 2
}
```

**Circuit Breaker Pattern**:
```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}
```

## Testing Strategy

### Dual Testing Approach

The system requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Verify specific examples, edge cases, and error conditions
- Focus on concrete scenarios with known inputs and outputs
- Test integration points between components
- Validate error handling and edge cases
- Quick to run and easy to debug

**Property-Based Tests**: Verify universal properties across all inputs
- Test properties that should hold for any valid input
- Use randomized input generation to find edge cases
- Require minimum 100 iterations per test
- Catch unexpected bugs through comprehensive input coverage

Both approaches are complementary and necessary. Unit tests catch specific bugs and validate concrete behavior, while property tests verify general correctness across the input space.

### Property-Based Testing Configuration

**Library Selection**:
- TypeScript/JavaScript: fast-check
- Python (if used): Hypothesis
- Minimum 100 iterations per property test
- Seed-based reproducibility for failed tests

**Test Tagging Format**:
Each property test must reference its design document property:

```typescript
import fc from 'fast-check';

// Feature: fakenews-off, Property 16: Claim Count Constraint
test('extraction service returns 1-5 claims for any content with claims', () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 100 }), // Generate random content
      async (content) => {
        const result = await extractionService.extract(content);
        expect(result.claims.length).toBeGreaterThanOrEqual(1);
        expect(result.claims.length).toBeLessThanOrEqual(5);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Test Strategy

**Test Organization**:
```
backend/
├── src/
│   ├── services/
│   │   ├── extractionService.ts
│   │   └── extractionService.test.ts
│   ├── handler.ts
│   └── handler.test.ts
└── tests/
    ├── integration/
    │   ├── api.test.ts
    │   └── dynamodb.test.ts
    └── e2e/
        └── fullFlow.test.ts

extension/
├── src/
│   ├── contentScript.ts
│   ├── contentScript.test.ts
│   ├── background.ts
│   └── background.test.ts
└── tests/
    └── integration/
        └── extension.test.ts

web_ui/
├── src/
│   ├── components/
│   │   ├── ResultsDisplay.tsx
│   │   └── ResultsDisplay.test.tsx
│   └── App.test.tsx
└── tests/
    └── e2e/
        └── userFlow.test.ts
```

**Unit Test Examples**:

```typescript
// Example 1: Testing specific error case
describe('Lambda Handler - Validation', () => {
  test('returns 400 for request with neither url nor text', async () => {
    const request = { title: 'Test' }; // Missing url and text
    const response = await handler(request);
    
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('Either url or text must be provided');
  });
});

// Example 2: Testing edge case
describe('Scoring Service - Deduplication', () => {
  test('keeps highest-scoring source when registrable domains (eTLD+1) are identical', () => {
    const sources = [
      { url: 'https://reuters.com/article1', score: 85, domain: 'reuters.com' },
      { url: 'https://reuters.com/article2', score: 90, domain: 'reuters.com' }
    ];
    
    const result = scoringService.deduplicate(sources);
    
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://reuters.com/article2');
    expect(result[0].score).toBe(90);
  });
});

// Example 3: Testing integration point
describe('Service Worker - API Communication', () => {
  test('forwards response to popup after successful API call', async () => {
    const mockResponse = {
      request_id: 'test-uuid',
      status_label: 'Supported',
      confidence_score: 85
    };
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });
    
    const popupMessages: any[] = [];
    chrome.runtime.sendMessage = jest.fn((msg) => popupMessages.push(msg));
    
    await serviceWorker.analyzeContent({ text: 'test' });
    
    expect(popupMessages).toHaveLength(1);
    expect(popupMessages[0]).toEqual(mockResponse);
  });
});

// Example 4: Testing extraction error handling
describe('Extraction Function - Error Handling', () => {
  test('returns error with fallback suggestion when extraction fails', () => {
    // Simulate SPA with no extractable content
    document.body.innerHTML = '<div id="app"></div>';
    
    const result = extractContent();
    
    expect(result.error).toBeDefined();
    expect(result.reason).toBe('spa_content');
    expect(result.suggestion).toContain('manual text paste');
  });
});
```

### Property-Based Test Examples

```typescript
// Feature: fakenews-off, Property 1: Content Extraction Completeness
test('extracts all available fields from any HTML page or returns error with fallback', () => {
  fc.assert(
    fc.property(
      fc.record({
        title: fc.option(fc.string(), { nil: undefined }),
        url: fc.option(fc.webUrl(), { nil: undefined }),
        text: fc.option(fc.string({ minLength: 10 }), { nil: undefined }),
        imageUrl: fc.option(fc.webUrl(), { nil: undefined })
      }),
      (pageData) => {
        const html = generateHTML(pageData);
        const extracted = extractionFunction.extractContent(html);
        
        // Either successful extraction or error with fallback
        if ('error' in extracted) {
          expect(extracted.error).toBeDefined();
          expect(extracted.reason).toMatch(/spa_content|dynamic_content|csp_blocked|unknown/);
          expect(extracted.suggestion).toBeDefined();
        } else {
          // All present fields should be extracted
          if (pageData.title) expect(extracted.title).toBeDefined();
          if (pageData.url) expect(extracted.url).toBeDefined();
          if (pageData.text) expect(extracted.text).toBeDefined();
          if (pageData.imageUrl) expect(extracted.imageUrl).toBeDefined();
        }
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: fakenews-off, Property 23: RAG Retrieval Count
test('retrieves up to 5 chunks for any document', () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1000, maxLength: 10000 }),
      async (document) => {
        const chunks = await ragService.chunkDocument(document);
        const retrieved = await ragService.retrieveRelevant(chunks, 'test query');
        
        expect(retrieved.length).toBeGreaterThanOrEqual(1);
        expect(retrieved.length).toBeLessThanOrEqual(5);
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: fakenews-off, Property 25: Source Count and Domain Diversity
test('returns 0-3 sources; when 2+ sources, from at least 2 distinct domains', () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          url: fc.webUrl(),
          title: fc.string(),
          snippet: fc.string(),
          domain: fc.constantFrom('reuters.com', 'apnews.com', 'bbc.com', 'nytimes.com')
        }),
        { minLength: 5, maxLength: 20 }
      ),
      async (candidates) => {
        const result = await scoringService.rankAndSelect(candidates);
        
        expect(result.length).toBeGreaterThanOrEqual(0);
        expect(result.length).toBeLessThanOrEqual(3);
        
        // When 2+ sources returned, must have at least 2 distinct domains
        if (result.length >= 2) {
          const uniqueDomains = new Set(result.map(s => s.domain));
          expect(uniqueDomains.size).toBeGreaterThanOrEqual(2);
        }
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: fakenews-off, Property 31: JSON Serialization Round Trip
test('serializing and parsing any Analysis_Response produces equivalent object', () => {
  fc.assert(
    fc.property(
      generateAnalysisResponse(), // Custom generator
      (response) => {
        const serialized = JSON.stringify(response);
        const parsed = JSON.parse(serialized);
        
        expect(parsed).toEqual(response);
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: fakenews-off, Property 38: Bias vs Falsity Distinction
test('biased but factually accurate content gets "Biased framing" label', () => {
  fc.assert(
    fc.property(
      fc.record({
        content: fc.string({ minLength: 100 }),
        isBiased: fc.constant(true),
        isFactuallyAccurate: fc.constant(true)
      }),
      async (testCase) => {
        // Mock evidence synthesis to indicate bias but accuracy
        const mockSynthesis = {
          evidenceStrength: 'strong',
          biasDetected: true,
          factualErrors: []
        };
        
        const result = await novaClient.determineLabel(
          testCase.content,
          mockSynthesis
        );
        
        expect(result.status_label).toBe('Biased framing');
      }
    ),
    { numRuns: 100 }
  );
});
```

### Custom Generators for Property Tests

```typescript
// Generator for valid Analysis_Response
function generateAnalysisResponse(): fc.Arbitrary<AnalysisResponse> {
  return fc.record({
    request_id: fc.uuid(),
    status_label: fc.constantFrom(
      'Supported',
      'Disputed',
      'Unverified',
      'Manipulated',
      'Biased framing'
    ),
    confidence_score: fc.integer({ min: 0, max: 100 }),
    recommendation: fc.string({ minLength: 10 }),
    progress_stages: fc.array(
      fc.record({
        stage: fc.string(),
        status: fc.constantFrom('completed', 'in_progress', 'pending'),
        timestamp: fc.date().map(d => d.toISOString())
      }),
      { minLength: 1, maxLength: 6 }
    ),
    sources: fc.array(
      fc.record({
        url: fc.webUrl(),
        title: fc.string(),
        snippet: fc.string({ minLength: 20 }),
        why: fc.string({ minLength: 10 }),
        domain: fc.domain()
      }),
      { minLength: 2, maxLength: 3 }
    ),
    media_risk: fc.option(fc.constantFrom('low', 'medium', 'high')),
    misinformation_type: fc.option(
      fc.constantFrom(
        'Satire or Parody',
        'Misleading Content',
        'Imposter Content',
        'Fabricated Content',
        'False Connection',
        'False Context',
        'Manipulated Content'
      )
    ),
    sift_guidance: fc.string({ minLength: 20 }),
    timestamp: fc.date().map(d => d.toISOString())
  });
}
```

### Integration Testing

**API Integration Tests**:
- Test full request/response cycle with mocked AWS services
- Verify CORS configuration
- Test rate limiting and throttling
- Validate error responses

**DynamoDB Integration Tests**:
- Test record storage and retrieval
- Verify TTL configuration
- Test GSI queries (if implemented)
- Validate concurrent access handling

**Bedrock Integration Tests**:
- Test with actual Bedrock API (in staging environment)
- Verify prompt formatting
- Test response parsing
- Measure latency and token usage

### End-to-End Testing

**Extension E2E Tests** (using Puppeteer):
```typescript
describe('Extension E2E Flow', () => {
  test('analyzes article and displays results', async () => {
    // Load extension in test browser
    const browser = await puppeteer.launch({
      headless: false,
      args: [`--load-extension=${extensionPath}`]
    });
    
    // Navigate to test article
    const page = await browser.newPage();
    await page.goto('https://example.com/test-article');
    
    // Click extension icon
    await page.click('#extension-icon');
    
    // Wait for analysis
    await page.waitForSelector('.analysis-result', { timeout: 35000 });
    
    // Verify results displayed
    const statusLabel = await page.$eval('.status-label', el => el.textContent);
    expect(statusLabel).toMatch(/Supported|Disputed|Unverified|Manipulated|Biased framing/);
    
    const confidence = await page.$eval('.confidence-score', el => el.textContent);
    expect(parseInt(confidence)).toBeGreaterThanOrEqual(0);
    expect(parseInt(confidence)).toBeLessThanOrEqual(100);
    
    await browser.close();
  });
});
```

**Web UI E2E Tests** (using Playwright):
```typescript
describe('Web UI E2E Flow', () => {
  test('analyzes pasted text and shows detailed report', async () => {
    const { page } = await setup();
    
    // Navigate to Web UI
    await page.goto('http://localhost:3000');
    
    // Paste text
    await page.fill('#text-input', 'Test article content...');
    
    // Submit
    await page.click('#analyze-button');
    
    // Wait for progress timeline
    await page.waitForSelector('.progress-timeline');
    
    // Verify all stages complete
    const stages = await page.$$('.progress-stage.completed');
    expect(stages.length).toBeGreaterThanOrEqual(5);
    
    // Verify sources displayed
    const sources = await page.$$('.source-card');
    expect(sources.length).toBeGreaterThanOrEqual(0);
    expect(sources.length).toBeLessThanOrEqual(3);
    
    // Verify domain diversity when 2+ sources present
    if (sources.length >= 2) {
      const domains = await Promise.all(
        sources.map(s => s.$eval('.source-domain', el => el.textContent))
      );
      const uniqueDomains = new Set(domains);
      expect(uniqueDomains.size).toBeGreaterThanOrEqual(2); // At least 2 distinct registrable domains (eTLD+1)
    }
  });
});
```

### Performance Testing

**Load Testing**:
- Simulate concurrent requests to API Gateway
- Measure Lambda cold start and warm execution times
- Test DynamoDB throughput under load
- Verify auto-scaling behavior

**Performance Targets**:
- Progress indicator appears: < 500ms
- Content extraction: < 500ms
- Claim extraction: < 5s
- Search retrieval: < 10s
- RAG processing: < 8s
- Typical full analysis: 8-12s
- Maximum full analysis: < 30s (hard timeout)

### Test Coverage Goals

- Unit test coverage: ≥ 80% for all services
- Property test coverage: All 41 properties implemented
- Integration test coverage: All service boundaries
- E2E test coverage: Critical user flows (extension analysis, web UI analysis)

### Continuous Integration

**CI Pipeline**:
1. Lint and type check (TypeScript)
2. Run unit tests
3. Run property-based tests
4. Run integration tests (with LocalStack for AWS services)
5. Build extension and Lambda packages
6. Run E2E tests (in headless browser)
7. Generate coverage report
8. Deploy to staging (on main branch)

**Test Execution Time Budget**:
- Unit tests: < 2 minutes
- Property tests: < 5 minutes
- Integration tests: < 3 minutes
- E2E tests: < 5 minutes
- Total: < 15 minutes


## Deployment

### AWS Infrastructure Deployment

**SAM Template** (`backend/infra/template.yaml`):

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: FakeNewsOff Backend Infrastructure

Parameters:
  SearchApiKey:
    Type: String
    NoEcho: true
    Description: API key for external search service (passed as environment variable)
  
  EnableMediaCheck:
    Type: String
    Default: 'true'
    AllowedValues: ['true', 'false']
    Description: Enable media manipulation detection
  
  Environment:
    Type: String
    Default: 'dev'
    AllowedValues: ['dev', 'staging', 'prod']
    Description: Deployment environment
  
  AllowedOrigins:
    Type: String
    Default: '*'
    Description: Comma-separated list of allowed CORS origins (use '*' for dev, specific domains for prod)

Conditions:
  IsDevEnvironment: !Equals [!Ref Environment, 'dev']
  IsProdEnvironment: !Equals [!Ref Environment, 'prod']

Globals:
  Function:
    Timeout: 30
    MemorySize: 1024
    Runtime: nodejs20.x
    Environment:
      Variables:
        NODE_ENV: !Ref Environment

Resources:
  # API Gateway
  FakeNewsOffApi:
    Type: AWS::Serverless::Api
    Properties:
      Name: !Sub 'fakenews-off-api-${Environment}'
      StageName: !Ref Environment
      Cors:
        AllowOrigin: !If
          - IsDevEnvironment
          - "'*'"
          - !Sub "'${AllowedOrigins}'"
        AllowHeaders: "'Content-Type,X-Amz-Date,Authorization,X-Api-Key'"
        AllowMethods: "'POST,GET,OPTIONS'"
        MaxAge: "'600'"
      Auth:
        ApiKeyRequired: false
      ThrottleSettings:
        BurstLimit: 100
        RateLimit: 50

  # Lambda Function
  AnalysisFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub 'fakenews-off-analysis-${Environment}'
      CodeUri: ../dist/
      Handler: handler.handler
      Timeout: 30
      MemorySize: 1024
      Environment:
        Variables:
          TABLE_NAME: !Ref AnalysisTable
          BUCKET_NAME: !If [EnableMediaCheckCondition, !Ref MediaBucket, '']
          SEARCH_API_KEY: !Ref SearchApiKey
          ENABLE_MEDIA_CHECK: !Ref EnableMediaCheck
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref AnalysisTable
        - Statement:
            - Effect: Allow
              Action:
                - bedrock:InvokeModel
              Resource:
                - !Sub 'arn:aws:bedrock:${AWS::Region}::foundation-model/amazon.nova-lite-v1:0'
                - !Sub 'arn:aws:bedrock:${AWS::Region}::foundation-model/amazon.nova-embed-v1:0'
        - !If
          - EnableMediaCheckCondition
          - S3CrudPolicy:
              BucketName: !Ref MediaBucket
          - !Ref AWS::NoValue
      Events:
        AnalyzePost:
          Type: Api
          Properties:
            RestApiId: !Ref FakeNewsOffApi
            Path: /analyze
            Method: POST
        StatusGet:
          Type: Api
          Properties:
            RestApiId: !Ref FakeNewsOffApi
            Path: /status/{request_id}
            Method: GET

  # DynamoDB Table
  AnalysisTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub 'fakenews-off-analysis-${Environment}'
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: request_id
          AttributeType: S
      KeySchema:
        - AttributeName: request_id
          KeyType: HASH
      TimeToLiveSpecification:
        Enabled: true
        AttributeName: ttl
      StreamSpecification:
        StreamViewType: NEW_AND_OLD_IMAGES
      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: true

  # S3 Bucket for Media (Optional)
  MediaBucket:
    Type: AWS::S3::Bucket
    Condition: EnableMediaCheckCondition
    Properties:
      BucketName: !Sub 'fakenews-off-media-${Environment}-${AWS::AccountId}'
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true
      LifecycleConfiguration:
        Rules:
          - Id: DeleteOldMedia
            Status: Enabled
            ExpirationInDays: 30
      CorsConfiguration:
        CorsRules:
          - AllowedOrigins: ['*']
            AllowedMethods: [GET, PUT]
            AllowedHeaders: ['*']
            MaxAge: 3600

  # CloudWatch Log Group
  AnalysisFunctionLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub '/aws/lambda/fakenews-off-analysis-${Environment}'
      RetentionInDays: 30

Conditions:
  EnableMediaCheckCondition: !Equals [!Ref EnableMediaCheck, 'true']

Outputs:
  ApiEndpoint:
    Description: API Gateway endpoint URL
    Value: !Sub 'https://${FakeNewsOffApi}.execute-api.${AWS::Region}.amazonaws.com/${Environment}'
    Export:
      Name: !Sub 'fakenews-off-api-endpoint-${Environment}'
  
  TableName:
    Description: DynamoDB table name
    Value: !Ref AnalysisTable
    Export:
      Name: !Sub 'fakenews-off-table-${Environment}'
  
  BucketName:
    Condition: EnableMediaCheckCondition
    Description: S3 bucket name for media
    Value: !Ref MediaBucket
    Export:
      Name: !Sub 'fakenews-off-bucket-${Environment}'
```

### Backend Deployment Process

**Prerequisites**:
- AWS CLI configured with appropriate credentials
- AWS SAM CLI installed
- Node.js 20.x installed
- Search API key obtained

**Build Script** (`backend/package.json`):
```json
{
  "scripts": {
    "build": "tsc && npm run bundle",
    "bundle": "esbuild src/handler.ts --bundle --platform=node --target=node20 --outfile=dist/handler.js --external:@aws-sdk/*",
    "test": "jest",
    "test:unit": "jest --testPathPattern=\\.test\\.ts$",
    "test:integration": "jest --testPathPattern=integration",
    "deploy:dev": "npm run build && sam deploy --config-env dev",
    "deploy:staging": "npm run build && sam deploy --config-env staging",
    "deploy:prod": "npm run build && sam deploy --config-env prod"
  }
}
```

**SAM Configuration** (`backend/samconfig.toml`):
```toml
version = 0.1

[default.deploy.parameters]
stack_name = "fakenews-off-backend"
resolve_s3 = true
region = "us-east-1"
capabilities = "CAPABILITY_IAM"
parameter_overrides = "Environment=dev"

[dev.deploy.parameters]
stack_name = "fakenews-off-backend-dev"
parameter_overrides = "Environment=dev SearchApiKey=<dev-key>"

[staging.deploy.parameters]
stack_name = "fakenews-off-backend-staging"
parameter_overrides = "Environment=staging SearchApiKey=<staging-key>"

[prod.deploy.parameters]
stack_name = "fakenews-off-backend-prod"
parameter_overrides = "Environment=prod SearchApiKey=<prod-key>"
confirm_changeset = true
```

**Deployment Commands**:
```bash
# Development
cd backend
npm install
npm run deploy:dev

# Staging
npm run deploy:staging

# Production (with confirmation)
npm run deploy:prod
```

### Extension Deployment

**Build Configuration** (`extension/vite.config.ts`):
```typescript
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        extractionFunction: resolve(__dirname, 'src/extractionFunction.ts'),
        background: resolve(__dirname, 'src/background.ts'),
        popup: resolve(__dirname, 'src/popup/popup.html')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    },
    minify: 'terser',
    sourcemap: false
  }
});
```

**Build Script** (`extension/package.json`):
```json
{
  "scripts": {
    "build": "tsc && vite build",
    "build:dev": "tsc && vite build --mode development",
    "package": "npm run build && npm run zip",
    "zip": "cd dist && zip -r ../fakenews-off-extension.zip .",
    "test": "jest"
  }
}
```

**Environment Configuration** (`extension/.env`):
```env
# Development
VITE_API_ENDPOINT=https://api-dev.fakenewsoff.com/dev

# Production
# VITE_API_ENDPOINT=https://api.fakenewsoff.com/prod
```

**Deployment to Chrome Web Store**:
1. Build extension: `npm run package`
2. Create developer account at chrome.google.com/webstore/devconsole
3. Upload `fakenews-off-extension.zip`
4. Fill in store listing details
5. Submit for review
6. Wait for approval (typically 1-3 days)

### Web UI Deployment

**Option A: AWS S3 + CloudFront**

**Build Configuration** (`web_ui/vite.config.ts`):
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser'
  },
  define: {
    'import.meta.env.VITE_API_ENDPOINT': JSON.stringify(
      process.env.VITE_API_ENDPOINT || 'https://api.fakenewsoff.com/prod'
    )
  }
});
```

**Deployment Script** (`web_ui/deploy.sh`):
```bash
#!/bin/bash
set -e

ENVIRONMENT=${1:-dev}
BUCKET_NAME="fakenews-off-web-${ENVIRONMENT}"
DISTRIBUTION_ID="<cloudfront-distribution-id>"

echo "Building Web UI for ${ENVIRONMENT}..."
npm run build

echo "Uploading to S3..."
aws s3 sync dist/ s3://${BUCKET_NAME}/ --delete

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} \
  --paths "/*"

echo "Deployment complete!"
echo "URL: https://${BUCKET_NAME}.s3-website-us-east-1.amazonaws.com"
```

**CloudFormation for S3 + CloudFront** (`web_ui/infra/template.yaml`):
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: FakeNewsOff Web UI Infrastructure

Parameters:
  Environment:
    Type: String
    Default: 'dev'

Resources:
  WebBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub 'fakenews-off-web-${Environment}'
      WebsiteConfiguration:
        IndexDocument: index.html
        ErrorDocument: index.html
      PublicAccessBlockConfiguration:
        BlockPublicAcls: false
        BlockPublicPolicy: false
        IgnorePublicAcls: false
        RestrictPublicBuckets: false

  WebBucketPolicy:
    Type: AWS::S3::BucketPolicy
    Properties:
      Bucket: !Ref WebBucket
      PolicyDocument:
        Statement:
          - Effect: Allow
            Principal: '*'
            Action: 's3:GetObject'
            Resource: !Sub '${WebBucket.Arn}/*'

  CloudFrontDistribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Enabled: true
        DefaultRootObject: index.html
        Origins:
          - Id: S3Origin
            DomainName: !GetAtt WebBucket.DomainName
            S3OriginConfig:
              OriginAccessIdentity: ''
        DefaultCacheBehavior:
          TargetOriginId: S3Origin
          ViewerProtocolPolicy: redirect-to-https
          AllowedMethods: [GET, HEAD, OPTIONS]
          CachedMethods: [GET, HEAD]
          ForwardedValues:
            QueryString: false
            Cookies:
              Forward: none
          Compress: true
          MinTTL: 0
          DefaultTTL: 86400
          MaxTTL: 31536000
        CustomErrorResponses:
          - ErrorCode: 404
            ResponseCode: 200
            ResponsePagePath: /index.html
          - ErrorCode: 403
            ResponseCode: 200
            ResponsePagePath: /index.html

Outputs:
  WebsiteURL:
    Value: !GetAtt CloudFrontDistribution.DomainName
    Description: CloudFront distribution URL
```

**Option B: AWS Amplify**

**Amplify Configuration** (`web_ui/amplify.yml`):
```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

**Deployment via Amplify Console**:
1. Connect GitHub repository
2. Configure build settings (use amplify.yml)
3. Set environment variables (VITE_API_ENDPOINT)
4. Deploy automatically on push to main branch

### Environment Variables

**Backend Lambda**:
- `TABLE_NAME`: DynamoDB table name (from SAM template)
- `BUCKET_NAME`: S3 bucket name (optional, from SAM template)
- `SEARCH_API_KEY`: External search API key (passed as environment variable from SAM parameter)
- `ENABLE_MEDIA_CHECK`: Enable/disable media analysis (from parameter)
- `NODE_ENV`: Environment (dev/staging/prod)

**Extension**:
- `VITE_API_ENDPOINT`: API Gateway endpoint URL

**Web UI**:
- `VITE_API_ENDPOINT`: API Gateway endpoint URL

### Monitoring and Observability

**CloudWatch Dashboards**:
```typescript
// Create dashboard via AWS Console or CDK
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Invocations", { "stat": "Sum" }],
          [".", "Errors", { "stat": "Sum" }],
          [".", "Duration", { "stat": "Average" }]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "Lambda Metrics"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/DynamoDB", "ConsumedReadCapacityUnits"],
          [".", "ConsumedWriteCapacityUnits"]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-east-1",
        "title": "DynamoDB Capacity"
      }
    }
  ]
}
```

**CloudWatch Alarms**:
```yaml
# Add to SAM template
HighErrorRateAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: !Sub 'fakenews-off-high-error-rate-${Environment}'
    AlarmDescription: Alert when error rate exceeds 5%
    MetricName: Errors
    Namespace: AWS/Lambda
    Statistic: Sum
    Period: 300
    EvaluationPeriods: 2
    Threshold: 5
    ComparisonOperator: GreaterThanThreshold
    Dimensions:
      - Name: FunctionName
        Value: !Ref AnalysisFunction

LongDurationAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: !Sub 'fakenews-off-long-duration-${Environment}'
    AlarmDescription: Alert when duration exceeds 25 seconds
    MetricName: Duration
    Namespace: AWS/Lambda
    Statistic: Average
    Period: 300
    EvaluationPeriods: 2
    Threshold: 25000
    ComparisonOperator: GreaterThanThreshold
    Dimensions:
      - Name: FunctionName
        Value: !Ref AnalysisFunction
```

**X-Ray Tracing**:
```typescript
// Enable in SAM template
AnalysisFunction:
  Type: AWS::Serverless::Function
  Properties:
    Tracing: Active  # Enable X-Ray tracing
```

### Cost Estimation

**Monthly Cost Breakdown (Estimated)**:

**Development Environment**:
- API Gateway: ~$3.50 (1M requests)
- Lambda: ~$20 (1M requests, 1GB memory, 20s avg duration)
- DynamoDB: ~$1.25 (on-demand, 1M reads, 100K writes)
- Bedrock Nova 2 Lite: ~$50 (1M input tokens, 500K output tokens)
- Bedrock Nova Embeddings: ~$5 (10M tokens)
- S3: ~$0.50 (10GB storage, 100K requests)
- CloudWatch Logs: ~$2 (5GB ingestion)
- Total: ~$82/month

**Production Environment** (10x traffic):
- API Gateway: ~$35
- Lambda: ~$200
- DynamoDB: ~$12.50
- Bedrock Nova 2 Lite: ~$500
- Bedrock Nova Embeddings: ~$50
- S3: ~$5
- CloudWatch Logs: ~$20
- CloudFront: ~$10
- Total: ~$832.50/month

### Rollback Strategy

**Lambda Rollback**:
```bash
# List versions
aws lambda list-versions-by-function \
  --function-name fakenews-off-analysis-prod

# Update alias to previous version
aws lambda update-alias \
  --function-name fakenews-off-analysis-prod \
  --name live \
  --function-version <previous-version>
```

**CloudFormation Rollback**:
```bash
# Automatic rollback on failure
sam deploy --no-fail-on-empty-changeset

# Manual rollback
aws cloudformation cancel-update-stack \
  --stack-name fakenews-off-backend-prod
```

**Extension Rollback**:
- Unpublish current version in Chrome Web Store
- Re-publish previous version
- Users will auto-update on next browser restart

**Web UI Rollback**:
```bash
# S3 versioning enabled
aws s3api list-object-versions \
  --bucket fakenews-off-web-prod

# Restore previous version
aws s3 sync s3://fakenews-off-web-prod-backup/ \
  s3://fakenews-off-web-prod/ --delete
```

### Security Considerations

**API Security**:
- HTTPS only (enforced by API Gateway)
- CORS configuration:
  * Development environment: Allow '*' for development flexibility
  * Production environment: Restrict to specific origins:
    - Web UI domain (e.g., https://fakenewsoff.com)
    - Chrome extension origins (chrome-extension://[extension-id])
  * Configured via AllowedOrigins parameter in SAM template
- Rate limiting enabled (50 req/s, 100 burst) to prevent abuse
- Input validation on all endpoints
- No API key authentication required (public API for MVP)
- Abuse prevention strategy:
  * CloudWatch alarms for unusual traffic patterns
  * AWS WAF recommended for production (IP blocking, rate limiting rules)
  * Monitor for repeated requests from same IP
  * Consider implementing API key requirement in future versions

**Data Security**:
- DynamoDB encryption at rest (default)
- S3 encryption at rest (AES256)
- CloudWatch Logs encrypted
- No PII stored in logs
- TTL enabled for automatic data deletion

**IAM Permissions**:
- Least privilege principle
- Lambda execution role with minimal permissions
- No public S3 bucket access (except Web UI bucket)
- Bedrock access limited to specific models

**Secrets Management**:
- Search API key passed as environment variable via SAM template parameter
- Parameter marked with NoEcho: true to prevent exposure in CloudFormation console
- API key never logged or exposed in responses
- For enhanced security in production, consider migrating to AWS Secrets Manager with runtime retrieval

### Deployment Checklist

**Pre-Deployment**:
- [ ] Run all tests (unit, property, integration, e2e)
- [ ] Update version numbers
- [ ] Review and merge PR
- [ ] Tag release in Git
- [ ] Update CHANGELOG.md

**Backend Deployment**:
- [ ] Build Lambda package
- [ ] Run SAM validate
- [ ] Deploy to staging
- [ ] Run smoke tests on staging
- [ ] Deploy to production
- [ ] Verify CloudWatch metrics
- [ ] Test API endpoints

**Extension Deployment**:
- [ ] Build extension package
- [ ] Test in local Chrome
- [ ] Update manifest version
- [ ] Upload to Chrome Web Store
- [ ] Submit for review
- [ ] Monitor review status

**Web UI Deployment**:
- [ ] Build static assets
- [ ] Test locally
- [ ] Deploy to staging
- [ ] Run E2E tests on staging
- [ ] Deploy to production
- [ ] Invalidate CloudFront cache
- [ ] Verify production URL

**Post-Deployment**:
- [ ] Monitor CloudWatch metrics for 1 hour
- [ ] Check error rates
- [ ] Verify user reports
- [ ] Update documentation
- [ ] Announce release

