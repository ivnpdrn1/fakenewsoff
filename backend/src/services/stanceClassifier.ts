/**
 * Stance Classifier for Text-Only Grounding
 * 
 * Classifies the stance of a source (article/news) relative to a claim.
 * Uses keyword-based heuristics for fast classification, with LLM fallback
 * for uncertain cases.
 */

import type { Stance } from '../types/grounding.js';

export interface StanceResult {
  stance: Stance;
  confidence: number; // 0-1
  justification?: string; // Max 1 sentence
}

/**
 * Classify stance of a source relative to a claim
 * 
 * @param claim - The user's claim text
 * @param sourceTitle - Article title
 * @param sourceSnippet - Article snippet/description
 * @returns Stance classification result
 */
export function classifyStance(
  claim: string,
  sourceTitle: string,
  sourceSnippet: string
): StanceResult {
  const text = `${sourceTitle} ${sourceSnippet}`.toLowerCase();
  const claimLower = claim.toLowerCase();

  // Try keyword-based heuristics first
  const supportResult = detectSupport(text, claimLower);
  if (supportResult.confidence >= 0.7) {
    return supportResult;
  }

  const contradictResult = detectContradiction(text, claimLower);
  if (contradictResult.confidence >= 0.7) {
    return contradictResult;
  }

  // If neither support nor contradiction is confident, check for mentions
  const mentionsResult = detectMention(text, claimLower);
  if (mentionsResult.confidence >= 0.5) {
    return mentionsResult;
  }

  // Default to unclear if no confident classification
  return {
    stance: 'unclear',
    confidence: 0.3,
    justification: 'Unable to determine stance from title and snippet'
  };
}

/**
 * Detect support keywords in source text
 */
function detectSupport(text: string, _claim: string): StanceResult {
  const supportKeywords = [
    'confirms', 'confirmed', 'verifies', 'verified', 'proves', 'proven',
    'supports', 'supported', 'validates', 'validated', 'true', 'accurate',
    'correct', 'factual', 'evidence shows', 'study finds', 'research shows',
    'experts say', 'officials confirm', 'data shows'
  ];

  let matchCount = 0;
  for (const keyword of supportKeywords) {
    if (text.includes(keyword)) {
      matchCount++;
    }
  }

  if (matchCount >= 2) {
    return {
      stance: 'supports',
      confidence: 0.8,
      justification: 'Source contains multiple support indicators'
    };
  } else if (matchCount === 1) {
    return {
      stance: 'supports',
      confidence: 0.6,
      justification: 'Source contains support indicators'
    };
  }

  return {
    stance: 'unclear',
    confidence: 0.0
  };
}

/**
 * Detect contradiction keywords in source text
 */
function detectContradiction(text: string, _claim: string): StanceResult {
  const contradictionKeywords = [
    'false', 'fake', 'debunked', 'debunks', 'disproves', 'disproven',
    'refutes', 'refuted', 'denies', 'denied', 'contradicts', 'contradicted',
    'incorrect', 'inaccurate', 'misleading', 'misinformation', 'hoax',
    'myth', 'no evidence', 'not true', 'untrue', 'fabricated'
  ];

  let matchCount = 0;
  for (const keyword of contradictionKeywords) {
    if (text.includes(keyword)) {
      matchCount++;
    }
  }

  if (matchCount >= 2) {
    return {
      stance: 'contradicts',
      confidence: 0.8,
      justification: 'Source contains multiple contradiction indicators'
    };
  } else if (matchCount === 1) {
    return {
      stance: 'contradicts',
      confidence: 0.6,
      justification: 'Source contains contradiction indicators'
    };
  }

  return {
    stance: 'unclear',
    confidence: 0.0
  };
}

/**
 * Detect if source mentions the claim without clear stance
 */
function detectMention(text: string, claim: string): StanceResult {
  // Extract key terms from claim
  const claimWords = claim
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 5);

  let mentionCount = 0;
  for (const word of claimWords) {
    if (text.includes(word.toLowerCase())) {
      mentionCount++;
    }
  }

  if (mentionCount >= 2) {
    return {
      stance: 'mentions',
      confidence: 0.6,
      justification: 'Source mentions key terms from claim'
    };
  }

  return {
    stance: 'unclear',
    confidence: 0.0
  };
}

/**
 * Classify stance using LLM for uncertain cases
 * 
 * @param claim - The user's claim text
 * @param sourceTitle - Article title
 * @param sourceSnippet - Article snippet/description
 * @param novaClient - NOVA client for LLM invocation (optional)
 * @returns Stance classification result
 */
export async function classifyStanceWithLLM(
  claim: string,
  sourceTitle: string,
  sourceSnippet: string,
  novaClient?: any // NovaClient type - optional to avoid circular dependency
): Promise<StanceResult> {
  // If no LLM client provided, fall back to keyword-based classification
  if (!novaClient) {
    return classifyStance(claim, sourceTitle, sourceSnippet);
  }

  try {
    const prompt = buildStancePrompt(claim, sourceTitle, sourceSnippet);
    
    // Invoke LLM with short timeout (300ms target)
    const response = await novaClient.invokeModel({
      prompt,
      maxTokens: 100,
      temperature: 0.1, // Low temperature for consistent classification
    });

    // Parse LLM response
    const parsed = parseStanceResponse(response);
    return parsed;
  } catch (error) {
    // On LLM error, fall back to keyword-based classification
    console.warn('LLM stance classification failed, falling back to keywords:', error);
    return classifyStance(claim, sourceTitle, sourceSnippet);
  }
}

/**
 * Build prompt for LLM stance classification
 */
function buildStancePrompt(claim: string, title: string, snippet: string): string {
  return `Classify the stance of this article relative to the claim.

Claim: "${claim}"

Article Title: "${title}"
Article Snippet: "${snippet}"

Classify the stance as one of:
- supports: Article provides evidence supporting the claim
- contradicts: Article provides evidence contradicting the claim
- mentions: Article mentions the claim without clear support or contradiction
- unclear: Cannot determine stance from the information provided

Respond in JSON format:
{
  "stance": "supports|contradicts|mentions|unclear",
  "justification": "One sentence explaining why (max 20 words)"
}`;
}

/**
 * Parse LLM response into StanceResult
 */
function parseStanceResponse(response: string): StanceResult {
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate stance value
    const validStances: Stance[] = ['supports', 'contradicts', 'mentions', 'unclear'];
    if (!validStances.includes(parsed.stance)) {
      throw new Error(`Invalid stance: ${parsed.stance}`);
    }

    // Truncate justification to 1 sentence
    let justification = parsed.justification || '';
    const firstSentence = justification.split(/[.!?]/)[0].trim();
    justification = firstSentence.length > 0 ? firstSentence + '.' : justification;

    return {
      stance: parsed.stance as Stance,
      confidence: 0.75, // LLM classifications get 0.75 confidence
      justification
    };
  } catch {
    // On parse error, return unclear
    return {
      stance: 'unclear',
      confidence: 0.3,
      justification: 'Unable to parse LLM response'
    };
  }
}
