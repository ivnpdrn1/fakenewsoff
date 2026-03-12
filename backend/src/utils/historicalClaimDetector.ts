/**
 * Historical Claim Detector
 *
 * Detects whether a claim refers to historical events, figures, or well-known facts
 * Used to determine retrieval strategy (news vs web search)
 */

/**
 * Historical indicators - keywords that suggest historical content
 */
const HISTORICAL_KEYWORDS = [
  // Time indicators
  'died', 'death', 'born', 'founded', 'established', 'ended', 'began', 'started',
  'was', 'were', 'had', 'did', 'happened', 'occurred',
  
  // Historical periods
  'century', 'decade', 'era', 'age', 'period',
  
  // Historical events
  'war', 'battle', 'revolution', 'independence', 'treaty', 'declaration',
  
  // Dates and years (will be detected by regex)
];

/**
 * Historical figures - known historical people
 */
const HISTORICAL_FIGURES = [
  'ronald reagan', 'george washington', 'abraham lincoln', 'john kennedy',
  'martin luther king', 'winston churchill', 'franklin roosevelt',
  'albert einstein', 'isaac newton', 'charles darwin', 'galileo',
  'napoleon', 'julius caesar', 'cleopatra', 'alexander the great',
];

/**
 * Historical events - known historical events
 */
const HISTORICAL_EVENTS = [
  'world war', 'wwii', 'ww2', 'wwi', 'ww1',
  'vietnam war', 'cold war', 'civil war', 'revolutionary war',
  'moon landing', 'apollo', 'pearl harbor', 'hiroshima',
  '9/11', 'september 11', 'berlin wall', 'holocaust',
];

/**
 * Recency indicators - keywords that suggest recent/breaking news
 */
const RECENCY_INDICATORS = [
  'today', 'yesterday', 'this week', 'this month', 'recently',
  'just', 'breaking', 'latest', 'new', 'current', 'now',
  'announced', 'announces', 'will', 'plans to', 'going to',
];

/**
 * Result of historical claim detection
 */
export interface HistoricalClaimResult {
  /** Whether the claim is historical */
  isHistorical: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reasons for classification */
  reasons: string[];
  /** Suggested retrieval mode */
  retrievalMode: 'news_recent' | 'news_historical' | 'web_knowledge';
}

/**
 * Detect if a claim is historical
 *
 * @param claim - Claim text to analyze
 * @returns Detection result with confidence and reasoning
 */
export function detectHistoricalClaim(claim: string): HistoricalClaimResult {
  const claimLower = claim.toLowerCase().trim();
  const reasons: string[] = [];
  let historicalScore = 0;
  let recencyScore = 0;

  // Check for year patterns (1900-2023)
  const yearPattern = /\b(19\d{2}|20[0-2]\d)\b/g;
  const years = claimLower.match(yearPattern);
  if (years) {
    const oldestYear = Math.min(...years.map(y => parseInt(y)));
    const currentYear = new Date().getFullYear();
    const yearsAgo = currentYear - oldestYear;
    
    if (yearsAgo > 1) {
      historicalScore += 0.3;
      reasons.push(`References year ${oldestYear} (${yearsAgo} years ago)`);
    }
  }

  // Check for historical keywords
  const foundKeywords = HISTORICAL_KEYWORDS.filter(keyword => 
    claimLower.includes(keyword)
  );
  if (foundKeywords.length > 0) {
    historicalScore += Math.min(0.2 * foundKeywords.length, 0.4);
    reasons.push(`Contains historical keywords: ${foundKeywords.slice(0, 3).join(', ')}`);
  }

  // Check for historical figures
  const foundFigures = HISTORICAL_FIGURES.filter(figure => 
    claimLower.includes(figure)
  );
  if (foundFigures.length > 0) {
    historicalScore += 0.4;
    reasons.push(`References historical figure: ${foundFigures[0]}`);
  }

  // Check for historical events
  const foundEvents = HISTORICAL_EVENTS.filter(event => 
    claimLower.includes(event)
  );
  if (foundEvents.length > 0) {
    historicalScore += 0.4;
    reasons.push(`References historical event: ${foundEvents[0]}`);
  }

  // Check for recency indicators (negative signal for historical)
  const foundRecency = RECENCY_INDICATORS.filter(indicator => 
    claimLower.includes(indicator)
  );
  if (foundRecency.length > 0) {
    recencyScore += Math.min(0.3 * foundRecency.length, 0.6);
    reasons.push(`Contains recency indicators: ${foundRecency.slice(0, 2).join(', ')}`);
  }

  // Calculate final confidence
  const confidence = Math.max(0, Math.min(1, historicalScore - recencyScore));
  const isHistorical = confidence > 0.3;

  // Determine retrieval mode
  let retrievalMode: 'news_recent' | 'news_historical' | 'web_knowledge';
  if (recencyScore > 0.4) {
    retrievalMode = 'news_recent';
  } else if (isHistorical && confidence > 0.6) {
    retrievalMode = 'web_knowledge';
  } else if (isHistorical) {
    retrievalMode = 'news_historical';
  } else {
    retrievalMode = 'news_recent';
  }

  return {
    isHistorical,
    confidence,
    reasons,
    retrievalMode,
  };
}

/**
 * Get suggested freshness strategies based on claim type
 *
 * @param claim - Claim text
 * @returns Array of freshness strategies to try in order
 */
export function getSuggestedFreshnessStrategies(
  claim: string
): Array<'7d' | '30d' | '1y' | 'web'> {
  const detection = detectHistoricalClaim(claim);

  switch (detection.retrievalMode) {
    case 'news_recent':
      // Recent news: try 7d, then 30d as fallback
      return ['7d', '30d', 'web'];
    
    case 'news_historical':
      // Historical but might have recent coverage: try 30d, 1y, then web
      return ['30d', '1y', 'web'];
    
    case 'web_knowledge':
      // Clearly historical: skip news, go straight to web search
      return ['web'];
    
    default:
      return ['7d', '30d', '1y', 'web'];
  }
}
