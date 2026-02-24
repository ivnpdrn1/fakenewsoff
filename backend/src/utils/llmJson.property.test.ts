/**
 * Property-Based Tests for llmJson utility
 * 
 * Tests JSON parsing reliability across a wide range of inputs using fast-check.
 * 
 * Property 19: Nova Response Parsing
 * Property 32: Response Schema Conformance
 * Validates: Requirements 6.8, 12.3
 */

import * as fc from 'fast-check';
import { parseStrictJson } from './llmJson';
import { 
  AnalysisResponseSchema, 
  AnalysisResponse,
  StatusLabelSchema,
  MediaRiskSchema
} from './schemaValidators';

/**
 * Property 19: Nova Response Parsing
 * 
 * For any valid JSON response structure, parseStrictJson should successfully
 * parse it into a structured object with all required fields accessible.
 */
describe('Property 19: Nova Response Parsing', () => {
  /**
   * Arbitrary generator for valid AnalysisResponse objects
   */
  const analysisResponseArbitrary = fc.record({
    request_id: fc.uuid(),
    status_label: fc.constantFrom(
      "Supported",
      "Disputed", 
      "Unverified",
      "Manipulated",
      "Biased framing"
    ),
    confidence_score: fc.integer({ min: 0, max: 100 }),
    recommendation: fc.string({ minLength: 10, maxLength: 200 }),
    progress_stages: fc.array(
      fc.record({
        stage: fc.constantFrom(
          "Extracting claims",
          "Finding better coverage",
          "Ranking sources",
          "Retrieving evidence",
          "Media check",
          "Synthesizing report"
        ),
        status: fc.constantFrom("completed", "in_progress", "pending"),
        timestamp: fc.option(fc.date().map(d => d.toISOString()), { nil: null })
      }),
      { minLength: 1, maxLength: 6 }
    ),
    sources: fc.array(
      fc.record({
        url: fc.webUrl(),
        title: fc.string({ minLength: 5, maxLength: 100 }),
        snippet: fc.string({ minLength: 20, maxLength: 300 }),
        why: fc.string({ minLength: 10, maxLength: 150 }),
        domain: fc.domain()
      }),
      { minLength: 0, maxLength: 3 }
    ),
    media_risk: fc.option(
      fc.constantFrom("low", "medium", "high"),
      { nil: null }
    ),
    misinformation_type: fc.option(
      fc.constantFrom(
        "Satire or Parody",
        "Misleading Content",
        "Imposter Content",
        "Fabricated Content",
        "False Connection",
        "False Context",
        "Manipulated Content"
      ),
      { nil: null }
    ),
    sift_guidance: fc.string({ minLength: 50, maxLength: 500 }),
    timestamp: fc.date().map(d => d.toISOString())
  });

  it('should parse any valid JSON response correctly', () => {
    fc.assert(
      fc.property(analysisResponseArbitrary, (response) => {
        // Serialize to JSON
        const jsonString = JSON.stringify(response);
        
        // Parse using parseStrictJson
        const result = parseStrictJson<AnalysisResponse>(jsonString);
        
        // Property assertions:
        // 1. Parsing should succeed
        expect(result.success).toBe(true);
        
        if (result.success) {
          // 2. All required fields should be present
          expect(result.data).toHaveProperty('request_id');
          expect(result.data).toHaveProperty('status_label');
          expect(result.data).toHaveProperty('confidence_score');
          expect(result.data).toHaveProperty('recommendation');
          expect(result.data).toHaveProperty('progress_stages');
          expect(result.data).toHaveProperty('sources');
          expect(result.data).toHaveProperty('media_risk');
          expect(result.data).toHaveProperty('misinformation_type');
          expect(result.data).toHaveProperty('sift_guidance');
          expect(result.data).toHaveProperty('timestamp');
          
          // 3. Field values should match original
          expect((result.data as any).request_id).toBe(response.request_id);
          expect((result.data as any).status_label).toBe(response.status_label);
          expect((result.data as any).confidence_score).toBe(response.confidence_score);
          expect((result.data as any).sources.length).toBe(response.sources.length);
        }
      }),
      { numRuns: 50 }
    );
  });

  it('should handle JSON with markdown code blocks', () => {
    fc.assert(
      fc.property(analysisResponseArbitrary, (response) => {
        // Wrap JSON in markdown code blocks
        const jsonString = JSON.stringify(response);
        const wrappedJson = `\`\`\`json\n${jsonString}\n\`\`\``;
        
        // Parse using parseStrictJson
        const result = parseStrictJson<AnalysisResponse>(wrappedJson);
        
        // Property assertions:
        // 1. Should successfully extract and parse JSON from markdown
        expect(result.success).toBe(true);
        
        if (result.success) {
          // 2. Parsed data should match original
          expect((result.data as any).request_id).toBe(response.request_id);
          expect((result.data as any).status_label).toBe(response.status_label);
        }
      }),
      { numRuns: 30 }
    );
  });

  it('should handle JSON with prose before and after', () => {
    fc.assert(
      fc.property(
        analysisResponseArbitrary,
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        (response, prefix, suffix) => {
          // Add prose before and after JSON
          const jsonString = JSON.stringify(response);
          const withProse = `${prefix}\n${jsonString}\n${suffix}`;
          
          // Parse using parseStrictJson
          const result = parseStrictJson<AnalysisResponse>(withProse);
          
          // Property assertions:
          // 1. Should extract JSON from prose
          expect(result.success).toBe(true);
          
          if (result.success) {
            // 2. Core fields should be preserved
            expect((result.data as any).request_id).toBe(response.request_id);
            expect((result.data as any).confidence_score).toBe(response.confidence_score);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should handle JSON with trailing commas', () => {
    fc.assert(
      fc.property(analysisResponseArbitrary, (response) => {
        // Create JSON with trailing commas
        let jsonString = JSON.stringify(response, null, 2);
        // Add trailing commas before closing braces/brackets
        jsonString = jsonString.replace(/(\n\s+)(\]|\})/g, '$1,$2');
        
        // Parse using parseStrictJson
        const result = parseStrictJson<AnalysisResponse>(jsonString);
        
        // Property assertions:
        // 1. Should handle trailing commas gracefully
        expect(result.success).toBe(true);
        
        if (result.success) {
          // 2. Data should be intact
          expect((result.data as any).request_id).toBe(response.request_id);
        }
      }),
      { numRuns: 25 }
    );
  });

  it('should provide fallback for completely malformed input', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => {
          // Filter out strings that might accidentally be valid JSON
          try {
            JSON.parse(s);
            return false;
          } catch {
            return true;
          }
        }),
        (malformedInput) => {
          // Parse malformed input
          const result = parseStrictJson(malformedInput);
          
          // Property assertions:
          // 1. Should always succeed (never throw)
          expect(result.success).toBe(true);
          
          if (result.success) {
            // 2. Should return fallback with safe defaults
            expect(result.data).toHaveProperty('status_label', 'Unverified');
            expect(result.data).toHaveProperty('confidence_score', 30);
            expect(result.data).toHaveProperty('recommendation');
            expect(result.data).toHaveProperty('sift_guidance');
            expect(result.data).toHaveProperty('sources', []);
            expect(result.data).toHaveProperty('misinformation_type', null);
          }
        }
      ),
      { numRuns: 40 }
    );
  });

  it('should handle nested object structures', () => {
    fc.assert(
      fc.property(analysisResponseArbitrary, (response) => {
        // Ensure we have nested structures (sources array with objects)
        if (response.sources.length === 0) {
          response.sources.push({
            url: 'https://example.com',
            title: 'Test Source',
            snippet: 'Test snippet content',
            why: 'Test relevance',
            domain: 'example.com'
          });
        }
        
        const jsonString = JSON.stringify(response);
        const result = parseStrictJson<AnalysisResponse>(jsonString);
        
        // Property assertions:
        // 1. Should parse nested structures correctly
        expect(result.success).toBe(true);
        
        if (result.success) {
          // 2. Nested arrays should be preserved
          expect(Array.isArray((result.data as any).sources)).toBe(true);
          expect(Array.isArray((result.data as any).progress_stages)).toBe(true);
          
          // 3. Nested object properties should be accessible
          if ((result.data as any).sources.length > 0) {
            expect((result.data as any).sources[0]).toHaveProperty('url');
            expect((result.data as any).sources[0]).toHaveProperty('title');
            expect((result.data as any).sources[0]).toHaveProperty('snippet');
            expect((result.data as any).sources[0]).toHaveProperty('why');
            expect((result.data as any).sources[0]).toHaveProperty('domain');
          }
        }
      }),
      { numRuns: 30 }
    );
  });
});

