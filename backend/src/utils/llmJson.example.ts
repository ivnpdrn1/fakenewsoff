/**
 * Example usage of llmJson utility
 * 
 * This file demonstrates how to use parseStrictJson in the novaClient
 * and other services that need to parse LLM responses.
 */

import { parseStrictJson, Result } from './llmJson';

// Example 1: Parsing a clean LLM response
function exampleCleanResponse() {
  const llmResponse = JSON.stringify({
    status_label: "Supported",
    confidence_score: 85,
    sources: [
      { url: "https://reuters.com/article", title: "Fact Check" }
    ]
  });

  const result = parseStrictJson(llmResponse);
  
  if (result.success) {
    console.log('Parsed successfully:', result.data);
  } else {
    console.error('Parse failed:', result.error);
  }
}

// Example 2: Parsing LLM response with markdown
function exampleMarkdownResponse() {
  const llmResponse = `
    Here's my analysis:
    \`\`\`json
    {
      "status_label": "Disputed",
      "confidence_score": 70
    }
    \`\`\`
  `;

  const result = parseStrictJson(llmResponse);
  
  if (result.success) {
    console.log('Repaired and parsed:', result.data);
  }
}

// Example 3: Handling malformed response with fallback
function exampleMalformedResponse() {
  const llmResponse = "I couldn't analyze this properly";

  const result = parseStrictJson(llmResponse);
  
  if (result.success) {
    // Even on failure, we get a safe fallback response
    console.log('Fallback response:', result.data);
    // Will have: status_label: "Unverified", confidence_score: 30, etc.
  }
}

// Example 4: Integration with novaClient (pseudo-code)
async function exampleNovaClientIntegration() {
  // Simulated Bedrock response
  const bedrockResponse = {
    body: {
      content: [
        {
          text: `\`\`\`json
          {
            "status_label": "Supported",
            "confidence_score": 90,
            "recommendation": "Safe to share with context",
            "sift_guidance": "Multiple credible sources confirm...",
            "sources": [],
            "misinformation_type": null
          }
          \`\`\``
        }
      ]
    }
  };

  // Extract text from Bedrock response
  const responseText = bedrockResponse.body.content[0].text;

  // Parse with repair and fallback
  const result = parseStrictJson(responseText);

  if (result.success) {
    // Always succeeds - either with parsed data or safe fallback
    return result.data;
  }

  // This branch is never reached because parseStrictJson always returns success
  // (either with parsed data or fallback)
}

// Example 5: Type-safe parsing
interface AnalysisResponse {
  status_label: "Supported" | "Disputed" | "Unverified" | "Manipulated" | "Biased framing";
  confidence_score: number;
  recommendation: string;
  sift_guidance: string;
  sources: Array<{ url: string; title: string }>;
  misinformation_type: string | null;
}

function exampleTypeSafeParsing() {
  const llmResponse = '{"status_label": "Supported", "confidence_score": 85}';

  const result = parseStrictJson<AnalysisResponse>(llmResponse);

  if (result.success) {
    // TypeScript knows the shape of result.data
    const label: string = result.data.status_label;
    const score: number = result.data.confidence_score;
    console.log(`Status: ${label}, Confidence: ${score}`);
  }
}

// Example 6: Error handling pattern for services
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

async function exampleServiceErrorHandling(bedrockResponseText: string) {
  const result = parseStrictJson(bedrockResponseText);

  if (result.success) {
    // Check if we got a fallback response (indicates parsing failure)
    const data = result.data as any;
    if (data.status_label === "Unverified" && data.confidence_score === 30) {
      // This was a fallback - log for monitoring
      console.warn('Used fallback response due to parse failure');
    }
    
    return data;
  }

  // This should never happen with current implementation,
  // but keeping for defensive programming
  throw new ServiceError(
    'Failed to parse LLM response',
    'novaClient',
    false // Not retryable - parsing error
  );
}

// Export examples for documentation
export {
  exampleCleanResponse,
  exampleMarkdownResponse,
  exampleMalformedResponse,
  exampleNovaClientIntegration,
  exampleTypeSafeParsing,
  exampleServiceErrorHandling
};
