/**
 * Unit Tests for Query Ranking in Evidence Orchestrator
 *
 * **Validates: Requirements 2.1 (Query Budgeting and Ranking)**
 *
 * Tests the rankQueriesByRelevance() function that ranks queries before staged execution.
 * This function prioritizes:
 * 1. Query type ('exact' and 'entity_action' are highest priority)
 * 2. Query priority score from generation
 * 3. Query text length and specificity
 */

import { EvidenceOrchestrator } from './evidenceOrchestrator';
import { GroundingService } from '../services/groundingService';
import { EvidenceFilter } from './evidenceFilter';
import { SourceClassifier } from './sourceClassifier';
import type { OrchestrationConfig, Query } from '../types/orchestration';

describe('Query Ranking for Staged Execution', () => {
  // Helper to create orchestrator instance
  const createOrchestrator = () => {
    const mockGroundingService = {} as GroundingService;
    const mockFilter = {} as EvidenceFilter;
    const mockClassifier = {} as SourceClassifier;
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
    return new EvidenceOrchestrator(mockGroundingService, mockFilter, mockClassifier, config, false);
  };

  // Helper to access private method via reflection
  const rankQueries = (orchestrator: EvidenceOrchestrator, queries: Query[]): Query[] => {
    // Access private method using type assertion
    return (orchestrator as any).rankQueriesByRelevance(queries);
  };

  describe('Query Type Prioritization', () => {
    it('should prioritize "exact" query type highest', () => {
      const orchestrator = createOrchestrator();
      const queries: Query[] = [
        { type: 'fact_check', text: 'Biden climate policy fact check', priority: 0.8 },
        { type: 'exact', text: 'Biden announced new climate policy', priority: 0.8 },
        { type: 'regional', text: 'Biden climate policy US', priority: 0.8 },
      ];

      const ranked = rankQueries(orchestrator, queries);

      expect(ranked[0].type).toBe('exact');
    });

    it('should prioritize "entity_action" query type second highest', () => {
      const orchestrator = createOrchestrator();
      const queries: Query[] = [
        { type: 'fact_check', text: 'Biden climate policy fact check', priority: 0.8 },
        { type: 'entity_action', text: 'Biden climate policy', priority: 0.8 },
        { type: 'regional', text: 'Biden climate policy US', priority: 0.8 },
      ];

      const ranked = rankQueries(orchestrator, queries);

      expect(ranked[0].type).toBe('entity_action');
    });

    it('should rank exact > entity_action > date_sensitive > regional > fact_check', () => {
      const orchestrator = createOrchestrator();
      const queries: Query[] = [
        { type: 'fact_check', text: 'test fact check', priority: 0.8 },
        { type: 'regional', text: 'test regional', priority: 0.8 },
        { type: 'date_sensitive', text: 'test date sensitive', priority: 0.8 },
        { type: 'entity_action', text: 'test entity action', priority: 0.8 },
        { type: 'exact', text: 'test exact', priority: 0.8 },
      ];

      const ranked = rankQueries(orchestrator, queries);

      expect(ranked[0].type).toBe('exact');
      expect(ranked[1].type).toBe('entity_action');
      expect(ranked[2].type).toBe('date_sensitive');
      expect(ranked[3].type).toBe('regional');
      expect(ranked[4].type).toBe('fact_check');
    });
  });

  describe('Priority Score Ranking', () => {
    it('should use priority score as tiebreaker when query types are equal', () => {
      const orchestrator = createOrchestrator();
      const queries: Query[] = [
        { type: 'exact', text: 'Biden climate policy', priority: 0.5 },
        { type: 'exact', text: 'Biden announced climate policy', priority: 0.9 },
        { type: 'exact', text: 'Biden new climate policy', priority: 0.7 },
      ];

      const ranked = rankQueries(orchestrator, queries);

      expect(ranked[0].priority).toBe(0.9);
      expect(ranked[1].priority).toBe(0.7);
      expect(ranked[2].priority).toBe(0.5);
    });

    it('should prioritize higher priority scores', () => {
      const orchestrator = createOrchestrator();
      const queries: Query[] = [
        { type: 'entity_action', text: 'test query', priority: 0.3 },
        { type: 'entity_action', text: 'test query', priority: 1.0 },
        { type: 'entity_action', text: 'test query', priority: 0.6 },
      ];

      const ranked = rankQueries(orchestrator, queries);

      expect(ranked[0].priority).toBe(1.0);
      expect(ranked[1].priority).toBe(0.6);
      expect(ranked[2].priority).toBe(0.3);
    });
  });

  describe('Query Specificity Ranking', () => {
    it('should use specificity as final tiebreaker', () => {
      const orchestrator = createOrchestrator();
      const queries: Query[] = [
        { type: 'exact', text: 'Biden', priority: 0.8 }, // Low specificity (1 word)
        { type: 'exact', text: 'Biden announced new climate policy', priority: 0.8 }, // High specificity (5 words)
        { type: 'exact', text: 'Biden climate', priority: 0.8 }, // Medium specificity (2 words)
      ];

      const ranked = rankQueries(orchestrator, queries);

      // Longer, more specific query should rank higher
      expect(ranked[0].text).toBe('Biden announced new climate policy');
    });

    it('should prefer queries with 3-8 words (optimal specificity)', () => {
      const orchestrator = createOrchestrator();
      const queries: Query[] = [
        { type: 'exact', text: 'Biden', priority: 0.8 }, // 1 word - too short
        { type: 'exact', text: 'Biden announced new climate policy today in Washington DC at the White House', priority: 0.8 }, // 14 words - too long
        { type: 'exact', text: 'Biden announced new climate policy', priority: 0.8 }, // 5 words - optimal
      ];

      const ranked = rankQueries(orchestrator, queries);

      // Optimal length query should rank highest
      expect(ranked[0].text).toBe('Biden announced new climate policy');
    });
  });

  describe('Combined Ranking Logic', () => {
    it('should apply all ranking factors in correct priority order', () => {
      const orchestrator = createOrchestrator();
      const queries: Query[] = [
        { type: 'fact_check', text: 'Biden climate policy fact check with many words', priority: 1.0 }, // Low type, high priority, high specificity
        { type: 'entity_action', text: 'Biden climate', priority: 0.5 }, // Medium type, low priority, low specificity
        { type: 'exact', text: 'Biden', priority: 0.3 }, // High type, low priority, low specificity
        { type: 'exact', text: 'Biden announced new climate policy', priority: 0.9 }, // High type, high priority, high specificity
      ];

      const ranked = rankQueries(orchestrator, queries);

      // Query type should dominate, then priority, then specificity
      expect(ranked[0].type).toBe('exact');
      expect(ranked[0].priority).toBe(0.9); // Best exact query
      expect(ranked[1].type).toBe('exact');
      expect(ranked[1].priority).toBe(0.3); // Second exact query
      expect(ranked[2].type).toBe('entity_action'); // Next best type
      expect(ranked[3].type).toBe('fact_check'); // Lowest type
    });

    it('should handle real-world query set correctly', () => {
      const orchestrator = createOrchestrator();
      const queries: Query[] = [
        { type: 'fact_check', text: 'Biden climate policy fact check', priority: 0.5 },
        { type: 'regional', text: 'Biden climate policy US', priority: 0.6 },
        { type: 'official_confirmation', text: 'White House climate policy announcement', priority: 0.7 },
        { type: 'date_sensitive', text: 'Biden climate policy 2024', priority: 0.8 },
        { type: 'entity_action', text: 'Biden climate policy', priority: 0.9 },
        { type: 'exact', text: 'Biden announced new climate policy', priority: 1.0 },
      ];

      const ranked = rankQueries(orchestrator, queries);

      // Verify correct ranking
      expect(ranked[0].type).toBe('exact');
      expect(ranked[1].type).toBe('entity_action');
      expect(ranked[2].type).toBe('date_sensitive');
      expect(ranked[3].type).toBe('official_confirmation');
      expect(ranked[4].type).toBe('regional');
      expect(ranked[5].type).toBe('fact_check');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty query list', () => {
      const orchestrator = createOrchestrator();
      const queries: Query[] = [];

      const ranked = rankQueries(orchestrator, queries);

      expect(ranked).toEqual([]);
    });

    it('should handle single query', () => {
      const orchestrator = createOrchestrator();
      const queries: Query[] = [
        { type: 'exact', text: 'Biden climate policy', priority: 0.8 },
      ];

      const ranked = rankQueries(orchestrator, queries);

      expect(ranked).toHaveLength(1);
      expect(ranked[0]).toEqual(queries[0]);
    });

    it('should not mutate original query array', () => {
      const orchestrator = createOrchestrator();
      const queries: Query[] = [
        { type: 'fact_check', text: 'test fact check', priority: 0.5 },
        { type: 'exact', text: 'test exact', priority: 0.9 },
      ];
      const originalOrder = [...queries];

      rankQueries(orchestrator, queries);

      // Original array should be unchanged
      expect(queries).toEqual(originalOrder);
    });

    it('should handle unknown query types', () => {
      const orchestrator = createOrchestrator();
      const queries: Query[] = [
        { type: 'unknown_type' as any, text: 'test unknown', priority: 0.8 },
        { type: 'exact', text: 'test exact', priority: 0.8 },
      ];

      const ranked = rankQueries(orchestrator, queries);

      // Known type should rank higher than unknown
      expect(ranked[0].type).toBe('exact');
      expect(ranked[1].type).toBe('unknown_type');
    });

    it('should handle queries with identical properties', () => {
      const orchestrator = createOrchestrator();
      const queries: Query[] = [
        { type: 'exact', text: 'Biden climate policy', priority: 0.8 },
        { type: 'exact', text: 'Biden climate policy', priority: 0.8 },
        { type: 'exact', text: 'Biden climate policy', priority: 0.8 },
      ];

      const ranked = rankQueries(orchestrator, queries);

      // Should maintain stable sort
      expect(ranked).toHaveLength(3);
      expect(ranked.every(q => q.type === 'exact')).toBe(true);
    });
  });
});
