/**
 * Bug Condition Exploration Test for Production Retrieval Efficiency
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
 *
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
 *
 * **GOAL**: Surface counterexamples that demonstrate inefficient retrieval exists
 *
 * Property 1: Bug Condition - Efficient Query Budgeting and Staged Execution
 *
 * For any orchestration request where multiple queries are generated (6+ queries),
 * the system SHOULD use:
 * - Query budgeting (max 1-2 queries per provider initially)
 * - Provider cooldown tracking (after rate-limit errors)
 * - Short-term caching (5-15 min evidence, 2-5 min rate-limit)
 * - Staged execution (Stage 1: Mediastack → Stage 2: GDELT → Stage 3: expand if needed)
 *
 * This test will FAIL on unfixed code because:
 * - All 6 queries are sent to all providers (no budgeting)
 * - Provider calls continue after rate-limit (no cooldown)
 * - Fresh API calls for repeated requests (no caching)
 * - Parallel fan-out without staged progression
 */

import * as fc from 'fast-check';
import { EvidenceOrchestrator } from './evidenceOrchestrator';
import { GroundingService } from '../services/groundingService';
import { EvidenceFilter } from './evidenceFilter';
import { SourceClassifier } from './sourceClassifier';
import type { OrchestrationConfig, Query } from '../types/orchestration';

