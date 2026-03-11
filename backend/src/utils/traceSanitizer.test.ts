/**
 * Unit tests for TraceSanitizer
 */

import { TraceSanitizer } from './traceSanitizer';

describe('TraceSanitizer', () => {
  describe('sanitize', () => {
    it('should pass through safe summaries unchanged', () => {
      const safeSummaries = [
        'Analyzed claim and identified 3 key subclaims',
        'Retrieved 5 news sources from GDELT',
        'Cache hit, used cached evidence from 2 minutes ago',
        'Classified evidence stance as supporting',
        'Generated verdict with 85% confidence',
        'Completed evidence retrieval in 1.2 seconds',
      ];

      safeSummaries.forEach((summary) => {
        const sanitized = TraceSanitizer.sanitize(summary);
        expect(sanitized).toBe(summary);
      });
    });

    it('should redact summaries containing API keys', () => {
      const unsafeSummaries = [
        'Called API with key sk_test_12345',
        'Using api_key: abc123def456',
        'Token: bearer_xyz789',
        'Access key: AKIAIOSFODNN7EXAMPLE',
      ];

      unsafeSummaries.forEach((summary) => {
        const sanitized = TraceSanitizer.sanitize(summary);
        expect(sanitized).toBe('Step completed');
      });
    });

    it('should redact summaries containing prompts', () => {
      const unsafeSummaries = [
        'Prompt: You are a helpful assistant',
        'System: Analyze the following claim',
        'User: What is the weather?',
        'Instruction: Extract claims from text',
      ];

      unsafeSummaries.forEach((summary) => {
        const sanitized = TraceSanitizer.sanitize(summary);
        expect(sanitized).toBe('Step completed');
      });
    });

    it('should redact summaries containing chain-of-thought reasoning', () => {
      const unsafeSummaries = [
        'Let me think step by step about this claim',
        'First, I notice that the evidence contradicts',
        'Reasoning: The claim appears to be false',
        'Thought: This requires more investigation',
      ];

      unsafeSummaries.forEach((summary) => {
        const sanitized = TraceSanitizer.sanitize(summary);
        expect(sanitized).toBe('Step completed');
      });
    });

    it('should redact summaries containing code', () => {
      const unsafeSummaries = [
        'function analyzeEvidence() { return true; }',
        'const result = processData(input);',
        'let verdict = "Supported";',
        'var confidence = 85;',
      ];

      unsafeSummaries.forEach((summary) => {
        const sanitized = TraceSanitizer.sanitize(summary);
        expect(sanitized).toBe('Step completed');
      });
    });

    it('should redact summaries containing AWS internals', () => {
      const unsafeSummaries = [
        'Called arn:aws:bedrock:us-east-1:123456789012:model/claude',
        'Using account_id: 123456789012',
        'Region: us-east-1',
        'Endpoint: https://bedrock.us-east-1.amazonaws.com',
      ];

      unsafeSummaries.forEach((summary) => {
        const sanitized = TraceSanitizer.sanitize(summary);
        expect(sanitized).toBe('Step completed');
      });
    });

    it('should truncate very long summaries', () => {
      const longSummary = 'Analyzed claim and retrieved evidence. '.repeat(20); // Safe content, just long
      const sanitized = TraceSanitizer.sanitize(longSummary);
      expect(sanitized.length).toBeLessThanOrEqual(500);
      expect(sanitized).toMatch(/\.\.\.$/);
    });

    it('should handle empty or invalid input', () => {
      expect(TraceSanitizer.sanitize('')).toBe('Step completed');
      expect(TraceSanitizer.sanitize(null as any)).toBe('Step completed');
      expect(TraceSanitizer.sanitize(undefined as any)).toBe('Step completed');
    });

    it('should trim whitespace', () => {
      const summary = '  Analyzed claim  ';
      const sanitized = TraceSanitizer.sanitize(summary);
      expect(sanitized).toBe('Analyzed claim');
    });
  });

  describe('validate', () => {
    it('should validate safe summaries', () => {
      const safeSummaries = [
        'Analyzed claim and identified 3 key subclaims',
        'Retrieved 5 news sources from GDELT',
        'Cache hit, used cached evidence',
      ];

      safeSummaries.forEach((summary) => {
        expect(TraceSanitizer.validate(summary)).toBe(true);
      });
    });

    it('should reject summaries with sensitive information', () => {
      const unsafeSummaries = [
        'Called API with key sk_test_12345',
        'Prompt: You are a helpful assistant',
        'Let me think step by step',
      ];

      unsafeSummaries.forEach((summary) => {
        expect(TraceSanitizer.validate(summary)).toBe(false);
      });
    });

    it('should reject empty summaries', () => {
      expect(TraceSanitizer.validate('')).toBe(false);
      expect(TraceSanitizer.validate(null as any)).toBe(false);
      expect(TraceSanitizer.validate(undefined as any)).toBe(false);
    });

    it('should reject summaries that are too long', () => {
      const longSummary = 'A'.repeat(600);
      expect(TraceSanitizer.validate(longSummary)).toBe(false);
    });
  });

  describe('containsSensitiveInfo', () => {
    it('should detect API keys', () => {
      expect(TraceSanitizer.containsSensitiveInfo('sk_test_12345')).toBe(true);
      expect(TraceSanitizer.containsSensitiveInfo('api_key: abc123')).toBe(true);
      expect(TraceSanitizer.containsSensitiveInfo('token: xyz789')).toBe(true);
    });

    it('should detect prompts', () => {
      expect(TraceSanitizer.containsSensitiveInfo('Prompt: You are')).toBe(true);
      expect(TraceSanitizer.containsSensitiveInfo('System: Analyze')).toBe(true);
      expect(TraceSanitizer.containsSensitiveInfo('User: What is')).toBe(true);
    });

    it('should detect chain-of-thought', () => {
      expect(TraceSanitizer.containsSensitiveInfo('Let me think step by step')).toBe(true);
      expect(TraceSanitizer.containsSensitiveInfo('First, I notice that')).toBe(true);
      expect(TraceSanitizer.containsSensitiveInfo('Reasoning: The claim')).toBe(true);
    });

    it('should not flag safe phrases', () => {
      expect(TraceSanitizer.containsSensitiveInfo('Analyzed claim')).toBe(false);
      expect(TraceSanitizer.containsSensitiveInfo('Retrieved 5 sources')).toBe(false);
      expect(TraceSanitizer.containsSensitiveInfo('Cache hit')).toBe(false);
      expect(TraceSanitizer.containsSensitiveInfo('Completed successfully')).toBe(false);
    });

    it('should handle empty or invalid input', () => {
      expect(TraceSanitizer.containsSensitiveInfo('')).toBe(false);
      expect(TraceSanitizer.containsSensitiveInfo(null as any)).toBe(false);
      expect(TraceSanitizer.containsSensitiveInfo(undefined as any)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle special characters', () => {
      const summary = 'Analyzed claim with special chars: @#$%^&*()';
      const sanitized = TraceSanitizer.sanitize(summary);
      expect(sanitized).toBe(summary);
    });

    it('should handle unicode characters', () => {
      const summary = 'Analyzed claim: 世界 🌍';
      const sanitized = TraceSanitizer.sanitize(summary);
      expect(sanitized).toBe(summary);
    });

    it('should handle newlines and tabs', () => {
      const summary = 'Analyzed claim\nwith newlines\tand tabs';
      const sanitized = TraceSanitizer.sanitize(summary);
      // Should preserve the content but trim
      expect(sanitized).toContain('Analyzed claim');
    });
  });
});
