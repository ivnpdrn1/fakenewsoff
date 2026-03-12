/**
 * Demo Evidence Provider
 *
 * Provides deterministic evidence sources for hackathon demo mode.
 * Returns predefined evidence for three example claims:
 * 1. Supported: "The Eiffel Tower is located in Paris, France"
 * 2. Disputed: "The moon landing was faked in 1969"
 * 3. Unverified: "A new species was discovered yesterday"
 *
 * Validates: Requirements 1, 2, 3, 4, 13
 */

import { createHash } from 'crypto';
import type { NormalizedSourceWithStance } from '../types/grounding';

/**
 * Demo evidence database (deterministic, in-memory)
 */
const DEMO_EVIDENCE_DB: Record<string, NormalizedSourceWithStance[]> = {
  // Supported claim evidence
  eiffel_tower_paris: [
    {
      url: 'https://www.britannica.com/topic/Eiffel-Tower',
      title: 'Eiffel Tower | History, Height, & Facts',
      snippet:
        'The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France.',
      publishDate: '2024-01-15T00:00:00Z',
      domain: 'britannica.com',
      score: 0.95,
      stance: 'supports',
      stanceJustification: 'Authoritative encyclopedia confirms location',
      provider: 'demo',
      credibilityTier: 1,
    },
    {
      url: 'https://www.toureiffel.paris/en',
      title: 'Official Eiffel Tower Website',
      snippet: 'Welcome to the official Eiffel Tower website. Located in Paris, France.',
      publishDate: '2024-01-15T00:00:00Z',
      domain: 'toureiffel.paris',
      score: 0.98,
      stance: 'supports',
      stanceJustification: 'Official source confirms Paris location',
      provider: 'demo',
      credibilityTier: 1,
    },
    {
      url: 'https://www.nationalgeographic.com/travel/article/eiffel-tower',
      title: 'Eiffel Tower: The Symbol of Paris',
      snippet: 'The iconic Eiffel Tower stands tall in the heart of Paris, France.',
      publishDate: '2024-01-10T00:00:00Z',
      domain: 'nationalgeographic.com',
      score: 0.92,
      stance: 'supports',
      stanceJustification: 'Reputable travel source confirms location',
      provider: 'demo',
      credibilityTier: 1,
    },
  ],

  // Disputed claim evidence
  moon_landing_faked: [
    {
      url: 'https://www.nasa.gov/mission_pages/apollo/apollo11.html',
      title: 'Apollo 11 Mission Overview',
      snippet:
        'On July 20, 1969, Neil Armstrong and Buzz Aldrin became the first humans to land on the Moon.',
      publishDate: '2024-01-15T00:00:00Z',
      domain: 'nasa.gov',
      score: 0.98,
      stance: 'contradicts',
      stanceJustification: 'Official NASA records confirm moon landing occurred',
      provider: 'demo',
      credibilityTier: 1,
    },
    {
      url: 'https://www.snopes.com/fact-check/moon-landing-hoax/',
      title: 'Fact Check: Moon Landing Hoax Claims',
      snippet: 'Multiple lines of evidence confirm the Apollo moon landings were real, not faked.',
      publishDate: '2024-01-12T00:00:00Z',
      domain: 'snopes.com',
      score: 0.94,
      stance: 'contradicts',
      stanceJustification: 'Fact-checking organization debunks hoax claims',
      provider: 'demo',
      credibilityTier: 1,
    },
    {
      url: 'https://www.space.com/apollo-11-moon-landing-conspiracy-theories-debunked.html',
      title: 'Moon Landing Conspiracy Theories Debunked',
      snippet:
        'Scientific evidence and expert analysis confirm the authenticity of the 1969 moon landing.',
      publishDate: '2024-01-08T00:00:00Z',
      domain: 'space.com',
      score: 0.9,
      stance: 'contradicts',
      stanceJustification: 'Scientific publication contradicts hoax claims',
      provider: 'demo',
      credibilityTier: 1,
    },
  ],

  // Unverified claim evidence (empty)
  new_species_discovered: [],
};

/**
 * Generate deterministic claim key from text
 *
 * @param text - Claim text to generate key for
 * @returns Deterministic key for claim lookup
 */
function generateClaimKey(text: string): string {
  const normalized = text.toLowerCase().trim();

  // Match specific example claims
  if (normalized.includes('eiffel tower') && normalized.includes('paris')) {
    return 'eiffel_tower_paris';
  }
  if (normalized.includes('moon landing') && normalized.includes('faked')) {
    return 'moon_landing_faked';
  }
  if (normalized.includes('new species') && normalized.includes('discovered')) {
    return 'new_species_discovered';
  }

  // Fallback: hash-based key for other claims
  const hash = createHash('sha256').update(normalized).digest('hex');
  return `claim_${hash.substring(0, 16)}`;
}

/**
 * Get demo evidence for a claim
 *
 * Returns deterministic evidence sources for known example claims.
 * For unknown claims, returns empty array (unverified).
 *
 * @param claimText - Claim text to get evidence for
 * @returns Array of evidence sources (empty for unverified claims)
 */
export function getDemoEvidence(claimText: string): NormalizedSourceWithStance[] {
  const key = generateClaimKey(claimText);
  return DEMO_EVIDENCE_DB[key] || [];
}

/**
 * Check if claim has demo evidence
 *
 * @param claimText - Claim text to check
 * @returns True if claim has predefined demo evidence
 */
export function hasDemoEvidence(claimText: string): boolean {
  const key = generateClaimKey(claimText);
  return key in DEMO_EVIDENCE_DB;
}
