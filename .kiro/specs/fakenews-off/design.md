# Technical Design Document: Deterministic Hackathon Demo

## Overview

This design extends the FakeNewsOff system with a deterministic demo mode for the "Try an Example" feature. The enhancement ensures reliable demonstration of system capabilities during hackathon judging by providing deterministic evidence responses for example claims, eliminating dependency on external API availability while maintaining full pipeline execution.

The feature demonstrates three core verification outcomes:
1. **Supported**: Claim backed by credible evidence (green indicators)
2. **Disputed**: Claim contradicted by credible evidence (red indicators)
3. **Unverified**: Insufficient evidence to verify claim (yellow indicators)

All three examples execute the complete verification pipeline including evidence retrieval, credibility assessment, stance classification, explainable AI reasoning, and appropriate UI rendering (evidence graph for supported/disputed, empty state for unverified, SIFT panel for unverified).

### Key Design Principles

- **Determinism**: Identical claims always produce identical results
- **Full Pipeline Execution**: Demo mode executes all verification stages
- **Zero External Dependencies**: No reliance on Bing, GDELT, or other external APIs
- **API Contract Consistency**: Demo responses match production schema exactly
- **Performance**: Complete analysis in under 2 seconds
- **Visual Clarity**: Color-coded outcomes for instant recognition

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ExampleClaims Component                                  │  │
│  │  • Displays 3 example claims                              │  │
│  │  • Sets demo_mode=true on click                           │  │
│  │  • Auto-submits form                                      │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                          │
│                       │ POST /analyze                            │
│                       │ { text: "...", demo_mode: true }         │
│                       │                                          │
└───────────────────────┼──────────────────────────────────────────┘
                        │
┌───────────────────────┼──────────────────────────────────────────┐
│                       │         BACKEND LAYER                     │
├───────────────────────┼───────────────────────────────────────────┤
│                       ▼                                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Lambda Handler                                           │  │
│  │  • Checks demo_mode flag                                  │  │
│  │  • Routes to demo or production pipeline                  │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                          │
│                       ▼                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Verification Pipeline (Full Execution)                   │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  1. Claim Intake                                    │  │  │
│  │  │  2. Claim Framing                                   │  │  │
│  │  │  3. Evidence Retrieval ──┐                          │  │  │
│  │  │  4. Source Screening      │                          │  │  │
│  │  │  5. Credibility Assessment│                          │  │  │
│  │  │  6. Stance Classification │                          │  │  │
│  │  │  7. Bedrock Reasoning     │                          │  │  │
│  │  │  8. Verdict Generation    │                          │  │  │
│  │  │  9. Response Packaging    │                          │  │  │
│  │  └────────────────────────────┼──────────────────────┘  │  │
│  └─────────────────────────────────┼──────────────────────────┘  │
│                                    │                              │
│                                    ▼                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Demo Evidence Provider (demo_mode=true)                  │  │
│  │  • In-memory evidence database                            │  │
│  │  • Deterministic source selection                         │  │
│  │  • Hash-based claim matching                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                    RESULTS RENDERING                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Supported Claim:                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ✓ Supported (Green)                                      │  │
│  │  • Evidence Graph Component                               │  │
│  │  • 2-3 sources from distinct domains                      │  │
│  │  • Explainable AI trace                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Disputed Claim:                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ✗ Disputed (Red)                                         │  │
│  │  • Evidence Graph Component                               │  │
│  │  • 2-3 contradicting sources                              │  │
│  │  • Explainable AI trace                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Unverified Claim:                                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ? Unverified (Yellow)                                    │  │
│  │  • Empty Evidence State Component                         │  │
│  │  • SIFT Framework Panel                                   │  │
│  │  • Explainable AI trace                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Frontend: ExampleClaims Component Enhancement

**Current State**: Component displays 3 example claims and populates input form on click.

**Required Changes**:
- Add `demo_mode: true` to request payload when example claim is clicked
- Maintain existing click behavior (populate form + auto-submit)
- No visual changes required

**Implementation**:

```typescript
// frontend/web/src/components/ExampleClaims.tsx

interface ExampleClaim {
  id: string;
  text: string;
  category: 'supported' | 'disputed' | 'unverified';
  description: string;
}

interface ExampleClaimsProps {
  onClaimClick: (text: string, isDemoMode: boolean) => void;
}

const ExampleClaims: React.FC<ExampleClaimsProps> = ({ onClaimClick }) => {
  const handleClaimClick = (claim: ExampleClaim) => {
    // Pass demo_mode flag to parent
    onClaimClick(claim.text, true);
  };
  
  // Rest of component unchanged
};
```