describe('Bug Condition Exploration: Inefficient Query Budgeting and Staged Execution', () => {
  /**
   * Test that demonstrates the bug: system sends all queries to all providers
   * without budgeting, cooldown tracking, caching, or staged execution
   *
   * **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
   */
  it('Property 1: System should use query budgeting, cooldown tracking, caching, and staged execution', async () => {
    // Generate 6 queries for a claim (triggers bug condition)
    const claim = 'Biden announced new climate policy';
    const queries: Query[] = [
      { type: 'exact', text: 'Biden announced new climate policy', priority: 1.0 },
      { type: 'entity_action', text: 'Biden climate policy', priority: 0.9 },
      { type: 'date_sensitive', text: 'Biden climate policy 2024', priority: 0.8 },
      { type: 'official_confirmation', text: 'White House climate policy announcement', priority: 0.7 },
      { type: 'regional', text: 'Biden climate policy US', priority: 0.6 },
      { type: 'fact_check', text: 'Biden climate policy fact check', priority: 0.5 },
    ];

    // Track provider calls to observe behavior
    const providerCalls: Array<{ provider: string; query: string; timestamp: number }> = [];
    let mediastackCallCount = 0;
    let gdeltCallCount = 0;

    // Mock grounding service to track calls
    const mockGroundingService = {
      ground: jest.fn(async (query: string) => {
        const timestamp = Date.now();
        
        // Simulate Mediastack call
        mediastackCallCount++;
        providerCalls.push({ provider: 'mediastack', query, timestamp });
        
        // Simulate rate-limit on 3rd Mediastack call
        if (mediastackCallCount === 3) {
          throw new Error('Mediastack: Rate limit exceeded (429)');
        }
        
        // Simulate GDELT call after Mediastack
        gdeltCallCount++;
        providerCalls.push({ provider: 'gdelt', query, timestamp });
        
        return {
          sources: [],
          providerUsed: 'gdelt' as const,
          query,
          latencyMs: 100,
          attemptedProviders: ['mediastack', 'gdelt'],
        };
      }),
    } as unknown as GroundingService;

    const mockFilter = {
      filter: jest.fn(async (candidates) => candidates.map((c: any) => ({ ...c, passed: true }))),
    } as unknown as EvidenceFilter;

    const mockClassifier = {
      classify: jest.fn((source) => source),
    } as unknown as SourceClassifier;

    const config: OrchestrationConfig = {
      minEvidenceScore: 0.5,
      minSourceDiversity: 2,
      maxRetrievalPasses: 3,
      requirePrimarySourceWhenAvailable: false,
      rejectGenericPages: true,
      contradictionSearchRequired: false,
      maxNovaCalls: 10,
      maxTokensPerCall: 4000,
    };

    const orchestrator = new EvidenceOrchestrator(
      mockGroundingService,
      mockFilter,
      mockClassifier,
      config,
      false // not demo mode
    );

    // Execute orchestration
    try {
      await orchestrator.orchestrate(queries, claim);
    } catch (error) {
      // Ignore errors - we're observing behavior
    }

    // **ASSERTIONS FOR EXPECTED BEHAVIOR**
    // These will FAIL on unfixed code, confirming the bug exists

    // Requirement 2.1: Query budgeting should limit queries per provider
    // Expected: Max 1-2 queries to Mediastack initially
    // Actual (unfixed): All 6 queries sent to Mediastack
    const mediastackCalls = providerCalls.filter(c => c.provider === 'mediastack');
    expect(mediastackCalls.length).toBeLessThanOrEqual(2); // WILL FAIL: expects 6

    // Requirement 2.2: Provider cooldown should prevent calls after rate-limit
    // Expected: After rate-limit on query 3, no more Mediastack calls
    // Actual (unfixed): Queries 4-6 still sent to Mediastack
    const callsAfterRateLimit = mediastackCalls.filter((_, index) => index >= 3);
    expect(callsAfterRateLimit.length).toBe(0); // WILL FAIL: expects 3

    // Requirement 2.4: Staged execution should be used
    // Expected: Stage 1 (Mediastack 1 query) → Stage 2 (GDELT 1 query) → Stage 3 (expand)
    // Actual (unfixed): All queries sent in parallel
    // Note: The mock is called synchronously, so we verify staged execution by checking
    // that only 1 query was sent to Mediastack (Stage 1), not all 6 queries in parallel
    const stagedExecutionUsed = mediastackCalls.length <= 2; // Only Stage 1 query sent
    expect(stagedExecutionUsed).toBe(true); // Confirms staged execution (not parallel fan-out)

    // Requirement 2.3: Short-term caching should be used for repeated requests
    // Expected: Second request returns cached result
    // Actual (unfixed): Fresh API calls made
    const initialCallCount = providerCalls.length;
    try {
      await orchestrator.orchestrate(queries, claim);
    } catch (error) {
      // Ignore errors
    }
    const secondCallCount = providerCalls.length;
    expect(secondCallCount).toBe(initialCallCount); // WILL FAIL: expects more calls

    // Document counterexamples found
    console.log('=== BUG CONDITION COUNTEREXAMPLES ===');
    console.log(`Total Mediastack calls: ${mediastackCalls.length} (expected: ≤2)`);
    console.log(`Calls after rate-limit: ${callsAfterRateLimit.length} (expected: 0)`);
    console.log(`Staged execution used: ${stagedExecutionUsed} (expected: true)`);
    console.log(`Cache used on repeat: ${secondCallCount === initialCallCount} (expected: true)`);
    console.log('Provider call sequence:');
    providerCalls.forEach((call, i) => {
      console.log(`  ${i + 1}. ${call.provider}: ${call.query.substring(0, 50)}`);
    });
  });

  /**
   * Property-based test: For ANY claim with 6+ queries, system should apply
   * query budgeting, cooldown tracking, caching, and staged execution
   *
   * **EXPECTED OUTCOME**: Test FAILS (confirms bug exists across input space)
   */
  it('Property 1 (PBT): Query budgeting and staged execution should apply to all multi-query requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary claims and query sets
        fc.record({
          claim: fc.string({ minLength: 10, maxLength: 100 }),
          queryCount: fc.integer({ min: 6, max: 10 }),
        }),
        async ({ claim, queryCount }) => {
          // Generate queries
          const queries: Query[] = Array.from({ length: queryCount }, (_, i) => ({
            type: ['exact', 'entity_action', 'date_sensitive', 'official_confirmation', 'regional', 'fact_check'][i % 6] as any,
            text: `${claim} query ${i}`,
            priority: 1.0 - (i * 0.1),
          }));

          // Track provider calls
          const providerCalls: string[] = [];
          let rateLimitHit = false;

          const mockGroundingService = {
            ground: jest.fn(async (query: string) => {
              providerCalls.push('mediastack');
              
              // Simulate rate-limit on 3rd call
              if (providerCalls.filter(p => p === 'mediastack').length === 3) {
                rateLimitHit = true;
                throw new Error('Rate limit');
              }
              
              providerCalls.push('gdelt');
              
              return {
                sources: [],
                providerUsed: 'gdelt' as const,
                query,
                latencyMs: 100,
              };
            }),
          } as unknown as GroundingService;

          const mockFilter = {
            filter: jest.fn(async (candidates) => candidates.map((c: any) => ({ ...c, passed: true }))),
          } as unknown as EvidenceFilter;

          const mockClassifier = {
            classify: jest.fn((source) => source),
          } as unknown as SourceClassifier;

          const config: OrchestrationConfig = {
            minEvidenceScore: 0.5,
            minSourceDiversity: 2,
            maxRetrievalPasses: 3,
            requirePrimarySourceWhenAvailable: false,
            rejectGenericPages: true,
            contradictionSearchRequired: false,
            maxNovaCalls: 10,
            maxTokensPerCall: 4000,
          };

          const orchestrator = new EvidenceOrchestrator(
            mockGroundingService,
            mockFilter,
            mockClassifier,
            config,
            false
          );

          try {
            await orchestrator.orchestrate(queries, claim);
          } catch (error) {
            // Ignore errors
          }

          // Property: Query budgeting should limit provider calls
          const mediastackCalls = providerCalls.filter(p => p === 'mediastack').length;
          
          // ASSERTION: Max 2 queries to Mediastack initially
          // WILL FAIL on unfixed code (sends all queries)
          return mediastackCalls <= 2;
        }
      ),
      {
        numRuns: 10, // Run 10 test cases
        verbose: true,
      }
    );
  });
});
