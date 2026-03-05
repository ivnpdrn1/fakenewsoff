/**
 * Demo Mode Grounding
 *
 * Provides deterministic grounding bundles for demo mode
 *
 * Validates: Requirements FR7.1, FR7.2, FR7.3, FR7.4
 */

import { GroundingBundle, NormalizedSource } from '../types/grounding';
import { extractQuery, normalizeQuery } from './queryExtractor';

/**
 * Demo sources database (deterministic)
 */
const DEMO_SOURCES: Record<string, NormalizedSource[]> = {
  climate: [
    {
      url: 'https://www.reuters.com/business/environment/climate-summit-2024',
      title: 'World leaders agree on climate action at COP29',
      snippet:
        'Major economies commit to reducing emissions by 50% by 2030 in landmark agreement reached at climate summit.',
      publishDate: '2024-03-01T10:00:00Z',
      domain: 'reuters.com',
      score: 0.95,
    },
    {
      url: 'https://www.bbc.com/news/science-environment-climate',
      title: 'Scientists warn of accelerating climate impacts',
      snippet:
        'New research shows climate change effects are occurring faster than previously predicted, with urgent action needed.',
      publishDate: '2024-03-01T08:30:00Z',
      domain: 'bbc.com',
      score: 0.92,
    },
    {
      url: 'https://www.npr.org/climate-policy-2024',
      title: 'Climate policy changes announced by major nations',
      snippet:
        'Several countries unveil new climate policies aimed at meeting Paris Agreement targets.',
      publishDate: '2024-02-28T15:00:00Z',
      domain: 'npr.org',
      score: 0.88,
    },
  ],
  election: [
    {
      url: 'https://www.apnews.com/politics/elections-2024',
      title: 'Primary elections see record turnout',
      snippet:
        'Voter participation reaches historic levels in early primary states as candidates campaign intensively.',
      publishDate: '2024-03-02T12:00:00Z',
      domain: 'apnews.com',
      score: 0.94,
    },
    {
      url: 'https://www.reuters.com/world/us/election-results',
      title: 'Latest election results and analysis',
      snippet:
        'Comprehensive coverage of primary election results with expert analysis of key races.',
      publishDate: '2024-03-02T10:30:00Z',
      domain: 'reuters.com',
      score: 0.91,
    },
    {
      url: 'https://www.nytimes.com/politics/elections',
      title: 'Election 2024: What voters need to know',
      snippet:
        'Guide to the upcoming elections including key issues, candidates, and voting information.',
      publishDate: '2024-03-01T14:00:00Z',
      domain: 'nytimes.com',
      score: 0.87,
    },
  ],
  technology: [
    {
      url: 'https://www.reuters.com/technology/ai-breakthrough',
      title: 'Major AI breakthrough announced by research team',
      snippet:
        'Scientists achieve significant advancement in artificial intelligence capabilities with new model architecture.',
      publishDate: '2024-03-03T09:00:00Z',
      domain: 'reuters.com',
      score: 0.93,
    },
    {
      url: 'https://www.bbc.com/news/technology',
      title: 'Tech industry responds to new regulations',
      snippet:
        'Major technology companies announce compliance measures following new regulatory framework.',
      publishDate: '2024-03-02T16:00:00Z',
      domain: 'bbc.com',
      score: 0.9,
    },
    {
      url: 'https://www.wsj.com/tech/innovation',
      title: 'Innovation in tech sector drives market growth',
      snippet: 'Technology stocks surge as companies unveil new products and services.',
      publishDate: '2024-03-01T11:00:00Z',
      domain: 'wsj.com',
      score: 0.85,
    },
  ],
  default: [
    {
      url: 'https://www.reuters.com/world/latest-news',
      title: 'Breaking news: Major developments reported',
      snippet:
        'Latest updates on significant events as they unfold, with comprehensive coverage from around the world.',
      publishDate: '2024-03-03T10:00:00Z',
      domain: 'reuters.com',
      score: 0.9,
    },
    {
      url: 'https://www.apnews.com/hub/top-news',
      title: 'Top stories from around the world',
      snippet:
        'Comprehensive coverage of the most important news stories with verified information from trusted sources.',
      publishDate: '2024-03-03T08:00:00Z',
      domain: 'apnews.com',
      score: 0.88,
    },
    {
      url: 'https://www.bbc.com/news',
      title: 'Latest news and analysis',
      snippet:
        'In-depth reporting and analysis of current events with expert commentary and context.',
      publishDate: '2024-03-02T18:00:00Z',
      domain: 'bbc.com',
      score: 0.85,
    },
  ],
};

/**
 * Get demo grounding bundle for headline
 *
 * Returns deterministic mock sources based on headline keywords
 *
 * @param headline - Headline text
 * @returns Demo grounding bundle
 */
export function getDemoGroundingBundle(headline: string): GroundingBundle {
  const query = extractQuery(headline);
  const normalizedQuery = normalizeQuery(query);

  // Determine which demo sources to use based on keywords
  let sources: NormalizedSource[] = DEMO_SOURCES['default'];

  const lowerQuery = normalizedQuery.toLowerCase();

  if (
    lowerQuery.includes('climate') ||
    lowerQuery.includes('environment') ||
    lowerQuery.includes('warming')
  ) {
    sources = DEMO_SOURCES['climate'];
  } else if (
    lowerQuery.includes('election') ||
    lowerQuery.includes('vote') ||
    lowerQuery.includes('campaign')
  ) {
    sources = DEMO_SOURCES['election'];
  } else if (
    lowerQuery.includes('tech') ||
    lowerQuery.includes('ai') ||
    lowerQuery.includes('computer')
  ) {
    sources = DEMO_SOURCES['technology'];
  }

  return {
    sources: [...sources], // Clone array to prevent mutation
    providerUsed: 'demo',
    query: normalizedQuery,
    latencyMs: 0,
  };
}

