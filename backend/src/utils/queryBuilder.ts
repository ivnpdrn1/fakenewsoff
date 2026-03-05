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
 */
export function generateQueries(text: string): QueryGenerationResult {
  const request = parseQueryRequest(text);
  const queries: string[] = [];

  // Query 1: Main claim with quoted phrase
  const mainClaim = extractMainClaim(text);
  if (mainClaim) {
    queries.push(`"${mainClaim}"`);
  }

  // Query 2: Entities + key phrases
  if (request.entities && request.entities.length > 0) {
    const entityQuery = request.entities.slice(0, 3).join(' ');
    if (request.keyPhrases && request.keyPhrases.length > 0) {
      queries.push(`${entityQuery} ${request.keyPhrases.slice(0, 2).join(' ')}`);
    } else {
      queries.push(entityQuery);
    }
  }

  // Query 3: Key phrases only
  if (request.keyPhrases && request.keyPhrases.length >= 3) {
    queries.push(request.keyPhrases.slice(0, 4).join(' '));
  }

  // Query 4: Temporal query (if temporal keywords detected)
  if (request.temporalKeywords && request.temporalKeywords.length > 0 && request.recencyHint) {
    const baseQuery = request.keyPhrases && request.keyPhrases.length > 0
      ? request.keyPhrases.slice(0, 3).join(' ')
      : request.entities && request.entities.length > 0
        ? request.entities.slice(0, 2).join(' ')
        : text.split(' ').slice(0, 5).join(' ');
    queries.push(`${baseQuery} ${request.recencyHint}`);
  }

  // Query 5: Alternative phrasing (question form)
  if (request.keyPhrases && request.keyPhrases.length >= 2) {
    queries.push(`what is ${request.keyPhrases.slice(0, 3).join(' ')}`);
  }

  // Query 6: Broad fallback (first 6 words)
  if (queries.length < 6) {
    const fallbackWords = text.split(/\s+/).slice(0, 6).join(' ');
    if (fallbackWords && !queries.includes(fallbackWords)) {
      queries.push(fallbackWords);
    }
  }

  // Ensure we have at least 3 queries
  if (queries.length < 3) {
    // Add fallback queries using different combinations
    const allWords = text.split(/\s+/).filter(w => w.length > 2);
    if (allWords.length >= 4) {
      queries.push(allWords.slice(0, 4).join(' '));
    }
    if (allWords.length >= 3 && queries.length < 3) {
      queries.push(allWords.slice(0, 3).join(' '));
    }
  }

  // Cap at 6 queries
  const finalQueries = queries.slice(0, 6);

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
