# Design Document: Phase UX Frontend + Browser Extension

## Overview

This design document specifies the architecture for FakeNewsOff's user-facing frontend experience, optimized for hackathon jury demonstration. The system consists of three integrated components:

1. **Web UI**: React + Vite single-page application for analyzing text and URLs
2. **Browser Extension**: Chrome Manifest V3 extension for analyzing selected text or page content
3. **Shared API Client**: TypeScript module for communicating with the backend /analyze endpoint

The design prioritizes reliability, simplicity, and demo-readiness. Every architectural decision supports the 90-second jury demo requirement while maintaining production-quality code standards.

### Design Principles

- **Reliability First**: No complex state management, minimal dependencies, clear error boundaries
- **Demo Optimized**: Support both demo mode (no AWS) and production mode with seamless switching
- **CI Validation**: All code must pass typecheck, lint, formatcheck, test, and build gates
- **Minimal Risk**: Simple architecture, graceful degradation, comprehensive error handling
- **Jury Impact**: Polished UI, smooth interactions, impressive visual presentation

### Key Constraints

- Must work flawlessly in 90-second demo
- Must support demo mode without AWS credentials
- Must pass all validation commands (258 backend tests + frontend tests)
- Must demonstrate all 5 Status_Label types through keyword-based responses
- Must handle network failures gracefully during live demo

## Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interactions                        │
│                                                                  │
│  ┌──────────────────┐              ┌──────────────────┐        │
│  │   Web Browser    │              │  Chrome Browser  │        │
│  │                  │              │                  │        │
│  │  ┌────────────┐  │              │  ┌────────────┐  │        │
│  │  │  Web UI    │  │              │  │ Extension  │  │        │
│  │  │  (React)   │  │              │  │  Popup     │  │        │
│  │  └────────────┘  │              │  └────────────┘  │        │
│  └──────────────────┘              └──────────────────┘        │
│           │                                  │                  │
│           │                                  │                  │
└───────────┼──────────────────────────────────┼──────────────────┘
            │                                  │
            │         ┌────────────────────────┘
            │         │
            ▼         ▼
   ┌──────────────────────────────────────────────────────────┐
   │              Shared API Client Module                    │
   │  ┌────────────────────────────────────────────────────┐  │
   │  │  analyzeContent(text, url, title, demo_mode)       │  │
   │  │  • Request payload construction                    │  │
   │  │  • Zod schema validation                           │  │
   │  │  • Error handling & typing                         │  │
   │  │  • Timeout & retry logic                           │  │
   │  └────────────────────────────────────────────────────┘  │
   └────────────────────────┬─────────────────────────────────┘
                            │
                            │ POST /analyze
                            │ { text, url?, title?, demo_mode? }
                            │
                            ▼
   ┌──────────────────────────────────────────────────────────┐
   │                    Backend API                            │
   │  ┌────────────────────────────────────────────────────┐  │
   │  │  POST /analyze endpoint                            │  │
   │  │  • Demo mode: keyword-based responses              │  │
   │  │  • Production: AWS Bedrock Nova 2 Lite             │  │
   │  │  • Returns: AnalysisResponse with request_id       │  │
   │  └────────────────────────────────────────────────────┘  │
   └────────────────────────┬─────────────────────────────────┘
                            │
                            │ AnalysisResponse
                            │ { request_id, status_label, confidence_score, ... }
                            │
                            ▼
   ┌──────────────────────────────────────────────────────────┐
   │                  Response Validation                      │
   │  • Zod schema validation (AnalysisResponseSchema)         │
   │  • Type-safe error handling                               │
   │  • request_id propagation for caching                     │
   └──────────────────────────────────────────────────────────┘
```

### Demo Mode Flow

```
User Input: "This fake news story is manipulated"
     │
     ▼
Web UI / Extension
     │ demo_mode: true
     ▼
API Client → POST /analyze { text: "...", demo_mode: true }
     │
     ▼
Backend (Demo Mode)
     │ Keyword Detection: "fake" + "manipulated"
     ▼
Returns: { status_label: "Manipulated", confidence_score: 90, ... }
     │
     ▼
API Client validates with Zod
     │
     ▼
UI displays: Red badge "Manipulated" + 90% confidence + sources
```

### request_id Propagation

```
Analysis Request → Backend generates UUID request_id
                → Stored in cache with 24hr TTL
                → Returned in AnalysisResponse
                → Extension passes to Web UI via URL param
                → Web UI retrieves cached result by request_id
```

## Project Folder Structure

```
frontend/
├── web/                          # React web application
│   ├── src/
│   │   ├── components/           # React components
│   │   │   ├── InputForm.tsx     # Text/URL input form
│   │   │   ├── ResultsCard.tsx   # Analysis results display
│   │   │   ├── StatusBadge.tsx   # Color-coded status label
│   │   │   ├── SourceList.tsx    # Credible sources list
│   │   │   ├── SIFTPanel.tsx     # SIFT framework guidance
│   │   │   └── ErrorState.tsx    # Error display component
│   │   ├── pages/
│   │   │   ├── Home.tsx          # Home page with input form
│   │   │   └── Results.tsx       # Results page with analysis
│   │   ├── App.tsx               # Root component with routing
│   │   ├── main.tsx              # Entry point
│   │   └── types.ts              # Frontend-specific types
│   ├── public/                   # Static assets
│   ├── index.html                # HTML template
│   ├── vite.config.ts            # Vite configuration
│   ├── tsconfig.json             # TypeScript config
│   ├── package.json              # Dependencies & scripts
│   └── README.md                 # Web UI documentation
│
├── extension/                    # Chrome browser extension
│   ├── src/
│   │   ├── popup.tsx             # Extension popup UI
│   │   ├── content-script.ts    # Content script for page interaction
│   │   ├── background.ts         # Service worker for context menu
│   │   └── types.ts              # Extension-specific types
│   ├── public/
│   │   ├── manifest.json         # Manifest V3 configuration
│   │   ├── icon-16.png           # Extension icons
│   │   ├── icon-48.png
│   │   └── icon-128.png
│   ├── vite.config.ts            # Vite config for extension build
│   ├── tsconfig.json             # TypeScript config
│   ├── package.json              # Dependencies & scripts
│   └── README.md                 # Extension installation guide
│
├── shared/                       # Shared code between web and extension
│   ├── api/
│   │   ├── client.ts             # API client implementation
│   │   └── client.test.ts        # API client tests
│   ├── schemas/
│   │   └── index.ts              # Re-export backend Zod schemas
│   └── utils/
│       ├── errors.ts             # Error type definitions
│       └── validation.ts         # Validation utilities
│
└── tests/                        # Integration tests
    ├── smoke.test.ts             # UI → Backend → UI smoke test
    └── setup.ts                  # Test configuration
```

### Folder Purpose

- **web/**: Standalone React application for desktop/mobile browsers
- **extension/**: Chrome extension with popup, content script, and background worker
- **shared/**: Code shared between web and extension (API client, schemas, utilities)
- **tests/**: Integration tests that validate the full stack

## Web UI Component Architecture

### Pages

#### Home Page (Home.tsx)
- **Purpose**: Entry point for content analysis
- **Components**: InputForm, demo mode toggle, instructions
- **State**: form input (text/URL), demo mode flag, loading state
- **Routing**: Default route `/`

#### Results Page (Results.tsx)
- **Purpose**: Display analysis results
- **Components**: ResultsCard, StatusBadge, SourceList, SIFTPanel, ErrorState
- **State**: analysis response, error state
- **Routing**: Route `/results` with optional `?request_id=` param

### Components

#### InputForm.tsx
- **Props**: `onSubmit(text, url, title)`, `loading`, `demoMode`
- **State**: text input, URL input, title input, validation errors
- **Behavior**: 
  - Validates input (text or URL required)
  - Debounces validation to avoid excessive re-renders
  - Disables submit during loading
  - Shows validation errors inline
- **Accessibility**: ARIA labels, keyboard navigation, focus management

#### ResultsCard.tsx
- **Props**: `response: AnalysisResponse`
- **State**: None (pure presentation)
- **Behavior**:
  - Displays status label via StatusBadge
  - Shows confidence score with progress bar
  - Renders recommendation prominently
  - Conditionally shows media_risk and misinformation_type
  - Provides "Copy to Clipboard" and "Export JSON" buttons
- **Accessibility**: Semantic HTML, ARIA labels for interactive elements

#### StatusBadge.tsx
- **Props**: `label: StatusLabel`
- **State**: None (pure presentation)
- **Behavior**:
  - Color-coded badges: Supported (green), Disputed (red), Unverified (yellow), Manipulated (dark red), Biased framing (orange)
  - Consistent styling across web and extension
- **Accessibility**: Color + text (not color alone)

#### SourceList.tsx
- **Props**: `sources: CredibleSource[]`
- **State**: None (pure presentation)
- **Behavior**:
  - Displays 0-3 sources with title, snippet, URL, and credibility explanation
  - Links open in new tab with `rel="noopener noreferrer"`
  - Shows empty state when no sources available
- **Accessibility**: Semantic list markup, descriptive link text

#### SIFTPanel.tsx
- **Props**: `guidance: string`
- **State**: None (pure presentation)
- **Behavior**:
  - Parses SIFT guidance string (format: "Stop: ... Investigate: ... Find: ... Trace: ...")
  - Displays four components with icons/visual separation
  - Collapsible on mobile for space efficiency
- **Accessibility**: Semantic headings, clear structure

#### ErrorState.tsx
- **Props**: `error: ApiError`, `onRetry?: () => void`
- **State**: None (pure presentation)
- **Behavior**:
  - Displays user-friendly error message based on error type
  - Shows retry button if `onRetry` provided
  - Logs detailed error to console for debugging
- **Accessibility**: ARIA live region for screen readers

### State Management Strategy

**Decision**: Use React state only (no Redux, no Zustand)

**Rationale**:
- Simple application with minimal shared state
- Reduces complexity and bundle size
- Easier to debug during live demo
- Faster development iteration

**State Location**:
- **App.tsx**: Demo mode flag (persisted to localStorage)
- **Home.tsx**: Form input state, loading state
- **Results.tsx**: Analysis response, error state

**State Flow**:
```
User submits form
  → Home.tsx sets loading=true
  → API Client calls backend
  → Response validated with Zod
  → Navigate to Results.tsx with response
  → Results.tsx renders components
