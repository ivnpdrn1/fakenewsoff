/**
 * Integration Tests for DynamoDB Operations
 * 
 * Tests storage and retrieval with truncation and S3 integration
 * 
 * Property 29: DynamoDB Storage Round Trip
 * Validates: Requirements 11.1, 11.2
 */

// Mock AWS SDK clients BEFORE importing the module
const mockSend = jest.fn().mockResolvedValue({});
const mockFrom = jest.fn().mockReturnValue({ send: mockSend });

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: mockFrom
  },
  PutCommand: jest.fn((input) => ({ input })),
  GetCommand: jest.fn((input) => ({ input })),
  QueryCommand: jest.fn((input) => ({ input }))
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn((input) => ({ input })),
  GetObjectCommand: jest.fn((input) => ({ input }))
}));

import {
  storeAnalysisRecord,
  getAnalysisRecord,
  computeContentHash,
  logContentMetadata,
  AnalysisRecord,
  AnalysisRequest
} from './dynamodb';
import { AnalysisResponse, CredibleSource } from './schemaValidators';
import { exceedsDynamoDBLimit } from './storagePolicy';

describe('DynamoDB Operations', () => {
  describe('storeAnalysisRecord', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockSend.mockResolvedValue({});
    });

    it('should store record with truncated text fields', async () => {
      const largeText = 'a'.repeat(25000); // Exceeds MAX_STORED_TEXT_CHARS (20k)
      
      const request: AnalysisRequest = {
        url: 'https://example.com',
        text: largeText,
        title: 'Test Article'
      };

      const response: AnalysisResponse = {
        request_id: 'test-uuid',
        status_label: 'Unverified',
        confidence_score: 50,
        recommendation: 'Verify before sharing',
        progress_stages: [],
        sources: [],
        media_risk: null,
        misinformation_type: null,
        sift_guidance: 'Test guidance',
        timestamp: new Date().toISOString()
      };

      const record: AnalysisRecord = {
        request_id: 'test-uuid',
        request,
        response,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await storeAnalysisRecord(record);

      expect(mockSend).toHaveBeenCalledTimes(1);
      
      // Verify the stored item has truncated text
      const storedItem = mockSend.mock.calls[0][0].input.Item;
      expect(storedItem.request.text).toContain('[truncated]');
      expect(storedItem.request.text.length).toBeLessThan(largeText.length);
    });

    it('should truncate source snippets and why fields', async () => {
      const longSnippet = 'a'.repeat(600);
      const longWhy = 'b'.repeat(400);

      const sources: CredibleSource[] = [
        {
          url: 'https://example.com/1',
          title: 'Source 1',
          snippet: longSnippet,
          why: longWhy,
          domain: 'example.com'
        }
      ];

      const request: AnalysisRequest = {
        url: 'https://example.com',
        text: 'Short text',
        title: 'Test'
      };

      const response: AnalysisResponse = {
        request_id: 'test-uuid',
        status_label: 'Supported',
        confidence_score: 85,
        recommendation: 'Safe to share',
        progress_stages: [],
        sources,
        media_risk: null,
        misinformation_type: null,
        sift_guidance: 'Test guidance',
        timestamp: new Date().toISOString()
      };

      const record: AnalysisRecord = {
        request_id: 'test-uuid',
        request,
        response,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await storeAnalysisRecord(record);

      const storedItem = mockSend.mock.calls[0][0].input.Item;
      expect(storedItem.response.sources[0].snippet).toContain('[truncated]');
      expect(storedItem.response.sources[0].why).toContain('[truncated]');
      expect(storedItem.response.sources[0].snippet.length).toBeLessThanOrEqual(500);
      expect(storedItem.response.sources[0].why.length).toBeLessThanOrEqual(300);
    });

    it('should ensure stored item never exceeds 400KB', async () => {
      // Create a very large request
      const largeText = 'a'.repeat(100000);
      const largeSources: CredibleSource[] = Array.from({ length: 3 }, (_, i) => ({
        url: `https://example.com/${i}`,
        title: `Source ${i}`,
        snippet: 'b'.repeat(1000),
        why: 'c'.repeat(500),
        domain: 'example.com'
      }));

      const request: AnalysisRequest = {
        url: 'https://example.com',
        text: largeText,
        title: 'Test Article'
      };

      const response: AnalysisResponse = {
        request_id: 'test-uuid',
        status_label: 'Unverified',
        confidence_score: 50,
        recommendation: 'Verify before sharing',
        progress_stages: [],
        sources: largeSources,
        media_risk: null,
        misinformation_type: null,
        sift_guidance: 'Test guidance',
        timestamp: new Date().toISOString()
      };

      const record: AnalysisRecord = {
        request_id: 'test-uuid',
        request,
        response,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await storeAnalysisRecord(record);

      // Verify the stored item is under 400KB
      const storedItem = mockSend.mock.calls[0][0].input.Item;
      expect(exceedsDynamoDBLimit(storedItem)).toBe(false);
    });

    it('should handle S3 storage for very large input when S3_INPUT_BUCKET is set', async () => {
      // Set S3 bucket environment variable
      process.env.S3_INPUT_BUCKET = 'test-bucket';

      // Mock S3 client
      const { S3Client } = require('@aws-sdk/client-s3');
      const mockS3Send = jest.fn().mockResolvedValue({});
      S3Client.mockImplementation(() => ({
        send: mockS3Send
      }));

      const veryLargeText = 'a'.repeat(25000); // Exceeds S3_STORAGE_THRESHOLD (20k)

      const request: AnalysisRequest = {
        url: 'https://example.com',
        text: veryLargeText,
        title: 'Test Article'
      };

      const response: AnalysisResponse = {
        request_id: 'test-uuid',
        status_label: 'Unverified',
        confidence_score: 50,
        recommendation: 'Verify before sharing',
        progress_stages: [],
        sources: [],
        media_risk: null,
        misinformation_type: null,
        sift_guidance: 'Test guidance',
        timestamp: new Date().toISOString()
      };

      const record: AnalysisRecord = {
        request_id: 'test-uuid',
        request,
        response,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await storeAnalysisRecord(record);

      // Verify S3 upload was called
      expect(mockS3Send).toHaveBeenCalled();

      // Verify DynamoDB item has S3 reference
      const storedItem = mockSend.mock.calls[0][0].input.Item;
      expect(storedItem.input_ref).toBeDefined();
      expect(storedItem.input_ref.bucket).toBe('test-bucket');
      expect(storedItem.input_ref.key).toContain('test-uuid');
      expect(storedItem.request.text).toContain('[Stored in S3:');

      // Clean up
      delete process.env.S3_INPUT_BUCKET;
    });

    it('should fall back to truncation if S3 storage fails', async () => {
      // Set S3 bucket environment variable
      process.env.S3_INPUT_BUCKET = 'test-bucket';

      // Mock S3 client to fail
      const { S3Client } = require('@aws-sdk/client-s3');
      const mockS3Send = jest.fn().mockRejectedValue(new Error('S3 error'));
      S3Client.mockImplementation(() => ({
        send: mockS3Send
      }));

      const veryLargeText = 'a'.repeat(25000);

      const request: AnalysisRequest = {
        url: 'https://example.com',
        text: veryLargeText,
        title: 'Test Article'
      };

      const response: AnalysisResponse = {
        request_id: 'test-uuid',
        status_label: 'Unverified',
        confidence_score: 50,
        recommendation: 'Verify before sharing',
        progress_stages: [],
        sources: [],
        media_risk: null,
        misinformation_type: null,
        sift_guidance: 'Test guidance',
        timestamp: new Date().toISOString()
      };

      const record: AnalysisRecord = {
        request_id: 'test-uuid',
        request,
        response,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await storeAnalysisRecord(record);

      // Verify fallback to truncation
      const storedItem = mockSend.mock.calls[0][0].input.Item;
      expect(storedItem.request.text).toContain('[truncated]');
      expect(storedItem.input_ref).toBeUndefined();

      // Clean up
      delete process.env.S3_INPUT_BUCKET;
    });
  });

  describe('computeContentHash', () => {
    it('should compute consistent hash for same content', async () => {
      const content = 'Test content for hashing';
      
      const hash1 = await computeContentHash(content);
      const hash2 = await computeContentHash(content);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
    });

    it('should produce different hashes for different content', async () => {
      const content1 = 'First content';
      const content2 = 'Second content';
      
      const hash1 = await computeContentHash(content1);
      const hash2 = await computeContentHash(content2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should normalize content before hashing', async () => {
      const content1 = 'Test   Content';
      const content2 = 'test content'; // Different case and whitespace
      
      const hash1 = await computeContentHash(content1);
      const hash2 = await computeContentHash(content2);
      
      expect(hash1).toBe(hash2);
    });

    it('should remove tracking parameters from URLs', async () => {
      const content1 = 'https://example.com/article?utm_source=twitter';
      const content2 = 'https://example.com/article';
      
      const hash1 = await computeContentHash(content1);
      const hash2 = await computeContentHash(content2);
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('logContentMetadata', () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should log content metadata without raw text', () => {
      const request: AnalysisRequest = {
        url: 'https://example.com/article',
        text: 'This is the article text that should not be logged',
        title: 'Article Title',
        selectedText: 'Selected portion'
      };

      logContentMetadata('test-request-id', request, 'test-hash');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.event).toBe('content_received');
      expect(loggedData.request_id).toBe('test-request-id');
      expect(loggedData.content_hash).toBe('test-hash');
      expect(loggedData.url_domain).toBe('example.com');
      expect(loggedData.text_length).toBe(request.text!.length);
      expect(loggedData.selected_text_length).toBe(request.selectedText!.length);
      
      // Verify raw text is NOT logged
      const logString = consoleLogSpy.mock.calls[0][0];
      expect(logString).not.toContain('article text that should not be logged');
      expect(logString).not.toContain('Selected portion');
    });

    it('should handle missing optional fields', () => {
      const request: AnalysisRequest = {
        text: 'Just text'
      };

      logContentMetadata('test-request-id', request, 'test-hash');

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.url_domain).toBeUndefined();
      expect(loggedData.has_image).toBe(false);
    });

    it('should log image presence', () => {
      const request: AnalysisRequest = {
        text: 'Text',
        imageUrl: 'https://example.com/image.jpg'
      };

      logContentMetadata('test-request-id', request, 'test-hash');

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.has_image).toBe(true);
    });
  });

  describe('Property 29: DynamoDB Storage Round Trip', () => {
    it('should handle large input without breaking storage', async () => {
      const largeInput = 'a'.repeat(30000); // >20k chars
      
      const request: AnalysisRequest = {
        url: 'https://example.com',
        text: largeInput,
        title: 'Large Article'
      };

      const response: AnalysisResponse = {
        request_id: 'test-uuid',
        status_label: 'Unverified',
        confidence_score: 50,
        recommendation: 'Verify before sharing',
        progress_stages: [],
        sources: [],
        media_risk: null,
        misinformation_type: null,
        sift_guidance: 'Test guidance',
        timestamp: new Date().toISOString()
      };

      const record: AnalysisRecord = {
        request_id: 'test-uuid',
        request,
        response,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Should not throw
      await expect(storeAnalysisRecord(record)).resolves.not.toThrow();
    });

    it('should ensure stored and retrieved data is equivalent with truncation', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      
      const largeText = 'a'.repeat(25000);
      const request: AnalysisRequest = {
        url: 'https://example.com',
        text: largeText,
        title: 'Test'
      };

      const response: AnalysisResponse = {
        request_id: 'test-uuid',
        status_label: 'Unverified',
        confidence_score: 50,
        recommendation: 'Verify',
        progress_stages: [],
        sources: [],
        media_risk: null,
        misinformation_type: null,
        sift_guidance: 'Test',
        timestamp: new Date().toISOString()
      };

      const record: AnalysisRecord = {
        request_id: 'test-uuid',
        request,
        response,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      let storedItem: any;
      const mockSend = jest.fn().mockImplementation((command) => {
        if (command.constructor.name === 'PutCommand') {
          storedItem = command.input.Item;
          return Promise.resolve({});
        }
        if (command.constructor.name === 'GetCommand') {
          return Promise.resolve({ Item: storedItem });
        }
        return Promise.resolve({});
      });

      DynamoDBDocumentClient.from = jest.fn().mockReturnValue({
        send: mockSend
      });

      // Store
      await storeAnalysisRecord(record);

      // Retrieve
      const retrieved = await getAnalysisRecord('test-uuid');

      // Verify equivalence (with truncation)
      expect(retrieved).toBeDefined();
      expect(retrieved!.request_id).toBe(record.request_id);
      expect(retrieved!.request.text).toContain('[truncated]');
      expect(retrieved!.response.status_label).toBe(response.status_label);
    });

    it('should ensure DynamoDB items never exceed 400KB', async () => {
      // Create maximum size content
      const maxText = 'a'.repeat(200000);
      const maxSources: CredibleSource[] = Array.from({ length: 3 }, (_, i) => ({
        url: `https://example.com/${i}`,
        title: `Source ${i}`,
        snippet: 'b'.repeat(2000),
        why: 'c'.repeat(1000),
        domain: 'example.com'
      }));

      const request: AnalysisRequest = {
        url: 'https://example.com',
        text: maxText,
        title: 'Maximum Size Article'
      };

      const response: AnalysisResponse = {
        request_id: 'test-uuid',
        status_label: 'Unverified',
        confidence_score: 50,
        recommendation: 'Verify before sharing',
        progress_stages: [],
        sources: maxSources,
        media_risk: null,
        misinformation_type: null,
        sift_guidance: 'Test guidance',
        timestamp: new Date().toISOString()
      };

      const record: AnalysisRecord = {
        request_id: 'test-uuid',
        request,
        response,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      let storedItem: any;
      const mockSend = jest.fn().mockImplementation((command) => {
        if (command.constructor.name === 'PutCommand') {
          storedItem = command.input.Item;
        }
        return Promise.resolve({});
      });

      DynamoDBDocumentClient.from = jest.fn().mockReturnValue({
        send: mockSend
      });

      await storeAnalysisRecord(record);

      // Verify item is under 400KB
      expect(exceedsDynamoDBLimit(storedItem)).toBe(false);
      
      // Verify truncation was applied
      expect(storedItem.request.text).toContain('[truncated]');
      expect(storedItem.response.sources[0].snippet).toContain('[truncated]');
    });
  });
});
