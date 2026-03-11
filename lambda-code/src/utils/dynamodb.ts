/**
 * DynamoDB Operations
 *
 * Provides utilities for storing and retrieving analysis records in DynamoDB.
 * Applies storage policy truncation to ensure items stay under 400KB limit.
 *
 * Validates: Requirements 11.1, 11.2
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { AnalysisResponse } from './schemaValidators';
import {
  truncateForStorage,
  truncateWhyFields,
  exceedsDynamoDBLimit,
  logTruncation,
  MAX_STORED_TEXT_CHARS,
} from './storagePolicy';
import { computeContentHash } from './hash';

// Re-export for backward compatibility
export { computeContentHash } from './hash';

// Export GSI name for use in tests and other modules
export const GSI_NAME_EXPORT = 'content_hash-index';

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Initialize S3 client
const s3Client = new S3Client({});

// Table name from environment variable
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'fakenews-off-analysis-records';

// GSI name for content_hash index (used for caching)
// This GSI enables efficient cache lookups within TTL window
// Configuration: content_hash (partition key) + created_at (sort key)
// See backend/docs/dynamodb-schema.md for full GSI documentation
const GSI_NAME = 'content_hash-index';

// Threshold for storing text in S3 instead of DynamoDB (20k chars)
const S3_STORAGE_THRESHOLD = 20_000;

/**
 * Analysis Request interface
 */
export interface AnalysisRequest {
  url?: string;
  text?: string;
  title?: string;
  imageUrl?: string;
  selectedText?: string;
}

/**
 * S3 Reference for large text stored in S3
 */
export interface S3Reference {
  bucket: string;
  key: string;
  size: number;
}

/**
 * Analysis Record stored in DynamoDB
 */
export interface AnalysisRecord {
  request_id: string; // PK: UUID
  request: AnalysisRequest; // Original request payload (with truncation or S3 ref)
  response: AnalysisResponse; // Analysis response payload (with truncation)
  created_at: string; // ISO8601 timestamp
  updated_at: string; // ISO8601 timestamp
  content_hash?: string; // SHA-256 hash for caching
  input_ref?: S3Reference; // S3 reference if input text stored in S3
  input_hash?: string; // Hash of original input for verification
  ttl?: number; // Optional: Unix timestamp for auto-deletion
}

/**
 * Store an analysis record in DynamoDB with truncation applied
 *
 * @param record - Analysis record to store
 * @returns Promise that resolves when storage is complete
 */
export async function storeAnalysisRecord(record: AnalysisRecord): Promise<void> {
  // Apply S3 storage for large text if enabled
  const { truncatedRequest, inputRef, inputHash } = await handleLargeTextStorage(
    record.request,
    record.request_id
  );

  // Apply truncation to response source fields
  const truncatedResponse = truncateResponseFields(record.response, record.request_id);

  // Create the final record with truncated data
  const finalRecord: AnalysisRecord = {
    ...record,
    request: truncatedRequest,
    response: truncatedResponse,
    input_ref: inputRef,
    input_hash: inputHash,
  };

  // Verify the item size is under the limit
  if (exceedsDynamoDBLimit(finalRecord)) {
    console.error(
      JSON.stringify({
        event: 'dynamodb_item_too_large',
        request_id: record.request_id,
        estimated_size: JSON.stringify(finalRecord).length,
        timestamp: new Date().toISOString(),
      })
    );
    throw new Error('DynamoDB item exceeds 400KB limit even after truncation');
  }

  // Store in DynamoDB
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: finalRecord,
  });

  await docClient.send(command);

  console.log(
    JSON.stringify({
      event: 'analysis_record_stored',
      request_id: record.request_id,
      has_s3_ref: !!inputRef,
      content_hash: record.content_hash,
      timestamp: new Date().toISOString(),
    })
  );
}

/**
 * Retrieve an analysis record from DynamoDB by request_id
 *
 * @param requestId - UUID of the analysis request
 * @returns Promise that resolves to the analysis record or null if not found
 */
