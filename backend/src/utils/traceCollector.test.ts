/**
 * Unit tests for TraceCollector
 */

import { TraceCollector } from './traceCollector';
import type { DecisionSummary } from '../types/trace';

describe('TraceCollector', () => {
  describe('initialization', () => {
    it('should initialize with request ID and mode', () => {
      const collector = new TraceCollector('test-request-id', 'production');
      const decisionSummary: DecisionSummary = {
        verdict: 'Supported',
        confidence: 85,
        rationale: 'Test rationale',
        evidence_count: 3,
      };

      const trace = collector.getTrace(decisionSummary);

      expect(trace.request_id).toBe('test-request-id');
      expect(trace.mode).toBe('production');
      expect(trace.provider).toBe('aws_bedrock');
      expect(trace.pipeline).toBe('nova');
      expect(trace.steps).toEqual([]);
    });

    it('should support all operation modes', () => {
      const modes: Array<'production' | 'degraded' | 'demo'> = ['production', 'degraded', 'demo'];

      modes.forEach((mode) => {
        const collector = new TraceCollector('test-id', mode);
        const decisionSummary: DecisionSummary = {
          verdict: 'Unverified',
          confidence: 30,
          rationale: 'Test',
          evidence_count: 0,
        };
        const trace = collector.getTrace(decisionSummary);
        expect(trace.mode).toBe(mode);
      });
    });
  });

  describe('step lifecycle', () => {
    it('should record a complete step with timing', () => {
      const collector = new TraceCollector('test-id', 'production');

      collector.startStep('Test Step');
      // Simulate some work
      const startTime = Date.now();
      while (Date.now() - startTime < 10) {
        // Wait 10ms
      }
      collector.completeStep('Test Step', 'Step completed successfully');

      const decisionSummary: DecisionSummary = {
        verdict: 'Supported',
        confidence: 85,
        rationale: 'Test',
        evidence_count: 1,
      };
      const trace = collector.getTrace(decisionSummary);

      expect(trace.steps).toHaveLength(1);
      expect(trace.steps[0].name).toBe('Test Step');
      expect(trace.steps[0].status).toBe('completed');
      expect(trace.steps[0].summary).toBe('Step completed successfully');
      expect(trace.steps[0].duration_ms).toBeGreaterThanOrEqual(10);
      expect(trace.steps[0].step_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(trace.steps[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle failed steps', () => {
      const collector = new TraceCollector('test-id', 'production');

      collector.startStep('Failing Step');
      collector.failStep('Failing Step', 'Step failed due to error');

      const decisionSummary: DecisionSummary = {
        verdict: 'Unverified',
        confidence: 30,
        rationale: 'Test',
        evidence_count: 0,
      };
      const trace = collector.getTrace(decisionSummary);

      expect(trace.steps).toHaveLength(1);
      expect(trace.steps[0].status).toBe('failed');
      expect(trace.steps[0].summary).toBe('Step failed due to error');
    });

    it('should handle skipped steps', () => {
      const collector = new TraceCollector('test-id', 'degraded');

      collector.startStep('Skipped Step');
      collector.skipStep('Skipped Step', 'Step skipped in degraded mode');

      const decisionSummary: DecisionSummary = {
        verdict: 'Unverified',
        confidence: 30,
        rationale: 'Test',
        evidence_count: 0,
      };
      const trace = collector.getTrace(decisionSummary);

      expect(trace.steps).toHaveLength(1);
      expect(trace.steps[0].status).toBe('skipped');
      expect(trace.steps[0].summary).toBe('Step skipped in degraded mode');
    });

    it('should handle completing a step without starting it', () => {
      const collector = new TraceCollector('test-id', 'production');

      // Complete without starting
      collector.completeStep('Instant Step', 'Step completed instantly');

      const decisionSummary: DecisionSummary = {
        verdict: 'Supported',
        confidence: 85,
        rationale: 'Test',
        evidence_count: 1,
      };
      const trace = collector.getTrace(decisionSummary);

      expect(trace.steps).toHaveLength(1);
      expect(trace.steps[0].name).toBe('Instant Step');
      expect(trace.steps[0].status).toBe('completed');
      expect(trace.steps[0].duration_ms).toBe(0);
    });
  });

  describe('step ordering', () => {
    it('should maintain step order', () => {
      const collector = new TraceCollector('test-id', 'production');

      collector.startStep('Step 1');
      collector.completeStep('Step 1', 'First step');

      collector.startStep('Step 2');
      collector.completeStep('Step 2', 'Second step');

      collector.startStep('Step 3');
      collector.completeStep('Step 3', 'Third step');

      const decisionSummary: DecisionSummary = {
        verdict: 'Supported',
        confidence: 85,
        rationale: 'Test',
        evidence_count: 3,
      };
      const trace = collector.getTrace(decisionSummary);

      expect(trace.steps).toHaveLength(3);
      expect(trace.steps[0].name).toBe('Step 1');
      expect(trace.steps[1].name).toBe('Step 2');
      expect(trace.steps[2].name).toBe('Step 3');
    });
  });

  describe('trace object generation', () => {
    it('should include decision summary', () => {
      const collector = new TraceCollector('test-id', 'production');

      collector.startStep('Analysis');
      collector.completeStep('Analysis', 'Analyzed claim');

      const decisionSummary: DecisionSummary = {
        verdict: 'Disputed',
        confidence: 75,
        rationale: 'Evidence contradicts claim',
        evidence_count: 5,
      };
      const trace = collector.getTrace(decisionSummary);

      expect(trace.decision_summary).toEqual(decisionSummary);
    });

    it('should calculate total duration', () => {
      const collector = new TraceCollector('test-id', 'production');

      const startTime = Date.now();

      collector.startStep('Step 1');
      while (Date.now() - startTime < 20) {
        // Wait 20ms
      }
      collector.completeStep('Step 1', 'Done');

      const decisionSummary: DecisionSummary = {
        verdict: 'Supported',
        confidence: 85,
        rationale: 'Test',
        evidence_count: 1,
      };
      const trace = collector.getTrace(decisionSummary);

      expect(trace.total_duration_ms).toBeGreaterThanOrEqual(20);
    });
  });

  describe('metadata', () => {
    it('should add metadata to the most recent step', () => {
      const collector = new TraceCollector('test-id', 'production');

      collector.startStep('Cache Check');
      collector.completeStep('Cache Check', 'Cache hit');
      collector.addMetadata({ cache_hit: true, cache_age_ms: 120000 });

      const decisionSummary: DecisionSummary = {
        verdict: 'Supported',
        confidence: 85,
        rationale: 'Test',
        evidence_count: 1,
      };
      const trace = collector.getTrace(decisionSummary);

      expect(trace.steps[0].metadata).toEqual({
        cache_hit: true,
        cache_age_ms: 120000,
      });
    });

    it('should handle adding metadata when no steps exist', () => {
      const collector = new TraceCollector('test-id', 'production');

      // Should not throw
      collector.addMetadata({ test: 'value' });

      const decisionSummary: DecisionSummary = {
        verdict: 'Supported',
        confidence: 85,
        rationale: 'Test',
        evidence_count: 0,
      };
      const trace = collector.getTrace(decisionSummary);

      expect(trace.steps).toHaveLength(0);
    });
  });

  describe('sanitization', () => {
    it('should sanitize summaries containing sensitive information', () => {
      const collector = new TraceCollector('test-id', 'production');

      collector.startStep('API Call');
      collector.completeStep('API Call', 'Called API with key sk_test_12345');

      const decisionSummary: DecisionSummary = {
        verdict: 'Supported',
        confidence: 85,
        rationale: 'Test',
        evidence_count: 1,
      };
      const trace = collector.getTrace(decisionSummary);

      // Should be sanitized to generic message
      expect(trace.steps[0].summary).toBe('Step completed');
    });
  });
});