```

### Routing Strategy

**Decision**: React Router with simple routes

**Routes**:
- `/` - Home page
- `/results` - Results page (with optional `?request_id=` param)

**Navigation**:
- Form submission → programmatic navigation to `/results`
- "New Analysis" button → navigate back to `/`
- Extension "View Full Analysis" → open `/results?request_id=<uuid>`

### Data Flow

```
InputForm
  │ onSubmit(text, url, title)
  ▼
Home.tsx
  │ calls API_Client.analyzeContent()
  ▼
API_Client
  │ POST /analyze
  │ Validates response with Zod
  ▼
Home.tsx
  │ navigate('/results', { state: { response } })
  ▼
Results.tsx
  │ receives response from location.state
  ▼
ResultsCard, StatusBadge, SourceList, SIFTPanel
  │ render analysis results
```

### Error Boundary Strategy

**Decision**: Single error boundary at App.tsx level

**Rationale**:
- Catches unexpected React errors
- Prevents white screen of death during demo
- Displays fallback UI with recovery option

**Implementation**:
```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    console.error('React error:', error, errorInfo);
    // Display fallback UI
  }
}
```

**Fallback UI**:
- User-friendly error message
- "Reload" button to recover
- Link to report issue (optional)


## Browser Extension Architecture

### Manifest V3 Structure

**File**: `extension/public/manifest.json`

```json
{
  "manifest_version": 3,
  "name": "FakeNewsOff",
  "version": "1.0.0",
  "description": "Real-time misinformation detection using AWS Bedrock Nova 2 Lite",
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "contextMenus",
    "notifications"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icon-16.png",
      "48": "icon-48.png",
      "128": "icon-128.png"
    }
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content-script.js"],
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "icon-16.png",
    "48": "icon-48.png",
    "128": "icon-128.png"
  }
}
```

**Permissions Justification**:
- `activeTab`: Access current tab content when popup is opened (minimal permission)
- `scripting`: Inject content script for text selection capture
- `storage`: Persist demo mode preference and cache recent analyses
- `contextMenus`: Add "Analyze with FakeNewsOff" to right-click menu
- `notifications`: Display quick results after context menu analysis

**Security**: No broad host permissions, no access to all websites by default

### Extension Components

#### popup.tsx
- **Purpose**: Main extension UI displayed when icon is clicked
- **State**: selected text, analysis response, loading state, error state, demo mode
- **Behavior**:
  1. On mount, request selected text from content script
  2. If no selection, request page snippet (first 500 chars)
  3. Display "Analyze" button
  4. On click, call API_Client.analyzeContent()
  5. Display results: StatusBadge, confidence, truncated recommendation
  6. Provide "View Full Analysis" button → opens Web UI with request_id
- **Size**: Optimized for 400x600px popup window
- **Accessibility**: Full keyboard navigation, ARIA labels

#### content-script.ts
- **Purpose**: Interact with page content to capture text
- **Behavior**:
  - Listen for messages from popup
  - On request, return `window.getSelection().toString()`
  - If no selection, return first 500 chars from document.body.innerText
  - Handle edge cases: iframes, shadow DOM, dynamic content
- **Injection**: Runs at `document_idle` to avoid performance impact
- **Permissions**: Uses `activeTab` (only when popup is opened)

#### background.ts
- **Purpose**: Service worker for context menu and notifications
- **Behavior**:
  1. Register context menu item on install: "Analyze with FakeNewsOff"
  2. Listen for context menu clicks
  3. On click, get selected text from active tab
  4. Call API_Client.analyzeContent()
  5. Display notification with status label and confidence
  6. Notification click → open Web UI with request_id
- **Lifecycle**: Persistent service worker (Manifest V3)
- **Error Handling**: Graceful degradation if API call fails

### Message Passing Strategy

**Decision**: Use Chrome runtime messaging API

**Message Types**:
```typescript
type Message =
  | { type: 'GET_SELECTION'; }
  | { type: 'SELECTION_RESPONSE'; text: string; }
  | { type: 'GET_PAGE_SNIPPET'; }
  | { type: 'SNIPPET_RESPONSE'; text: string; }
  | { type: 'ANALYZE_CONTENT'; text: string; demoMode: boolean; }
  | { type: 'ANALYSIS_COMPLETE'; response: AnalysisResponse; }
  | { type: 'ANALYSIS_ERROR'; error: ApiError; };
```

**Flow**:
```
popup.tsx
  │ chrome.tabs.sendMessage({ type: 'GET_SELECTION' })
  ▼
content-script.ts
  │ window.getSelection().toString()
  │ chrome.runtime.sendMessage({ type: 'SELECTION_RESPONSE', text })
  ▼
popup.tsx
  │ receives text, displays in UI
```

### Context Menu Handler

**Registration** (background.ts):
```typescript
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'analyze-selection',
    title: 'Analyze with FakeNewsOff',
    contexts: ['selection']
  });
});
```

**Handler** (background.ts):
```typescript
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'analyze-selection' && info.selectionText) {
    const response = await analyzeContent(info.selectionText);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon-128.png',
      title: `Status: ${response.status_label}`,
      message: `Confidence: ${response.confidence_score}%`,
      buttons: [{ title: 'View Full Analysis' }]
    });
  }
});
```

### Extension Flow Diagram

```
User selects text on webpage
  │
  ▼
User right-clicks → "Analyze with FakeNewsOff"
  │
  ▼
background.ts receives context menu click
  │ info.selectionText
  ▼
background.ts calls API_Client.analyzeContent()
  │
  ▼
API_Client → POST /analyze (demo_mode from storage)
  │
  ▼
Backend returns AnalysisResponse
  │
  ▼
background.ts displays notification
  │ Status: Manipulated, Confidence: 90%
  │ [View Full Analysis]
  ▼
User clicks notification
  │
  ▼
Opens Web UI: /results?request_id=<uuid>
  │
  ▼
Web UI retrieves cached result from backend
```

## Shared API Client Design

### API Client Module

**File**: `frontend/shared/api/client.ts`

**Purpose**: Centralized, typed API communication for both web and extension

### Function Signature

```typescript
export async function analyzeContent(params: {
  text: string;
  url?: string;
  title?: string;
  demoMode?: boolean;
}): Promise<Result<AnalysisResponse, ApiError>>

type Result<T, E> =
  | { success: true; data: T }
  | { success: false; error: E };

type ApiError =
  | { type: 'network'; message: string; originalError?: unknown }
  | { type: 'timeout'; message: string }
  | { type: 'validation'; message: string; details: string[] }
  | { type: 'server'; statusCode: number; message: string }
  | { type: 'unknown'; message: string };
```

### Request Payload Schema

```typescript
const AnalyzeRequestSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  url: z.string().url().optional(),
  title: z.string().optional(),
  demo_mode: z.boolean().optional()
});

type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
```

### Response Validation Using Zod

**Strategy**: Validate all backend responses at runtime

**Implementation**:
```typescript
import { AnalysisResponseSchema } from '../schemas';