export async function getAnalysisRecord(requestId: string): Promise<AnalysisRecord | null> {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      request_id: requestId,
    },
  });

  const result = await docClient.send(command);

  if (!result.Item) {
    return null;
  }

  return result.Item as AnalysisRecord;
}

/**
 * Query analysis records by content_hash (for caching)
 *
 * This function queries the content_hash-index GSI to find cached analysis results
 * within the specified TTL window. This enables cost reduction by avoiding duplicate
 * analyses for the same content.
 *
 * Cache Bypass Options:
 * - Global: Set CACHE_DISABLE=true environment variable
 * - Per-request: Include cache_bypass: true in request payload
 *
 * TTL Behavior:
 * - Default: 24 hours (configurable via ttlWindowHours parameter)
 * - Records older than TTL window are not returned
 * - Automatic cleanup via DynamoDB TTL (30 days default)
 *
 * GSI Configuration:
 * - Partition Key: content_hash (String, SHA-256 hash)
 * - Sort Key: created_at (String, ISO8601 timestamp)
 * - Projection: ALL (includes all attributes)
 *
 * See backend/docs/dynamodb-schema.md for complete GSI documentation
 *
 * @param contentHash - SHA-256 hash of the normalized content
 * @param ttlWindowHours - Time window in hours to search (default: 24)
 * @returns Promise that resolves to matching records within TTL window
 */
export async function queryByContentHash(
  contentHash: string,
  ttlWindowHours: number = 24
): Promise<AnalysisRecord[]> {
  // Calculate the timestamp threshold for TTL window
  const thresholdTime = new Date();
  thresholdTime.setHours(thresholdTime.getHours() - ttlWindowHours);
  const thresholdISO = thresholdTime.toISOString();

  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: GSI_NAME, // content_hash-index GSI
    KeyConditionExpression: 'content_hash = :hash AND created_at > :threshold',
    ExpressionAttributeValues: {
      ':hash': contentHash,
      ':threshold': thresholdISO,
    },
  });

  const result = await docClient.send(command);

  return (result.Items || []) as AnalysisRecord[];
}

/**
 * Truncate text fields in the request payload
 *
 * @param request - Original request
 * @param requestId - Request ID for logging
 * @returns Request with truncated text fields
 */
function truncateRequestText(request: AnalysisRequest, requestId: string): AnalysisRequest {
  const truncated: AnalysisRequest = { ...request };

  // Truncate main text field
  if (request.text && request.text.length > MAX_STORED_TEXT_CHARS) {
    const originalLength = request.text.length;
    truncated.text = truncateForStorage(request.text);
    logTruncation('request.text', originalLength, truncated.text.length, requestId);
  }

  // Truncate selectedText field
  if (request.selectedText && request.selectedText.length > MAX_STORED_TEXT_CHARS) {
    const originalLength = request.selectedText.length;
    truncated.selectedText = truncateForStorage(request.selectedText);
    logTruncation('request.selectedText', originalLength, truncated.selectedText.length, requestId);
  }

  return truncated;
}

/**
 * Truncate fields in the response payload
 *
 * @param response - Original response
 * @param requestId - Request ID for logging
 * @returns Response with truncated fields
 */
function truncateResponseFields(response: AnalysisResponse, requestId: string): AnalysisResponse {
  // Truncate source snippets and why fields
  const originalSourcesLength = JSON.stringify(response.sources).length;
  const truncatedSources = truncateWhyFields(response.sources);
  const truncatedSourcesLength = JSON.stringify(truncatedSources).length;

  if (originalSourcesLength !== truncatedSourcesLength) {
    logTruncation('response.sources', originalSourcesLength, truncatedSourcesLength, requestId);
  }

  return {
    ...response,
    sources: truncatedSources,
  };
}

/**
 * Handle large text storage - store in S3 if enabled and text exceeds threshold
 *
 * @param request - Original request
 * @param requestId - Request ID for S3 key
 * @returns Object with truncated request, optional S3 reference, and input hash
 */