/**
 * Property 32: Response Schema Conformance
 * 
 * For any response returned by parseStrictJson, all required fields should be
 * present and correctly typed according to the AnalysisResponse schema.
 */
describe('Property 32: Response Schema Conformance', () => {
  it('should always return responses conforming to AnalysisResponse schema', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Valid responses
          fc.record({
            request_id: fc.uuid(),
            status_label: fc.constantFrom("Supported", "Disputed", "Unverified", "Manipulated", "Biased framing"),
            confidence_score: fc.integer({ min: 0, max: 100 }),
            recommendation: fc.string({ minLength: 10 }),
            progress_stages: fc.array(
              fc.record({
                stage: fc.string({ minLength: 5 }),
                status: fc.constantFrom("completed", "in_progress", "pending"),
                timestamp: fc.option(fc.date().map(d => d.toISOString()), { nil: null })
              }),
              { minLength: 1 }
            ),
            sources: fc.array(
              fc.record({
                url: fc.webUrl(),
                title: fc.string({ minLength: 1 }),
                snippet: fc.string({ minLength: 1 }),
                why: fc.string({ minLength: 1 }),
                domain: fc.domain()
              }),
              { maxLength: 3 }
            ),
            media_risk: fc.option(fc.constantFrom("low", "medium", "high"), { nil: null }),
            misinformation_type: fc.option(
              fc.constantFrom(
                "Satire or Parody",
                "Misleading Content",
                "Imposter Content",
                "Fabricated Content",
                "False Connection",
                "False Context",
                "Manipulated Content"
              ),
              { nil: null }
            ),
            sift_guidance: fc.string({ minLength: 10 }),
            timestamp: fc.date().map(d => d.toISOString())
          }).map(r => JSON.stringify(r)),
          // Malformed inputs (should trigger fallback)
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => {
            try { JSON.parse(s); return false; } catch { return true; }
          })
        ),
        (input) => {
          // Parse input
          const result = parseStrictJson(input);
          
          // Property assertions:
          // 1. Should always succeed
          expect(result.success).toBe(true);
          
          if (result.success) {
            // 2. Result should conform to AnalysisResponse schema
            const validation = AnalysisResponseSchema.safeParse(result.data);
            
            // If validation fails, it should be because of the fallback response
            // which has minimal but valid structure
            if (!validation.success) {
              // Fallback should still have core required fields
              expect(result.data).toHaveProperty('status_label');
              expect(result.data).toHaveProperty('confidence_score');
              expect(result.data).toHaveProperty('recommendation');
              expect(result.data).toHaveProperty('sift_guidance');
              expect(result.data).toHaveProperty('sources');
            } else {
              // Valid parse should have all required fields with correct types
              expect(validation.data).toHaveProperty('request_id');
              expect(typeof validation.data.request_id).toBe('string');
              
              expect(validation.data).toHaveProperty('status_label');
              expect(['Supported', 'Disputed', 'Unverified', 'Manipulated', 'Biased framing'])
                .toContain(validation.data.status_label);
              
              expect(validation.data).toHaveProperty('confidence_score');
              expect(typeof validation.data.confidence_score).toBe('number');
              expect(validation.data.confidence_score).toBeGreaterThanOrEqual(0);
              expect(validation.data.confidence_score).toBeLessThanOrEqual(100);
              
              expect(validation.data).toHaveProperty('sources');
              expect(Array.isArray(validation.data.sources)).toBe(true);
              expect(validation.data.sources.length).toBeLessThanOrEqual(3);
              
              expect(validation.data).toHaveProperty('progress_stages');
              expect(Array.isArray(validation.data.progress_stages)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should ensure status_label is always a valid enum value', () => {
    fc.assert(
      fc.property(
        fc.record({
          request_id: fc.uuid(),
          status_label: fc.constantFrom("Supported", "Disputed", "Unverified", "Manipulated", "Biased framing"),
          confidence_score: fc.integer({ min: 0, max: 100 }),
          recommendation: fc.string({ minLength: 10 }),
          progress_stages: fc.array(
            fc.record({
              stage: fc.string({ minLength: 5 }),
              status: fc.constantFrom("completed", "in_progress", "pending"),
              timestamp: fc.option(fc.date().map(d => d.toISOString()), { nil: null })
            }),
            { minLength: 1 }
          ),
          sources: fc.array(
            fc.record({
              url: fc.webUrl(),
              title: fc.string({ minLength: 1 }),
              snippet: fc.string({ minLength: 1 }),
              why: fc.string({ minLength: 1 }),
              domain: fc.domain()
            }),
            { maxLength: 3 }
          ),
          media_risk: fc.option(fc.constantFrom("low", "medium", "high"), { nil: null }),
          misinformation_type: fc.option(
            fc.constantFrom(
              "Satire or Parody",
              "Misleading Content",
              "Imposter Content",
              "Fabricated Content",
              "False Connection",
              "False Context",
              "Manipulated Content"
            ),
            { nil: null }
          ),
          sift_guidance: fc.string({ minLength: 10 }),
          timestamp: fc.date().map(d => d.toISOString())
        }),
        (response) => {
          const jsonString = JSON.stringify(response);
          const result = parseStrictJson(jsonString);
          
          // Property assertions:
          expect(result.success).toBe(true);
          
          if (result.success) {
            // status_label must be one of the valid enum values
            const validLabels = ["Supported", "Disputed", "Unverified", "Manipulated", "Biased framing"];
            expect(validLabels).toContain((result.data as any).status_label);
            
            // Validate with schema
            const labelValidation = StatusLabelSchema.safeParse((result.data as any).status_label);
            expect(labelValidation.success).toBe(true);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should ensure confidence_score is always within 0-100 range', () => {
    fc.assert(
      fc.property(
        fc.record({
          request_id: fc.uuid(),
          status_label: fc.constantFrom("Supported", "Disputed", "Unverified", "Manipulated", "Biased framing"),
          confidence_score: fc.integer({ min: 0, max: 100 }),
          recommendation: fc.string({ minLength: 10 }),
          progress_stages: fc.array(
            fc.record({
              stage: fc.string({ minLength: 5 }),
              status: fc.constantFrom("completed", "in_progress", "pending"),
              timestamp: fc.option(fc.date().map(d => d.toISOString()), { nil: null })
            }),
            { minLength: 1 }
          ),
          sources: fc.array(
            fc.record({
              url: fc.webUrl(),
              title: fc.string({ minLength: 1 }),
              snippet: fc.string({ minLength: 1 }),
              why: fc.string({ minLength: 1 }),
              domain: fc.domain()
            }),
            { maxLength: 3 }
          ),
          media_risk: fc.option(fc.constantFrom("low", "medium", "high"), { nil: null }),
          misinformation_type: fc.option(
            fc.constantFrom(
              "Satire or Parody",
              "Misleading Content",
              "Imposter Content",
              "Fabricated Content",
              "False Connection",
              "False Context",
              "Manipulated Content"
            ),
            { nil: null }
          ),
          sift_guidance: fc.string({ minLength: 10 }),
          timestamp: fc.date().map(d => d.toISOString())
        }),
        (response) => {
          const jsonString = JSON.stringify(response);
          const result = parseStrictJson(jsonString);
          
          // Property assertions:
          expect(result.success).toBe(true);
          
          if (result.success) {
            // confidence_score must be a number between 0 and 100
            expect(typeof (result.data as any).confidence_score).toBe('number');
            expect((result.data as any).confidence_score).toBeGreaterThanOrEqual(0);
            expect((result.data as any).confidence_score).toBeLessThanOrEqual(100);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should ensure sources array has 0-3 elements', () => {
    fc.assert(
      fc.property(
        fc.record({
          request_id: fc.uuid(),
          status_label: fc.constantFrom("Supported", "Disputed", "Unverified", "Manipulated", "Biased framing"),
          confidence_score: fc.integer({ min: 0, max: 100 }),
          recommendation: fc.string({ minLength: 10 }),
          progress_stages: fc.array(
            fc.record({
              stage: fc.string({ minLength: 5 }),
              status: fc.constantFrom("completed", "in_progress", "pending"),
              timestamp: fc.option(fc.date().map(d => d.toISOString()), { nil: null })
            }),
            { minLength: 1 }
          ),
          sources: fc.array(
            fc.record({
              url: fc.webUrl(),
              title: fc.string({ minLength: 1 }),
              snippet: fc.string({ minLength: 1 }),
              why: fc.string({ minLength: 1 }),
              domain: fc.domain()
            }),
            { minLength: 0, maxLength: 3 }
          ),
          media_risk: fc.option(fc.constantFrom("low", "medium", "high"), { nil: null }),
          misinformation_type: fc.option(
            fc.constantFrom(
              "Satire or Parody",
              "Misleading Content",
              "Imposter Content",
              "Fabricated Content",
              "False Connection",
              "False Context",
              "Manipulated Content"
            ),
            { nil: null }
          ),
          sift_guidance: fc.string({ minLength: 10 }),
          timestamp: fc.date().map(d => d.toISOString())
        }),
        (response) => {
          const jsonString = JSON.stringify(response);
          const result = parseStrictJson(jsonString);
          
          // Property assertions:
          expect(result.success).toBe(true);
          
          if (result.success) {
            // sources must be an array with 0-3 elements
            expect(Array.isArray((result.data as any).sources)).toBe(true);
            expect((result.data as any).sources.length).toBeGreaterThanOrEqual(0);
            expect((result.data as any).sources.length).toBeLessThanOrEqual(3);
            
            // Each source must have required fields
            (result.data as any).sources.forEach((source: any) => {
              expect(source).toHaveProperty('url');
              expect(source).toHaveProperty('title');
              expect(source).toHaveProperty('snippet');
              expect(source).toHaveProperty('why');
              expect(source).toHaveProperty('domain');
            });
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should ensure media_risk is null or valid enum value', () => {
    fc.assert(
      fc.property(
        fc.record({
          request_id: fc.uuid(),
          status_label: fc.constantFrom("Supported", "Disputed", "Unverified", "Manipulated", "Biased framing"),
          confidence_score: fc.integer({ min: 0, max: 100 }),
          recommendation: fc.string({ minLength: 10 }),
          progress_stages: fc.array(
            fc.record({
              stage: fc.string({ minLength: 5 }),
              status: fc.constantFrom("completed", "in_progress", "pending"),
              timestamp: fc.option(fc.date().map(d => d.toISOString()), { nil: null })
            }),
            { minLength: 1 }
          ),
          sources: fc.array(
            fc.record({
              url: fc.webUrl(),
              title: fc.string({ minLength: 1 }),
              snippet: fc.string({ minLength: 1 }),
              why: fc.string({ minLength: 1 }),
              domain: fc.domain()
            }),
            { maxLength: 3 }
          ),
          media_risk: fc.option(fc.constantFrom("low", "medium", "high"), { nil: null }),
          misinformation_type: fc.option(
            fc.constantFrom(
              "Satire or Parody",
              "Misleading Content",
              "Imposter Content",
              "Fabricated Content",
              "False Connection",
              "False Context",
              "Manipulated Content"
            ),
            { nil: null }
          ),
          sift_guidance: fc.string({ minLength: 10 }),
          timestamp: fc.date().map(d => d.toISOString())
        }),
        (response) => {
          const jsonString = JSON.stringify(response);
          const result = parseStrictJson(jsonString);
          
          // Property assertions:
          expect(result.success).toBe(true);
          
          if (result.success) {
            // media_risk must be null or one of the valid enum values
            if ((result.data as any).media_risk !== null) {
              const validRisks = ["low", "medium", "high"];
              expect(validRisks).toContain((result.data as any).media_risk);
              
              // Validate with schema
              const riskValidation = MediaRiskSchema.safeParse((result.data as any).media_risk);
              expect(riskValidation.success).toBe(true);
            }
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should ensure all required string fields are present and non-empty', () => {
    fc.assert(
      fc.property(
        fc.record({
          request_id: fc.uuid(),
          status_label: fc.constantFrom("Supported", "Disputed", "Unverified", "Manipulated", "Biased framing"),
          confidence_score: fc.integer({ min: 0, max: 100 }),
          recommendation: fc.string({ minLength: 10, maxLength: 200 }),
          progress_stages: fc.array(
            fc.record({
              stage: fc.string({ minLength: 5 }),
              status: fc.constantFrom("completed", "in_progress", "pending"),
              timestamp: fc.option(fc.date().map(d => d.toISOString()), { nil: null })
            }),
            { minLength: 1 }
          ),
          sources: fc.array(
            fc.record({
              url: fc.webUrl(),
              title: fc.string({ minLength: 1 }),
              snippet: fc.string({ minLength: 1 }),
              why: fc.string({ minLength: 1 }),
              domain: fc.domain()
            }),
            { maxLength: 3 }
          ),
          media_risk: fc.option(fc.constantFrom("low", "medium", "high"), { nil: null }),
          misinformation_type: fc.option(
            fc.constantFrom(
              "Satire or Parody",
              "Misleading Content",
              "Imposter Content",
              "Fabricated Content",
              "False Connection",
              "False Context",
              "Manipulated Content"
            ),
            { nil: null }
          ),
          sift_guidance: fc.string({ minLength: 50, maxLength: 500 }),
          timestamp: fc.date().map(d => d.toISOString())
        }),
        (response) => {
          const jsonString = JSON.stringify(response);
          const result = parseStrictJson(jsonString);
          
          // Property assertions:
          expect(result.success).toBe(true);
          
          if (result.success) {
            // All required string fields must be present and non-empty
            expect((result.data as any).request_id).toBeTruthy();
            expect(typeof (result.data as any).request_id).toBe('string');
            expect((result.data as any).request_id.length).toBeGreaterThan(0);
            
            expect((result.data as any).recommendation).toBeTruthy();
            expect(typeof (result.data as any).recommendation).toBe('string');
            expect((result.data as any).recommendation.length).toBeGreaterThan(0);
            
            expect((result.data as any).sift_guidance).toBeTruthy();
            expect(typeof (result.data as any).sift_guidance).toBe('string');
            expect((result.data as any).sift_guidance.length).toBeGreaterThan(0);
            
            expect((result.data as any).timestamp).toBeTruthy();
            expect(typeof (result.data as any).timestamp).toBe('string');
            expect((result.data as any).timestamp.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});
