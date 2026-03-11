/**
 * Score Normalization Utility
 * 
 * Ensures all source scores are valid numbers to prevent frontend validation errors
 */

import type { NormalizedSourceWithStance } from '../types/grounding';

/**
 * Normalize source scores to ensure they are always numbers
 * 
 * Converts null, undefined, NaN, or non-numeric values to 0
 * 
 * @param sources - Sources with potentially invalid scores
 * @returns Sources with guaranteed numeric scores
 */
export function normalizeSourceScores(
  sources: NormalizedSourceWithStance[]
): NormalizedSourceWithStance[] {
  return sources.map((source) => ({
    ...source,
    score: typeof source.score === 'number' && !isNaN(source.score) ? source.score : 0,
  }));
}

/**
 * Validate that all sources have numeric scores
 * 
 * @param sources - Sources to validate
 * @returns True if all scores are valid numbers
 */
export function validateSourceScores(sources: NormalizedSourceWithStance[]): boolean {
  return sources.every(
    (source) => typeof source.score === 'number' && !isNaN(source.score)
  );
}
