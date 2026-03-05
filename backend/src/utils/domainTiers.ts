/**
 * Domain Tier Mapping
 *
 * Maps news domains to trust tiers for source ranking
 *
 * Validates: Requirements FR3.4
 */

/**
 * Domain tier map with trust scores
 *
 * Tier 1.0: Highly trusted news sources (wire services, public broadcasters)
 * Tier 0.8: Trusted major newspapers and news organizations
 * Tier 0.6: Mainstream news networks
 * Tier 0.5: Default for unknown domains
 */
const DOMAIN_TIERS: Record<string, number> = {
  // Tier 1.0 - Highly trusted
  'reuters.com': 1.0,
  'apnews.com': 1.0,
  'bbc.com': 1.0,
  'bbc.co.uk': 1.0,
  'npr.org': 1.0,
  'pbs.org': 1.0,

  // Tier 0.8 - Trusted
  'nytimes.com': 0.8,
  'washingtonpost.com': 0.8,
  'theguardian.com': 0.8,
  'wsj.com': 0.8,
  'ft.com': 0.8,
  'economist.com': 0.8,

  // Tier 0.6 - Mainstream
  'cnn.com': 0.6,
  'foxnews.com': 0.6,
  'nbcnews.com': 0.6,
  'abcnews.go.com': 0.6,
  'cbsnews.com': 0.6,
  'usatoday.com': 0.6,
  'time.com': 0.6,
  'newsweek.com': 0.6,
};

/**
 * Get domain tier score
 *
 * Returns trust score for a given domain, defaulting to 0.5 for unknown domains
 *
 * @param domain - Domain to get tier for (e.g., "bbc.com")
 * @returns Tier score (0-1)
 *
 * @example
 * getDomainTier("reuters.com") // 1.0
 * getDomainTier("nytimes.com") // 0.8
 * getDomainTier("unknown.com") // 0.5
 */
export function getDomainTier(domain: string): number {
  if (!domain || typeof domain !== 'string') {
    return 0.5;
  }

  const normalized = domain.toLowerCase().trim();
  return DOMAIN_TIERS[normalized] ?? 0.5;
}

/**
 * Check if domain is in tier map
 *
 * @param domain - Domain to check
 * @returns True if domain is in tier map
 */
export function isKnownDomain(domain: string): boolean {
  if (!domain || typeof domain !== 'string') {
    return false;
  }

  const normalized = domain.toLowerCase().trim();
  return normalized in DOMAIN_TIERS;
}

/**
 * Get all domains in a specific tier
 *
 * @param tier - Tier score to filter by
 * @returns Array of domains in that tier
 */
export function getDomainsInTier(tier: number): string[] {
  return Object.entries(DOMAIN_TIERS)
    .filter(([, score]) => score === tier)
    .map(([domain]) => domain);
}