async function analyzeContent(params) {
  const response = await fetch('/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  const data = await response.json();

  // Validate with Zod
  const validation = AnalysisResponseSchema.safeParse(data);

  if (!validation.success) {
    return {
      success: false,
      error: {
        type: 'validation',
        message: 'Invalid response from server',
        details: validation.error.issues.map(i => i.message)
      }
    };
  }

  return { success: true, data: validation.data };
}
```

**Validation Coverage**:
- `status_label` is one of 5 valid values (Zod enum)
- `confidence_score` is 0-100 (Zod number with min/max)
- `sources` array has 0-3 items (Zod array with min/max)
- `request_id` is valid UUID (Zod string UUID)
- All required fields are present (Zod object schema)

### Error Typing Strategy

**Decision**: Discriminated union for error types

**Rationale**:
- Type-safe error handling in UI
- Clear error messages for each failure mode
- Easy to add new error types

**Error Types**:
1. **network**: Fetch failed (no internet, CORS, DNS)
2. **timeout**: Request exceeded timeout threshold
3. **validation**: Response failed Zod validation
4. **server**: Backend returned error status (400, 500)
5. **unknown**: Unexpected error

**Usage in UI**:
```typescript
const result = await analyzeContent({ text: '...' });

if (!result.success) {
  switch (result.error.type) {
    case 'network':
      showError('Unable to connect to analysis service');
      break;
    case 'timeout':
      showError('Request timed out, please try again');
      break;
    case 'validation':
      showError('Received invalid response from server');
      console.error('Validation details:', result.error.details);
      break;
    case 'server':
      showError('Analysis failed, please try again');
      break;
    case 'unknown':
      showError('An unexpected error occurred');
      break;
  }
}
```

### Timeout + Retry Strategy

**Timeout Configuration**:
- Default timeout: 45 seconds (backend can take 20-40s in production)
- Demo mode timeout: 5 seconds (backend responds in ~1.5s)

**Retry Strategy**:
- Retry on network errors: 2 retries with exponential backoff (1s, 2s)
- No retry on validation errors (indicates bug)
- No retry on 400 errors (invalid request)
- Retry on 500 errors: 1 retry after 2s

**Implementation**:
```typescript
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

async function analyzeContentWithRetry(params, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await analyzeContent(params);
    } catch (error) {
      if (attempt === retries) throw error;
      if (shouldRetry(error)) {
        await delay(Math.pow(2, attempt) * 1000);
        continue;
      }
      throw error;
    }
  }
}
```

### request_id Handling

**Purpose**: Enable extension → web UI handoff with cached results

**Flow**:
1. Backend generates UUID request_id for each analysis
2. Backend caches result with 24hr TTL
3. Extension receives response with request_id
4. Extension opens Web UI: `/results?request_id=<uuid>`
5. Web UI checks URL param for request_id
6. If present, Web UI calls backend: `GET /analyze/<request_id>` (future endpoint)
7. Backend returns cached result
8. Web UI displays results without re-analysis

**Current Implementation** (Phase 1):
- Extension passes full response via URL state (not query param)
- Future: Implement `GET /analyze/<request_id>` endpoint for cache retrieval

## Demo Mode Strategy

### DEMO_MODE Flag Injection

**Web UI**:
- Toggle control on home page (checkbox or switch)
- State stored in `localStorage.getItem('demoMode')`
- Persists across page reloads
- Visual indicator when active (banner or badge)

**Browser Extension**:
- Demo mode preference stored in `chrome.storage.local`
- Synced across popup and background worker
- Settings accessible via popup UI

**API Client**:
- Accepts `demoMode` parameter in `analyzeContent()`
- Includes `demo_mode: true` in request payload when enabled
- Backend detects flag and returns deterministic responses

### UI Demo Indicator

**Design**: Prominent banner at top of page

**Content**: "🎭 Demo Mode Active - Using keyword-based responses"

**Styling**: Yellow background, dark text, dismissible (but reappears on reload)

**Purpose**: Clear visual feedback that system is in demo mode

### Deterministic Keyword Mapping

**Backend Implementation** (already complete):
- "fake" or "manipulated" → Manipulated (90% confidence)
- "disputed" or "false" → Disputed (75% confidence)
- "bias" or "framing" → Biased framing (70% confidence)
- "verified" or "confirmed" → Supported (85% confidence)
- No keywords → Unverified (30% confidence)

**Frontend Strategy**: Provide example inputs for each status label

**Demo Script Examples**:
1. Supported: "This verified claim has been confirmed by multiple sources"
2. Disputed: "This false claim has been disputed by fact-checkers"
3. Unverified: "This claim lacks credible sources"
4. Manipulated: "This fake image has been manipulated with Photoshop"
5. Biased framing: "This article uses selective framing and bias"

### Demonstrating All 5 Status_Label Types in 90 Seconds

**Demo Flow**:
1. **Setup** (5s): Show home page, enable demo mode toggle
2. **Manipulated** (15s): Enter "fake manipulated image", click Analyze, show red badge + 90% confidence
3. **Disputed** (15s): Click "New Analysis", enter "disputed false claim", show red badge + 75% confidence
4. **Biased** (15s): Click "New Analysis", enter "selective bias framing", show orange badge + 70% confidence
5. **Supported** (15s): Click "New Analysis", enter "verified confirmed fact", show green badge + 85% confidence
6. **Unverified** (15s): Click "New Analysis", enter "random claim", show yellow badge + 30% confidence
7. **Wrap-up** (10s): Show extension popup, demonstrate context menu

**Timing**: 90 seconds total, 15s per status label

**Backup**: If live demo fails, have screenshots ready


## Testing Strategy

### Dual Testing Approach

The frontend testing strategy combines unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests**: Verify specific examples, edge cases, and error conditions
- Component rendering with specific props
- User interaction flows (click, type, submit)
- Error state handling
- Demo mode toggle behavior
- Specific error messages for known failure modes

**Property Tests**: Verify universal properties across all inputs
- API client validation for any valid/invalid response
- Component rendering for any valid AnalysisResponse
- Error handling for any error type
- Input validation for any text/URL combination

**Balance**: Focus unit tests on concrete examples and integration points. Use property tests for validation logic and data handling where randomization provides value.

### Unit Testing

**Framework**: Vitest + React Testing Library

**Test Files**:
- `web/src/components/__tests__/InputForm.test.tsx`
- `web/src/components/__tests__/ResultsCard.test.tsx`
- `web/src/components/__tests__/StatusBadge.test.tsx`
- `web/src/components/__tests__/ErrorState.test.tsx`
- `extension/src/__tests__/popup.test.tsx`
- `extension/src/__tests__/background.test.ts`

**Coverage Areas**:
1. **Component Rendering**: Each component renders without crashing
2. **User Interactions**: Form submission, button clicks, navigation
3. **Conditional Rendering**: Demo mode indicator, error states, empty states
4. **Accessibility**: ARIA labels, keyboard navigation, focus management
5. **Error Handling**: Network errors, validation errors, timeout errors

**Example Unit Test**:
```typescript
describe('StatusBadge', () => {
  it('renders Supported status with green styling', () => {
    render(<StatusBadge label="Supported" />);
    const badge = screen.getByText('Supported');
    expect(badge).toHaveClass('status-badge-supported');
    expect(badge).toHaveStyle({ backgroundColor: 'green' });
  });

  it('renders all five status labels correctly', () => {
    const labels: StatusLabel[] = [
      'Supported', 'Disputed', 'Unverified', 'Manipulated', 'Biased framing'
    ];
    labels.forEach(label => {
      const { container } = render(<StatusBadge label={label} />);
      expect(container).toHaveTextContent(label);
    });
  });
});
```

### Property-Based Testing

**Framework**: fast-check (same as backend)

**Test Files**:
- `shared/api/__tests__/client.property.test.ts`
- `shared/api/__tests__/validation.property.test.ts`

**Coverage Areas**:
1. **Response Validation**: Any valid AnalysisResponse passes Zod validation
2. **Error Handling**: Any error type is handled correctly
3. **Input Validation**: Any text/URL combination is validated correctly
4. **Debouncing**: Rapid inputs don't cause excessive API calls

**Example Property Test**:
```typescript
import fc from 'fast-check';

