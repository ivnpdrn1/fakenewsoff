/**
 * Evidence Orchestrator Integration Tests
 * 
 * Integration tests for provider failure capture in staged execution
 */

import { EvidenceOrchestrator } from './evidenceOrchestrator';
import type { GroundingService } from '../services/groundingService';
import { EvidenceFilter } from './evidenceFilter';
import { SourceClassifier } from './sourceClassifier';
import type { Query, OrchestrationConfig } from '../types/orchestration';

describe('Evidence Orchestrator - Provider Failure Capture Integration', () => {
  /**
   * **Validates: Requirements 2.4**
   * 
   * Integration test verifying that provider failures during staged execution
   * are correctly captured in state.providerFailureDetails with all required fields
   */
  it('should capture provider failures in state.providerFailureDetails during staged execution', async () => {
    // Create mock grounding service that simulates provider failures
    const mockGroundingService = {
      ground: jest.fn()
        .mockRejectedValueOnce(new Error('API quota exceeded for current billing period'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded, please try again later')),
      getProviderCooldown: jest.fn().mockReturnValue(null),
    } as unknown as GroundingService;

    // Create mock filter and classifier
    const mockFilter = {
      filter: jest.fn().mockResolvedValue([]),
    } as unknown as EvidenceFilter;

    const mockClassifier = {
      classify: jest.fn().mockReturnValue({}),
    } as unknown as SourceClassifier;

    // Create orchestration config
    const config: OrchestrationConfig = {
      minEvidenceScore: 0.6,
      minSourceDiversity: 2,
      maxRetrievalPasses: 1,
      requirePrimarySourceWhenAvailable: true,
      rejectGenericPages: true,
      contradictionSearchRequired: true,
      maxNovaCalls: 10,
      maxTokensPerCall: 4000,
    };

    // Create orchestrator
    const orchestrator = new EvidenceOrchestrator(
      mockGroundingService,
      mockFilter,
      mockClassifier,
      config,
      false // not demo mode
    );

    // Create test queries
    const queries: Query[] = [
      {
        type: 'exact',
        text: 'Test query for mediastack',
        priority: 1.0,
      },
      {
        type: 'entity_action',
        text: 'Test query for gdelt',
        priority: 0.9,
      },
    ];

    // Execute orchestration
    const state = await orchestrator.orchestrate(queries, 'Test claim');

    // Verify state.providerFailureDetails is populated
    expect(state.providerFailureDetails).toBeDefined();
    expect(Array.isArray(state.providerFailureDetails)).toBe(true);
    expect(state.providerFailureDetails!.length).toBeGreaterThan(0);

    // Verify failure details contain required fields
    for (const failure of state.providerFailureDetails!) {
      expect(failure.provider).toBeDefined();
      expect(typeof failure.provider).toBe('string');
      
      expect(failure.query).toBeDefined();
      expect(typeof failure.query).toBe('string');
      
      expect(failure.reason).toBeDefined();
      expect(typeof failure.reason).toBe('string');
      
      expect(failure.stage).toBeDefined();
      expect(typeof failure.stage).toBe('number');
      
      expect(failure.latency).toBeDefined();
      expect(typeof failure.latency).toBe('number');
      expect(failure.latency).toBeGreaterThanOrEqual(0);
      
      expect(failure.raw_count).toBeDefined();
      expect(typeof failure.raw_count).toBe('number');
      
      expect(failure.normalized_count).toBeDefined();
      expect(typeof failure.normalized_count).toBe('number');
      
      expect(failure.accepted_count).toBeDefined();
      expect(typeof failure.accepted_count).toBe('number');
      
      expect(failure.error_message).toBeDefined();
      expect(typeof failure.error_message).toBe('string');
      expect(failure.error_message.length).toBeGreaterThan(0);
    }
  });

  /**
   * **Validates: Requirements 2.4**
   * 
   * Verify that failure reasons match expected values
   */
  it('should capture correct failure reasons for different provider errors', async () => {
    // Create mock grounding service with specific error types
    const mockGroundingService = {
      ground: jest.fn()
        .mockRejectedValueOnce(new Error('API quota exceeded'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockRejectedValueOnce(new Error('Request timeout')),
      getProviderCooldown: jest.fn().mockReturnValue(null),
    } as unknown as GroundingService;

    const mockFilter = {
      filter: jest.fn().mockResolvedValue([]),
    } as unknown as EvidenceFilter;

    const mockClassifier = {
      classify: jest.fn().mockReturnValue({}),
    } as unknown as SourceClassifier;

    const config: OrchestrationConfig = {
      minEvidenceScore: 0.6,
      minSourceDiversity: 2,
      maxRetrievalPasses: 1,
      requirePrimarySourceWhenAvailable: true,
      rejectGenericPages: true,
      contradictionSearchRequired: true,
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

    const queries: Query[] = [
      { type: 'exact', text: 'Query 1', priority: 1.0 },
      { type: 'entity_action', text: 'Query 2', priority: 0.9 },
      { type: 'date_sensitive', text: 'Query 3', priority: 0.8 },
    ];

    const state = await orchestrator.orchestrate(queries, 'Test claim');

    // Verify failure details exist
    expect(state.providerFailureDetails).toBeDefined();
    expect(state.providerFailureDetails!.length).toBeGreaterThan(0);

    // Verify each failure has a valid reason
    const validReasons = [
      'rate_limit',
      'quota_exceeded',
      'timeout',
      'zero_raw_results',
      'normalization_zero',
      'filtered_to_zero',
      'attempt_failed',
    ];

    for (const failure of state.providerFailureDetails!) {
      expect(validReasons).toContain(failure.reason);
    }
  });

  /**
   * **Validates: Requirements 2.4**
   * 
   * Verify that successful provider calls do not add failure details
   */
  it('should not add failure details when providers succeed', async () => {
    // Create mock grounding service that succeeds
    const mockGroundingService = {
      ground: jest.fn().mockResolvedValue({
        sources: [
          {
            url: 'https://example.com/article',
            title: 'Test Article',
            snippet: 'Test snippet',
            publishDate: '2024-01-01',
            domain: 'example.com',
            score: 0.9,
          },
        ],
        queries: 1,
        providerUsed: ['mediastack'],
        sourcesCount: 1,
        cacheHit: false,
        latencyMs: 100,
      }),
      getProviderCooldown: jest.fn().mockReturnValue(null),
    } as unknown as GroundingService;

    const mockFilter = {
      filter: jest.fn().mockImplementation((candidates) =>
        Promise.resolve(candidates.map((c: any) => ({ ...c, passed: true })))
      ),
    } as unknown as EvidenceFilter;

    const mockClassifier = {
      classify: jest.fn().mockImplementation((source) => ({
        ...source,
        sourceClass: 'major_international',
        authorityLevel: 'high',
        pageType: 'article',
      })),
    } as unknown as SourceClassifier;

    const config: OrchestrationConfig = {
      minEvidenceScore: 0.6,
      minSourceDiversity: 2,
      maxRetrievalPasses: 1,
      requirePrimarySourceWhenAvailable: true,
      rejectGenericPages: true,
      contradictionSearchRequired: true,
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

    const queries: Query[] = [
      { type: 'exact', text: 'Successful query', priority: 1.0 },
    ];

    const state = await orchestrator.orchestrate(queries, 'Test claim');

    // Verify providerFailureDetails is empty or undefined when providers succeed
    if (state.providerFailureDetails) {
      expect(state.providerFailureDetails.length).toBe(0);
    }

    // Verify evidence was collected
    expect(state.collectedEvidence.length).toBeGreaterThan(0);
  });
});
