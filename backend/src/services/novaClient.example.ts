/**
 * Example usage of novaClient service
 * 
 * This file demonstrates how to use the novaClient service in the analysis pipeline.
 * It shows the integration of llmJson utility for robust JSON parsing.
 */

import {
  extractClaims,
  synthesizeEvidence,
  determineLabel,
  ServiceError,
  type DocumentChunk,
  type MediaAnalysisResult
} from './novaClient';
import type { CredibleSource } from '../utils/schemaValidators';

/**
 * Example: Complete analysis pipeline using novaClient
 */
export async function exampleAnalysisPipeline(
  content: string,
  title: string,
  sources: CredibleSource[],
  ragChunks: DocumentChunk[],
  mediaAnalysis: MediaAnalysisResult | null
) {
  try {
    // Step 1: Extract claims from content
    console.log('Extracting claims...');
    const claimResult = await extractClaims(content, title);
    console.log(`Extracted ${claimResult.claims.length} claims`);

    // Handle case where no claims found
    if (claimResult.claims.length === 0) {
      return {
        status_label: 'Unverified',
        confidence_score: 30,
        recommendation: 'No verifiable factual claims found in this content.',
        sift_guidance: 'This content may be opinion, satire, or purely descriptive.',
        sources: [],
        misinformation_type: null
      };
    }

    // Step 2: Synthesize evidence from sources
    console.log('Synthesizing evidence...');
    const synthesis = await synthesizeEvidence(
      claimResult.claims,
      sources,
      ragChunks
    );
    console.log(`Evidence strength: ${synthesis.evidenceStrength}`);

    // Step 3: Determine label and recommendation
    console.log('Determining label...');
    const labelResult = await determineLabel(
      claimResult.claims,
      synthesis,
      mediaAnalysis
    );
    console.log(`Status: ${labelResult.status_label}, Confidence: ${labelResult.confidence_score}`);

    return {
      ...labelResult,
      sources,
      claims: claimResult.claims,
      summary: claimResult.summary
    };

  } catch (error) {
    if (error instanceof ServiceError) {
      console.error(`Service error in ${error.service}: ${error.message}`);
      console.error(`Retryable: ${error.retryable}`);
      
      // If error is retryable, caller can retry
      // If not retryable (parsing error), return fallback response
      if (!error.retryable) {
        return {
          status_label: 'Unverified' as const,
          confidence_score: 30,
          recommendation: 'Unable to complete automated analysis. Please verify manually.',
          sift_guidance: 'Apply SIFT framework: Stop, Investigate the source, Find better coverage, Trace claims.',
          sources: [],
          misinformation_type: null
        };
      }
      
      throw error; // Retryable errors should be handled by caller
    }
    
    throw error;
  }
}

/**
 * Example: Handling parsing errors gracefully
 */
export async function exampleErrorHandling(content: string) {
  try {
    const result = await extractClaims(content);
    return result;
  } catch (error) {
    if (error instanceof ServiceError) {
      // ServiceError with retryable=false means parsing failed
      // This is a controlled error, not a crash
      console.error('Parsing failed, but system remains stable');
      console.error(`Error: ${error.message}`);
      
      // Return safe fallback
      return {
        claims: [],
        summary: 'Unable to extract claims due to parsing error'
      };
    }
    
    // Unexpected error
    throw error;
  }
}

/**
 * Example: Using determineLabel with fallback behavior
 */
export async function exampleLabelWithFallback(
  claims: any[],
  synthesis: any
) {
  // determineLabel never throws on parsing errors
  // It returns a fallback response instead
  const result = await determineLabel(claims, synthesis);
  
  // Check if we got a fallback response
  if (result.status_label === 'Unverified' && result.confidence_score === 30) {
    console.log('Received fallback response due to parsing failure');
    console.log('System did not crash - graceful degradation working');
  }
  
  return result;
}

/**
 * Example: Integration with repair logic
 * 
 * The llmJson utility automatically attempts to repair malformed JSON:
 * 1. Strips markdown code blocks (```json ... ```)
 * 2. Removes prose before/after JSON
 * 3. Fixes trailing commas
 * 4. Extracts JSON from mixed content
 * 
 * If repair succeeds, parsing continues normally.
 * If repair fails, fallback response is returned.
 * 
 * This prevents pipeline crashes from LLM output variations.
 */
export function exampleRepairBehavior() {
  console.log(`
    NovaClient uses parseStrictJson which provides:
    
    1. Direct parsing attempt
    2. Automatic repair on failure
    3. Controlled fallback if repair fails
    4. Structured logging of repair events
    
    This ensures:
    - No raw JSON.parse errors thrown
    - No pipeline crashes from malformed LLM output
    - Graceful degradation to safe defaults
    - Full observability of parsing issues
  `);
}