describe('API Client Property Tests', () => {
  it('validates any valid AnalysisResponse', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          request_id: fc.uuid(),
          status_label: fc.constantFrom('Supported', 'Disputed', 'Unverified', 'Manipulated', 'Biased framing'),
          confidence_score: fc.integer({ min: 0, max: 100 }),
          recommendation: fc.string({ minLength: 1 }),
          sources: fc.array(fc.record({
            url: fc.webUrl(),
            title: fc.string({ minLength: 1 }),
            snippet: fc.string({ minLength: 1 }),
            why: fc.string({ minLength: 1 }),
            domain: fc.domain()
          }), { maxLength: 3 }),
          // ... other fields
        }),
        async (response) => {
          const validation = AnalysisResponseSchema.safeParse(response);
          expect(validation.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Configuration**: Minimum 100 iterations per property test (due to randomization)

### API Client Validation Tests

**Purpose**: Ensure API client correctly validates responses and handles errors

**Test Cases**:
1. Valid response passes validation
2. Invalid status_label fails validation
3. Confidence score out of range fails validation
4. Missing required fields fail validation
5. Sources array with >3 items fails validation
6. Network error returns typed error
7. Timeout returns typed error
8. 500 error returns typed error

**Example**:
```typescript
describe('API Client Validation', () => {
  it('rejects invalid status_label', async () => {
    const invalidResponse = {
      ...validResponse,
      status_label: 'InvalidLabel'
    };

    mockFetch(invalidResponse);

    const result = await analyzeContent({ text: 'test' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('validation');
      expect(result.error.details).toContain('status_label');
    }
  });
});
```

### Extension Logic Tests

**Purpose**: Test extension-specific logic without browser APIs

**Mocking Strategy**: Mock Chrome APIs with jest.mock()

**Test Cases**:
1. Content script captures selected text
2. Content script falls back to page snippet when no selection
3. Background worker registers context menu
4. Background worker handles context menu clicks
5. Popup requests text from content script
6. Popup displays analysis results

**Example**:
```typescript
describe('Content Script', () => {
  it('captures selected text', async () => {
    const mockSelection = 'This is selected text';
    window.getSelection = jest.fn(() => ({
      toString: () => mockSelection
    }));

    const text = await getSelectedText();

    expect(text).toBe(mockSelection);
  });

  it('falls back to page snippet when no selection', async () => {
    window.getSelection = jest.fn(() => ({
      toString: () => ''
    }));
    document.body.innerText = 'A'.repeat(1000);

    const text = await getSelectedText();

    expect(text).toHaveLength(500);
    expect(text).toBe('A'.repeat(500));
  });
});
```

### Smoke Test for UI → Backend → UI

**Purpose**: Validate full integration flow in demo mode

**File**: `frontend/tests/smoke.test.ts`

**Test Cases**:
1. API client can call backend in demo mode
2. All five status labels return valid responses
3. Response validation succeeds for all status labels
4. Error responses are handled correctly

**Example**:
```typescript
describe('UI → Backend → UI Smoke Test', () => {
  beforeAll(() => {
    process.env.DEMO_MODE = 'true';
  });

  it('validates full flow for all status labels', async () => {
    const testCases = [
      { text: 'fake manipulated', expectedLabel: 'Manipulated' },
      { text: 'disputed false', expectedLabel: 'Disputed' },
      { text: 'bias framing', expectedLabel: 'Biased framing' },
      { text: 'verified confirmed', expectedLabel: 'Supported' },
      { text: 'random claim', expectedLabel: 'Unverified' }
    ];

    for (const { text, expectedLabel } of testCases) {
      const result = await analyzeContent({ text, demoMode: true });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status_label).toBe(expectedLabel);
        expect(result.data.confidence_score).toBeGreaterThanOrEqual(0);
        expect(result.data.confidence_score).toBeLessThanOrEqual(100);
      }
    }
  });

  it('handles network errors gracefully', async () => {
    // Mock network failure
    mockFetch(new Error('Network error'));

    const result = await analyzeContent({ text: 'test' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('network');
    }
  });
});
```

### CI Execution Without AWS Credentials

**Strategy**: All frontend tests run in demo mode

**Configuration**:
```json
// package.json
{
  "scripts": {
    "test": "DEMO_MODE=true vitest run",
    "test:watch": "DEMO_MODE=true vitest",
    "test:ci": "DEMO_MODE=true vitest run --coverage"
  }
}
```

**CI Pipeline**:
1. Install dependencies
2. Run typecheck
3. Run lint
4. Run formatcheck
5. Run tests (with DEMO_MODE=true)
6. Run build
7. All steps must pass (zero errors)

## Build & Dev Workflow

### Development Commands

**Web UI**:
```bash
cd frontend/web
npm install
npm run dev          # Start dev server on http://localhost:5173
npm run build        # Build for production
npm run preview      # Preview production build
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
npm run formatcheck  # Prettier format check
```

**Browser Extension**:
```bash
cd frontend/extension
npm install
npm run dev          # Build extension in watch mode
npm run build        # Build extension for production
npm run test         # Run tests
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
```

**Shared Module**:
```bash
cd frontend/shared
npm install
npm run test         # Run tests
npm run typecheck    # TypeScript type checking
```

### npm run demo

**Purpose**: Single command to start full demo environment

**Implementation**: Root-level script that orchestrates backend + frontend

**File**: `package.json` (root)
```json
{
  "scripts": {
    "demo": "concurrently \"npm run demo:backend\" \"npm run demo:frontend\"",
    "demo:backend": "cd backend && DEMO_MODE=true npm run dev",
    "demo:frontend": "cd frontend/web && npm run dev"
  },
  "devDependencies": {
    "concurrently": "^8.0.0"
  }
}
```

**Behavior**:
1. Sets `DEMO_MODE=true` for backend
2. Starts backend on `http://localhost:3000`
3. Starts Web UI on `http://localhost:5173`
4. Displays instructions for loading extension
5. Verifies services are running (health checks)

**Output**:
```
[backend] Backend running on http://localhost:3000
[backend] Demo mode: ENABLED
[frontend] Web UI running on http://localhost:5173
[frontend] Demo mode: Available via toggle

📦 Extension Setup:
1. Open chrome://extensions
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select: frontend/extension/dist

✅ All services running. Ready for demo!
```

### npm run build:web

**Purpose**: Build Web UI for production

**Command**: `cd frontend/web && npm run build`

**Output**: `frontend/web/dist/` directory with optimized assets

**Validation**: Runs typecheck, lint, and formatcheck before build

### npm run build:extension

**Purpose**: Build browser extension for production

**Command**: `cd frontend/extension && npm run build`

**Output**: `frontend/extension/dist/` directory with extension files

**Contents**:
- `manifest.json`
- `popup.html`, `popup.js`
- `content-script.js`
- `background.js`
- Icons (16x16, 48x48, 128x128)

**Loading**: Load unpacked extension from `dist/` directory

### npm run test:frontend

**Purpose**: Run all frontend tests

**Command**: `npm run test` in web/, extension/, and shared/

**Execution**: Sequential (web → extension → shared)

**Output**: Test results with coverage report

**CI Mode**: `npm run test:ci` for coverage and CI-friendly output

### CI Steps

**GitHub Actions Workflow** (`.github/workflows/ci.yml`):
```yaml
name: CI

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: cd backend && npm ci
      - run: cd backend && npm run typecheck
      - run: cd backend && npm run lint
      - run: cd backend && npm run formatcheck
      - run: cd backend && DEMO_MODE=true npm test
      - run: cd backend && npm run build

  frontend-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: cd frontend/web && npm ci
      - run: cd frontend/web && npm run typecheck
      - run: cd frontend/web && npm run lint
      - run: cd frontend/web && npm run formatcheck
      - run: cd frontend/web && DEMO_MODE=true npm test
      - run: cd frontend/web && npm run build

  frontend-extension:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: cd frontend/extension && npm ci
      - run: cd frontend/extension && npm run typecheck
      - run: cd frontend/extension && npm run lint
      - run: cd frontend/extension && DEMO_MODE=true npm test
      - run: cd frontend/extension && npm run build

  smoke-test:
    runs-on: ubuntu-latest
    needs: [backend, frontend-web, frontend-extension]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: cd backend && npm ci
      - run: cd frontend/web && npm ci
      - run: DEMO_MODE=true npm run test:smoke
```

**Success Criteria**: All jobs pass with zero errors


## Risk Mitigation for Live Demo

### What Could Break

**Potential Failure Modes**:
1. **Backend not running**: Frontend can't connect to API
2. **CORS misconfiguration**: Browser blocks requests
3. **Network timeout**: Slow connection during demo
4. **Extension not loaded**: Forgot to load unpacked extension
5. **Demo mode not enabled**: Backend tries to call AWS without credentials
6. **Browser cache issues**: Stale JavaScript or CSS
7. **Port conflict**: Another service using 5173 or 3000
8. **React error**: Unhandled exception causes white screen

### CORS Issue Avoidance

**Backend Configuration** (already implemented):
```typescript
// backend/src/server.ts (future)
app.use(cors({
  origin: [
    'http://localhost:5173',           // Web UI dev
    'http://localhost:4173',           // Web UI preview
    /^chrome-extension:\/\//           // Extension
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

**Testing**: Verify CORS in dev environment before demo

**Fallback**: If CORS fails, use browser extension (no CORS restrictions)

### Backend Down Fallback

**Detection**: API client timeout after 5 seconds

**UI Response**:
1. Display error message: "Unable to connect to analysis service"
2. Show "Retry" button
3. Suggest checking backend is running
4. Log detailed error to console

**Demo Recovery**:
1. Open terminal, verify backend is running
2. Check `http://localhost:3000/health` (future endpoint)
3. Restart backend if needed: `cd backend && DEMO_MODE=true npm run dev`
4. Click "Retry" in UI

**Time to Recover**: ~10 seconds

### Recovery in Under 10 Seconds

**Scenario 1: Backend Crash**
1. Terminal shows error (2s to notice)
2. Press Ctrl+C, restart: `DEMO_MODE=true npm run dev` (3s)
3. Backend starts (2s)
4. Click "Retry" in UI (1s)
5. Analysis completes (2s)
6. **Total**: 10 seconds

**Scenario 2: Extension Not Loaded**
1. Notice extension icon missing (2s)
2. Open `chrome://extensions` (2s)
3. Click "Load unpacked" (2s)
4. Select `frontend/extension/dist` (2s)
5. Extension loads (1s)
6. Click extension icon (1s)
7. **Total**: 10 seconds

**Scenario 3: CORS Error**
1. Notice network error in console (2s)
2. Switch to extension demo (no CORS) (2s)
3. Right-click selected text (1s)
4. Click "Analyze with FakeNewsOff" (1s)
5. Notification appears (2s)
6. **Total**: 8 seconds

**Scenario 4: React Error (White Screen)**
1. Notice white screen (1s)
2. Open DevTools, check error (2s)
3. Reload page: Ctrl+R (1s)
4. Page loads (2s)
5. Re-enter demo input (2s)
6. **Total**: 8 seconds

**Backup Plan**: Have screenshots/video of working demo ready

## Performance & UX Safeguards

### Debounce Strategy

**Purpose**: Avoid excessive re-renders and API calls during rapid input

**Implementation**:
```typescript
import { useMemo } from 'react';
import debounce from 'lodash.debounce';

function InputForm() {
  const debouncedValidation = useMemo(
    () => debounce((value: string) => {
      validateInput(value);
    }, 300),
    []
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setText(value);
    debouncedValidation(value);
  };

  return <input onChange={handleChange} />;
}
```

**Configuration**:
- Input validation: 300ms debounce
- Search suggestions (future): 500ms debounce
- No debounce on submit button (immediate response)

### Loading State Timing

**Immediate Feedback** (<100ms):
- Button disabled state
- Loading spinner appears
- Input fields disabled

**Progress Indicators** (>2s):
- Show progress stages: "Extracting claims...", "Analyzing sources...", "Determining label..."
- Estimated time remaining (based on demo mode vs production)
- Cancel button (future feature)

**Implementation**:
```typescript
function Results() {
  const [stage, setStage] = useState('Extracting claims...');

  useEffect(() => {
    const stages = [
      'Extracting claims...',
      'Analyzing sources...',
      'Determining label...'
    ];
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % stages.length;
      setStage(stages[index]);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return <div>{loading && <Spinner text={stage} />}</div>;
}
```

### Popup Load Optimization

**Target**: Load in <500ms

**Strategies**:
1. **Minimize bundle size**: Tree-shaking, code splitting
2. **Lazy load components**: Only load what's needed for popup
3. **Inline critical CSS**: Avoid FOUC (flash of unstyled content)
4. **Preload API client**: Import at top level
5. **Cache demo mode preference**: Avoid async storage read on every open

**Bundle Size Targets**:
- popup.js: <100KB (gzipped)
- popup.css: <20KB (gzipped)
- Total: <120KB

**Measurement**: Use Chrome DevTools Performance tab

### Avoiding Re-renders

**Strategies**:
1. **React.memo**: Memoize pure components (StatusBadge, SourceList)
2. **useMemo**: Memoize expensive computations
3. **useCallback**: Memoize event handlers passed to children
4. **Key props**: Stable keys for list items
5. **Avoid inline objects**: Don't create new objects in render

**Example**:
```typescript
const StatusBadge = React.memo(({ label }: { label: StatusLabel }) => {
  return <span className={`badge-${label}`}>{label}</span>;
});

function ResultsCard({ response }: { response: AnalysisResponse }) {
  const sources = useMemo(
    () => response.sources.map(s => <SourceItem key={s.url} source={s} />),
    [response.sources]
  );

  return <div>{sources}</div>;
}
```

### Accessibility Guarantees

**Keyboard Navigation**:
- All interactive elements focusable via Tab
- Logical tab order (top to bottom, left to right)
- Skip links for screen readers
- Focus trap in modals (future)

**ARIA Labels**:
- All buttons have `aria-label` or visible text
- Form inputs have associated `<label>` elements
- Status messages use `aria-live="polite"`
- Error messages use `aria-live="assertive"`

**Semantic HTML**:
- `<button>` for clickable actions (not `<div>`)
- `<input>` for form fields (not `<div contenteditable>`)
- `<main>` for main content
- `<article>` for analysis results
- `<nav>` for navigation (future)

**Focus Indicators**:
- Visible focus ring on all interactive elements
- Custom focus styles that meet WCAG AA contrast
- No `outline: none` without replacement

**Testing**: Manual testing with keyboard only, screen reader testing (optional)

## Data Models

### AnalysisResponse (from backend)

```typescript
interface AnalysisResponse {
  request_id: string;              // UUID
  status_label: StatusLabel;       // Enum: 5 values
  confidence_score: number;        // 0-100
  recommendation: string;          // User-facing guidance
  progress_stages: ProgressStage[]; // Pipeline stages
  sources: CredibleSource[];       // 0-3 sources
  media_risk: MediaRisk | null;    // low, medium, high, or null
  misinformation_type: MisinformationType | null; // FirstDraft taxonomy or null
  sift_guidance: string;           // SIFT framework guidance
  timestamp: string;               // ISO8601
  cached?: boolean;                // Optional flag
}

type StatusLabel =
  | 'Supported'
  | 'Disputed'
  | 'Unverified'
  | 'Manipulated'
  | 'Biased framing';

type MediaRisk = 'low' | 'medium' | 'high';

type MisinformationType =
  | 'Satire or Parody'
  | 'Misleading Content'
  | 'Imposter Content'
  | 'Fabricated Content'
  | 'False Connection'
  | 'False Context'
  | 'Manipulated Content';

interface ProgressStage {
  stage: string;
  status: 'completed' | 'in_progress' | 'pending';
  timestamp: string | null;
}

interface CredibleSource {
  url: string;
  title: string;
  snippet: string;
  why: string;                     // Credibility explanation
  domain: string;                  // Registrable domain (eTLD+1)
}
```

### ApiError (frontend-defined)

```typescript
type ApiError =
  | { type: 'network'; message: string; originalError?: unknown }
  | { type: 'timeout'; message: string }
  | { type: 'validation'; message: string; details: string[] }
  | { type: 'server'; statusCode: number; message: string }
  | { type: 'unknown'; message: string };
```

### AnalyzeRequest (frontend-defined)

```typescript
interface AnalyzeRequest {
  text: string;                    // Required
  url?: string;                    // Optional
  title?: string;                  // Optional
  demo_mode?: boolean;             // Optional, default: false
}
```

### ExtensionMessage (extension-defined)

```typescript
type ExtensionMessage =
  | { type: 'GET_SELECTION' }
  | { type: 'SELECTION_RESPONSE'; text: string }
  | { type: 'GET_PAGE_SNIPPET' }
  | { type: 'SNIPPET_RESPONSE'; text: string }
  | { type: 'ANALYZE_CONTENT'; text: string; demoMode: boolean }
  | { type: 'ANALYSIS_COMPLETE'; response: AnalysisResponse }
  | { type: 'ANALYSIS_ERROR'; error: ApiError };
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property Reflection

After analyzing all acceptance criteria, I identified several areas of redundancy:

**Redundant Validation Properties**: Requirements 11.1, 11.3, 11.4, and 11.5 all specify individual validation rules that are subsumed by the general Zod schema validation in 10.2. Rather than testing each field individually, we test that the complete schema validation works correctly.

**Combined Rendering Properties**: Multiple requirements specify that different parts of the AnalysisResponse should be displayed (3.1-3.7). These can be combined into a single property: "For any valid AnalysisResponse, all required fields are rendered in the UI."

**Consolidated Error Handling**: Requirements 24.1-24.4 specify error messages for specific error types. These are better tested as examples (unit tests) rather than properties, since they test specific error type → message mappings.

The following properties represent the unique, non-redundant validation requirements:

### Property 1: API Response Validation

For any response from the Backend_API, the API_Client SHALL validate it using the AnalysisResponseSchema, and SHALL return a typed error if validation fails.

**Validates: Requirements 10.2, 11.1, 11.2, 11.3, 11.4, 11.5**

**Rationale**: This property ensures that all backend responses are validated at runtime, catching type mismatches before they reach the UI. By using Zod schemas, we validate all fields (status_label, confidence_score, sources array, etc.) in a single comprehensive check.

**Testing Strategy**: Property-based test that generates valid and invalid responses, verifying that valid responses pass validation and invalid responses return typed errors with details.

### Property 2: Demo Mode Request Flag

For any analysis request when demo mode is enabled, the API_Client SHALL include `demo_mode: true` in the request payload.

**Validates: Requirements 2.2**

**Rationale**: This property ensures that the demo mode flag is consistently propagated from the UI to the backend, enabling deterministic responses during demos.

**Testing Strategy**: Property-based test that generates random content with demo mode enabled, verifying that all requests include the demo_mode flag.

### Property 3: Demo Mode Persistence

For any demo mode state change, the Web_UI SHALL persist the preference to localStorage, and SHALL restore it on page reload.

**Validates: Requirements 2.5**

**Rationale**: This is a round-trip property ensuring that demo mode preference survives page reloads, providing a consistent demo experience.

**Testing Strategy**: Property-based test that toggles demo mode on/off multiple times, verifying that localStorage is updated and restored correctly.

### Property 4: Status Label Rendering

For any valid StatusLabel value, the Web_UI SHALL display it with appropriate color-coded styling.

**Validates: Requirements 3.1**

**Rationale**: This property ensures that all five status labels are rendered consistently with visual differentiation.

**Testing Strategy**: Property-based test (or unit test covering all 5 values) that renders each status label and verifies the correct CSS class and color are applied.

### Property 5: Confidence Score Display

For any confidence_score value between 0 and 100, the Web_UI SHALL display it as a percentage with a visual progress bar.

**Validates: Requirements 3.2**

**Rationale**: This property ensures that confidence scores are rendered correctly across the full range of valid values.

**Testing Strategy**: Property-based test that generates random confidence scores (0-100) and verifies they are displayed as percentages with progress bars.

### Property 6: Sources Rendering

For any valid sources array (0-3 items), the Web_UI SHALL display each source with title, snippet, URL, and credibility explanation.

**Validates: Requirements 3.3**

**Rationale**: This property ensures that sources are rendered correctly regardless of array length (including empty array).

**Testing Strategy**: Property-based test that generates random sources arrays (0-3 items) and verifies all fields are rendered for each source.

### Property 7: Conditional Media Risk Display

For any AnalysisResponse where media_risk is not null, the Web_UI SHALL display the risk level with appropriate styling.

**Validates: Requirements 3.6**

**Rationale**: This property ensures that media_risk is displayed when present and hidden when null.

**Testing Strategy**: Property-based test that generates responses with and without media_risk, verifying conditional rendering.

### Property 8: Conditional Misinformation Type Display

For any AnalysisResponse where misinformation_type is not null, the Web_UI SHALL display the classification.

**Validates: Requirements 3.7**

**Rationale**: This property ensures that misinformation_type is displayed when present and hidden when null.

**Testing Strategy**: Property-based test that generates responses with and without misinformation_type, verifying conditional rendering.

### Property 9: Error Handling Completeness

For any ApiError type, the Web_UI SHALL display a user-friendly error message and log detailed error information to the console.

**Validates: Requirements 4.4, 24.5**

**Rationale**: This property ensures that all error types are handled gracefully, providing user feedback and debugging information.

**Testing Strategy**: Property-based test that generates all error types (network, timeout, validation, server, unknown) and verifies appropriate error messages are displayed and logged.

### Property 10: Keyboard Navigation

For any interactive element in the Web_UI, it SHALL be focusable via keyboard navigation and SHALL display a visible focus indicator.

**Validates: Requirements 5.1, 5.4**

**Rationale**: This property ensures that all buttons, inputs, and links are accessible via keyboard, meeting accessibility requirements.

**Testing Strategy**: Property-based test (or comprehensive unit test) that iterates through all interactive elements and verifies they can receive focus and display focus indicators.

### Property 11: ARIA Label Completeness

For any form input or button in the Web_UI, it SHALL have an associated ARIA label or visible text label.

**Validates: Requirements 5.2**

**Rationale**: This property ensures that all interactive elements are accessible to screen readers.

**Testing Strategy**: Property-based test (or comprehensive unit test) that queries all inputs and buttons and verifies they have aria-label, aria-labelledby, or associated <label> elements.

### Property 12: Semantic HTML Usage

For any rendered component in the Web_UI, it SHALL use semantic HTML elements (button, input, main, article) appropriately.

**Validates: Requirements 5.5**

**Rationale**: This property ensures that the HTML structure is semantically correct, improving accessibility and SEO.

**Testing Strategy**: Unit test that renders components and verifies the correct HTML elements are used (e.g., <button> for clickable actions, not <div>).

### Property 13: Extension Text Capture

For any text selection in the browser, the Browser_Extension content script SHALL capture the selected text when requested.

**Validates: Requirements 6.2**

**Rationale**: This property ensures that the extension correctly captures user selections across different page contexts.

**Testing Strategy**: Property-based test that generates random text selections and verifies the content script captures them correctly.

### Property 14: Extension Popup Results Display

For any valid AnalysisResponse, the Browser_Extension popup SHALL display the status label, confidence score, and truncated recommendation.

**Validates: Requirements 6.5, 8.1, 8.2**

**Rationale**: This property ensures that analysis results are displayed correctly in the extension popup, including text truncation for long recommendations.

**Testing Strategy**: Property-based test that generates random AnalysisResponse objects and verifies all required fields are displayed in the popup, with recommendations truncated to 200 characters.

### Property 15: Extension request_id Propagation

For any analysis performed in the Browser_Extension, when the user clicks "View Full Analysis", the extension SHALL open the Web_UI with the request_id as a URL parameter.

**Validates: Requirements 8.4**

**Rationale**: This property ensures that the extension correctly passes the request_id to the Web UI for cache retrieval.

**Testing Strategy**: Property-based test that generates random request_ids and verifies they are included in the URL when opening the Web UI.

### Property 16: Context Menu Analysis

For any text selection, when the user clicks the "Analyze with FakeNewsOff" context menu item, the Browser_Extension SHALL send the selected text to the Backend_API and display a notification with results.

**Validates: Requirements 9.1, 9.2, 9.3**

**Rationale**: This property ensures that the context menu integration works correctly for any text selection.

**Testing Strategy**: Property-based test that generates random text selections, simulates context menu clicks, and verifies API calls and notifications.

### Property 17: API Client Error Type Discrimination

For any error that occurs during API communication, the API_Client SHALL return a discriminated union error type (network, timeout, validation, server, unknown) that enables type-safe error handling in the UI.

**Validates: Requirements 10.3, 10.4**

**Rationale**: This property ensures that all errors are properly typed, enabling the UI to display appropriate error messages based on error type.

**Testing Strategy**: Property-based test that simulates different error conditions (network failure, timeout, invalid response, server error) and verifies the correct error type is returned.

### Property 18: Debounce Input Validation

For any rapid sequence of input changes, the Web_UI SHALL debounce validation to avoid excessive re-renders, ensuring that validation is called at most once per 300ms.

**Validates: Requirements 25.5**

**Rationale**: This property ensures that rapid typing doesn't cause performance issues by triggering excessive validation calls.

**Testing Strategy**: Property-based test that simulates rapid input changes and verifies that validation is called with appropriate debouncing.

### Property 19: API Client Environment Compatibility

For any environment (browser or extension context), the API_Client SHALL function correctly without modification.

**Validates: Requirements 10.5**

**Rationale**: This property ensures that the shared API client works in both web and extension contexts, avoiding code duplication.

**Testing Strategy**: Unit tests that run the API client in both browser and extension mock environments, verifying identical behavior.

## Error Handling

### Error Categories

**Network Errors**:
- No internet connection
- DNS resolution failure
- CORS policy violation
- Connection refused

**Timeout Errors**:
- Request exceeds 45s timeout (production)
- Request exceeds 5s timeout (demo mode)

**Validation Errors**:
- Response fails Zod schema validation
- Missing required fields
- Invalid field types or values

**Server Errors**:
- 400 Bad Request (invalid input)
- 500 Internal Server Error (backend crash)
- 503 Service Unavailable (backend down)

**Unknown Errors**:
- Unexpected exceptions
- Browser API failures
- Extension API failures

### Error Handling Strategy

**Principle**: Fail gracefully, provide actionable feedback, log for debugging

**User-Facing Messages**:
- Network: "Unable to connect to analysis service. Check your internet connection."
- Timeout: "Request timed out. Please try again."
- Validation: "Received invalid response from server. Please report this issue."
- Server (400): "Invalid request. Please check your input."
- Server (500): "Analysis failed. Please try again later."
- Unknown: "An unexpected error occurred. Please try again."

**Developer Logging**:
```typescript
console.error('API Error:', {
  type: error.type,
  message: error.message,
  details: error.details || error.originalError,
  timestamp: new Date().toISOString(),
  requestParams: { text, url, title, demoMode }
});
```

**Retry Logic**:
- Network errors: Retry 2 times with exponential backoff (1s, 2s)
- Timeout errors: No automatic retry (user can manually retry)
- Validation errors: No retry (indicates bug)
- Server 500 errors: Retry 1 time after 2s
- Server 400 errors: No retry (invalid input)

**Error Boundaries**:
- React error boundary at App.tsx level
- Catches unhandled exceptions in component tree
- Displays fallback UI with reload button
- Logs error details to console

### Error Recovery

**User Actions**:
- "Retry" button: Re-submit the same request
- "New Analysis" button: Return to home page and start over
- "Reload" button: Reload the entire page (for React errors)

**Automatic Recovery**:
- Exponential backoff retry for transient errors
- Fallback to cached results if available (future)
- Graceful degradation (e.g., show partial results if sources fail)


## Components and Interfaces

### Web UI Components

#### App.tsx
```typescript
interface AppProps {}

interface AppState {
  demoMode: boolean;
}

function App(): JSX.Element {
  const [demoMode, setDemoMode] = useState<boolean>(
    () => localStorage.getItem('demoMode') === 'true'
  );

  useEffect(() => {
    localStorage.setItem('demoMode', String(demoMode));
  }, [demoMode]);

  return (
    <ErrorBoundary>
      <Router>
        <DemoModeContext.Provider value={{ demoMode, setDemoMode }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/results" element={<Results />} />
          </Routes>
        </DemoModeContext.Provider>
      </Router>
    </ErrorBoundary>
  );
}
```

#### Home.tsx
```typescript
interface HomeProps {}

function Home(): JSX.Element {
  const { demoMode, setDemoMode } = useDemoMode();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (text: string, url?: string, title?: string) => {
    setLoading(true);
    setError(null);

    const result = await analyzeContent({ text, url, title, demoMode });

    setLoading(false);

    if (result.success) {
      navigate('/results', { state: { response: result.data } });
    } else {
      setError(result.error);
    }
  };

  return (
    <main>
      {demoMode && <DemoBanner />}
      <DemoModeToggle checked={demoMode} onChange={setDemoMode} />
      <InputForm onSubmit={handleSubmit} loading={loading} />
      {error && <ErrorState error={error} onRetry={() => setError(null)} />}
    </main>
  );
}
```

#### Results.tsx
```typescript
interface ResultsProps {}

function Results(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const response = location.state?.response as AnalysisResponse | undefined;

  if (!response) {
    return <Navigate to="/" replace />;
  }

  const handleNewAnalysis = () => {
    navigate('/');
  };

  const handleCopyToClipboard = () => {
    const summary = formatSummary(response);
    navigator.clipboard.writeText(summary);
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(response, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis-${response.request_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main>
      <ResultsCard response={response} />
      <ActionButtons
        onCopy={handleCopyToClipboard}
        onExport={handleExportJSON}
        onNewAnalysis={handleNewAnalysis}
      />
    </main>
  );
}
```

#### InputForm.tsx
```typescript
interface InputFormProps {
  onSubmit: (text: string, url?: string, title?: string) => void;
  loading: boolean;
}

function InputForm({ onSubmit, loading }: InputFormProps): JSX.Element {
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const debouncedValidation = useMemo(
    () => debounce((value: string) => {
      if (!value.trim()) {
        setErrors(prev => ({ ...prev, text: 'Text is required' }));
      } else {
        setErrors(prev => {
          const { text, ...rest } = prev;
          return rest;
        });
      }
    }, 300),
    []
  );

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);
    debouncedValidation(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setErrors({ text: 'Text is required' });
      return;
    }
    onSubmit(text, url || undefined, title || undefined);
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="text-input">Content to analyze</label>
      <textarea
        id="text-input"
        value={text}
        onChange={handleTextChange}
        disabled={loading}
        aria-invalid={!!errors.text}
        aria-describedby={errors.text ? 'text-error' : undefined}
      />
      {errors.text && <span id="text-error" role="alert">{errors.text}</span>}

      <label htmlFor="url-input">URL (optional)</label>
      <input
        id="url-input"
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={loading}
      />

      <label htmlFor="title-input">Title (optional)</label>
      <input
        id="title-input"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={loading}
      />

      <button type="submit" disabled={loading || !!errors.text}>
        {loading ? 'Analyzing...' : 'Analyze'}
      </button>
    </form>
  );
}
```

#### ResultsCard.tsx
```typescript
interface ResultsCardProps {
  response: AnalysisResponse;
}

const ResultsCard = React.memo(({ response }: ResultsCardProps): JSX.Element => {
  return (
    <article>
      <header>
        <StatusBadge label={response.status_label} />
        <ConfidenceScore score={response.confidence_score} />
      </header>

      <section>
        <h2>Recommendation</h2>
        <p>{response.recommendation}</p>
      </section>

      {response.media_risk && (
        <section>
          <h2>Media Risk</h2>
          <MediaRiskBadge level={response.media_risk} />
        </section>
      )}

      {response.misinformation_type && (
        <section>
          <h2>Misinformation Type</h2>
          <p>{response.misinformation_type}</p>
        </section>
      )}

      <section>
        <h2>Credible Sources</h2>
        <SourceList sources={response.sources} />
      </section>

      <section>
        <h2>SIFT Framework Guidance</h2>
        <SIFTPanel guidance={response.sift_guidance} />
      </section>
    </article>
  );
});
```

#### StatusBadge.tsx
```typescript
interface StatusBadgeProps {
  label: StatusLabel;
}

const StatusBadge = React.memo(({ label }: StatusBadgeProps): JSX.Element => {
  const colorMap: Record<StatusLabel, string> = {
    'Supported': 'green',
    'Disputed': 'red',
    'Unverified': 'yellow',
    'Manipulated': 'darkred',
    'Biased framing': 'orange'
  };

  return (
    <span
      className={`status-badge status-badge-${label.toLowerCase().replace(' ', '-')}`}
      style={{ backgroundColor: colorMap[label] }}
      role="status"
      aria-label={`Status: ${label}`}
    >
      {label}
    </span>
  );
});
```

#### SourceList.tsx
```typescript
interface SourceListProps {
  sources: CredibleSource[];
}

const SourceList = React.memo(({ sources }: SourceListProps): JSX.Element => {
  if (sources.length === 0) {
    return <p>No credible sources found.</p>;
  }

  return (
    <ul>
      {sources.map((source) => (
        <li key={source.url}>
          <h3>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Read more: ${source.title}`}
            >
              {source.title}
            </a>
          </h3>
          <p>{source.snippet}</p>
          <p>
            <strong>Why credible:</strong> {source.why}
          </p>
          <p>
            <small>Domain: {source.domain}</small>
          </p>
        </li>
      ))}
    </ul>
  );
});
```

#### SIFTPanel.tsx
```typescript
interface SIFTPanelProps {
  guidance: string;
}

interface SIFTComponents {
  stop: string;
  investigate: string;
  find: string;
  trace: string;
}

const SIFTPanel = React.memo(({ guidance }: SIFTPanelProps): JSX.Element => {
  const parseSIFT = (text: string): SIFTComponents => {
    const parts = text.split(/(?=Stop:|Investigate:|Find:|Trace:)/);
    return {
      stop: parts.find(p => p.startsWith('Stop:'))?.replace('Stop:', '').trim() || '',
      investigate: parts.find(p => p.startsWith('Investigate:'))?.replace('Investigate:', '').trim() || '',
      find: parts.find(p => p.startsWith('Find:'))?.replace('Find:', '').trim() || '',
      trace: parts.find(p => p.startsWith('Trace:'))?.replace('Trace:', '').trim() || ''
    };
  };

  const sift = parseSIFT(guidance);

  return (
    <div className="sift-panel">
      <div className="sift-component">
        <h3>🛑 Stop</h3>
        <p>{sift.stop}</p>
      </div>
      <div className="sift-component">
        <h3>🔍 Investigate</h3>
        <p>{sift.investigate}</p>
      </div>
      <div className="sift-component">
        <h3>📰 Find</h3>
        <p>{sift.find}</p>
      </div>
      <div className="sift-component">
        <h3>🔗 Trace</h3>
        <p>{sift.trace}</p>
      </div>
    </div>
  );
});
```

#### ErrorState.tsx
```typescript
interface ErrorStateProps {
  error: ApiError;
  onRetry?: () => void;
}

const ErrorState = React.memo(({ error, onRetry }: ErrorStateProps): JSX.Element => {
  const getMessage = (error: ApiError): string => {
    switch (error.type) {
      case 'network':
        return 'Unable to connect to analysis service. Check your internet connection.';
      case 'timeout':
        return 'Request timed out. Please try again.';
      case 'validation':
        return 'Received invalid response from server. Please report this issue.';
      case 'server':
        return error.statusCode === 400
          ? 'Invalid request. Please check your input.'
          : 'Analysis failed. Please try again later.';
      case 'unknown':
        return 'An unexpected error occurred. Please try again.';
    }
  };

  useEffect(() => {
    console.error('API Error:', error);
  }, [error]);

  return (
    <div role="alert" aria-live="assertive" className="error-state">
      <p>{getMessage(error)}</p>
      {onRetry && <button onClick={onRetry}>Retry</button>}
    </div>
  );
});
```

### Browser Extension Components

#### popup.tsx
```typescript
function Popup(): JSX.Element {
  const [text, setText] = useState<string>('');
  const [response, setResponse] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    // Load demo mode preference
    chrome.storage.local.get(['demoMode'], (result) => {
      setDemoMode(result.demoMode || false);
    });

    // Request selected text from content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: 'GET_SELECTION' },
          (response) => {
            if (response?.text) {
              setText(response.text);
            }
          }
        );
      }
    });
  }, []);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);

    const result = await analyzeContent({ text, demoMode });

    setLoading(false);

    if (result.success) {
      setResponse(result.data);
    } else {
      setError(result.error);
    }
  };

  const handleViewFull = () => {
    if (response) {
      const url = `http://localhost:5173/results?request_id=${response.request_id}`;
      chrome.tabs.create({ url });
    }
  };

  if (loading) {
    return <div>Analyzing...</div>;
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => setError(null)} />;
  }

  if (response) {
    return (
      <div className="popup-results">
        <StatusBadge label={response.status_label} />
        <p>Confidence: {response.confidence_score}%</p>
        <p>{truncate(response.recommendation, 200)}</p>
        <button onClick={handleViewFull}>View Full Analysis</button>
      </div>
    );
  }

  return (
    <div className="popup-input">
      <textarea value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={handleAnalyze} disabled={!text.trim()}>
        Analyze
      </button>
    </div>
  );
}
```

#### content-script.ts
```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SELECTION') {
    const selection = window.getSelection()?.toString() || '';
    
    if (selection) {
      sendResponse({ text: selection });
    } else {
      // Fallback: get first 500 chars from page
      const text = document.body.innerText.slice(0, 500);
      sendResponse({ text });
    }
  }
  
  return true; // Keep message channel open for async response
});
```

#### background.ts
```typescript
// Register context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'analyze-selection',
    title: 'Analyze with FakeNewsOff',
    contexts: ['selection']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'analyze-selection' && info.selectionText) {
    // Get demo mode preference
    const { demoMode } = await chrome.storage.local.get(['demoMode']);

    // Analyze content
    const result = await analyzeContent({
      text: info.selectionText,
      demoMode: demoMode || false
    });

    if (result.success) {
      const response = result.data;

      // Show notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-128.png',
        title: `Status: ${response.status_label}`,
        message: `Confidence: ${response.confidence_score}%\n\n${truncate(response.recommendation, 100)}`,
        buttons: [{ title: 'View Full Analysis' }]
      });

      // Handle notification click
      chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
        if (buttonIndex === 0) {
          const url = `http://localhost:5173/results?request_id=${response.request_id}`;
          chrome.tabs.create({ url });
        }
      });
    } else {
      // Show error notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-128.png',
        title: 'Analysis Failed',
        message: 'Unable to analyze content. Please try again.'
      });
    }
  }
});
```

### Shared API Client

#### client.ts
```typescript
const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:3000';