**API Client Update**:

```typescript
// frontend/shared/api/client.ts

interface AnalysisRequest {
  text?: string;
  url?: string;
  demo_mode?: boolean;  // New field
}

export async function analyzeContent(
  request: AnalysisRequest
): Promise<AnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.statusText}`);
  }
  
  return response.json();
}
```

### 2. Backend: Demo Mode Detection

**Lambda Handler Enhancement**:

```typescript
// backend/src/lambda.ts

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const request: AnalysisRequest = JSON.parse(event.body || '{}');
  
  // Check demo mode from request or environment
  const isDemoMode = request.demo_mode === true || process.env.DEMO_MODE === 'true';
  
  if (isDemoMode) {
    // Use demo pipeline
    return handleDemoRequest(request);
  } else {
    // Use production pipeline
    return handleProductionRequest(request);
  }
}
```

### 3. Backend: Demo Evidence Provider

**Core Implementation**:

```typescript
// backend/src/demo/demoEvidenceProvider.ts

import { createHash } from 'crypto';
import type { NormalizedSourceWithStance } from '../types/grounding';

/**
 * Demo evidence database (deterministic, in-memory)
 */
const DEMO_EVIDENCE_DB: Record<string, NormalizedSourceWithStance[]> = {
  // Supported claim evidence
  'eiffel_tower_paris': [
    {
      url: 'https://www.britannica.com/topic/Eiffel-Tower',
      title: 'Eiffel Tower | History, Height, & Facts',
      snippet: 'The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France.',
      publishDate: '2024-01-15T00:00:00Z',
      domain: 'britannica.com',
      score: 0.95,
      stance: 'supports',
      stanceJustification: 'Authoritative encyclopedia confirms location',
      provider: 'demo',
      credibilityTier: 1,
    },
    {
      url: 'https://www.toureiffel.paris/en',
      title: 'Official Eiffel Tower Website',
      snippet: 'Welcome to the official Eiffel Tower website. Located in Paris, France.',
      publishDate: '2024-01-15T00:00:00Z',
      domain: 'toureiffel.paris',
      score: 0.98,
      stance: 'supports',
      stanceJustification: 'Official source confirms Paris location',
      provider: 'demo',
      credibilityTier: 1,
    },
    {
      url: 'https://www.nationalgeographic.com/travel/article/eiffel-tower',
      title: 'Eiffel Tower: The Symbol of Paris',
      snippet: 'The iconic Eiffel Tower stands tall in the heart of Paris, France.',
      publishDate: '2024-01-10T00:00:00Z',
      domain: 'nationalgeographic.com',
      score: 0.92,
      stance: 'supports',
      stanceJustification: 'Reputable travel source confirms location',
      provider: 'demo',
      credibilityTier: 1,
    },
  ],
  
  // Disputed claim evidence
  'moon_landing_faked': [
    {
      url: 'https://www.nasa.gov/mission_pages/apollo/apollo11.html',
      title: 'Apollo 11 Mission Overview',
      snippet: 'On July 20, 1969, Neil Armstrong and Buzz Aldrin became the first humans to land on the Moon.',
      publishDate: '2024-01-15T00:00:00Z',
      domain: 'nasa.gov',
      score: 0.98,
      stance: 'contradicts',
      stanceJustification: 'Official NASA records confirm moon landing occurred',
      provider: 'demo',
      credibilityTier: 1,
    },
    {
      url: 'https://www.snopes.com/fact-check/moon-landing-hoax/',
      title: 'Fact Check: Moon Landing Hoax Claims',
      snippet: 'Multiple lines of evidence confirm the Apollo moon landings were real, not faked.',
      publishDate: '2024-01-12T00:00:00Z',
      domain: 'snopes.com',
      score: 0.94,
      stance: 'contradicts',
      stanceJustification: 'Fact-checking organization debunks hoax claims',
      provider: 'demo',
      credibilityTier: 1,
    },
    {
      url: 'https://www.space.com/apollo-11-moon-landing-conspiracy-theories-debunked.html',
      title: 'Moon Landing Conspiracy Theories Debunked',
      snippet: 'Scientific evidence and expert analysis confirm the authenticity of the 1969 moon landing.',
      publishDate: '2024-01-08T00:00:00Z',
      domain: 'space.com',
      score: 0.90,
      stance: 'contradicts',
      stanceJustification: 'Scientific publication contradicts hoax claims',
      provider: 'demo',
      credibilityTier: 1,
    },
  ],
  
  // Unverified claim evidence (empty)
  'new_species_discovered': [],
};

