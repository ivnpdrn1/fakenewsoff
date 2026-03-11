# Technical Design: Phase UX Frontend Extension

## Overview

This design describes the complete end-to-end FakeNewsOff application architecture, integrating the frontend with the already-deployed iterative evidence orchestration backend. The system provides users with trustworthy, explainable misinformation analysis through a clean, accessible interface.

### System Context

The backend orchestration pipeline is **already deployed and operational** in production with the feature flag `ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED=true`. This design focuses on:

1. How the frontend integrates with the existing backend
2. How to render orchestration results in a user-friendly way
3. How to provide a complete end-to-end user experience
4. How to support both jury demos and production users

### Key Design Principles

- **Backend is Fixed**: Do not redesign the orchestration system - it's deployed and working
- **Backward Compatibility**: Support both orchestration and legacy pipeline responses
- **Progressive Enhancement**: Core functionality works, enhanced features load progressively
- **Accessibility First**: WCAG AA compliance for all interactive elements
- **Resilience**: Graceful degradation when services fail
- **Transparency**: Show users how analysis was performed

## Architecture

### High-Level System Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                         User Journey                                  │
│                                                                       │
│  Landing Page → Input Claim → Analysis → Results → Evidence Graph   │
│       ↓              ↓            ↓          ↓            ↓          │
│   Examples      Validation    Loading    Verdict    Exploration     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                      Frontend Architecture                            │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    React Application                           │ │
│  │                                                                │ │
│  │  Pages:                                                        │ │
│  │  • Landing (/)                                                 │ │
│  │  • Results (/results)                                          │ │
│  │                                                                │ │
│  │  Components:                                                   │ │
│  │  • InputForm - Claim submission                                │ │
│  │  • ResultsCard - Verdict display                               │ │
│  │  • ClaimEvidenceGraph - Visual evidence relationships          │ │
│  │  • SIFTPanel - Media literacy guidance                         │ │
│  │  • StatusBadge - Verdict classification                        │ │
│  │  • ApiStatus - Backend health indicator                        │ │
│  │  • ErrorState - Error handling UI                              │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                        │
│                              │ API Client (shared/api/client.ts)     │
│                              │ • Timeout: 45s production, 5s demo    │
│                              │ • Retry: Exponential backoff          │
│                              │ • Validation: Zod schemas             │
│                              │                                        │
└──────────────────────────────┼────────────────────────────────────────┘
                               │
                               │ POST /analyze
                               │ {text, url?, title?, demo_mode?}
                               │
┌──────────────────────────────┼────────────────────────────────────────┐
│                      Backend Architecture                             │
│                              │                                        │
│  ┌───────────────────────────▼─────────────────────────────────────┐ │
│  │              API Gateway + Lambda Handler                       │ │
│  │                   (lambda.ts:handler)                           │ │
│  └───────────────────────────┬─────────────────────────────────────┘ │
│                              │                                        │
│                              │ Feature Flag Check                     │
│                              │                                        │
│              ┌───────────────┴───────────────┐                       │
│              │                               │                       │
│              ▼                               ▼                       │
│  ┌─────────────────────┐         ┌─────────────────────┐           │
│  │  Orchestration      │         │  Legacy Pipeline    │           │
│  │  Pipeline           │         │  (URL-based)        │           │
│  │  (Text-only)        │         │                     │           │
│  │                     │         │                     │           │
│  │  • Claim Decomp     │         │  • Claim Extract    │           │
│  │  • Query Gen        │         │  • Source Fetch     │           │
│  │  • Multi-Pass       │         │  • Evidence Synth   │           │
│  │  • Evidence Filter  │         │  • Verdict          │           │
│  │  • Source Class     │         │                     │           │
│  │  • Contradiction    │         │                     │           │
│  │  • Verdict Synth    │         │                     │           │
│  └─────────────────────┘         └─────────────────────┘           │
│              │                               │                       │
│              └───────────────┬───────────────┘                       │
│                              │                                        │
│  ┌───────────────────────────▼─────────────────────────────────────┐ │
│  │              Response Formatter                                 │ │
│  │              (Backward Compatible)                              │ │
│  │                                                                 │ │
│  │  Legacy Fields:                                                 │ │
│  │  • status_label, confidence_score, rationale                    │ │
│  │  • text_grounding {sources, queries, providerUsed}              │ │
│  │                                                                 │ │
│  │  Orchestration Metadata (optional):                             │ │
│  │  • orchestration {enabled, passes_executed, source_classes}     │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### Request/Response Flow

```
User Input → Frontend Validation → API Client → Lambda Handler
                                                      │
                                                      ├─ Has URL? → Legacy Pipeline
                                                      │
                                                      └─ Text-only + Flag Enabled?
                                                            │
                                                            ├─ Yes → Orchestration Pipeline
                                                            │         (7-15s latency)
                                                            │
                                                            └─ No → Legacy Pipeline
                                                                    (10-20s latency)
                                                                    
← Response ← JSON Validation ← Backward Compatible Format ←
```

### Feature Flag Routing

The backend uses `ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED` to route requests:

| Request Type | Flag=true | Flag=false | On Error |
|--------------|-----------|------------|----------|
| Text-only    | Orchestration | Legacy | Fallback to Legacy |
| With URL     | Legacy | Legacy | Legacy |
| Demo mode    | Demo + Orchestration | Demo + Legacy | Demo + Legacy |

Frontend must handle both response formats transparently.

## Components and Interfaces

### Frontend Component Hierarchy

```
App
├── Router
│   ├── Landing (/)
│   │   ├── Header
│   │   ├── Hero Section
│   │   ├── InputForm
│   │   │   ├── TextArea (claim input)
│   │   │   ├── URLInput (optional)
│   │   │   ├── ValidationMessages
│   │   │   └── SubmitButton
│   │   ├── ExampleClaims
│   │   └── ApiStatus
│   │
│   └── Results (/results)
│       ├── Header
│       ├── ClaimEvidenceGraph
│       │   ├── SVG Canvas
│       │   ├── ClaimNode (center)
│       │   ├── SourceNodes (grouped by stance)
│       │   │   ├── SupportsNodes (right, green)
│       │   │   ├── ContradictsNodes (left, red)
│       │   │   └── MentionsNodes (bottom, blue/gray)
│       │   └── Edges (with arrows)
│       │
│       ├── ResultsCard
│       │   ├── StatusBadge
│       │   ├── ConfidenceBar
│       │   ├── Rationale
│       │   ├── MediaRisk (conditional)
│       │   ├── MisinformationType (conditional)
│       │   ├── SourcesList
│       │   │   ├── SourceItem (clickable)
│       │   │   └── CredibilityBadge
│       │   ├── OrchestrationMetadata (conditional)
│       │   │   ├── PassesExecuted
│       │   │   ├── SourceClasses
│       │   │   ├── AverageQuality
│       │   │   └── ContradictionsFound
│       │   ├── SIFTPanel
│       │   │   ├── StopSection
│       │   │   ├── InvestigateSection
│       │   │   ├── FindSection
│       │   │   └── TraceSection
│       │   └── ActionButtons
│       │       ├── CopyToClipboard
│       │       └── ExportJSON
│       │
│       └── ApiStatus
│
└── ErrorBoundary
    └── ErrorState
```

### Component Responsibilities