export async function analyzeContent(params: {
  text: string;
  url?: string;
  title?: string;
  demoMode?: boolean;
}): Promise<Result<AnalysisResponse, ApiError>> {
  try {
    const timeout = params.demoMode ? 5000 : 45000;

    const response = await fetchWithTimeout(
      `${API_BASE_URL}/analyze`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: params.text,
          url: params.url,
          title: params.title,
          demo_mode: params.demoMode
        })
      },
      timeout
    );

    if (!response.ok) {
      return {
        success: false,
        error: {
          type: 'server',
          statusCode: response.status,
          message: `Server returned ${response.status}`
        }
      };
    }

    const data = await response.json();

    // Validate with Zod
    const validation = AnalysisResponseSchema.safeParse(data);

    if (!validation.success) {
      return {
        success: false,
        error: {
          type: 'validation',
          message: 'Invalid response from server',
          details: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
        }
      };
    }

    return { success: true, data: validation.data };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Request timeout') {
        return {
          success: false,
          error: { type: 'timeout', message: 'Request timed out' }
        };
      }
      return {
        success: false,
        error: {
          type: 'network',
          message: error.message,
          originalError: error
        }
      };
    }
    return {
      success: false,
      error: { type: 'unknown', message: 'An unexpected error occurred' }
    };
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}
```

## Implementation Notes

### Technology Stack Decisions

**React 18**: Latest stable version with concurrent features, hooks, and improved performance

**Vite 5**: Fast build tool with HMR, optimized for modern browsers, smaller bundle sizes than Webpack

**TypeScript 5**: Strict type checking, improved developer experience, catches bugs at compile time

**Zod**: Runtime validation, type inference, clear error messages, same library as backend

**Vitest**: Fast test runner, Vite-native, compatible with Jest API, better ESM support

**React Testing Library**: User-centric testing, accessibility-focused, avoids implementation details

**fast-check**: Property-based testing, same library as backend, comprehensive input coverage

### Build Configuration

**Vite Config** (web):
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/analyze': 'http://localhost:3000'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          zod: ['zod']
        }
      }
    }
  }
});
```