/**
 * Generate deterministic claim key from text
 */
function generateClaimKey(text: string): string {
  const normalized = text.toLowerCase().trim();
  
  // Match specific example claims
  if (normalized.includes('eiffel tower') && normalized.includes('paris')) {
    return 'eiffel_tower_paris';
  }
  if (normalized.includes('moon landing') && normalized.includes('faked')) {
    return 'moon_landing_faked';
  }
  if (normalized.includes('new species') && normalized.includes('discovered')) {
    return 'new_species_discovered';
  }
  
  // Fallback: hash-based key for other claims
  const hash = createHash('sha256').update(normalized).digest('hex');
  return `claim_${hash.substring(0, 16)}`;
}

/**
 * Get demo evidence for a claim
 */
export function getDemoEvidence(claimText: string): NormalizedSourceWithStance[] {
  const key = generateClaimKey(claimText);
  return DEMO_EVIDENCE_DB[key] || [];
}

/**
 * Check if claim has demo evidence
 */
export function hasDemoEvidence(claimText: string): boolean {
  const key = generateClaimKey(claimText);
  return key in DEMO_EVIDENCE_DB;
}
```

### 4. Backend: Pipeline Integration

**Evidence Retrieval Stage**:

```typescript
// backend/src/services/groundingService.ts

import { getDemoEvidence } from '../demo/demoEvidenceProvider';

export async function retrieveEvidence(
  claim: string,
  isDemoMode: boolean
): Promise<NormalizedSourceWithStance[]> {
  if (isDemoMode) {
    // Use demo evidence provider
    const demoSources = getDemoEvidence(claim);
    
    // Simulate realistic latency (50-100ms)
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
    
    return demoSources;
  } else {
    // Use production evidence retrieval
    return await productionEvidenceRetrieval(claim);
  }
}
```

**Full Pipeline Execution**:

```typescript
// backend/src/orchestration/iterativeOrchestrationPipeline.ts

export async function executeVerificationPipeline(
  request: AnalysisRequest,
  isDemoMode: boolean
): Promise<AnalysisResponse> {
  const trace: TraceStep[] = [];
  const startTime = Date.now();
  
  // Stage 1: Claim Intake
  trace.push(createTraceStep('Claim Intake', 'completed', 5));
  
  // Stage 2: Claim Framing
  const framedClaim = await frameClaimForVerification(request.text);
  trace.push(createTraceStep('Claim Framing', 'completed', 120));
  
  // Stage 3: Evidence Retrieval (demo or production)
  const evidence = await retrieveEvidence(framedClaim, isDemoMode);
  trace.push(createTraceStep('Evidence Retrieval', 'completed', 450, {
    provider: isDemoMode ? 'demo' : 'production',
    sources_count: evidence.length,
  }));
  
  // Stage 4: Source Screening
  const screenedSources = await screenSources(evidence);
  trace.push(createTraceStep('Source Screening', 'completed', 80));
  
  // Stage 5: Credibility Assessment
  const assessedSources = await assessCredibility(screenedSources);
  trace.push(createTraceStep('Credibility Assessment', 'completed', 95));
  
  // Stage 6: Stance Classification
  const classifiedSources = await classifyStance(assessedSources, framedClaim);
  trace.push(createTraceStep('Evidence Stance Classification', 'completed', 110));
  
  // Stage 7: Bedrock Reasoning
  const reasoning = await synthesizeWithBedrock(framedClaim, classifiedSources);
  trace.push(createTraceStep('Bedrock Reasoning', 'completed', 200, {
    model: 'amazon.nova-lite-v1:0',
  }));
  
  // Stage 8: Verdict Generation
  const verdict = await generateVerdict(reasoning, classifiedSources);
  trace.push(createTraceStep('Verdict Generation', 'completed', 85));
  
  // Stage 9: Response Packaging
  const response = await packageResponse(verdict, classifiedSources, trace);
  trace.push(createTraceStep('Response Packaging', 'completed', 30));
  
  return response;
}
```

### 5. Frontend: Results Rendering

**Evidence Graph Rendering** (Supported/Disputed):

```typescript
// frontend/web/src/components/ClaimEvidenceGraph.tsx