#### InputForm
- Accept text-only claims (min 10 chars)
- Accept URL claims with optional text
- Validate input before submission
- Display inline validation errors
- Show loading state during analysis
- Prevent duplicate submissions
- Support keyboard shortcuts (Enter to submit)

#### ResultsCard
- Display verdict with color-coded StatusBadge
- Show confidence score with progress bar
- Render rationale explanation
- List evidence sources with stance indicators
- Show credibility tiers (1=high, 2=medium, 3=low)
- Display orchestration metadata when available
- Provide SIFT guidance
- Export functionality (copy/JSON)

#### ClaimEvidenceGraph
- Deterministic SVG layout (no physics jitter)
- Center claim node
- Group sources by stance:
  - Supports: right side, green
  - Contradicts: left side, red
  - Mentions/Unclear: bottom, blue/gray
- Clickable source nodes (open URL in new tab)
- Hover tooltips (title, domain, publish date)
- Empty state for zero sources
- Responsive scaling for mobile

#### SIFTPanel
- Display SIFT framework steps
- Show structured guidance when available
- Provide clickable evidence URLs
- Fallback to generic guidance when unavailable
- Explain each step in context

#### StatusBadge
- Color-coded verdict display
- Supported: green
- Disputed: red
- Unverified: yellow
- Manipulated: dark red
- Biased framing: orange

#### ApiStatus
- Display backend health indicator
- Show grounding provider status
- Check health on page load
- Manual refresh button
- Visual status (green/yellow/red)

#### ErrorState
- User-friendly error messages
- Retry button for recoverable errors
- Preserve user input on error
- Suggest alternative actions
- Log errors for debugging

### State Management

Using React Context + useState for simplicity:

```typescript
// AppContext.tsx
interface AppState {
  apiBaseUrl: string;
  apiHealth: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastAnalysis: AnalysisResponse | null;
  isAnalyzing: boolean;
  error: ApiError | null;
}

interface AppActions {
  setApiHealth: (health: AppState['apiHealth']) => void;
  setLastAnalysis: (response: AnalysisResponse) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setError: (error: ApiError | null) => void;
  clearError: () => void;
}
```

No complex state management needed - most state is local to components or passed via navigation.

### Routing Structure

```typescript
// App.tsx routes
<Routes>
  <Route path="/" element={<Landing />} />
  <Route path="/results" element={<Results />} />
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

Results page receives `AnalysisResponse` via `location.state` from navigation after successful analysis.

## Data Models

### Request Payload

```typescript
interface AnalyzeRequest {
  text: string;           // Required: claim text
  url?: string;           // Optional: URL for URL-based analysis
  title?: string;         // Optional: page title
  demo_mode?: boolean;    // Optional: force demo mode
}
```

### Response Schema (Backward Compatible)

```typescript
interface AnalysisResponse {
  // Legacy fields (always present)
  status_label: StatusLabel;
  confidence_score: number;  // 0-100
  rationale: string;
  
  // Text grounding (present for text-only claims)
  text_grounding?: {
    sources: NormalizedSourceWithStance[];  // 0-6 sources
    queries: number;
    providerUsed: string[];
    sourcesCount: number;
    cacheHit: boolean;
    latencyMs: number;
    reasonCodes?: ReasonCode[];
    errors?: string[];
  };
  
  // Orchestration metadata (optional, present when orchestration used)
  orchestration?: {
    enabled: boolean;
    passes_executed: number;      // 1-3
    source_classes: number;       // Diversity metric
    average_quality: number;      // 0-1
    contradictions_found: boolean;
  };
  
  // Other fields
  request_id: string;
  timestamp: string;
  media_risk?: 'low' | 'medium' | 'high';
  misinformation_type?: string;
  sift_guidance?: string;
  credible_sources?: EvidenceSource[];
  sift?: SIFTDetails;
  grounding?: GroundingMetadata;
}
```

### Source Data Model

```typescript
interface NormalizedSourceWithStance {
  url: string;
  title: string;
  snippet: string;
  publishDate: string;  // ISO8601
  domain: string;
  score: number;        // 0-1
  stance: 'supports' | 'contradicts' | 'mentions' | 'unclear';
  stanceJustification?: string;
  provider: 'bing' | 'gdelt' | 'demo';
  credibilityTier: 1 | 2 | 3;  // 1=high, 2=medium, 3=low
}
```

### Orchestration Metadata Model

```typescript
interface OrchestrationMetadata {
  enabled: boolean;
  passes_executed: number;      // Number of retrieval passes (1-3)
  source_classes: number;       // Number of distinct source classes
  average_quality: number;      // Average quality score (0-1)
  contradictions_found: boolean; // Whether contradictions were found
}
```

## Results Rendering Model

### Verdict Display Strategy

The UI translates backend output into user-facing explanations:

```typescript
// Verdict classification mapping
const verdictConfig = {
  'true': {
    color: 'green',
    icon: '✓',
    label: 'Supported',
    description: 'Evidence strongly supports this claim'
  },
  'false': {
    color: 'red',
    icon: '✗',
    label: 'Disputed',
    description: 'Evidence contradicts this claim'
  },
  'misleading': {
    color: 'orange',
    icon: '⚠',
    label: 'Misleading',
    description: 'Claim is partially true but misleading'
  },
  'partially_true': {
    color: 'yellow',
    icon: '◐',
    label: 'Partially True',
    description: 'Some aspects supported, others not'
  },
  'unverified': {
    color: 'gray',
    icon: '?',
    label: 'Unverified',
    description: 'Insufficient evidence to verify'
  }
};
```

### Confidence Score Visualization

```typescript
// Confidence interpretation
function getConfidenceContext(score: number): string {
  if (score >= 75) return 'High confidence - Strong evidence';
  if (score >= 50) return 'Moderate confidence - Some uncertainty';
  return 'Low confidence - Insufficient evidence';
}

// Visual representation
<div className="confidence-bar-container">
  <div 
    className="confidence-bar"
    style={{ 
      width: `${score}%`,
      backgroundColor: score >= 75 ? 'green' : score >= 50 ? 'yellow' : 'red'
    }}
  />
  <span className="confidence-text">{getConfidenceContext(score)}</span>
</div>
```

### Evidence Presentation

Sources are grouped and displayed by stance:

1. **Supporting Evidence** (stance='supports')
   - Displayed first with green indicators
   - Shows why evidence supports claim
   - Includes credibility tier badge

2. **Contradicting Evidence** (stance='contradicts')
   - Displayed second with red indicators
   - Highlighted prominently for safety
   - Shows why evidence contradicts claim

3. **Contextual Evidence** (stance='mentions' or 'unclear')
   - Displayed last with blue/gray indicators
   - Provides background context
   - Less prominent visual weight

### Orchestration Metadata Display

When `orchestration.enabled === true`, show expandable section:

```
┌─────────────────────────────────────────────────────────┐
│ ℹ️ Analysis Details (Orchestration Used)                │
│                                                         │
│ Passes Executed: 2                                      │
│ → Initial retrieval + targeted refinement               │
│                                                         │
│ Source Diversity: 2 classes                             │
│ → news_media, fact_checker                              │
│                                                         │
│ Average Quality: 0.75                                   │
│ → High quality evidence                                 │
│                                                         │
│ Contradictions: Found                                   │
│ → Safety-first contradiction check performed            │
└─────────────────────────────────────────────────────────┘
```

## Evidence Graph Architecture

### Graph Layout Strategy

Deterministic SVG layout with fixed positions (no physics simulation):

```
Viewport: 800x500px

