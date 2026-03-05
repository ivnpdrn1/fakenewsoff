/**
 * Unit tests for llmJson utility
 *
 * Tests JSON parsing with repair and fallback mechanisms
 * Validates: Requirements 6.8, 12.2
 */

import { parseStrictJson } from './llmJson';

describe('parseStrictJson', () => {
  describe('direct parsing', () => {
    it('should parse valid JSON object', () => {
      const input = '{"status": "ok", "value": 42}';
      const result = parseStrictJson<{ status: string; value: number }>(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('ok');
        expect(result.data.value).toBe(42);
      }
    });

    it('should parse valid JSON array', () => {
      const input = '[1, 2, 3]';
      const result = parseStrictJson<number[]>(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([1, 2, 3]);
      }
    });

    it('should parse nested JSON structures', () => {
      const input = JSON.stringify({
        status_label: 'Supported',
        confidence_score: 85,
        sources: [{ url: 'https://example.com', title: 'Test' }],
      });
      const result = parseStrictJson(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty('status_label', 'Supported');
        expect(result.data).toHaveProperty('confidence_score', 85);
      }
    });
  });

  describe('repair mechanism', () => {
    it('should strip markdown code blocks', () => {
      const input = '```json\n{"status": "ok"}\n```';
      const result = parseStrictJson<{ status: string }>(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('ok');
      }
    });

    it('should strip markdown code blocks with language tag', () => {
      const input = '```JSON\n{"value": 123}\n```';
      const result = parseStrictJson<{ value: number }>(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe(123);
      }
    });

    it('should extract JSON from prose before', () => {
      const input = 'Here is the result:\n{"status": "ok"}';
      const result = parseStrictJson<{ status: string }>(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('ok');
      }
    });

    it('should extract JSON from prose after', () => {
      const input = '{"status": "ok"}\nThat was the result.';
      const result = parseStrictJson<{ status: string }>(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('ok');
      }
    });

    it('should extract JSON from prose before and after', () => {
      const input = 'The analysis shows:\n{"status": "ok"}\nEnd of analysis.';
      const result = parseStrictJson<{ status: string }>(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('ok');
      }
    });

    it('should remove trailing commas', () => {
      const input = '{"status": "ok", "value": 42,}';
      const result = parseStrictJson<{ status: string; value: number }>(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('ok');
        expect(result.data.value).toBe(42);
      }
    });

    it('should handle multiple trailing commas', () => {
      const input = '{"items": [1, 2, 3,], "done": true,}';
      const result = parseStrictJson<{ items: number[]; done: boolean }>(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toEqual([1, 2, 3]);
        expect(result.data.done).toBe(true);
      }
    });

    it('should handle complex repair scenario', () => {
      const input = `
        Here's the analysis result:
        \`\`\`json
        {
          "status_label": "Disputed",
          "confidence_score": 75,
          "sources": [
            {"url": "https://example.com", "title": "Test"},
          ],
        }
        \`\`\`
        Hope this helps!
      `;
      const result = parseStrictJson(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty('status_label', 'Disputed');
        expect(result.data).toHaveProperty('confidence_score', 75);
      }
    });
  });

  describe('fallback mechanism', () => {
    it('should return fallback for completely malformed JSON', () => {
      const input = 'This is not JSON at all';
      const result = parseStrictJson(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty('status_label', 'Unverified');
        expect(result.data).toHaveProperty('confidence_score', 30);
        expect(result.data).toHaveProperty('recommendation');
        expect(result.data).toHaveProperty('sift_guidance');
        expect(result.data).toHaveProperty('sources', []);
        expect(result.data).toHaveProperty('misinformation_type', null);
      }
    });

    it('should return fallback for incomplete JSON', () => {
      const input = '{"status": "ok"';
      const result = parseStrictJson(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty('status_label', 'Unverified');
        expect(result.data).toHaveProperty('confidence_score', 30);
      }
    });

    it('should return fallback for JSON with syntax errors', () => {
      const input = '{"status": ok}'; // Missing quotes around value
      const result = parseStrictJson(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty('status_label', 'Unverified');
      }
    });

    it('should return fallback for empty string', () => {
      const input = '';
      const result = parseStrictJson(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty('status_label', 'Unverified');
      }
    });

    it('should return fallback with SIFT guidance', () => {
      const input = 'Invalid response';
      const result = parseStrictJson(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty('sift_guidance');
        const guidance = (result.data as any).sift_guidance;
        expect(guidance).toContain('Stop');
        expect(guidance).toContain('Investigate');
        expect(guidance).toContain('Find better coverage');
        expect(guidance).toContain('Trace claims');
      }
    });

    it('should return fallback with actionable recommendation', () => {
      const input = 'Not valid JSON';
      const result = parseStrictJson(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty('recommendation');
        const recommendation = (result.data as any).recommendation;
        expect(recommendation).toContain('Verify before sharing');
        expect(recommendation).toContain('SIFT framework');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace-only input', () => {
      const input = '   \n\t  ';
      const result = parseStrictJson(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty('status_label', 'Unverified');
      }
    });

    it('should handle JSON with unicode characters', () => {
      const input = '{"message": "Hello 世界 🌍"}';
      const result = parseStrictJson<{ message: string }>(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toBe('Hello 世界 🌍');
      }
    });

    it('should handle JSON with escaped quotes', () => {
      const input = '{"quote": "He said \\"hello\\""}';
      const result = parseStrictJson<{ quote: string }>(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.quote).toBe('He said "hello"');
      }
    });

    it('should handle JSON with newlines in strings', () => {
      const input = '{"text": "Line 1\\nLine 2"}';
      const result = parseStrictJson<{ text: string }>(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text).toBe('Line 1\nLine 2');
      }
    });

    it('should prefer object over array when both present', () => {
      const input = 'Array: [1,2] Object: {"value": 42}';
      const result = parseStrictJson(input);

      expect(result.success).toBe(true);
      if (result.success) {
        // Should extract the object, not the array
        expect(result.data).toHaveProperty('value', 42);
      }
    });

    it('should handle nested braces in strings', () => {
      const input = '{"code": "function() { return {}; }"}';
      const result = parseStrictJson<{ code: string }>(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.code).toBe('function() { return {}; }');
      }
    });
  });

  describe('real-world LLM response patterns', () => {
    it('should handle ChatGPT-style response with explanation', () => {
      const input = `
        Based on my analysis, here's the result:
        
        \`\`\`json
        {
          "status_label": "Supported",
          "confidence_score": 90,
          "sources": []
        }
        \`\`\`
        
        This indicates strong support from credible sources.
      `;
      const result = parseStrictJson(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty('status_label', 'Supported');
        expect(result.data).toHaveProperty('confidence_score', 90);
      }
    });

    it('should handle response with thinking process', () => {
      const input = `
        Let me analyze this step by step:
        1. First, I'll check the sources
        2. Then evaluate credibility
        
        Result:
        {"status_label": "Disputed", "confidence_score": 70}
      `;
      const result = parseStrictJson(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty('status_label', 'Disputed');
      }
    });

    it('should handle response with apology', () => {
      const input = `
        I apologize for the confusion. Here's the correct response:
        {"status_label": "Unverified", "confidence_score": 40}
      `;
      const result = parseStrictJson(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty('status_label', 'Unverified');
      }
    });
  });

  describe('type safety', () => {
    it('should work with typed interfaces', () => {
      interface AnalysisResponse {
        status_label: string;
        confidence_score: number;
        sources: Array<{ url: string }>;
      }

      const input = JSON.stringify({
        status_label: 'Supported',
        confidence_score: 85,
        sources: [{ url: 'https://example.com' }],
      });

      const result = parseStrictJson<AnalysisResponse>(input);

      expect(result.success).toBe(true);
      if (result.success) {
        // TypeScript should recognize these properties
        expect(result.data.status_label).toBe('Supported');
        expect(result.data.confidence_score).toBe(85);
        expect(result.data.sources).toHaveLength(1);
      }
    });
  });
});