async function handleLargeTextStorage(
  request: AnalysisRequest,
  requestId: string
): Promise<{
  truncatedRequest: AnalysisRequest;
  inputRef?: S3Reference;
  inputHash?: string;
}> {
  const truncatedRequest = { ...request };
  let inputRef: S3Reference | undefined;
  let inputHash: string | undefined;

  // Check if S3 storage is enabled (read from env at runtime for testability)
  const S3_INPUT_BUCKET = process.env.S3_INPUT_BUCKET;
  if (!S3_INPUT_BUCKET) {
    // S3 not configured, use regular truncation
    return {
      truncatedRequest: truncateRequestText(request, requestId),
    };
  }

  // Check if text exceeds S3 storage threshold
  const textLength = (request.text || '').length;
  const selectedTextLength = (request.selectedText || '').length;
  const totalLength = textLength + selectedTextLength;

  if (totalLength > S3_STORAGE_THRESHOLD) {
    // Store large text in S3
    const fullText = [request.text, request.selectedText].filter(Boolean).join('\n\n---\n\n');
    const s3Key = `${requestId}/input.txt`;

    try {
      // Upload to S3
      await s3Client.send(
        new PutObjectCommand({
          Bucket: S3_INPUT_BUCKET,
          Key: s3Key,
          Body: fullText,
          ContentType: 'text/plain',
          Metadata: {
            request_id: requestId,
            original_length: totalLength.toString(),
          },
        })
      );

      // Compute hash of original input
      inputHash = await computeContentHash(fullText);

      // Create S3 reference
      inputRef = {
        bucket: S3_INPUT_BUCKET,
        key: s3Key,
        size: fullText.length,
      };

      // Replace text with S3 reference marker
      truncatedRequest.text = `[Stored in S3: ${s3Key}]`;
      truncatedRequest.selectedText = undefined;

      console.log(
        JSON.stringify({
          event: 'large_input_stored_in_s3',
          request_id: requestId,
          original_size: totalLength,
          s3_key: s3Key,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (error) {
      // S3 storage failed, fall back to truncation
      console.error(
        JSON.stringify({
          event: 's3_storage_failed',
          request_id: requestId,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        })
      );

      return {
        truncatedRequest: truncateRequestText(request, requestId),
      };
    }
  } else {
    // Text is small enough, use regular truncation
    return {
      truncatedRequest: truncateRequestText(request, requestId),
    };
  }

  return {
    truncatedRequest,
    inputRef,
    inputHash,
  };
}

/**
 * Retrieve large text from S3 if stored there
 *
 * @param inputRef - S3 reference
 * @returns Promise that resolves to the stored text
 */
export async function retrieveLargeTextFromS3(inputRef: S3Reference): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: inputRef.bucket,
      Key: inputRef.key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error('S3 object body is empty');
    }

    // Convert stream to string
    const text = await response.Body.transformToString();

    return text;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 's3_retrieval_failed',
        s3_key: inputRef.key,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      })
    );

    throw new Error(`Failed to retrieve text from S3: ${inputRef.key}`);
  }
}

/**
 * Log content metadata without exposing raw text
 *
 * @param requestId - Request ID for tracking
 * @param request - Analysis request
 * @param contentHash - Content hash for tracking
 */
export function logContentMetadata(
  requestId: string,
  request: AnalysisRequest,
  contentHash: string
): void {
  const urlDomain = request.url ? new URL(request.url).hostname : undefined;
  const textLength = (request.text || '').length;
  const selectedTextLength = (request.selectedText || '').length;

  console.log(
    JSON.stringify({
      event: 'content_received',
      request_id: requestId,
      content_hash: contentHash,
      url_domain: urlDomain,
      text_length: textLength,
      selected_text_length: selectedTextLength,
      has_image: !!request.imageUrl,
      timestamp: new Date().toISOString(),
    })
  );
}