Center Claim Node:
  Position: (400, 250)
  Radius: 50px
  
Supporting Sources (Right Side):
  X: 600
  Y: 100 + (index * 120)
  Radius: 50px
  Color: Green (#22c55e)
  
Contradicting Sources (Left Side):
  X: 200
  Y: 100 + (index * 120)
  Radius: 50px
  Color: Red (#ef4444)
  
Mentions/Unclear Sources (Bottom):
  X: 300 + (index * 120)
  Y: 420
  Radius: 45px
  Color: Blue (#3b82f6) / Gray (#9ca3af)
```

### Node Types

1. **Claim Node** (center)
   - Circle with "Claim" label
   - Always visible
   - Not clickable

2. **Source Nodes** (grouped by stance)
   - Circle with domain name
   - Stance label below
   - Clickable (opens URL in new tab)
   - Hover tooltip with details

### Edge Rendering

```typescript
// Edge configuration
const edgeConfig = {
  supports: {
    color: '#22c55e',
    marker: 'arrow-supports',
    dasharray: 'none'
  },
  contradicts: {
    color: '#ef4444',
    marker: 'arrow-contradicts',
    dasharray: 'none'
  },
  mentions: {
    color: '#3b82f6',
    marker: 'arrow-mentions',
    dasharray: '5,5'  // Dashed
  },
  unclear: {
    color: '#9ca3af',
    marker: 'arrow-unclear',
    dasharray: '2,2'  // Dotted
  }
};
```

### Interaction Model

- **Click**: Open source URL in new tab
- **Hover**: Show tooltip with:
  - Full title
  - Domain
  - Publish date (formatted)
  - Credibility tier
- **No drag**: Fixed positions for consistency

### Empty State

When `sources.length === 0`:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                    ┌─────────┐                          │
│                    │  Claim  │                          │
│                    └─────────┘                          │
│                                                         │
│         No evidence sources found for this analysis.    │
│                                                         │
│         Try providing a URL for better results.         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Many Sources Handling

When `sources.length > 10`:

- Limit display to top 10 sources by quality score
- Show message: "Showing top 10 of {total} sources"
- Prioritize contradicting sources (safety-first)
- Maintain readable spacing

### Responsive Behavior

```css
/* Desktop: Full size */
@media (min-width: 768px) {
  .graph-svg {
    width: 100%;
    height: 500px;
  }
}

/* Mobile: Scaled down */
@media (max-width: 767px) {
  .graph-svg {
    width: 100%;
    height: 400px;
  }
  
  /* Smaller nodes and text */
  .node circle {
    r: 40px;
  }
  
  .node text {
    font-size: 12px;
  }
}
```


## Jury Demo Flow

### Demo Mode Configuration

Demo mode provides deterministic responses for jury presentations:

```typescript
// Demo mode detection
const isDemoMode = (request: AnalyzeRequest): boolean => {
  return request.demo_mode === true || process.env.DEMO_MODE === 'true';
};

// Demo timeout: 5 seconds (vs 45s production)
const timeout = isDemoMode(request) ? 5000 : 45000;
```

### Example Claims for Demo

Three pre-configured claims demonstrating different capabilities:

1. **Supported Claim** (shows orchestration success)
   - Claim: "The Eiffel Tower is located in Paris, France"
   - Expected: status_label='Supported', confidence=85%
   - Sources: 3-5 high-quality sources
   - Orchestration: 2 passes, 2 source classes
   - Graph: Multiple supporting sources on right

2. **Disputed Claim** (shows contradiction detection)
   - Claim: "The moon landing was faked in 1969"
   - Expected: status_label='Disputed', confidence=90%
   - Sources: Fact-checkers + contradicting evidence
   - Orchestration: 2 passes, contradictions found
   - Graph: Contradicting sources on left

3. **Unverified Claim** (shows empty state handling)
   - Claim: "A new species was discovered yesterday"
   - Expected: status_label='Unverified', confidence=30%
   - Sources: 0-1 sources
   - Orchestration: 1 pass, insufficient evidence
   - Graph: Empty state with guidance

### Demo Flow Timeline (90 seconds)

```
0:00 - Landing page displayed
0:05 - Click example claim #1 (Supported)
0:10 - Analysis starts (loading spinner)
0:15 - Results displayed
       • Verdict: Supported
       • Confidence: 85%
       • Evidence graph visible
       • Orchestration metadata shown
0:30 - Explain orchestration (2 passes, source diversity)
0:40 - Click example claim #2 (Disputed)
0:45 - Analysis starts
0:50 - Results displayed
       • Verdict: Disputed
       • Contradicting evidence highlighted
       • Safety-first approach explained
1:05 - Show SIFT guidance
1:15 - Click example claim #3 (Unverified)
1:20 - Analysis starts
1:25 - Results displayed
       • Empty state shown
       • Guidance provided
1:30 - Wrap up, Q&A
```

### Demo Mode UI Indicators

When in demo mode, show subtle indicator:

```
┌─────────────────────────────────────────────────────────┐
│ 🎭 Demo Mode - Using pre-configured responses           │
└─────────────────────────────────────────────────────────┘
```

## Production User Flow

### Normal User Journey

```
1. Landing Page
   ↓
2. User enters claim (text or URL)
   ↓
3. Input validation
   ↓
4. Submit → Loading state (7-45s)
   ↓
5. Results page
   ↓
6. Explore evidence graph
   ↓
7. Read SIFT guidance
   ↓
8. Export or start new analysis
```

### Resilience Scenarios

#### Slow Analysis (>30s)

```typescript
// Show progress message after 30s
useEffect(() => {
  if (isAnalyzing) {
    const timer = setTimeout(() => {
      setProgressMessage('Analysis taking longer than expected. Please wait...');
    }, 30000);
    
    return () => clearTimeout(timer);
  }
}, [isAnalyzing]);
```

#### Weak Evidence

When `confidence_score < 50`:

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ Low Confidence Analysis                               │
│                                                         │
│ We found limited evidence for this claim.               │
│                                                         │
│ Suggestions:                                            │
│ • Try providing a URL for better results                │
│ • Rephrase the claim to be more specific                │
│ • Check if the claim is too recent for news coverage    │
└─────────────────────────────────────────────────────────┘
```

#### Contradictions Found

When `orchestration.contradictions_found === true`:

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ Contradicting Evidence Found                          │
│                                                         │
│ Our analysis found evidence that contradicts this claim.│
│ Review the contradicting sources carefully before       │
│ sharing this information.                               │
└─────────────────────────────────────────────────────────┘
```

#### No Evidence

When `text_grounding.sources.length === 0`:

```
┌─────────────────────────────────────────────────────────┐
│ No Evidence Sources Found                               │
│                                                         │
│ We couldn't find credible sources for this claim.       │
│                                                         │
│ This could mean:                                        │
│ • The claim is too vague or general                     │
│ • The topic is too recent for news coverage             │
│ • The claim may not be newsworthy                       │
│                                                         │
│ Try:                                                    │
│ • Providing a URL to the original source                │
│ • Making the claim more specific                        │
│ • Checking if the claim is factual vs opinion           │
└─────────────────────────────────────────────────────────┘
```

### Error Recovery

All errors preserve user input and provide retry:

```typescript
interface ErrorStateProps {
  error: ApiError;
  onRetry: () => void;
  onCancel: () => void;
  preservedInput: string;
}

// Error display
<ErrorState
  error={error}
  onRetry={() => analyzeContent({ text: preservedInput })}
  onCancel={() => navigate('/')}
  preservedInput={preservedInput}
/>
```

## Error Handling Strategy

### Error Types and Responses

```typescript
type ApiErrorType = 
  | 'network'      // Network failure
  | 'timeout'      // Request timeout
  | 'validation'   // Invalid response
  | 'server'       // 5xx error
  | 'unknown';     // Unexpected error

interface ApiError {
  type: ApiErrorType;
  message: string;
  details?: string[];
  statusCode?: number;
  retryable: boolean;
}
```

### Error Handling Matrix

| Error Type | User Message | Retry | Preserve Input | Log |
|------------|--------------|-------|----------------|-----|
| Network | "Connection failed. Check your internet." | Yes | Yes | Yes |
| Timeout | "Analysis timed out. Try again." | Yes | Yes | Yes |
| Validation | "Invalid response from server." | No | Yes | Yes |
| Server 500 | "Server error. Try again later." | Yes (1x) | Yes | Yes |
| Server 400 | "Invalid request. Check your input." | No | No | Yes |
| Unknown | "Unexpected error occurred." | Yes | Yes | Yes |

### Retry Logic

```typescript
// Exponential backoff
const retryConfig = {
  maxRetries: 2,
  initialDelay: 1000,
  backoffMultiplier: 2
};

// Retry implementation
for (let attempt = 0; attempt <= maxRetries; attempt++) {
  if (attempt > 0) {
    const delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
    await sleep(delay);
  }
  
  try {
    return await fetchWithTimeout(url, options, timeout);
  } catch (error) {
    if (!isRetryable(error) || attempt === maxRetries) {
      throw error;
    }
  }
}
```

### Frontend Error Handling

```typescript
// API client error handling
try {
  const result = await analyzeContent(params);
  
  if (!result.success) {
    // Handle API error
    setError(result.error);
    
    if (result.error.retryable) {
      // Show retry button
      setShowRetry(true);
    }
  } else {
    // Success - navigate to results
    navigate('/results', { state: { response: result.data } });
  }
} catch (error) {
  // Unexpected error
  setError(createUnknownError('An unexpected error occurred'));
}
```

### Fallback Behavior

When orchestration fails, backend automatically falls back to legacy:

```typescript
// Backend fallback (already implemented)
try {
  return await analyzeWithIterativeOrchestration(claim);
} catch (error) {
  console.error('Orchestration error, falling back to legacy');
  return await legacyPipeline(claim);
}
```

Frontend handles this transparently - no special handling needed.

## Deployment Architecture

### Frontend Deployment

```
┌─────────────────────────────────────────────────────────┐
│                   CloudFront CDN                         │
│                                                         │
│  • Global edge locations                                │
│  • HTTPS enforcement                                    │
│  • Gzip compression                                     │
│  • Cache static assets                                  │
│  • Runtime config: /config.json                         │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   S3 Static Hosting                      │
│                                                         │
│  • index.html                                           │
│  • /assets/*.js (code-split bundles)                    │
│  • /assets/*.css                                        │
│  • /config.json (runtime configuration)                 │
└─────────────────────────────────────────────────────────┘
```

### Runtime Configuration

Frontend uses `/config.json` for runtime configuration (no rebuild needed):

```json
{
  "apiBaseUrl": "https://fnd9pknygc.execute-api.us-east-1.amazonaws.com"
}
```

This allows:
- Zero-downtime API URL changes
- Environment-specific configuration
- No frontend rebuild when backend changes

### Configuration Loading

```typescript
// API client initialization
let runtimeConfig: { apiBaseUrl?: string } | null = null;

async function loadRuntimeConfig(): Promise<void> {
  try {
    const response = await fetch('/config.json');
    if (response.ok) {
      runtimeConfig = await response.json();
    }
  } catch (error) {
    console.warn('Failed to load runtime config, using fallback');
    runtimeConfig = {};
  }
}

// Get API base URL
function getApiBaseUrl(): string {
  // 1. Runtime config (production)
  if (runtimeConfig?.apiBaseUrl) {
    return runtimeConfig.apiBaseUrl;
  }
  
  // 2. Environment variable (development)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // 3. Fallback (localhost)
  return 'http://localhost:3000';
}
```

### Deployment Process

```powershell
# 1. Build frontend
cd frontend/web
npm run build

# 2. Deploy to S3
aws s3 sync dist/ s3://fakenewsoff-web/ --delete

# 3. Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"

# 4. Verify deployment
curl https://fakenewsoff.com/config.json
```

### Zero-Downtime Strategy

1. Build new version
2. Upload to S3 (new files don't overwrite old)
3. Update index.html last (atomic switch)
4. Invalidate CloudFront cache
5. Old users continue with cached version
6. New users get new version

### Backend Deployment (Already Deployed)

```
┌─────────────────────────────────────────────────────────┐
│                   API Gateway                            │
│  https://fnd9pknygc.execute-api.us-east-1...            │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Lambda Function                        │
│  fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe       │
│                                                         │
│  Environment Variables:                                 │
│  • ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED=true        │
│  • GROUNDING_ENABLED=true                               │
│  • GROUNDING_PROVIDER_ORDER=bing,gdelt                  │
└─────────────────────────────────────────────────────────┘
```

Backend is already deployed and operational. No changes needed.

## Observability

### Frontend Logging

```typescript
// Structured logging
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  event: string;
  data?: Record<string, unknown>;
}

// Log API requests
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'info',
  event: 'api_request',
  data: {
    endpoint: '/analyze',
    text_length: request.text.length,
    has_url: !!request.url,
    demo_mode: request.demo_mode
  }
}));

// Log API responses
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'info',
  event: 'api_response',
  data: {
    latency_ms: latency,
    status_label: response.status_label,
    confidence: response.confidence_score,
    sources_count: response.text_grounding?.sourcesCount,
    orchestration_used: response.orchestration?.enabled,
    cache_hit: response.text_grounding?.cacheHit
  }
}));

// Log errors
console.error(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'error',
  event: 'api_error',
  data: {
    error_type: error.type,
    message: error.message,
    status_code: error.statusCode,
    retryable: error.retryable
  }
}));
```

### Backend Logging (Already Implemented)

Backend emits structured JSON logs for all orchestration stages:

```json
{
  "timestamp": "2026-03-10T02:00:00.000Z",
  "level": "INFO",
  "service": "evidenceOrchestrator",
  "event": "orchestration_complete",
  "passes_executed": 2,
  "total_evidence": 5,
  "source_classes": ["news_media", "fact_checker"],
  "average_quality": 0.75,
  "threshold_met": true
}
```

### Health Monitoring

```typescript
// Health check on app load
useEffect(() => {
  checkApiHealth();
}, []);

async function checkApiHealth() {
  const result = await checkHealth();
  
  if (result.success) {
    setApiHealth('healthy');
  } else {
    setApiHealth('unhealthy');
    console.warn('API health check failed:', result.error);
  }
}

// Display health status
<ApiStatus health={apiHealth} />
```

### Metrics to Track

Frontend metrics:
- API request latency (p50, p95, p99)
- API error rate by type
- Cache hit rate
- Orchestration usage rate
- User journey completion rate
- Time to results

Backend metrics (already tracked):
- Orchestration success rate
- Passes executed per request
- Evidence quality scores
- Source diversity metrics
- Latency per stage
- Fallback rate

### CloudWatch Logs

Backend logs are in CloudWatch:

```
Log Group: /aws/lambda/fakenewsoff-backend-AnalyzeFunction-pm4SHzxH3tCe

Filter patterns:
- Orchestration: "orchestration"
- Errors: "ERROR"
- Latency: "totalLatencyMs"
```

Frontend logs (browser console) can be collected via:
- Browser DevTools
- Error tracking service (e.g., Sentry)
- Custom analytics


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified several areas of redundancy:

1. **Response Format Handling**: Multiple criteria test that the frontend handles orchestration vs legacy responses. These can be combined into comprehensive properties about backward compatibility.

2. **UI Display Properties**: Many criteria test that specific UI elements display specific data. These can be grouped by component rather than having separate properties for each field.

3. **Error Handling**: Multiple criteria test different error types. These can be combined into properties about error handling patterns.

4. **Credibility Tier Display**: Three separate criteria (15.1, 15.2, 15.3) test tier 1, 2, and 3 display. These can be combined into one property about all tiers.

5. **Confidence Level Display**: Three separate criteria (27.2, 27.3, 27.4) test low, medium, and high confidence. These can be combined into one property about all confidence levels.

6. **Orchestration Metadata Display**: Multiple criteria (16.1-16.5, 30.1-30.5) test different orchestration fields. These can be combined into comprehensive properties.

### Property 1: API Request Construction

*For any* valid text claim (≥10 characters), when submitted through the InputForm, the API client should construct a request payload with the correct structure (text field present, optional url/title fields, proper JSON format).

**Validates: Requirements 1.1, 7.1, 7.2**

### Property 2: Backward Compatible Response Handling

*For any* API response (orchestration or legacy format), the frontend should parse and display the response without errors, regardless of whether orchestration metadata is present or absent.

**Validates: Requirements 1.3, 21.2, 21.3, 25.1, 25.2, 25.4**

### Property 3: Orchestration Metadata Display

*For any* response with orchestration metadata present, the frontend should display all orchestration fields (enabled, passes_executed, source_classes, average_quality, contradictions_found) with appropriate explanations.

**Validates: Requirements 1.2, 1.4, 16.1, 16.2, 16.3, 16.4, 16.5, 30.1, 30.2, 30.3, 30.4, 30.5**

### Property 4: Source Stance Grouping

*For any* set of sources with stance classifications, the frontend should group sources by stance (supports/contradicts/mentions/unclear) and display them with visually distinct indicators matching their stance.

**Validates: Requirements 2.2, 2.7, 3.2, 14.1, 14.2**

### Property 5: Credibility Tier Display

*For any* source with a credibility tier (1, 2, or 3), the frontend should display the appropriate visual indicator (tier 1=green/high, tier 2=yellow/medium, tier 3=gray/low).

**Validates: Requirements 2.3, 15.1, 15.2, 15.3**

### Property 6: Date Formatting

*For any* source with a publishDate in ISO8601 format, the frontend should display the date in a human-readable format (e.g., "Mar 10, 2026" or "3/10/2026").

**Validates: Requirements 2.4**

### Property 7: Graph Layout Determinism

*For any* set of sources, the ClaimEvidenceGraph should produce the same visual layout when rendered multiple times with the same input (deterministic positioning, no random jitter).

**Validates: Requirements 3.1**

### Property 8: Graph Responsive Scaling

*For any* viewport width between 320px and 2560px, the ClaimEvidenceGraph should scale appropriately and remain readable without overflow or layout breaks.

**Validates: Requirements 3.7, 13.1, 13.2**

### Property 9: Verdict Color Coding

*For any* verdict classification (true/false/misleading/partially_true/unverified), the frontend should display the verdict with the appropriate color coding (true=green, false=red, misleading=orange, partially_true=yellow, unverified=gray).

**Validates: Requirements 4.1**

### Property 10: Confidence Bar Width

*For any* confidence score (0-100), the confidence progress bar width should match the score percentage (e.g., 75% confidence → 75% bar width).

**Validates: Requirements 4.2**

### Property 11: Confidence Context Messaging

*For any* confidence score, the frontend should display contextual messaging based on the score range (low <50% shows uncertainty warning, medium 50-75% shows moderate certainty, high >75% shows strong certainty).

**Validates: Requirements 4.5, 27.1, 27.2, 27.3, 27.4**

### Property 12: Contradiction Highlighting

*For any* response with contradicting sources (stance='contradicts'), the frontend should display contradicting sources with prominent visual distinction (red indicators, left side of graph, separate section in results).

**Validates: Requirements 4.4, 14.2, 14.4, 14.5**

### Property 13: Input Validation

*For any* input text with length <10 characters, the InputForm should display a validation error and disable the submit button.

**Validates: Requirements 7.1, 7.3, 7.4**

### Property 14: Duplicate Submission Prevention

*For any* analysis in progress, the frontend should disable the submit button and prevent duplicate submissions until the analysis completes or errors.

**Validates: Requirements 8.4**

### Property 15: Timeout Messaging

*For any* analysis that exceeds 30 seconds, the frontend should display a progress message indicating the system is still working.

**Validates: Requirements 8.5**

### Property 16: Error Message Display

*For any* API error (network/timeout/validation/server), the frontend should display a user-friendly error message appropriate to the error type.

**Validates: Requirements 9.1, 9.2, 9.3, 9.4**

### Property 17: Retry Button for Recoverable Errors

*For any* recoverable error (network/timeout/server 500), the frontend should display a "Try Again" button that preserves the user's input.

**Validates: Requirements 9.5, 29.1, 29.2**

### Property 18: Error Logging Without Sensitive Data

*For any* error that occurs, the frontend should log the error to console with error type, message, and context, but without exposing sensitive data (API keys, full request bodies, user PII).

**Validates: Requirements 9.6, 18.2**

### Property 19: API Client Timeout

*For any* API request, the client should enforce timeout protection (45s for production, 5s for demo mode) and reject requests that exceed the timeout.

**Validates: Requirements 10.1**

### Property 20: Retry with Exponential Backoff

*For any* retryable error (network failure), the API client should retry with exponential backoff (initial delay 1s, multiplier 2x, max 2 retries).

**Validates: Requirements 10.2, 29.5**

### Property 21: Response Schema Validation

*For any* API response, the client should validate the response against the Zod schema and reject responses that don't match the expected structure.

**Validates: Requirements 10.3**

### Property 22: Demo Mode Latency

*For any* demo mode request, the frontend should display results within 5 seconds.

**Validates: Requirements 11.2**

### Property 23: Responsive Touch Targets

*For any* interactive element on mobile devices (<768px width), the touch target should be at least 44px in height and width.

**Validates: Requirements 13.3, 13.5**

### Property 24: Source Credibility Sorting

*For any* list of sources with credibility tiers, the frontend should sort sources by credibility tier (tier 1 first, then tier 2, then tier 3).

**Validates: Requirements 15.5**

### Property 25: Structured Logging

*For any* API request/response, the frontend should log structured data including latency, status, sources count, orchestration status, and cache hit status.

**Validates: Requirements 18.1, 18.3, 18.4, 21.5**

### Property 26: Semantic HTML Structure

*For any* page in the application, the HTML should use semantic elements (header, main, article, section, nav) rather than generic divs for structural elements.

**Validates: Requirements 19.1**

### Property 27: ARIA Labels for Interactive Elements

*For any* interactive element (button, link, input), the element should have an appropriate ARIA label or aria-label attribute for screen reader accessibility.

**Validates: Requirements 19.2, 19.6**

### Property 28: Keyboard Navigation

*For any* interactive element, the element should be keyboard accessible (focusable via Tab, activatable via Enter/Space).

**Validates: Requirements 19.3**

### Property 29: Color Contrast Compliance

*For any* text element, the color contrast ratio between text and background should meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text).

**Validates: Requirements 19.4**

### Property 30: Runtime Configuration Loading

*For any* deployment environment, the frontend should load the API base URL from /config.json at runtime, falling back to environment variables or localhost if unavailable.

**Validates: Requirements 20.1, 20.2, 20.3**

### Property 31: API Health Check on Load

*For any* page load, the frontend should check API health and display the health status indicator (green=healthy, yellow=degraded, red=unhealthy).

**Validates: Requirements 26.2, 26.3**

### Property 32: Export Summary Content

*For any* analysis response, the "Copy to Clipboard" export should include verdict, confidence, recommendation, and sources in the formatted summary.

**Validates: Requirements 23.3**

### Property 33: Export JSON Validity

*For any* analysis response, the "Export JSON" function should produce valid, parseable JSON that matches the AnalysisResponse schema.

**Validates: Requirements 23.4**

### Property 34: Input Preservation on Error

*For any* error that occurs during analysis, the frontend should preserve the user's input text and make it available for retry.

**Validates: Requirements 29.1, 29.2**

### Property 35: Loading Skeleton Display

*For any* slow-loading component, the frontend should display a loading skeleton or placeholder while the component loads.

**Validates: Requirements 28.5**

## Error Handling

### Error Classification

The frontend handles five categories of errors:

1. **Network Errors**: Connection failures, DNS resolution failures
   - User Message: "Connection failed. Check your internet connection."
   - Retryable: Yes (2 retries with exponential backoff)
   - Preserve Input: Yes

2. **Timeout Errors**: Request exceeds timeout (45s production, 5s demo)
   - User Message: "Analysis timed out. The server took too long to respond."
   - Retryable: Yes (1 retry)
   - Preserve Input: Yes

3. **Validation Errors**: Response doesn't match expected schema
   - User Message: "Invalid response from server. Please try again."
   - Retryable: No
   - Preserve Input: Yes

4. **Server Errors**: 5xx status codes
   - User Message: "Server error. Please try again later."
   - Retryable: Yes (1 retry)
   - Preserve Input: Yes

5. **Client Errors**: 4xx status codes (except 401/403)
   - User Message: "Invalid request. Please check your input."
   - Retryable: No
   - Preserve Input: No

### Error Recovery Flow

```
Error Occurs
    ↓
Classify Error Type
    ↓
Preserve User Input (if applicable)
    ↓
Display User-Friendly Message
    ↓
Log Error Details (console)
    ↓
Show Retry Button (if retryable)
    ↓
User Clicks Retry
    ↓
Resubmit with Preserved Input
    ↓
Success → Results Page
Failure → Show Alternative Actions
```

### Fallback Strategies

1. **API Unavailable**: Show health warning, suggest checking back later
2. **Orchestration Failure**: Backend automatically falls back to legacy (transparent to user)
3. **No Sources Found**: Show empty state with guidance
4. **Weak Evidence**: Show low confidence warning with suggestions
5. **Validation Failure**: Log error, show generic error message

### Error Logging

All errors are logged with structured format:

```typescript
{
  timestamp: string;      // ISO8601
  level: 'error';
  event: 'api_error';
  data: {
    error_type: string;   // network/timeout/validation/server/unknown
    message: string;      // Error message
    status_code?: number; // HTTP status if applicable
    retryable: boolean;   // Whether error is retryable
    request_id?: string;  // Request ID if available
  }
}
```

No sensitive data (API keys, full request bodies, PII) is logged.

## Testing Strategy

### Dual Testing Approach

The testing strategy uses both unit tests and property-based tests:

- **Unit Tests**: Verify specific examples, edge cases, and integration points
- **Property Tests**: Verify universal properties across all inputs

Both are complementary and necessary for comprehensive coverage.

### Unit Testing Focus

Unit tests should focus on:

1. **Specific Examples**
   - Example claim submission and results display
   - Example error scenarios (network failure, timeout)
   - Example empty states (zero sources)

2. **Integration Points**
   - API client integration with backend
   - Component integration (InputForm → Results)
   - Router navigation between pages

3. **Edge Cases**
   - Minimum input length (10 characters)
   - Maximum sources (>10 sources)
   - Missing optional fields (orchestration metadata)

4. **User Interactions**
   - Button clicks (submit, retry, export)
   - Form input (text entry, validation)
   - Navigation (back to home, new analysis)

### Property-Based Testing Focus

Property tests should focus on:

1. **Universal Properties**
   - Response format handling (orchestration vs legacy)
   - Source grouping by stance
   - Credibility tier display
   - Confidence score visualization

2. **Input Coverage**
   - Random text claims (various lengths)
   - Random source sets (various stances, tiers)
   - Random confidence scores (0-100)
   - Random viewport sizes (320-2560px)

3. **Invariants**
   - Graph layout determinism
   - Backward compatibility
   - Error handling patterns
   - Accessibility compliance

### Property Test Configuration

- **Library**: fast-check (JavaScript/TypeScript property-based testing)
- **Iterations**: Minimum 100 per property test
- **Tag Format**: `Feature: phase-ux-frontend-extension, Property {number}: {property_text}`

Example property test:

```typescript
import fc from 'fast-check';

// Property 2: Backward Compatible Response Handling
test('Feature: phase-ux-frontend-extension, Property 2: Backward compatible response handling', () => {
  fc.assert(
    fc.property(
      fc.record({
        status_label: fc.constantFrom('Supported', 'Disputed', 'Unverified'),
        confidence_score: fc.integer({ min: 0, max: 100 }),
        rationale: fc.string(),
        text_grounding: fc.option(fc.record({
          sources: fc.array(sourceArbitrary, { maxLength: 6 }),
          queries: fc.nat(),
          providerUsed: fc.array(fc.string()),
          sourcesCount: fc.nat(),
          cacheHit: fc.boolean(),
          latencyMs: fc.nat()
        })),
        orchestration: fc.option(fc.record({
          enabled: fc.boolean(),
          passes_executed: fc.integer({ min: 1, max: 3 }),
          source_classes: fc.integer({ min: 0, max: 10 }),
          average_quality: fc.float({ min: 0, max: 1 }),
          contradictions_found: fc.boolean()
        }))
      }),
      (response) => {
        // Test that frontend handles both formats without errors
        const result = renderResults(response);
        expect(result).toBeDefined();
        expect(result.error).toBeUndefined();
      }
    ),
    { numRuns: 100 }
  );
});
```

### Test Coverage Goals

- **Unit Tests**: 80% code coverage minimum
- **Property Tests**: All 35 correctness properties implemented
- **Integration Tests**: Critical user journeys (landing → input → results)
- **Accessibility Tests**: WCAG AA compliance verification
- **Responsive Tests**: Mobile, tablet, desktop viewports

### Smoke Tests

Smoke tests verify end-to-end functionality:

1. **Landing Page Load**: Page loads without errors
2. **Claim Submission**: User can submit a claim
3. **Results Display**: Results page displays correctly
4. **Graph Rendering**: Evidence graph renders without errors
5. **Error Handling**: Errors are handled gracefully
6. **Responsive Design**: UI works on mobile and desktop

### Testing Tools

- **Unit Tests**: Jest + React Testing Library
- **Property Tests**: fast-check
- **Integration Tests**: Playwright or Cypress
- **Accessibility Tests**: axe-core
- **Visual Regression**: Percy or Chromatic


## Diagrams

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Journey                                 │
│                                                                      │
│  Landing → Input Claim → Validation → Submit → Loading → Results   │
│                                                                      │
│  Results → Evidence Graph → SIFT Guidance → Export → New Analysis  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    Frontend (React + TypeScript)                     │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Pages                                                        │  │
│  │  • Landing (/)                                                │  │
│  │  • Results (/results)                                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Components                                                   │  │
│  │  • InputForm - Claim submission                               │  │
│  │  • ResultsCard - Verdict display                              │  │
│  │  • ClaimEvidenceGraph - Visual evidence                       │  │
│  │  • SIFTPanel - Media literacy                                 │  │
│  │  • StatusBadge - Verdict badge                                │  │
│  │  • ApiStatus - Health indicator                               │  │
│  │  • ErrorState - Error handling                                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  API Client (shared/api/client.ts)                            │  │
│  │  • Timeout: 45s production, 5s demo                           │  │
│  │  • Retry: Exponential backoff (2 retries)                     │  │
│  │  • Validation: Zod schemas                                    │  │
│  │  • Runtime config: /config.json                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
                           │ POST /analyze
                           │ {text, url?, title?, demo_mode?}
                           │
┌──────────────────────────┼───────────────────────────────────────────┐
│                    Backend (AWS Lambda)                              │
│                          │                                           │
│  ┌───────────────────────▼────────────────────────────────────────┐ │
│  │  Lambda Handler (lambda.ts)                                    │ │
│  │  • Feature flag check                                          │ │
│  │  • Pipeline routing                                            │ │
│  │  • Error handling                                              │ │
│  └───────────────────────┬────────────────────────────────────────┘ │
│                          │                                           │
│              ┌───────────┴───────────┐                              │
│              │                       │                              │
│              ▼                       ▼                              │
│  ┌─────────────────────┐ ┌─────────────────────┐                  │
│  │  Orchestration      │ │  Legacy Pipeline    │                  │
│  │  Pipeline           │ │  (URL-based)        │                  │
│  │  (Text-only)        │ │                     │                  │
│  │                     │ │                     │                  │
│  │  • Claim Decomp     │ │  • Claim Extract    │                  │
│  │  • Query Gen        │ │  • Source Fetch     │                  │
│  │  • Multi-Pass       │ │  • Evidence Synth   │                  │
│  │  • Evidence Filter  │ │  • Verdict          │                  │
│  │  • Source Class     │ │                     │                  │
│  │  • Contradiction    │ │                     │                  │
│  │  • Verdict Synth    │ │                     │                  │
│  └─────────────────────┘ └─────────────────────┘                  │
│              │                       │                              │
│              └───────────┬───────────┘                              │
│                          │                                           │
│  ┌───────────────────────▼────────────────────────────────────────┐ │
│  │  Response Formatter (Backward Compatible)                      │ │
│  │  • Legacy fields: status_label, confidence_score, rationale    │ │
│  │  • text_grounding: sources, queries, providerUsed              │ │
│  │  • orchestration: enabled, passes_executed, source_classes     │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### Request/Response Flow Diagram

```
┌──────────┐
│  User    │
└────┬─────┘
     │
     │ 1. Enter claim
     ▼
┌──────────────────┐
│  InputForm       │
│  • Validate      │
│  • Min 10 chars  │
└────┬─────────────┘
     │
     │ 2. Submit
     ▼
┌──────────────────┐
│  API Client      │
│  • Construct     │
│  • Timeout 45s   │
│  • Retry logic   │
└────┬─────────────┘
     │
     │ 3. POST /analyze
     ▼
┌──────────────────┐
│  Lambda Handler  │
│  • Parse request │
│  • Check flag    │
└────┬─────────────┘
     │
     │ 4. Route based on request type
     │
     ├─────────────────┬─────────────────┐
     │                 │                 │
     ▼                 ▼                 ▼
┌─────────┐    ┌──────────────┐   ┌─────────┐
│ Has URL?│    │ Text-only +  │   │ Demo    │
│ → Legacy│    │ Flag enabled?│   │ Mode?   │
│         │    │ → Orchestrate│   │ → Demo  │
└────┬────┘    └──────┬───────┘   └────┬────┘
     │                │                 │
     │                │                 │
     └────────────────┴─────────────────┘
                      │
                      │ 5. Format response
                      ▼
            ┌──────────────────┐
            │  JSON Response   │
            │  • Legacy fields │
            │  • Orchestration │
            │  • CORS headers  │
            └────┬─────────────┘
                 │
                 │ 6. Return to client
                 ▼
            ┌──────────────────┐
            │  API Client      │
            │  • Validate Zod  │
            │  • Parse JSON    │
            └────┬─────────────┘
                 │
                 │ 7. Navigate to results
                 ▼
            ┌──────────────────┐
            │  Results Page    │
            │  • ResultsCard   │
            │  • Graph         │
            │  • SIFT          │
            └──────────────────┘
```

### Evidence Graph Layout Diagram

```
Claim Evidence Graph Layout (800x500px viewport)

                    Contradicts (Left)              Supports (Right)
                    
                    ┌─────────┐                     ┌─────────┐
                    │ Source  │                     │ Source  │
                    │ domain  │                     │ domain  │
                    │Contradicts                    │Supports │
                    └────┬────┘                     └────┬────┘
                         │                               │
                    (200, 100)                      (600, 100)
                         │                               │
                         │                               │
                         │         ┌─────────┐           │
                         └────────▶│  Claim  │◀──────────┘
                                   │  Node   │
                                   └─────────┘
                                   (400, 250)
                                       │
                         ┌─────────────┴─────────────┐
                         │                           │
                         ▼                           ▼
                    ┌─────────┐                 ┌─────────┐
                    │ Source  │                 │ Source  │
                    │ domain  │                 │ domain  │
                    │Mentions │                 │Unclear  │
                    └─────────┘                 └─────────┘
                    (300, 420)                  (420, 420)
                    
                    Mentions/Unclear (Bottom)

Legend:
• Claim Node: Center (400, 250), radius 50px, gray
• Supports: Right side (x=600), green, solid edges
• Contradicts: Left side (x=200), red, solid edges
• Mentions: Bottom (y=420), blue, dashed edges
• Unclear: Bottom (y=420), gray, dotted edges

Interactions:
• Click node → Open URL in new tab
• Hover node → Show tooltip (title, domain, date)
• No drag → Fixed positions for consistency
```

### State Management Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Application State                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Global State (AppContext)                                 │ │
│  │  • apiBaseUrl: string                                      │ │
│  │  • apiHealth: 'healthy' | 'degraded' | 'unhealthy'        │ │
│  │  • lastAnalysis: AnalysisResponse | null                   │ │
│  │  • isAnalyzing: boolean                                    │ │
│  │  • error: ApiError | null                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Local State (Component-specific)                          │ │
│  │                                                            │ │
│  │  InputForm:                                                │ │
│  │  • inputText: string                                       │ │
│  │  • inputUrl: string                                        │ │
│  │  • validationError: string | null                          │ │
│  │  • isSubmitting: boolean                                   │ │
│  │                                                            │ │
│  │  ResultsCard:                                              │ │
│  │  • copied: boolean (for copy feedback)                     │ │
│  │  • expandedSections: Set<string>                           │ │
│  │                                                            │ │
│  │  ApiStatus:                                                │ │
│  │  • isChecking: boolean                                     │ │
│  │  • lastCheckTime: Date | null                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Navigation State (React Router)                           │ │
│  │  • location.pathname: '/' | '/results'                     │ │
│  │  • location.state: { response?: AnalysisResponse }         │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

State Flow:

User Input → Local State (InputForm)
    ↓
Submit → Global State (isAnalyzing = true)
    ↓
API Call → API Client
    ↓
Success → Global State (lastAnalysis = response)
    ↓
Navigate → Navigation State (location.state = {response})
    ↓
Results Page → Render from location.state
```

### Error Handling Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                      Error Handling Flow                          │
└──────────────────────────────────────────────────────────────────┘

API Call
    │
    ├─ Success → Navigate to Results
    │
    └─ Error
        │
        ├─ Network Error
        │   ├─ Preserve Input: Yes
        │   ├─ Message: "Connection failed"
        │   ├─ Retryable: Yes (2 retries)
        │   └─ Log: {type: 'network', message, retryable: true}
        │
        ├─ Timeout Error
        │   ├─ Preserve Input: Yes
        │   ├─ Message: "Request timed out"
        │   ├─ Retryable: Yes (1 retry)
        │   └─ Log: {type: 'timeout', message, retryable: true}
        │
        ├─ Validation Error
        │   ├─ Preserve Input: Yes
        │   ├─ Message: "Invalid response"
        │   ├─ Retryable: No
        │   └─ Log: {type: 'validation', message, details}
        │
        ├─ Server Error (5xx)
        │   ├─ Preserve Input: Yes
        │   ├─ Message: "Server error"
        │   ├─ Retryable: Yes (1 retry)
        │   └─ Log: {type: 'server', status_code, message}
        │
        └─ Client Error (4xx)
            ├─ Preserve Input: No
            ├─ Message: "Invalid request"
            ├─ Retryable: No
            └─ Log: {type: 'client', status_code, message}

All Errors:
    ↓
Display ErrorState Component
    ├─ User-friendly message
    ├─ Retry button (if retryable)
    ├─ Cancel button (return to home)
    └─ Preserved input (if applicable)
```

## Implementation Notes

### Critical Constraints

1. **Backend is Fixed**: The orchestration pipeline is already deployed. Do not modify backend logic.

2. **Backward Compatibility**: Frontend must handle both orchestration and legacy responses without errors.

3. **Runtime Configuration**: Use /config.json for API base URL to enable zero-downtime deployments.

4. **Accessibility**: All interactive elements must be keyboard accessible and screen reader compatible.

5. **Responsive Design**: UI must work on viewports from 320px to 2560px width.

### Technology Stack

- **Frontend Framework**: React 18+ with TypeScript
- **Routing**: React Router v6
- **Validation**: Zod for runtime schema validation
- **HTTP Client**: Fetch API with custom wrapper
- **Testing**: Jest + React Testing Library + fast-check
- **Build Tool**: Vite
- **Deployment**: S3 + CloudFront

### Key Files

Frontend:
- `frontend/web/src/pages/Landing.tsx` - Landing page
- `frontend/web/src/pages/Results.tsx` - Results page
- `frontend/web/src/components/InputForm.tsx` - Claim input
- `frontend/web/src/components/ResultsCard.tsx` - Verdict display
- `frontend/web/src/components/ClaimEvidenceGraph.tsx` - Evidence graph
- `frontend/web/src/components/SIFTPanel.tsx` - SIFT guidance
- `frontend/shared/api/client.ts` - API client
- `frontend/shared/schemas/backend-schemas.ts` - Zod schemas

Backend (already deployed):
- `backend/src/lambda.ts` - Lambda handler
- `backend/src/orchestration/iterativeOrchestrationPipeline.ts` - Orchestration
- `backend/src/types/orchestration.ts` - Orchestration types
- `backend/src/utils/demoMode.ts` - Demo mode

### Deployment Checklist

Frontend:
1. Build with `npm run build`
2. Upload to S3 with `aws s3 sync dist/ s3://bucket/`
3. Update /config.json with API base URL
4. Invalidate CloudFront cache
5. Verify /config.json loads correctly
6. Test API integration
7. Verify orchestration metadata displays

Backend (already deployed):
- No changes needed
- Feature flag: `ITERATIVE_EVIDENCE_ORCHESTRATION_ENABLED=true`
- API URL: `https://fnd9pknygc.execute-api.us-east-1.amazonaws.com`

### Performance Targets

- **Landing Page Load**: <2s
- **Analysis Latency**: 7-45s (backend-dependent)
- **Results Page Render**: <1s
- **Graph Render**: <500ms
- **API Client Timeout**: 45s production, 5s demo
- **Retry Delay**: 1s, 2s (exponential backoff)

### Accessibility Targets

- **WCAG Level**: AA compliance
- **Color Contrast**: 4.5:1 for normal text, 3:1 for large text
- **Touch Targets**: Minimum 44x44px
- **Keyboard Navigation**: All interactive elements
- **Screen Reader**: ARIA labels for all components
- **Semantic HTML**: header, main, article, section

### Browser Support

- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile Browsers**: iOS Safari 14+, Chrome Mobile 90+
- **No IE11**: Modern JavaScript features required

## Summary

This design describes the complete end-to-end FakeNewsOff application, integrating the frontend with the already-deployed iterative evidence orchestration backend. The system provides users with trustworthy, explainable misinformation analysis through a clean, accessible interface.

Key aspects:
- **Backend Integration**: Frontend integrates with deployed orchestration pipeline via /analyze endpoint
- **Backward Compatibility**: Handles both orchestration and legacy response formats
- **Evidence Visualization**: ClaimEvidenceGraph shows stance-based source relationships
- **User Experience**: Clear verdict display, SIFT guidance, error handling, export options
- **Accessibility**: WCAG AA compliance, keyboard navigation, screen reader support
- **Deployment**: Runtime configuration via /config.json for zero-downtime updates
- **Testing**: 35 correctness properties with property-based testing using fast-check

The design focuses on completing the frontend to deliver a production-ready application for both hackathon jury demonstrations and real user usage, without modifying the already-deployed backend orchestration system.
