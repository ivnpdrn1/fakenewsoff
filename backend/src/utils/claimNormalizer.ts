/**
 * Claim Normalizer
 *
 * Normalizes user claim text for cache key generation
 */

/**
 * Normalize claim text for cache key generation
 *
 * Normalization steps:
 * 1. Convert to lowercase
 * 2. Trim whitespace
 * 3. Collapse repeated spaces
 * 4. Remove surrounding punctuation
 *
 * @param claim - User claim text
 * @returns Normalized claim text
 */
export function normalizeClaimForCache(claim: string): string {
  if (!claim || typeof claim !== 'string') {
    return '';
  }

  let normalized = claim
    .toLowerCase() // Convert to lowercase
    .trim() // Trim whitespace
    .replace(/\s+/g, ' '); // Collapse repeated spaces

  // Remove surrounding punctuation (but keep internal punctuation)
  normalized = normalized.replace(/^[^\w\s]+|[^\w\s]+$/g, '');

  return normalized;
}

/**
 * Generate cache key from normalized claim
 *
 * @param claim - User claim text
 * @returns Cache key
 */
export function generateCacheKey(claim: string): string {
  const normalized = normalizeClaimForCache(claim);
  return `evidence:${normalized}`;
}

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits (insertions, deletions, substitutions)
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Levenshtein distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create 2D array for dynamic programming
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first column and row
  for (let i = 0; i <= len1; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix using dynamic programming
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Dictionary of known historical entities for typo correction
 * Maps common typos to correct spellings
 */
const KNOWN_ENTITIES: Record<string, string> = {
  // Historical figures
  'ronald regan': 'Ronald Reagan',
  'ronald reagan': 'Ronald Reagan',
  'george bush': 'George Bush',
  'bill clinton': 'Bill Clinton',
  'barack obama': 'Barack Obama',
  'donald trump': 'Donald Trump',
  'joe biden': 'Joe Biden',
  'winston churchill': 'Winston Churchill',
  'franklin roosevelt': 'Franklin Roosevelt',
  'john kennedy': 'John Kennedy',
  'martin luther king': 'Martin Luther King',
  
  // Historical events
  'world war ii': 'World War II',
  'world war 2': 'World War II',
  'wwii': 'World War II',
  'ww2': 'World War II',
  'world war i': 'World War I',
  'world war 1': 'World War I',
  'wwi': 'World War I',
  'ww1': 'World War I',
  'vietnam war': 'Vietnam War',
  'cold war': 'Cold War',
  
  // Places
  'united states': 'United States',
  'united kingdom': 'United Kingdom',
  'soviet union': 'Soviet Union',
  'european union': 'European Union',
};

/**
 * Normalize entity name using fuzzy matching against known entities
 * Uses Levenshtein distance to find closest match
 *
 * @param entity - Entity name to normalize
 * @returns Normalized entity name (or original if no close match found)
 */
function normalizeEntityName(entity: string): string {
  const entityLower = entity.toLowerCase().trim();
  
  // Exact match in dictionary
  if (KNOWN_ENTITIES[entityLower]) {
    return KNOWN_ENTITIES[entityLower];
  }
  
  // Fuzzy match using Levenshtein distance
  let bestMatch = entity;
  let minDistance = Infinity;
  const maxDistance = 2; // Only consider typos with 1-2 character differences
  
  for (const [knownEntity, correctSpelling] of Object.entries(KNOWN_ENTITIES)) {
    const distance = levenshteinDistance(entityLower, knownEntity);
    
    // If distance is small enough and better than previous best
    if (distance <= maxDistance && distance < minDistance) {
      minDistance = distance;
      bestMatch = correctSpelling;
    }
  }
  
  return bestMatch;
}

/**
 * Extract potential entity names from claim text
 * Looks for capitalized words and multi-word phrases
 *
 * @param claim - Claim text
 * @returns Array of potential entity names
 */
function extractPotentialEntities(claim: string): string[] {
  const entities: string[] = [];
  
  // Split into words
  const words = claim.split(/\s+/);
  
  // Look for multi-word entities (2-4 words)
  for (let len = 4; len >= 2; len--) {
    for (let i = 0; i <= words.length - len; i++) {
      const phrase = words.slice(i, i + len).join(' ');
      const phraseLower = phrase.toLowerCase();
      
      // Check if this phrase is in our known entities dictionary
      if (KNOWN_ENTITIES[phraseLower]) {
        entities.push(phrase);
      }
    }
  }
  
  return entities;
}

/**
 * Normalize claim with typo tolerance for entity names
 * Applies basic normalization plus entity name correction
 *
 * @param claim - User claim text
 * @returns Normalized claim with corrected entity names
 */
export function normalizeClaimWithTypoTolerance(claim: string): string {
  if (!claim || typeof claim !== 'string') {
    return '';
  }
  
  // Step 1: Basic normalization (lowercase, trim, collapse spaces)
  let normalized = normalizeClaimForCache(claim);
  
  // Step 2: Extract potential entity names
  const entities = extractPotentialEntities(normalized);
  
  // Step 3: Normalize each entity
  let result = normalized;
  for (const entity of entities) {
    const normalizedEntity = normalizeEntityName(entity);
    if (normalizedEntity !== entity) {
      // Replace entity with normalized version (case-insensitive)
      const regex = new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      result = result.replace(regex, normalizedEntity);
    }
  }
  
  return result;
}