import type { TextGroundingBundle, NormalizedSourceWithStance } from '../types/grounding';
import { createHash } from 'crypto';

/**
 * Demo sources for text-only grounding (deterministic)
 */
const TEXT_DEMO_SOURCES: NormalizedSourceWithStance[] = [
  {
    url: 'https://www.reuters.com/fact-check/analysis',
    title: 'Fact check: Analyzing recent claims',
    snippet: 'Comprehensive fact-checking analysis of recent claims with evidence from multiple sources.',
    publishDate: '2024-03-03T10:00:00Z',
    domain: 'reuters.com',
    score: 0.95,
    stance: 'supports',
    stanceJustification: 'Source provides evidence supporting the claim.',
    provider: 'demo',
    credibilityTier: 1,
  },
  {
    url: 'https://www.apnews.com/fact-checking',
    title: 'Fact-checking latest statements',
    snippet: 'Independent verification of recent statements with detailed evidence and expert analysis.',
    publishDate: '2024-03-02T14:00:00Z',
    domain: 'apnews.com',
    score: 0.92,
    stance: 'contradicts',
    stanceJustification: 'Source provides evidence contradicting the claim.',
    provider: 'demo',
    credibilityTier: 1,
  },
  {
    url: 'https://www.bbc.com/news/reality-check',
    title: 'Reality Check: Examining the evidence',
    snippet: 'In-depth examination of claims with context and evidence from credible sources.',
    publishDate: '2024-03-01T16:00:00Z',
    domain: 'bbc.com',
    score: 0.88,
    stance: 'mentions',
    stanceJustification: 'Source mentions the claim without clear support or contradiction.',
    provider: 'demo',
    credibilityTier: 1,
  },
  {
    url: 'https://www.npr.org/fact-check',
    title: 'NPR Fact Check: Verifying claims',
    snippet: 'Detailed fact-checking with expert sources and comprehensive research.',
    publishDate: '2024-03-01T12:00:00Z',
    domain: 'npr.org',
    score: 0.85,
    stance: 'unclear',
    stanceJustification: 'Unable to determine stance from available information.',
    provider: 'demo',
    credibilityTier: 1,
  },
  {
    url: 'https://www.washingtonpost.com/fact-checker',
    title: 'Fact Checker: Analyzing statements',
    snippet: 'Rigorous fact-checking with Pinocchio ratings and detailed explanations.',
    publishDate: '2024-02-29T10:00:00Z',
    domain: 'washingtonpost.com',
    score: 0.82,
    stance: 'supports',
    stanceJustification: 'Source confirms key aspects of the claim.',
    provider: 'demo',
    credibilityTier: 1,
  },
  {
    url: 'https://www.nytimes.com/fact-check',
    title: 'The Times Fact Check',
    snippet: 'Independent fact-checking with thorough research and expert consultation.',
    publishDate: '2024-02-28T15:00:00Z',
    domain: 'nytimes.com',
    score: 0.8,
    stance: 'mentions',
    stanceJustification: 'Source discusses related topics without clear stance.',
    provider: 'demo',
    credibilityTier: 1,
  },
];

/**
 * Get demo text grounding bundle for text claim
 * 
 * Returns exactly 3 deterministic sources with varied stances
 * Sources are selected based on hash of input text for determinism
 * 
 * @param text - User's claim text
 * @returns Demo text grounding bundle
 */
export function getDemoTextGroundingBundle(text: string): TextGroundingBundle {
  // Generate deterministic hash from text
  const hash = createHash('sha256').update(text).digest('hex');
  const hashValue = parseInt(hash.substring(0, 8), 16);

  // Select 3 sources deterministically based on hash
  // Ensure stance diversity: at least 2 different stances
  const sourceIndices = [
    hashValue % TEXT_DEMO_SOURCES.length,
    (hashValue + 1) % TEXT_DEMO_SOURCES.length,
    (hashValue + 2) % TEXT_DEMO_SOURCES.length,
  ];

  // Ensure we have at least 2 different stances
  const selectedSources = sourceIndices.map((idx) => TEXT_DEMO_SOURCES[idx]);
  const stances = new Set(selectedSources.map((s) => s.stance));

  // If all 3 sources have same stance, replace one with different stance
  if (stances.size === 1) {
    const differentStanceIdx = (hashValue + 3) % TEXT_DEMO_SOURCES.length;
    selectedSources[2] = TEXT_DEMO_SOURCES[differentStanceIdx];
  }

  // Generate deterministic queries based on text
  const queries = [
    `"${text.split(' ').slice(0, 5).join(' ')}"`,
    text.split(' ').slice(0, 4).join(' '),
    text.split(' ').slice(0, 3).join(' ') + ' recent',
  ];

  return {
    sources: selectedSources.map((source) => ({
      ...source,
      // Update publish dates to be recent
      publishDate: new Date(Date.now() - (hashValue % 7) * 24 * 60 * 60 * 1000).toISOString(),
    })),
    queries,
    providerUsed: ['demo'],
    sourcesCount: 3,
    cacheHit: false,
    latencyMs: 0,
  };
}