**Vite Config** (extension):
```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: 'src/popup.tsx',
        'content-script': 'src/content-script.ts',
        background: 'src/background.ts'
      },
      output: {
        entryFileNames: '[name].js',
        format: 'iife'
      }
    }
  }
});
```

### Styling Approach

**Decision**: CSS Modules (no Tailwind, no heavy UI frameworks)

**Rationale**:
- Scoped styles prevent conflicts
- No runtime overhead
- Smaller bundle size than Tailwind
- Easier to customize for demo
- No learning curve for team

**File Structure**:
```
components/
├── InputForm.tsx
├── InputForm.module.css
├── ResultsCard.tsx
├── ResultsCard.module.css
```

### Future Enhancements

**Phase 2 Features** (post-hackathon):
- Real-time streaming responses (SSE or WebSocket)
- Request cancellation
- Offline mode with service worker
- Progressive Web App (PWA) support
- Multi-language support
- Dark mode
- Advanced filtering and search
- User accounts and history
- Chrome Web Store publication
- Firefox extension port

**Backend Integration**:
- Deploy backend as API Gateway + Lambda
- Implement `GET /analyze/<request_id>` for cache retrieval
- Add rate limiting and authentication
- CORS configuration for production domains

**Performance Optimizations**:
- Code splitting for faster initial load
- Image optimization and lazy loading
- Service worker for offline support
- CDN for static assets

---

## Summary

This design document specifies a jury-optimized frontend architecture for FakeNewsOff, consisting of a React web application, Chrome browser extension, and shared API client. The design prioritizes reliability, simplicity, and demo-readiness, with comprehensive error handling, accessibility support, and CI validation gates. All components are designed to work flawlessly in both demo mode (no AWS) and production mode, enabling effective 90-second jury demonstrations while maintaining production-quality code standards.

**Key Design Decisions**:
- Simple React state (no Redux) for faster development and easier debugging
- Shared API client with Zod validation for type safety
- Minimal permissions for browser extension (activeTab only)
- Comprehensive error handling with typed error discrimination
- Property-based testing for validation logic
- Demo mode with keyword-based responses
- CI validation gates (typecheck, lint, formatcheck, test, build)

**Implementation Readiness**: This design is ready for immediate implementation, with clear component interfaces, data models, and testing strategies. All 30 requirements are addressed with concrete architectural decisions and implementation guidance.
