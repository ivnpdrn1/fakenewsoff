# Backend Utilities

This directory contains utility modules used across the backend services.

## llmJson.ts

**Purpose**: Robust JSON parsing for LLM responses with repair and fallback mechanisms.

**Problem**: LLM responses (from AWS Bedrock Nova, etc.) can be malformed:
- Wrapped in markdown code blocks (```json ... ```)
- Include prose before/after the JSON
- Have trailing commas
- Completely fail to produce valid JSON

**Solution**: Three-tier parsing strategy:
1. **Direct Parse**: Try standard JSON.parse first
2. **Repair**: Strip markdown, extract JSON from prose, fix trailing commas
3. **Fallback**: Return safe default response with "Unverified" status

### API

```typescript
type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

function parseStrictJson<T>(responseText: string): Result<T>
```

### Usage

```typescript
import { parseStrictJson } from './utils/llmJson';

// Parse LLM response
const result = parseStrictJson(llmResponseText);

if (result.success) {
  // Always succeeds - either with parsed data or safe fallback
  const data = result.data;
  console.log(data.status_label); // "Supported", "Disputed", etc.
}
```

### Fallback Response

When parsing fails completely, returns:

```typescript
{
  status_label: "Unverified",
  confidence_score: 30,
  recommendation: "Verify before sharing. Unable to complete automated analysis...",
  sift_guidance: "Stop: Don't share immediately. Investigate the source...",
  sources: [],
  misinformation_type: null
}
```

### Logging

The utility logs structured JSON for monitoring:

- `json_repair_success`: When repair mechanism fixes malformed JSON
- `json_parse_fallback`: When fallback response is used

### Requirements

Validates:
- **Requirement 6.8**: Parse Nova responses with error handling
- **Requirement 12.2**: Handle malformed JSON gracefully

### Testing

See `llmJson.test.ts` for comprehensive test coverage:
- Direct parsing of valid JSON
- Repair of markdown-wrapped JSON
- Repair of JSON with prose
- Fallback for malformed input
- Real-world LLM response patterns

### Integration

Used by:
- `novaClient.ts`: Parse evidence synthesis and label determination responses
- `extractionService.ts`: Parse claim extraction responses
- Any service that consumes LLM output

### Design Decisions

**Why always return success?**
- Prevents pipeline crashes from malformed LLM output
- Fallback response is safe and informative to users
- Allows system to continue operating even with bad LLM responses

**Why not throw errors?**
- Throwing errors would require try-catch everywhere
- Fallback response is more useful than an error
- Aligns with "graceful degradation" principle

**Why log repairs and fallbacks?**
- Enables monitoring of LLM response quality
- Helps identify prompt engineering issues
- Provides data for improving repair logic
