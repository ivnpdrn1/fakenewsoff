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

export interface ScoredQuery {
  query: string;
  score: number;
  reasons: string[];
}

export interface QueryGenerationResult {
  queries: string[];
  metadata: {
    entitiesExtracted: string[];
    keyPhrasesExtracted: string[];
    temporalKeywordsDetected: string[];
    hasRecencyHint: boolean;
  };
  scoredQueries?: ScoredQuery[];
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
 * Generate 3-7 diverse evidence-seeking search queries from text input
 * 
 * Implements query expansion for improved evidence coverage:
 * 1. Original claim
 * 2. Core claim (shortened if needed)
 * 3. "<claim> fact check"
 * 4. "<claim> evidence"
 * 5. "<claim> verification"
 * 6. "<claim> latest updates" (if live event)
 * 7. "<entities> Reuters BBC AP" (if named entities present)
 * 
 * For short claims (< 3 tokens), applies aggressive expansion:
 * - "<claim> news"
 * - "<claim> latest"
 * - "<claim> updates"
 * - "<claim> conflict news" (for geopolitical terms)
 * 
 * Queries are deduplicated and capped at 6-7 max.
 */
export function generateQueries(text: string): QueryGenerationResult {
  const request = parseQueryRequest(text);
  const queries: string[] = [];
  
  // Log query expansion start
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    event: 'QUERY_EXPANSION_START',
    original_claim: text.substring(0, 100),
  }));

  // Detect if this is a live event claim
  const isLiveEvent = /\b(latest|breaking|ongoing|current|now|today|continues|developing|live|update)\b/i.test(text);
  
  // Clean the claim (remove trailing punctuation and redundant words)
  const cleanedClaim = text.trim().replace(/[?!.]+$/, '');
  
  // Remove redundant "news" or "latest" from the end if present
  const baseClaimWithoutNews = cleanedClaim.replace(/\s+(news|latest news|latest updates)$/i, '');
  
  // Count tokens to detect short claims
  const tokenCount = cleanedClaim.split(/\s+/).length;
  const isShortClaim = tokenCount < 3;
  
  // Detect geopolitical terms for specialized expansion
  const geopoliticalTerms = /\b(war|conflict|invasion|attack|crisis|dispute|tension|military|troops|battle|fighting)\b/i;
  const isGeopolitical = geopoliticalTerms.test(cleanedClaim);
  
  // Query 1: Original claim (cleaned)
  queries.push(cleanedClaim);

  // Query 2: Core claim without redundant suffixes (if different from original)
  if (baseClaimWithoutNews !== cleanedClaim && baseClaimWithoutNews.length > 10) {
    queries.push(baseClaimWithoutNews);
  }

  // For short claims, apply aggressive expansion
  if (isShortClaim) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      event: 'QUERY_EXPANSION_APPLIED',
      reason: 'short_claim',
      token_count: tokenCount,
      original_claim: cleanedClaim,
    }));
    
    // Add news-focused queries
    queries.push(`${baseClaimWithoutNews} news`);
    queries.push(`${baseClaimWithoutNews} latest`);
    queries.push(`${baseClaimWithoutNews} updates`);
    
    // Add geopolitical-specific queries if applicable
    if (isGeopolitical) {
      queries.push(`${baseClaimWithoutNews} conflict news`);
      queries.push(`${baseClaimWithoutNews} situation`);
    }
  } else {
    // Standard expansion for longer claims
    queries.push(`${baseClaimWithoutNews} fact check`);
    queries.push(`${baseClaimWithoutNews} evidence`);
    queries.push(`${baseClaimWithoutNews} verification`);
  }

  // Query 6: "<claim> latest updates" (if live event and not already in claim)
  if (isLiveEvent && !cleanedClaim.toLowerCase().includes('latest')) {
    queries.push(`${baseClaimWithoutNews} latest updates`);
  }

  // Query 7: "<main entity names> Reuters BBC AP" (if named entities present)
  if (request.entities && request.entities.length > 0) {
    const mainEntities = request.entities.slice(0, 3).join(' ');
    queries.push(`${mainEntities} Reuters BBC AP`);
  }

  // Deduplicate queries (case-insensitive and exact match)
  const seen = new Set<string>();
  const deduplicated = queries.filter(q => {
    const normalized = q.toLowerCase().trim().replace(/\s+/g, ' ');
    if (seen.has(normalized) || normalized.length === 0) {
      return false;
    }
    seen.add(normalized);
    return true;
  });

  // Rank and select top queries with diversity
  const { selected: rankedQueries, scored: scoredQueries } = rankAndSelectQueries(deduplicated, 6);
  
  // Log query ranking
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    event: 'QUERY_RANKING_APPLIED',
    original_claim: text.substring(0, 100),
    total_queries_before_ranking: deduplicated.length,
    selected_query_count: rankedQueries.length,
    query_scores: scoredQueries.map(sq => ({ query: sq.query.substring(0, 50), score: sq.score, reasons: sq.reasons })),
    selected_queries: rankedQueries.map(q => q.substring(0, 50)),
  }));

  // Log query expansion complete
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    event: 'QUERY_EXPANSION_COMPLETE',
    original_claim: text.substring(0, 100),
    expanded_queries: rankedQueries,
    unique_query_count: rankedQueries.length,
    is_live_event: isLiveEvent,
    has_entities: (request.entities?.length || 0) > 0,
  }));

  return {
    queries: rankedQueries,
    metadata: {
      entitiesExtracted: request.entities || [],
      keyPhrasesExtracted: request.keyPhrases || [],
      temporalKeywordsDetected: request.temporalKeywords || [],
      hasRecencyHint: !!request.recencyHint,
    },
    scoredQueries,
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

/**
 * Score a query based on evidence-seeking quality heuristics
 * 
 * Scoring criteria:
 * +5: Contains trusted source anchors (Reuters, BBC, AP)
 * +4: Contains "fact check"
 * +3: Contains "evidence" or "verification"
 * +2: Contains "news" or "latest"
 * +1: Contains "updates"
 * -1: Too generic or redundant
 * -2: Near-duplicate after normalization
 */
function scoreQuery(query: string, allQueries: string[]): ScoredQuery {
  let score = 0;
  const reasons: string[] = [];
  const lowerQuery = query.toLowerCase();
  
  // +5: Trusted source anchors
  if (/\b(reuters|bbc|ap)\b/i.test(query)) {
    score += 5;
    reasons.push('trusted_sources');
  }
  
  // +4: Fact check
  if (/\bfact\s*check\b/i.test(query)) {
    score += 4;
    reasons.push('fact_check');
  }
  
  // +3: Evidence or verification
  if (/\bevidence\b/i.test(query)) {
    score += 3;
    reasons.push('evidence');
  }
  if (/\bverification\b/i.test(query)) {
    score += 3;
    reasons.push('verification');
  }
  
  // +2: News or latest
  if (/\bnews\b/i.test(query)) {
    score += 2;
    reasons.push('news');
  }
  if (/\blatest\b/i.test(query)) {
    score += 2;
    reasons.push('latest');
  }
  
  // +1: Updates
  if (/\bupdates?\b/i.test(query)) {
    score += 1;
    reasons.push('updates');
  }
  
  // -1: Too generic (only contains very common words)
  const words = query.toLowerCase().split(/\s+/);
  const genericWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'situation', 'information'];
  const nonGenericWords = words.filter(w => !genericWords.includes(w));
  if (nonGenericWords.length < 2) {
    score -= 1;
    reasons.push('too_generic');
  }
  
  // -2: Near-duplicate (very similar to another query)
  const normalized = query.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const other of allQueries) {
    if (other === query) continue;
    const otherNormalized = other.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // Check if queries are very similar (>80% overlap)
    const words1 = new Set(normalized.split(/\s+/));
    const words2 = new Set(otherNormalized.split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    const similarity = intersection.size / union.size;
    
    if (similarity > 0.8 && normalized !== otherNormalized) {
      score -= 2;
      reasons.push('near_duplicate');
      break;
    }
  }
  
  return { query, score, reasons };
}

