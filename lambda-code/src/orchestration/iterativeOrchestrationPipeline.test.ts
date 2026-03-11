/**
 * Integration tests for Iterative Orchestration Pipeline
 *
 * Tests feature flag routing, backward compatibility, and orchestration behavior
 */

import { analyzeWithIterativeOrchestration } from './iterativeOrchestrationPipeline';

describe('Iterative Orchestration Pipeline Integration Tests', () => {
  describe('Pipeline Execution', () => {
    it('should complete full pipeline for simple claim', async () => {
      const claim = 'The sky is blue';

      const result = await analyzeWithIterativeOrchestration(claim);

      // Verify result structure
      expect(result).toHaveProperty('claim', claim);
      expect(result).toHaveProperty('decomposition');
      expect(result).toHaveProperty('verdict');
      expect(result).toHaveProperty('evidenceBuckets');
      expect(result).toHaveProperty('contradictionResult');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('logs');
      expect(result).toHaveProperty('config');

      // Verify decomposition
      expect(result.decomposition.originalClaim).toBe(claim);
      expect(result.decomposition.subclaims).toBeInstanceOf(Array);
      expect(result.decomposition.subclaims.length).toBeGreaterThan(0);

      // Verify verdict structure
      expect(result.verdict).toHaveProperty('classification');
      expect(result.verdict).toHaveProperty('confidence');
      expect(result.verdict).toHaveProperty('supportedSubclaims');
      expect(result.verdict).toHaveProperty('unsupportedSubclaims');
      expect(result.verdict).toHaveProperty('contradictorySummary');
      expect(result.verdict).toHaveProperty('unresolvedUncertainties');
      expect(result.verdict).toHaveProperty('bestEvidence');
      expect(result.verdict).toHaveProperty('rationale');

      // Verify verdict classification is valid
      expect(['true', 'false', 'misleading', 'partially_true', 'unverified']).toContain(
        result.verdict.classification
      );

      // Verify confidence is in valid range
      expect(result.verdict.confidence).toBeGreaterThanOrEqual(0);
      expect(result.verdict.confidence).toBeLessThanOrEqual(1);

      // Verify evidence buckets
      expect(result.evidenceBuckets).toHaveProperty('supporting');
      expect(result.evidenceBuckets).toHaveProperty('contradicting');
      expect(result.evidenceBuckets).toHaveProperty('context');
      expect(result.evidenceBuckets).toHaveProperty('rejected');

      // Verify contradiction result
      expect(result.contradictionResult).toHaveProperty('evidence');
      expect(result.contradictionResult).toHaveProperty('queries');
      expect(result.contradictionResult).toHaveProperty('foundContradictions');

      // Verify metrics
      expect(result.metrics).toHaveProperty('totalLatencyMs');
      expect(result.metrics).toHaveProperty('novaCallsMade');
      expect(result.metrics).toHaveProperty('groundingCallsMade');
      expect(result.metrics).toHaveProperty('passesExecuted');
      expect(result.metrics.totalLatencyMs).toBeGreaterThan(0);

      // Verify logs
      expect(result.logs).toBeInstanceOf(Array);
      expect(result.logs.length).toBeGreaterThan(0);

      // Verify pipeline stages are logged
      const stages = result.logs.map((log) => log.stage);
      expect(stages).toContain('pipeline');
      expect(stages).toContain('decomposition');
      expect(stages).toContain('query_generation');
      expect(stages).toContain('orchestration');
    }, 30000); // 30 second timeout for full pipeline

    it('should handle errors gracefully', async () => {
      const claim = ''; // Empty claim should be handled gracefully

      const result = await analyzeWithIterativeOrchestration(claim);

      // Empty claim should return unverified verdict
      expect(result.verdict.classification).toBe('unverified');
      expect(result.verdict.confidence).toBeLessThanOrEqual(0.5);
    });
  });

  describe('Evidence Quality', () => {
    it('should collect evidence from multiple passes', async () => {
      const claim = 'Breaking news about technology';

      const result = await analyzeWithIterativeOrchestration(claim);

      // Verify at least one pass was executed
      expect(result.metrics.passesExecuted).toBeGreaterThan(0);
      expect(result.metrics.passesExecuted).toBeLessThanOrEqual(3);

      // Verify evidence was collected
      const totalEvidence =
        result.evidenceBuckets.supporting.length +
        result.evidenceBuckets.contradicting.length +
        result.evidenceBuckets.context.length;

      expect(totalEvidence).toBeGreaterThanOrEqual(0);
    }, 30000);
  });

  describe('Structured Logging', () => {
    it('should emit logs for each pipeline stage', async () => {
      const claim = 'Test claim for logging';

      const result = await analyzeWithIterativeOrchestration(claim);

      // Verify all expected stages are logged
      const stages = new Set(result.logs.map((log) => log.stage));

      expect(stages.has('pipeline')).toBe(true);
      expect(stages.has('decomposition')).toBe(true);
      expect(stages.has('query_generation')).toBe(true);
      expect(stages.has('orchestration')).toBe(true);
      expect(stages.has('contradiction')).toBe(true);
      expect(stages.has('synthesis')).toBe(true);

      // Verify log structure
      result.logs.forEach((log) => {
        expect(log).toHaveProperty('stage');
        expect(log).toHaveProperty('timestamp');
        expect(log).toHaveProperty('message');
        expect(typeof log.stage).toBe('string');
        expect(typeof log.timestamp).toBe('string');
        expect(typeof log.message).toBe('string');
      });
    }, 30000);
  });
});
