/**
 * Example Usage of Content Hashing Utilities
 * 
 * This file demonstrates how to use the hash utilities for:
 * - Request deduplication
 * - Cache key generation
 * - Content fingerprinting
 */

import { normalizeContent, computeContentHash } from './hash';

/**
 * Example 1: Request Deduplication
 * 
 * Hash analysis requests to detect duplicates and return cached results
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _deduplicateRequest(url: string, text: string): Promise<string> {
  // Combine request fields into a single string
  const requestContent = `${url} ${text}`;
  
  // Compute hash for cache lookup
  const contentHash = await computeContentHash(requestContent);
  
  console.log('Request hash:', contentHash);
  // Use this hash to query DynamoDB GSI for cached results
  
  return contentHash;
}

/**
 * Example 2: RAG Context Hashing
 * 
 * Hash assembled RAG context to track which sources were used
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _hashRagContext(chunks: string[]): Promise<string> {
  // Combine all chunks into a single context string
  const context = chunks.join('\n');
  
  // Compute hash of the assembled context
  const contextHash = await computeContentHash(context);
  
  console.log('RAG context hash:', contextHash);
  // Store this hash with the analysis record for debugging
  
  return contextHash;
}

/**
 * Example 3: Prompt Fingerprinting
 * 
 * Hash final prompts sent to LLM for cost tracking and debugging
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _trackPromptUsage(prompt: string): Promise<void> {
  // Compute hash of the prompt
  const promptHash = await computeContentHash(prompt);
  
  console.log('Prompt hash:', promptHash);
  // Log this hash to track which prompts are used most frequently
  // Useful for identifying opportunities to cache LLM responses
}

/**
 * Example 4: Content Normalization
 * 
 * Normalize content before comparison or storage
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _normalizeUserInput(input: string): string {
  // Normalize removes case differences, whitespace variations, and tracking params
  const normalized = normalizeContent(input);
  
  console.log('Original:', input);
  console.log('Normalized:', normalized);
  
  return normalized;
}

/**
 * Example 5: Cache Key Generation
 * 
 * Generate cache keys for 24-hour result caching
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _generateCacheKey(
  url?: string,
  text?: string,
  selectedText?: string
): Promise<string> {
  // Combine all available content fields
  const content = [url, text, selectedText]
    .filter(Boolean)
    .join(' ');
  
  // Generate cache key
  const cacheKey = await computeContentHash(content);
  
  console.log('Cache key:', cacheKey);
  // Query DynamoDB GSI with this key to find cached results within TTL window
  
  return cacheKey;
}

// Example usage - uncomment to run
// async function main() {
//   console.log('=== Example 1: Request Deduplication ===');
//   await deduplicateRequest(
//     'https://example.com/article?utm_source=twitter',
//     '  Breaking NEWS  '
//   );
//   
//   console.log('\n=== Example 2: RAG Context Hashing ===');
//   await hashRagContext([
//     'Source 1: Paris is the capital of France.',
//     'Source 2: The city has a population of 2.2 million.'
//   ]);
//   
//   console.log('\n=== Example 3: Prompt Fingerprinting ===');
//   await trackPromptUsage('Analyze the following content for misinformation...');
//   
//   console.log('\n=== Example 4: Content Normalization ===');
//   normalizeUserInput('  Test   CONTENT\n\nhttps://example.com?utm_source=twitter  ');
//   
//   console.log('\n=== Example 5: Cache Key Generation ===');
//   await generateCacheKey(
//     'https://example.com/article',
//     'Article text here',
//     'Selected text'
//   );
// }
// main().catch(console.error);
