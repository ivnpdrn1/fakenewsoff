/**
 * Bug Condition Exploration Test for Historical Claims Evidence Retrieval
 *
 * Feature: historical-claims-evidence-retrieval-fix
 * Property 1: Bug Condition - Historical Claims Return Empty Evidence
 *
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * NOTE: This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * GOAL: Surface counterexamples that demonstrate the bug exists
 *
 * Scoped PBT Approach: Test well-documented historical claims (Reagan death, WWII end date)
 * that should have evidence but return empty results with 7-day freshness
 */

import { groundTextOnly } from './groundingService';
import { getEnv } from '../utils/envValidation';

describe('Bug Condition Exploration: Historical Claims Return Empty Evidence', () => {
  // Skip tests if API keys are not configured
  const env = getEnv();
  const hasApiKeys = env.BING_NEWS_KEY || env.GDELT_DOC_ENDPOINT;
  const testCondition = hasApiKeys ? describe : describe.skip;

  testCondition('Historical claims with 7-day freshness (UNFIXED CODE)', () => {
    // Increase timeout for API calls
    jest.setTimeout(10000);

    it('should return empty evidence for "Ronald Reagan is dead" (Bug Condition)', async () => {
      // This is a well-documented historical claim (Reagan died in 2004)
      // With 7-day freshness, this should return empty evidence (BUG)
      // After fix, this should return credible sources (EXPECTED BEHAVIOR)

      const claim = 'Ronald Reagan is dead';
      const result = await groundTextOnly(claim, 'bug-test-1', false);

      // Document the bug: empty evidence array
      console.log('Bug Condition Test 1 - Ronald Reagan is dead:');
      console.log(`  Sources found: ${result.sources.length}`);
      console.log(`  Provider used: ${result.providerUsed.join(', ')}`);
      console.log(`  Reason codes: ${result.reasonCodes?.join(', ') || 'none'}`);
      console.log(`  Errors: ${result.errors?.join(', ') || 'none'}`);

      // EXPECTED BEHAVIOR (after fix):
      // - sources.length > 0 (should have obituaries, biographical articles)
      // - freshnessStrategy should be '30d' or '1y' (not '7d')
      // - sources should have credibilityTier 1 or 2

      // BUG CONDITION (unfixed code):
      // This assertion will FAIL on unfixed code, confirming the bug
      expect(result.sources.length).toBeGreaterThan(0);
      expect(result.sources[0]).toHaveProperty('credibilityTier');
      expect([1, 2]).toContain(result.sources[0].credibilityTier);
    });

    it('should return empty evidence for "World War II ended in 1945" (Bug Condition)', async () => {
      // This is a well-documented historical event (79 years ago)
      // With 7-day freshness, this should return empty evidence (BUG)
      // After fix, this should return historical sources (EXPECTED BEHAVIOR)

      const claim = 'World War II ended in 1945';
      const result = await groundTextOnly(claim, 'bug-test-2', false);

      // Document the bug: empty evidence array
      console.log('Bug Condition Test 2 - World War II ended in 1945:');
      console.log(`  Sources found: ${result.sources.length}`);
      console.log(`  Provider used: ${result.providerUsed.join(', ')}`);
      console.log(`  Reason codes: ${result.reasonCodes?.join(', ') || 'none'}`);

      // EXPECTED BEHAVIOR (after fix):
      // - sources.length > 0 (should have historical sources)
      // - freshnessStrategy should be '1y' (very old event)

      // BUG CONDITION (unfixed code):
      // This assertion will FAIL on unfixed code, confirming the bug
      expect(result.sources.length).toBeGreaterThan(0);
    });

    it('should return empty evidence for "The moon landing was faked" (Bug Condition)', async () => {
      // This is a historical conspiracy theory (1969 event)
      // With 7-day freshness, this should return empty evidence (BUG)
      // After fix, this should return both supporting and contradicting sources (EXPECTED BEHAVIOR)

      const claim = 'The moon landing was faked';
      const result = await groundTextOnly(claim, 'bug-test-3', false);

      // Document the bug: empty evidence array
      console.log('Bug Condition Test 3 - The moon landing was faked:');
      console.log(`  Sources found: ${result.sources.length}`);
      console.log(`  Provider used: ${result.providerUsed.join(', ')}`);
      console.log(`  Reason codes: ${result.reasonCodes?.join(', ') || 'none'}`);

      // EXPECTED BEHAVIOR (after fix):
      // - sources.length > 0 (should have debunking articles)
      // - sources should include contradicting stance

      // BUG CONDITION (unfixed code):
      // This assertion will FAIL on unfixed code, confirming the bug
      expect(result.sources.length).toBeGreaterThan(0);
    });

    it('should return empty evidence for "Ronald Regan is dead" with typo (Bug Condition)', async () => {
      // This is a typo variation of "Ronald Reagan is dead"
      // With no typo tolerance, this should return empty evidence (BUG)
      // After fix with typo normalization, this should return same evidence as correct spelling (EXPECTED BEHAVIOR)

      const claim = 'Ronald Regan is dead'; // Note: "Regan" instead of "Reagan"
      const result = await groundTextOnly(claim, 'bug-test-4', false);

      // Document the bug: empty evidence array due to typo
      console.log('Bug Condition Test 4 - Ronald Regan is dead (typo):');
      console.log(`  Sources found: ${result.sources.length}`);
      console.log(`  Provider used: ${result.providerUsed.join(', ')}`);
      console.log(`  Reason codes: ${result.reasonCodes?.join(', ') || 'none'}`);

      // EXPECTED BEHAVIOR (after fix):
      // - sources.length > 0 (should normalize "Regan" to "Reagan")
      // - typoNormalizationApplied should be true

      // BUG CONDITION (unfixed code):
      // This assertion will FAIL on unfixed code, confirming the bug
      expect(result.sources.length).toBeGreaterThan(0);
    });
  });

  describe('Counterexample Documentation', () => {
    it('should document the bug condition for analysis', () => {
      // This test documents the expected counterexamples:
      // 1. "Ronald Reagan is dead" returns empty evidence (should have obituaries)
      // 2. "World War II ended in 1945" returns empty evidence (should have historical sources)
      // 3. "The moon landing was faked" returns empty evidence (should have debunking articles)
      // 4. "Ronald Regan is dead" returns empty evidence (should normalize typo)

      // Root causes confirmed:
      // - Hardcoded 7-day freshness in Bing News and GDELT
      // - No typo tolerance in claim normalization
      // - No fallback strategy for broader time windows
      // - Recency scoring penalizes older articles

      expect(true).toBe(true); // Placeholder for documentation
    });
  });
});