interface ClaimEvidenceGraphProps {
  claim: string;
  sources: EvidenceSource[];
  verdict: 'Supported' | 'Disputed';
}

const ClaimEvidenceGraph: React.FC<ClaimEvidenceGraphProps> = ({
  claim,
  sources,
  verdict,
}) => {
  const verdictColor = verdict === 'Supported' ? '#22c55e' : '#ef4444';
  
  return (
    <div className="evidence-graph">
      <div className="claim-node" style={{ borderColor: verdictColor }}>
        {claim}
      </div>
      <div className="evidence-nodes">
        {sources.map((source, idx) => (
          <div key={idx} className="evidence-node">
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.title}
            </a>
            <p className="snippet">{source.snippet}</p>
            <p className="why">{source.why}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
```

**Empty Evidence State** (Unverified):

```typescript
// frontend/web/src/components/EmptyEvidenceState.tsx

const EmptyEvidenceState: React.FC = () => {
  return (
    <div className="empty-evidence-state">
      <div className="icon">?</div>
      <h3>No Evidence Found</h3>
      <p>
        We couldn't find credible sources to verify this claim.
        This doesn't mean the claim is false—it may be too recent,
        too specific, or outside mainstream coverage.
      </p>
      <p className="recommendation">
        Use the SIFT framework below to investigate further before sharing.
      </p>
    </div>
  );
};
```

**SIFT Panel** (Unverified):

```typescript
// frontend/web/src/components/SIFTPanel.tsx

interface SIFTDetails {
  stop: { summary: string; evidence_urls: string[] };
  investigate: { summary: string; evidence_urls: string[] };
  find: { summary: string; evidence_urls: string[] };
  trace: { summary: string; evidence_urls: string[]; earliest_source?: string };
}

interface SIFTPanelProps {
  sift: SIFTDetails;
}

const SIFTPanel: React.FC<SIFTPanelProps> = ({ sift }) => {
  return (
    <div className="sift-panel">
      <h3>SIFT Framework Guidance</h3>
      
      <div className="sift-step">
        <h4>🛑 Stop</h4>
        <p>{sift.stop.summary}</p>
      </div>
      
      <div className="sift-step">
        <h4>🔍 Investigate the Source</h4>
        <p>{sift.investigate.summary}</p>
      </div>
      
      <div className="sift-step">
        <h4>📰 Find Better Coverage</h4>
        <p>{sift.find.summary}</p>
      </div>
      
      <div className="sift-step">
        <h4>🔗 Trace Claims to Original Context</h4>
        <p>{sift.trace.summary}</p>
        {sift.trace.earliest_source && (
          <a href={sift.trace.earliest_source} target="_blank" rel="noopener noreferrer">
            View earliest source
          </a>
        )}
      </div>
    </div>
  );
};
```

## Data Models

### Demo Evidence Source

```typescript
interface NormalizedSourceWithStance {
  url: string;
  title: string;
  snippet: string;
  publishDate: string;
  domain: string;
  score: number;
  stance: 'supports' | 'contradicts' | 'mentions' | 'unclear';
  stanceJustification: string;
  provider: 'demo' | 'bing' | 'gdelt';
  credibilityTier: 1 | 2 | 3;
}
```

### Demo Response Structure

```typescript
interface DemoAnalysisResponse {
  request_id: string;
  status_label: 'Supported' | 'Disputed' | 'Unverified';
  confidence_score: number;
  recommendation: string;
  progress_stages: ProgressStage[];
  credible_sources: EvidenceSource[];
  sift: SIFTDetails;
  grounding: GroundingMetadata;
  trace: TraceObject;
  media_risk: null;
  misinformation_type: null;
  timestamp: string;
}
```

## Correctness Properties

### Property 1: Demo Mode Activation

*For any* example claim click, the request payload SHALL include `demo_mode: true`.

**Validates: Requirement 1.1**

### Property 2: Demo Evidence Determinism

*For any* identical claim text submitted in demo mode, the Demo_Evidence_Provider SHALL return identical evidence sources.

**Validates: Requirements 2.5, 3.5, 4.4**

### Property 3: Full Pipeline Execution in Demo Mode

*For any* demo mode request, the verification pipeline SHALL execute all 9 stages: Claim Intake, Claim Framing, Evidence Retrieval, Source Screening, Credibility Assessment, Stance Classification, Bedrock Reasoning, Verdict Generation, Response Packaging.

**Validates: Requirements 5.1-5.10**

### Property 4: Evidence Graph Rendering Condition

*For any* response with at least 1 evidence source, the Frontend_Client SHALL render the Evidence_Graph component.

**Validates: Requirements 6.1-6.6**

### Property 5: Empty State Rendering Condition

*For any* response with zero evidence sources, the Frontend_Client SHALL render the Empty_Evidence_State component and SHALL NOT render the Evidence_Graph.

**Validates: Requirements 7.1-7.4**

### Property 6: SIFT Panel Display

*For any* Unverified_Verdict response, the Frontend_Client SHALL render the SIFT_Panel with all four guidance sections.

**Validates: Requirements 8.1-8.5**

### Property 7: Demo Mode Performance

*For any* demo mode request, the Backend_API SHALL complete processing within 2000 milliseconds.

**Validates: Requirements 9.1-9.3**

### Property 8: Visual Outcome Differentiation

*For any* verdict response, the Frontend_Client SHALL apply the correct color indicator: green for Supported, red for Disputed, yellow for Unverified.

**Validates: Requirements 10.1-10.5**

### Property 9: Example Claims Count

*For any* render of Example_Claims_Component, exactly 3 example claims SHALL be displayed.

**Validates: Requirements 11.1-11.4**

### Property 10: Explainable Trace Inclusion

*For any* demo mode response, the response SHALL include an Explainable_Trace with step records, timing information, and decision summary.

**Validates: Requirements 12.1-12.5**

### Property 11: Zero External API Calls

*For any* demo mode request, the Backend_API SHALL NOT make HTTP requests to external evidence providers (Bing, GDELT, etc.).

**Validates: Requirements 13.1-13.5**

### Property 12: API Contract Consistency

*For any* demo mode response, the response schema SHALL match the production API contract exactly.

**Validates: Requirements 14.1-14.4**

### Property 13: Demo Mode Configuration

*For any* request with `demo_mode: true` OR environment variable `DEMO_MODE=true`, the Backend_API SHALL enable demo mode.

**Validates: Requirements 15.1-15.5**

## Testing Strategy

### Unit Tests

**Frontend Tests**:
```typescript
// frontend/web/src/components/ExampleClaims.test.tsx

describe('ExampleClaims', () => {
  it('should set demo_mode=true when example claim is clicked', () => {
    const onClaimClick = jest.fn();
    render(<ExampleClaims onClaimClick={onClaimClick} />);
    
    const supportedClaim = screen.getByText(/Eiffel Tower/i);
    fireEvent.click(supportedClaim);
    
    expect(onClaimClick).toHaveBeenCalledWith(
      'The Eiffel Tower is located in Paris, France',
      true
    );
  });
  
  it('should display exactly 3 example claims', () => {
    render(<ExampleClaims onClaimClick={jest.fn()} />);
    
    const claims = screen.getAllByRole('button');
    expect(claims).toHaveLength(3);
  });
});
```

**Backend Tests**:
```typescript
// backend/src/demo/demoEvidenceProvider.test.ts

describe('getDemoEvidence', () => {
  it('should return deterministic evidence for supported claim', () => {
    const evidence1 = getDemoEvidence('The Eiffel Tower is located in Paris, France');
    const evidence2 = getDemoEvidence('The Eiffel Tower is located in Paris, France');
    
    expect(evidence1).toEqual(evidence2);
    expect(evidence1.length).toBeGreaterThanOrEqual(2);
    expect(evidence1.every(s => s.stance === 'supports')).toBe(true);
  });
  
  it('should return empty array for unverified claim', () => {
    const evidence = getDemoEvidence('A new species was discovered yesterday');
    
    expect(evidence).toEqual([]);
  });
  
  it('should return contradicting evidence for disputed claim', () => {
    const evidence = getDemoEvidence('The moon landing was faked in 1969');
    
    expect(evidence.length).toBeGreaterThanOrEqual(2);
    expect(evidence.every(s => s.stance === 'contradicts')).toBe(true);
  });
});
```

### Property-Based Tests

```typescript
// backend/src/demo/demoEvidenceProvider.property.test.ts

import fc from 'fast-check';

// Feature: fakenews-off, Property 2: Demo Evidence Determinism
test('demo evidence is deterministic for identical claims', () => {
  fc.assert(
    fc.property(
      fc.constantFrom(
        'The Eiffel Tower is located in Paris, France',
        'The moon landing was faked in 1969',
        'A new species was discovered yesterday'
      ),
      (claim) => {
        const evidence1 = getDemoEvidence(claim);
        const evidence2 = getDemoEvidence(claim);
        
        expect(evidence1).toEqual(evidence2);
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: fakenews-off, Property 11: Zero External API Calls
test('demo mode makes no external HTTP requests', async () => {
  const mockFetch = jest.spyOn(global, 'fetch');
  
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom(
        'The Eiffel Tower is located in Paris, France',
        'The moon landing was faked in 1969',
        'A new species was discovered yesterday'
      ),
      async (claim) => {
        await executeVerificationPipeline({ text: claim, demo_mode: true }, true);
        
        expect(mockFetch).not.toHaveBeenCalled();
      }
    ),
    { numRuns: 100 }
  );
  
  mockFetch.mockRestore();
});
```

### Integration Tests

```typescript
// backend/src/lambda.integration.test.ts

describe('Demo Mode Integration', () => {
  it('should complete full pipeline in under 2 seconds', async () => {
    const startTime = Date.now();
    
    const response = await handler({
      body: JSON.stringify({
        text: 'The Eiffel Tower is located in Paris, France',
        demo_mode: true,
      }),
    });
    
    const duration = Date.now() - startTime;
    
    expect(response.statusCode).toBe(200);
    expect(duration).toBeLessThan(2000);
  });
  
  it('should return all required fields in demo response', async () => {
    const response = await handler({
      body: JSON.stringify({
        text: 'The moon landing was faked in 1969',
        demo_mode: true,
      }),
    });
    
    const body = JSON.parse(response.body);
    
    expect(body).toHaveProperty('request_id');
    expect(body).toHaveProperty('status_label');
    expect(body).toHaveProperty('confidence_score');
    expect(body).toHaveProperty('credible_sources');
    expect(body).toHaveProperty('trace');
    expect(body).toHaveProperty('sift');
  });
});
```

## Performance Considerations

### Target Metrics

- **Demo Mode Latency**: < 2000ms end-to-end
- **Evidence Retrieval**: < 100ms (in-memory lookup)
- **Pipeline Execution**: < 1500ms (all stages)
- **Frontend Rendering**: < 500ms (results display)

### Optimization Strategies

1. **In-Memory Evidence Storage**: All demo evidence stored in memory, no I/O
2. **Minimal Bedrock Calls**: Reuse reasoning for identical claims
3. **Simplified Trace Generation**: Pre-computed trace templates
4. **Lazy Component Loading**: Load evidence graph only when needed

## Error Handling

### Demo Mode Errors

**Unknown Claim**:
- Scenario: Claim not in demo evidence database
- Handling: Return empty evidence (unverified verdict)
- User Impact: Graceful degradation

**Pipeline Failure**:
- Scenario: Pipeline stage fails in demo mode
- Handling: Log error, return fallback response
- User Impact: Show error message with retry option

**Invalid Request**:
- Scenario: Malformed request with demo_mode=true
- Handling: Return 400 error with validation message
- User Impact: Clear error message

## Deployment

### Configuration

**Environment Variables**:
```bash
# Enable demo mode for all requests (optional)
DEMO_MODE=true

# Demo mode latency simulation (ms)
DEMO_DELAY=500
```

**Feature Flags**:
```typescript
interface DemoConfig {
  enabled: boolean;
  responseDelay: number;
  logRequests: boolean;
}
```

### Rollout Plan

1. **Phase 1**: Deploy backend with demo mode support
2. **Phase 2**: Update frontend to set demo_mode flag
3. **Phase 3**: Test all three example claims
4. **Phase 4**: Enable for hackathon judging

## Success Metrics

- All 3 example claims return results in < 2 seconds
- Evidence graph renders for supported/disputed claims
- Empty state renders for unverified claims
- SIFT panel displays for unverified claims
- Zero external API calls in demo mode
- 100% deterministic responses for identical claims
