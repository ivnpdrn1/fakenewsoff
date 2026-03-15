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
function detectSupport(text: string, claim: string): StanceResult {
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

  // Explicit support keywords take priority
  if (matchCount >= 2) {
    return {
      stance: 'supports',
      confidence: 0.8,
      justification: 'Source contains multiple support indicators'
    };
  } else if (matchCount === 1) {
    return {
      stance: 'supports',
      confidence: 0.75,
      justification: 'Source contains support indicators'
    };
  }

  // Check for semantic equivalence (factual statements without explicit support keywords)
  const semanticMatch = detectSemanticSupport(text, claim);
  if (semanticMatch.confidence > 0.0) {
    return semanticMatch;
  }

  return {
    stance: 'unclear',
    confidence: 0.0
  };
}

/**
 * Detect semantic support through factual equivalence
 * Handles cases where evidence states facts directly without explicit support keywords
 */
function detectSemanticSupport(text: string, claim: string): StanceResult {
  // Normalize both text and claim for comparison
  const normalizedText = normalizeForComparison(text);
  const normalizedClaim = normalizeForComparison(claim);

  // Extract key entities and actions from claim
  const claimTokens = extractKeyTokens(normalizedClaim);
  
  // Check if text contains the key entities and actions
  let matchedTokens = 0;
  for (const token of claimTokens) {
    if (normalizedText.includes(token)) {
      matchedTokens++;
    }
  }

  // If most key tokens match, check for date/time semantic equivalence
  const matchRatio = claimTokens.length > 0 ? matchedTokens / claimTokens.length : 0;
  
  if (matchRatio >= 0.7) {
    // Check for date semantic equivalence FIRST (strict check)
    // If claim has a date, text must have matching date
    const claimHasDate = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[.,\s]+\d{1,2}[,\s]+\d{4}\b/i.test(claim) ||
                         /\b\d{1,2}[,\s]+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[,\s]+\d{4}\b/i.test(claim) ||
                         /\bin\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}\b/i.test(claim);
    
    if (claimHasDate) {
      const dateEquivalence = checkDateEquivalence(text, claim);
      if (!dateEquivalence) {
        // Dates don't match - cannot be supporting evidence
        return {
          stance: 'unclear',
          confidence: 0.0
        };
      }
      // Dates match - this is supporting evidence
      return {
        stance: 'supports',
        confidence: 0.75,
        justification: 'Source provides factual evidence supporting the claim'
      };
    }

    // No date in claim, check if text contains claim's core assertion
    if (matchRatio >= 0.8) {
      return {
        stance: 'supports',
        confidence: 0.7,
        justification: 'Source states facts consistent with the claim'
      };
    }
  }

  return {
    stance: 'unclear',
    confidence: 0.0
  };
}

/**
 * Normalize text for semantic comparison
 */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:]/g, ' ') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Extract key tokens (entities, actions) from claim
 * Filters out common stop words and short words
 */
function extractKeyTokens(claim: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'could', 'may', 'might', 'must', 'can', 'that', 'this', 'these', 'those'
  ]);

  return claim
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 10); // Limit to top 10 key tokens
}

/**
 * Check if dates in text and claim are semantically equivalent
 * Handles: exact dates vs month-level, abbreviated months, etc.
 */
function checkDateEquivalence(text: string, claim: string): boolean {
  const textLower = text.toLowerCase();
  const claimLower = claim.toLowerCase();

  // Month name mappings (full and abbreviated)
  const monthPatterns = [
    { full: 'january', abbr: 'jan', num: '01' },
    { full: 'february', abbr: 'feb', num: '02' },
    { full: 'march', abbr: 'mar', num: '03' },
    { full: 'april', abbr: 'apr', num: '04' },
    { full: 'may', abbr: 'may', num: '05' },
    { full: 'june', abbr: 'jun', num: '06' },
    { full: 'july', abbr: 'jul', num: '07' },
    { full: 'august', abbr: 'aug', num: '08' },
    { full: 'september', abbr: 'sep', num: '09' },
    { full: 'october', abbr: 'oct', num: '10' },
    { full: 'november', abbr: 'nov', num: '11' },
    { full: 'december', abbr: 'dec', num: '12' }
  ];

  // Extract year from claim (4-digit year)
  const claimYearMatch = claimLower.match(/\b(20\d{2})\b/);
  if (!claimYearMatch) return false;
  const claimYear = claimYearMatch[1];

  // Extract year from text
  const textYearMatch = textLower.match(/\b(20\d{2})\b/);
  if (!textYearMatch) return false;
  const textYear = textYearMatch[1];

  // Years must match
  if (claimYear !== textYear) return false;

  // Find month in claim
  let claimMonth: { full: string; abbr: string; num: string } | null = null;
  for (const month of monthPatterns) {
    if (claimLower.includes(month.full) || claimLower.includes(month.abbr + '.') || claimLower.includes(month.abbr + ' ')) {
      claimMonth = month;
      break;
    }
  }

  if (!claimMonth) return false;

  // Find month in text
  let textMonth: { full: string; abbr: string; num: string } | null = null;
  for (const month of monthPatterns) {
    if (textLower.includes(month.full) || textLower.includes(month.abbr + '.') || textLower.includes(month.abbr + ' ') || textLower.includes(month.abbr + ',')) {
      textMonth = month;
      break;
    }
  }

  if (!textMonth) return false;

  // Months must match
  if (claimMonth.full !== textMonth.full) return false;

  // If claim specifies "in [month] [year]" and text has "[month] [day], [year]"
  // or "[day] [month] [year]", they are semantically equivalent
  const claimHasMonthLevel = 
    claimLower.includes(`in ${claimMonth.full}`) ||
    claimLower.includes(`in ${claimMonth.abbr}`) ||
    (claimLower.includes(claimMonth.full) && !claimLower.match(/\b\d{1,2}\b/)); // Month without day

  const textHasSpecificDate = 
    textLower.match(new RegExp(`\\b\\d{1,2}[,\\s]+${textMonth.full}`, 'i')) ||
    textLower.match(new RegExp(`${textMonth.full}[,\\s]+\\d{1,2}`, 'i')) ||
    textLower.match(new RegExp(`\\b\\d{1,2}[,\\s]+${textMonth.abbr}`, 'i')) ||
    textLower.match(new RegExp(`${textMonth.abbr}[.,\\s]+\\d{1,2}`, 'i'));

  // Specific date in text supports month-level claim
  if (claimHasMonthLevel && textHasSpecificDate) {
    return true;
  }

  // Both have same month and year (regardless of day specificity)
  return true;
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