/**
 * Rank and select top queries with diversity
 * 
 * Ensures the final set contains:
 * - Exact claim (always included)
 * - Mix of high-scoring queries
 * - Diversity in query types (news, fact-check, trusted sources)
 */
function rankAndSelectQueries(queries: string[], maxQueries: number = 6): { selected: string[]; scored: ScoredQuery[] } {
  // Score all queries
  const scored = queries.map(q => scoreQuery(q, queries));
  
  // Sort by score (descending)
  scored.sort((a, b) => b.score - a.score);
  
  // Always include the first query (original claim)
  const selected: string[] = [queries[0]];
  const selectedReasons = new Set<string>();
  
  // Add highest-scoring diverse queries
  for (const scoredQuery of scored) {
    if (selected.length >= maxQueries) break;
    if (selected.includes(scoredQuery.query)) continue;
    
    // Check for diversity (prefer queries with different reasons)
    const hasNewReason = scoredQuery.reasons.some(r => !selectedReasons.has(r));
    const isHighScore = scoredQuery.score >= 2;
    
    if (hasNewReason || isHighScore) {
      selected.push(scoredQuery.query);
      scoredQuery.reasons.forEach(r => selectedReasons.add(r));
    }
  }
  
  // If we still have room, add remaining high-scoring queries
  for (const scoredQuery of scored) {
    if (selected.length >= maxQueries) break;
    if (!selected.includes(scoredQuery.query) && scoredQuery.score > 0) {
      selected.push(scoredQuery.query);
    }
  }
  
  return { selected, scored };
}
