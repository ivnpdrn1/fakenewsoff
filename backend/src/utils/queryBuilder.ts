/**
 * Query Builder for Text-Only Grounding
 * 
 * Generates diverse search queries from user-provided text claims.
 * Extracts entities, key phrases, and temporal context to create
 * effective search queries for news/web providers.
 */

export interface QueryRequest {
  text: string;
  entities?: string[];
  keyPhrases?: string[];
  temporalKeywords?: string[];
  recencyHint?: string;
}

export interface QueryGenerationResult {
  queries: string[];
  metadata: {
    entitiesExtracted: string[];
    keyPhrasesExtracted: string[];
    temporalKeywordsDetected: string[];
    hasRecencyHint: boolean;
  };
}

/**
 * Parse text input and extract entities, key phrases, and temporal keywords
 */
export function parseQueryRequest(text: string): QueryRequest {
  const entities = extractEntities(text);
  const keyPhrases = extractKeyPhrases(text);
  const temporalKeywords = extractTemporalKeywords(text);
  const recencyHint = generateRecencyHint(temporalKeywords);

  return {
    text,
    entities,
    keyPhrases,
    temporalKeywords,
    recencyHint,
  };
}

/**
 * Format a QueryRequest into a search query string
 */
export function formatQuery(request: QueryRequest): string {
  const parts: string[] = [];

  // Add entities if available
  if (request.entities && request.entities.length > 0) {
    parts.push(...request.entities);
  }

  // Add key phrases if available
  if (request.keyPhrases && request.keyPhrases.length > 0) {
    parts.push(...request.keyPhrases);
  }

  // Add recency hint if available
  if (request.recencyHint) {
    parts.push(request.recencyHint);
  }

  return parts.join(' ').trim();
}

/**
 * Extract named entities (people, places, organizations) using regex patterns
 */
function extractEntities(text: string): string[] {
  const entities: string[] = [];
  
  // Capitalized words (potential proper nouns)
  const capitalizedPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
  const matches = text.match(capitalizedPattern);
  
  if (matches) {
    // Filter out common words that aren't entities
    const commonWords = new Set(['The', 'A', 'An', 'This', 'That', 'These', 'Those']);
    entities.push(...matches.filter(m => !commonWords.has(m)));
  }

  return [...new Set(entities)]; // Remove duplicates
}

/**
 * Extract key phrases using stop word removal and n-gram analysis
 */
function extractKeyPhrases(text: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'will', 'with', 'the', 'this', 'but', 'they', 'have',
    'had', 'what', 'when', 'where', 'who', 'which', 'why', 'how'
  ]);

  // Take first sentence for key phrases
  const firstSentence = text.split(/[.!?]/)[0];
  const sentenceWords = firstSentence.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  // Return top 3-5 words from first sentence
  return sentenceWords.slice(0, 5);
}

/**
 * Extract temporal keywords that indicate recency requirements
 */
function extractTemporalKeywords(text: string): string[] {
  const temporalPatterns = [
    /\b(yesterday|today|tonight|now|current|currently)\b/gi,
    /\b(recent|recently|latest|breaking|just|new)\b/gi,
    /\b(this\s+(week|month|year|morning|afternoon|evening))\b/gi,
    /\b(last\s+(week|month|year|night))\b/gi,
  ];

  const keywords: string[] = [];
  for (const pattern of temporalPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      keywords.push(...matches.map(m => m.toLowerCase()));
    }
  }

  return [...new Set(keywords)]; // Remove duplicates
}

/**
 * Generate recency hint based on temporal keywords
 */
function generateRecencyHint(temporalKeywords: string[]): string | undefined {
  if (temporalKeywords.length === 0) {
    return undefined;
  }

  // Map temporal keywords to recency hints
  const hasToday = temporalKeywords.some(k => ['today', 'tonight', 'now', 'current', 'currently'].includes(k));
  const hasRecent = temporalKeywords.some(k => ['recent', 'recently', 'latest', 'breaking', 'just', 'new'].includes(k));
  const hasYesterday = temporalKeywords.some(k => k === 'yesterday');
  const hasThisWeek = temporalKeywords.some(k => k.includes('this week'));
  const hasLastWeek = temporalKeywords.some(k => k.includes('last week'));

  if (hasToday) {
    return 'today';
  } else if (hasYesterday) {
    return 'yesterday';
  } else if (hasRecent || hasThisWeek) {
    return 'this week';
  } else if (hasLastWeek) {
    return 'last week';
  }

  return 'recent';
}

/**
 * Generate 3-6 diverse search queries from text input
 * 
 * For news-style claims, generates multiple query variants:
 * - Original claim
 * - Entity-focused queries
 * - Time-aware/news-aware variants
 * - Semantic variants
 */
