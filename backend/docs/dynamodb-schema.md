# DynamoDB Schema Documentation

## Table: fakenews-off-analysis-records

### Primary Key

- **Partition Key**: `request_id` (String, UUID)
  - Unique identifier for each analysis request
  - Generated using UUID v4

### Attributes

```typescript
interface AnalysisRecord {
  request_id: string;              // PK: UUID
  request: AnalysisRequest;        // Original request payload (with truncation or S3 ref)
  response: AnalysisResponse;      // Analysis response payload (with truncation)
  created_at: string;              // ISO8601 timestamp
  updated_at: string;              // ISO8601 timestamp
  content_hash?: string;           // SHA-256 hash for caching
  input_ref?: S3Reference;         // S3 reference if input text stored in S3
  input_hash?: string;             // Hash of original input for verification
  ttl?: number;                    // Optional: Unix timestamp for auto-deletion
}
```

### Global Secondary Index (GSI)

#### content_hash-index

**Purpose**: Enable cache lookups within 24-hour TTL window to reduce costs and improve response times for duplicate content analysis.

**Configuration**:
- **GSI Name**: `content_hash-index`
- **Partition Key**: `content_hash` (String)
  - SHA-256 hash of normalized content
  - Computed using `computeContentHash()` from `backend/src/utils/hash.ts`
- **Sort Key**: `created_at` (String, ISO8601 timestamp)
  - Enables time-based queries within TTL window
  - Allows filtering for recent analyses (e.g., last 24 hours)
- **Projection**: ALL
  - Include all attributes in the index
  - Enables returning complete records without additional table queries

**Query Pattern**:
```typescript
// Query for cached results within 24-hour window
const thresholdTime = new Date();
thresholdTime.setHours(thresholdTime.getHours() - 24);
const thresholdISO = thresholdTime.toISOString();

const command = new QueryCommand({
  TableName: 'fakenews-off-analysis-records',
  IndexName: 'content_hash-index',
  KeyConditionExpression: 'content_hash = :hash AND created_at > :threshold',
  ExpressionAttributeValues: {
    ':hash': contentHash,
    ':threshold': thresholdISO
  }
});
```

**Cache Behavior**:
- **TTL Window**: 24 hours (default, configurable)
- **Cache Key**: SHA-256 hash of normalized content
  - Normalization: lowercase, trim whitespace, remove URL tracking parameters
  - See `normalizeContent()` in `backend/src/utils/hash.ts`
- **Cache Hit**: Return existing analysis response with `cached: true` flag
- **Cache Miss**: Proceed with full analysis pipeline

**Cache Bypass Options**:
1. **Global Bypass**: Set `CACHE_DISABLE=true` environment variable
   - Disables all cache lookups
   - Useful for testing or debugging
2. **Per-Request Bypass**: Include `cache_bypass: true` in request payload
   - Allows selective cache bypass for specific requests
   - Useful for forcing fresh analysis

### TTL Configuration

**Attribute**: `ttl` (Number, Unix timestamp)

**Behavior**:
- Automatically delete records after expiration
- Default: 30 days from creation
- Calculation: `created_at + 30 days`
- DynamoDB TTL feature must be enabled on the table

**Purpose**:
- Reduce storage costs
- Comply with data retention policies
- Automatic cleanup without manual intervention

### SAM Template Configuration

The following configuration should be added to `backend/infra/template.yaml` (Phase 4, Task 21):

```yaml
Resources:
  AnalysisTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: fakenews-off-analysis-records
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: request_id
          AttributeType: S
        - AttributeName: content_hash
          AttributeType: S
        - AttributeName: created_at
          AttributeType: S
      KeySchema:
        - AttributeName: request_id
          KeyType: HASH
      GlobalSecondaryIndexes:
        - IndexName: content_hash-index
          KeySchema:
            - AttributeName: content_hash
              KeyType: HASH
            - AttributeName: created_at
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
      TimeToLiveSpecification:
        Enabled: true
        AttributeName: ttl
      Tags:
        - Key: Project
          Value: FakeNewsOff
        - Key: Component
          Value: Backend
```

### Storage Optimization

**Truncation Policy**:
- Request text fields truncated to 10,000 characters
- Response source snippets truncated to 500 characters
- Response "why" fields truncated to 200 characters
- See `backend/src/utils/storagePolicy.ts` for details

**S3 Offloading** (Optional):
- Large text (>20,000 characters) stored in S3
- DynamoDB record contains S3 reference instead of full text
- Requires `S3_INPUT_BUCKET` environment variable
- See `handleLargeTextStorage()` in `backend/src/utils/dynamodb.ts`

**Size Limit**:
- DynamoDB item size limit: 400KB
- Truncation ensures items stay under limit
- Validation performed before storage

### Query Examples

**1. Get Analysis by Request ID**:
```typescript
const record = await getAnalysisRecord(requestId);
```

**2. Query Cache by Content Hash**:
```typescript
const cachedRecords = await queryByContentHash(contentHash, 24);
if (cachedRecords.length > 0) {
  // Return cached result
  return cachedRecords[0].response;
}
```

**3. Store New Analysis**:
```typescript
const record: AnalysisRecord = {
  request_id: uuid(),
  request: analysisRequest,
  response: analysisResponse,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  content_hash: await computeContentHash(normalizedContent),
  ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
};

await storeAnalysisRecord(record);
```

### Performance Considerations

**Read Capacity**:
- GSI queries consume read capacity units
- PAY_PER_REQUEST billing mode recommended for variable workload
- Monitor GSI query costs in CloudWatch

**Write Capacity**:
- Each analysis creates one item write
- GSI automatically updated on item write
- No additional write cost for GSI

**Query Efficiency**:
- GSI enables efficient cache lookups without table scan
- Sort key (created_at) allows time-based filtering
- Projection type ALL eliminates need for additional queries

### Monitoring

**CloudWatch Metrics**:
- `UserErrors`: Track validation failures
- `SystemErrors`: Track storage failures
- `ConsumedReadCapacityUnits`: Monitor read costs
- `ConsumedWriteCapacityUnits`: Monitor write costs

**Custom Metrics**:
- Cache hit rate: `cache_hits / (cache_hits + cache_misses)`
- Average cache age: Time between creation and cache hit
- Storage size distribution: Track item sizes

**Alarms**:
- High error rate (>5% of requests)
- Throttling events (read or write)
- Item size approaching limit (>350KB)

### Security

**IAM Permissions**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/fakenews-off-analysis-records",
        "arn:aws:dynamodb:*:*:table/fakenews-off-analysis-records/index/content_hash-index"
      ]
    }
  ]
}
```

**Data Privacy**:
- Content hash is one-way (cannot reverse to original content)
- Full text not logged (only metadata)
- TTL ensures automatic data deletion
- S3 offloading for large text (optional)

### Migration Notes

**Adding GSI to Existing Table**:
1. GSI can be added to existing table without downtime
2. DynamoDB will backfill existing items into GSI
3. Backfill time depends on table size
4. GSI becomes available after backfill completes

**Updating Existing Records**:
- Existing records without `content_hash` will not appear in GSI
- Consider backfill script to add `content_hash` to existing records
- Or rely on natural TTL expiration (30 days)