export function generateQueries(text: string): QueryGenerationResult {
  const request = parseQueryRequest(text);
  const queries: string[] = [];
  const lowerText = text.toLowerCase();

  // Detect if this is a news-style claim
  const isNewsClaim = /\b(news|latest|recent|update|report|announce|continue|ongoing|war|conflict|ceasefire|release|increase|decrease)\b/i.test(text);

  // Query 1: Original claim (cleaned)
  const cleanedClaim = text.trim().replace(/[?!.]+$/, '');
  queries.push(cleanedClaim);

  // Query 2: Entities + "news" or "latest"
  if (request.entities && request.entities.length > 0) {
    const entityQuery = request.entities.slice(0, 3).join(' ');
    if (isNewsClaim) {
      queries.push(`${entityQuery} latest news`);
      queries.push(`${entityQuery} updates`);
    } else {
      queries.push(`${entityQuery} news`);
    }
  }

  // Query 3: Key phrases + temporal context
  if (request.keyPhrases && request.keyPhrases.length >= 2) {
    const keyPhraseQuery = request.keyPhrases.slice(0, 4).join(' ');
    if (request.recencyHint) {
      queries.push(`${keyPhraseQuery} ${request.recencyHint}`);
    } else if (isNewsClaim) {
      queries.push(`${keyPhraseQuery} recent developments`);
    } else {
      queries.push(keyPhraseQuery);
    }
  }

  // Query 4: News source variant (Reuters, BBC, AP style)
  if (request.entities && request.entities.length > 0 && isNewsClaim) {
    const entityQuery = request.entities.slice(0, 2).join(' ');
    queries.push(`${entityQuery} Reuters BBC AP`);
  }

  // Query 5: "What is" question form
  if (request.keyPhrases && request.keyPhrases.length >= 2) {
    const questionQuery = request.keyPhrases.slice(0, 3).join(' ');
    queries.push(`what is ${questionQuery}`);
  }

  // Query 6: Semantic variant with "about" or "regarding"
  if (request.entities && request.entities.length > 0 && request.keyPhrases && request.keyPhrases.length > 0) {
    const entity = request.entities[0];
    const keyPhrase = request.keyPhrases.slice(0, 2).join(' ');
    queries.push(`${entity} ${keyPhrase}`);
  }

  // Ensure we have at least 3 queries
  if (queries.length < 3) {
    // Add fallback queries using different combinations
    const allWords = text.split(/\s+/).filter(w => w.length > 2);
    if (allWords.length >= 4 && queries.length < 3) {
      queries.push(allWords.slice(0, 4).join(' '));
    }
    if (allWords.length >= 3 && queries.length < 3) {
      queries.push(allWords.slice(0, 3).join(' '));
    }
    // Last resort: first 5 words
    if (queries.length < 3) {
      const fallback = text.split(/\s+/).slice(0, 5).join(' ');
      if (fallback && !queries.includes(fallback)) {
        queries.push(fallback);
      }
    }
  }

  // Deduplicate queries (case-insensitive)
  const seen = new Set<string>();
  const deduplicated = queries.filter(q => {
    const lower = q.toLowerCase();
    if (seen.has(lower)) {
      return false;
    }
    seen.add(lower);
    return true;
  });

  // Cap at 6 queries, ensure at least 3
  const finalQueries = deduplicated.slice(0, Math.max(3, Math.min(6, deduplicated.length)));

  // If we still don't have 3, add more variants
  while (finalQueries.length < 3 && request.keyPhrases && request.keyPhrases.length > 0) {
    const variant = request.keyPhrases.slice(0, finalQueries.length + 1).join(' ');
    if (!finalQueries.includes(variant)) {
      finalQueries.push(variant);
    } else {
      break;
    }
  }

  return {
    queries: finalQueries,
    metadata: {
      entitiesExtracted: request.entities || [],
      keyPhrasesExtracted: request.keyPhrases || [],
      temporalKeywordsDetected: request.temporalKeywords || [],
      hasRecencyHint: !!request.recencyHint,
    },
  };
}

/**
 * Extract the main claim from text (typically first sentence or first clause)
 */
function extractMainClaim(text: string): string {
  // Get first sentence
  const firstSentence = text.split(/[.!?]/)[0].trim();
  
  // If sentence is too long, take first clause
  if (firstSentence.length > 100) {
    const firstClause = firstSentence.split(/[,;]/)[0].trim();
    return firstClause.length > 20 ? firstClause : firstSentence.slice(0, 80);
  }

  return firstSentence;
}
