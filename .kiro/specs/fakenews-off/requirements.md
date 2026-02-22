# Requirements Document

## Introduction

FakeNewsOff is a Chrome MV3 browser extension with an AWS serverless backend that helps users identify misinformation in web content through AI-powered analysis. The system extracts content from web pages, analyzes it using AWS Bedrock Nova 2 Lite, retrieves credible sources, and presents results with confidence scores and educational guidance based on the SIFT framework.

## Glossary

- **Extension**: The Chrome MV3 browser extension component
- **Content_Script**: JavaScript code injected into web pages to extract content
- **Service_Worker**: Background script that handles API communication
- **Popup_UI**: User interface displayed when the extension icon is clicked
- **Backend**: AWS serverless infrastructure including API Gateway and Lambda
- **Lambda_Function**: AWS Lambda function that processes analysis requests
- **Nova_Client**: Service that interfaces with AWS Bedrock Nova 2 Lite model
- **Search_Client**: Service that retrieves information from external search APIs
- **Extraction_Service**: Service that identifies and extracts claims from content
- **RAG_Service**: Retrieval-Augmented Generation service for chunking, embedding, and retrieval
- **Scoring_Service**: Service that ranks and deduplicates sources
- **Media_Check_Service**: Service that detects deepfakes and verifies media provenance
- **Analysis_Request**: JSON payload containing content to be analyzed
- **Analysis_Response**: JSON payload containing analysis results
- **SIFT_Framework**: Stop, Investigate the source, Find better coverage, Trace claims methodology
- **Misinformation_Type**: Classification from FirstDraft's 7 types taxonomy
- **Confidence_Score**: Numerical value representing analysis certainty
- **Credible_Source**: Verified reference supporting or refuting claims
- **Share_Card**: Formatted text summary for sharing analysis results
- **DynamoDB_Table**: Database for storing analysis records
- **API_Gateway**: AWS service exposing the /analyze endpoint

## Requirements

### Requirement 1: Extract Web Page Content

**User Story:** As a user, I want the extension to extract relevant content from web pages, so that I can analyze articles and selected text for misinformation.

#### Acceptance Criteria

1. WHEN a user activates the Extension, THE Content_Script SHALL extract the article title from the page
2. WHEN a user activates the Extension, THE Content_Script SHALL extract any selected text from the page
3. WHEN a user activates the Extension, THE Content_Script SHALL extract the full page text content
4. WHEN a user activates the Extension, THE Content_Script SHALL extract the canonical URL from the page metadata
5. WHEN a user activates the Extension, THE Content_Script SHALL extract the top image URL from the page
6. THE Content_Script SHALL send extracted content to the Service_Worker within 500ms of activation

### Requirement 2: Communicate with Backend API

**User Story:** As a user, I want the extension to send content to the backend for analysis, so that I can receive misinformation detection results.

#### Acceptance Criteria

1. WHEN the Service_Worker receives extracted content, THE Service_Worker SHALL construct an Analysis_Request payload
2. WHEN an Analysis_Request is ready, THE Service_Worker SHALL send a POST request to the /analyze endpoint
3. IF the API request fails, THEN THE Service_Worker SHALL retry up to 3 times with exponential backoff
4. WHEN the Backend returns an Analysis_Response, THE Service_Worker SHALL forward it to the Popup_UI
5. IF the API returns an error after all retries, THEN THE Service_Worker SHALL send an error message to the Popup_UI

### Requirement 3: Display Analysis Results

**User Story:** As a user, I want to see analysis results in a clear interface, so that I can understand the credibility of the content.

#### Acceptance Criteria

1. WHEN the Popup_UI receives an Analysis_Response, THE Popup_UI SHALL display the credibility status (credible, questionable, or false)
2. WHEN the Popup_UI receives an Analysis_Response, THE Popup_UI SHALL display the Misinformation_Type classification
3. WHEN the Popup_UI receives an Analysis_Response, THE Popup_UI SHALL display the Confidence_Score as a percentage
4. WHEN the Popup_UI receives an Analysis_Response, THE Popup_UI SHALL display between 2 and 3 Credible_Sources
5. WHEN the Popup_UI receives an Analysis_Response, THE Popup_UI SHALL display SIFT_Framework guidance
6. WHEN the Popup_UI receives an Analysis_Response, THE Popup_UI SHALL display media risk assessment results
7. WHEN a user clicks the "Copy Share Card" button, THE Popup_UI SHALL copy a formatted Share_Card to the clipboard

### Requirement 4: Process Analysis Requests

**User Story:** As a system, I want to process incoming analysis requests through the backend, so that content can be evaluated for misinformation.

#### Acceptance Criteria

1. WHEN the API_Gateway receives a POST request to /analyze, THE API_Gateway SHALL invoke the Lambda_Function
2. WHEN the Lambda_Function receives an Analysis_Request, THE Lambda_Function SHALL validate the request payload structure
3. IF the Analysis_Request is invalid, THEN THE Lambda_Function SHALL return an error response with status code 400
4. WHEN the Lambda_Function validates an Analysis_Request, THE Lambda_Function SHALL pass the content to the Extraction_Service
5. WHEN analysis completes, THE Lambda_Function SHALL return an Analysis_Response with status code 200
6. THE Lambda_Function SHALL complete processing within 30 seconds

### Requirement 5: Extract Claims from Content

**User Story:** As a system, I want to identify specific claims in content, so that I can verify factual assertions.

#### Acceptance Criteria

1. WHEN the Extraction_Service receives content, THE Extraction_Service SHALL identify factual claims within the text
2. WHEN the Extraction_Service identifies claims, THE Extraction_Service SHALL extract at least 1 and at most 5 primary claims
3. THE Extraction_Service SHALL return extracted claims to the Lambda_Function within 5 seconds
4. WHEN no verifiable claims are found, THE Extraction_Service SHALL return an empty claims list

### Requirement 6: Analyze Content with AI

**User Story:** As a system, I want to use AI to analyze content credibility, so that I can provide accurate misinformation detection.

#### Acceptance Criteria

1. WHEN the Nova_Client receives claims and content, THE Nova_Client SHALL send a request to AWS Bedrock Nova 2 Lite
2. WHEN the Nova_Client sends a request, THE Nova_Client SHALL include prompt templates that enforce SIFT_Framework guidance
3. WHEN the Nova_Client sends a request, THE Nova_Client SHALL include prompt templates that enforce FirstDraft 7 Misinformation_Type classification
4. WHEN the Nova_Client sends a request, THE Nova_Client SHALL include prompt templates that require between 2 and 3 Credible_Sources
5. WHEN AWS Bedrock returns results, THE Nova_Client SHALL parse the response into structured analysis data
6. THE Nova_Client SHALL complete analysis within 20 seconds

### Requirement 7: Retrieve Supporting Information

**User Story:** As a system, I want to search for credible sources, so that I can provide evidence-based analysis results.

#### Acceptance Criteria

1. WHEN the Search_Client receives extracted claims, THE Search_Client SHALL query external search APIs for relevant sources
2. WHEN the Search_Client queries search APIs, THE Search_Client SHALL retrieve at least 5 candidate sources per claim
3. THE Search_Client SHALL pass retrieved sources to the Scoring_Service within 10 seconds
4. IF the search API is unavailable, THEN THE Search_Client SHALL return cached results when available

### Requirement 8: Implement RAG Pipeline

**User Story:** As a system, I want to use retrieval-augmented generation, so that I can provide contextually relevant analysis.

#### Acceptance Criteria

1. WHEN the RAG_Service receives source documents, THE RAG_Service SHALL chunk the documents into segments of 512 tokens or fewer
2. WHEN the RAG_Service chunks documents, THE RAG_Service SHALL generate embeddings using AWS Bedrock Nova Embeddings
3. WHEN the RAG_Service receives a query, THE RAG_Service SHALL retrieve the top 5 most relevant chunks based on embedding similarity
4. THE RAG_Service SHALL return retrieved chunks to the Nova_Client within 8 seconds

### Requirement 9: Rank and Deduplicate Sources

**User Story:** As a system, I want to rank sources by credibility, so that I can present the most reliable information to users.

#### Acceptance Criteria

1. WHEN the Scoring_Service receives candidate sources, THE Scoring_Service SHALL assign credibility scores based on domain authority
2. WHEN the Scoring_Service receives candidate sources, THE Scoring_Service SHALL deduplicate sources with identical domains
3. WHEN the Scoring_Service completes scoring, THE Scoring_Service SHALL return between 2 and 3 highest-ranked Credible_Sources
4. THE Scoring_Service SHALL complete ranking within 2 seconds

### Requirement 10: Verify Media Authenticity

**User Story:** As a user, I want to know if images or videos may be manipulated, so that I can assess media credibility.

#### Acceptance Criteria

1. WHEN the Media_Check_Service receives an image URL, THE Media_Check_Service SHALL apply deepfake detection heuristics
2. WHEN the Media_Check_Service receives an image URL, THE Media_Check_Service SHALL check for provenance metadata
3. WHEN the Media_Check_Service completes analysis, THE Media_Check_Service SHALL return a risk assessment (low, medium, or high)
4. WHERE no image URL is provided, THE Media_Check_Service SHALL skip media analysis
5. THE Media_Check_Service SHALL complete analysis within 10 seconds

### Requirement 11: Store Analysis Records

**User Story:** As a system, I want to store analysis results, so that I can track usage and improve the service.

#### Acceptance Criteria

1. WHEN the Lambda_Function completes an analysis, THE Lambda_Function SHALL store the Analysis_Request in the DynamoDB_Table
2. WHEN the Lambda_Function completes an analysis, THE Lambda_Function SHALL store the Analysis_Response in the DynamoDB_Table
3. WHEN the Lambda_Function stores records, THE Lambda_Function SHALL include a timestamp
4. THE Lambda_Function SHALL complete storage operations within 1 second

### Requirement 12: Parse and Format Content

**User Story:** As a developer, I want to parse Analysis_Request payloads and format Analysis_Response payloads, so that the API contract is maintained.

#### Acceptance Criteria

1. WHEN the Lambda_Function receives a request, THE Lambda_Function SHALL parse the Analysis_Request JSON payload
2. IF the Analysis_Request JSON is malformed, THEN THE Lambda_Function SHALL return an error with a descriptive message
3. WHEN the Lambda_Function prepares a response, THE Lambda_Function SHALL format the Analysis_Response according to the API contract schema
4. FOR ALL valid Analysis_Response objects, serializing then parsing SHALL produce an equivalent object (round-trip property)

### Requirement 13: Build and Package Extension

**User Story:** As a developer, I want to build the extension with TypeScript and Vite, so that I can deploy it to Chrome Web Store.

#### Acceptance Criteria

1. WHEN the build script executes, THE build script SHALL compile TypeScript source files in the extension directory
2. WHEN the build script executes, THE build script SHALL bundle the Extension using Vite
3. WHEN the build script completes, THE build script SHALL output a Chrome MV3 compliant package
4. THE build script SHALL complete within 60 seconds

### Requirement 14: Build and Package Lambda

**User Story:** As a developer, I want to package the Lambda function, so that I can deploy it to AWS.

#### Acceptance Criteria

1. WHEN the Lambda packaging script executes, THE Lambda packaging script SHALL compile TypeScript source files in the backend directory
2. WHEN the Lambda packaging script executes, THE Lambda packaging script SHALL bundle dependencies
3. WHEN the Lambda packaging script completes, THE Lambda packaging script SHALL output a deployment package compatible with AWS Lambda
4. THE Lambda packaging script SHALL complete within 90 seconds

### Requirement 15: Deploy Infrastructure

**User Story:** As a developer, I want to deploy the backend infrastructure, so that the extension can communicate with AWS services.

#### Acceptance Criteria

1. WHEN the deployment executes, THE deployment SHALL create the API_Gateway endpoint
2. WHEN the deployment executes, THE deployment SHALL create the Lambda_Function with appropriate IAM permissions
3. WHEN the deployment executes, THE deployment SHALL create the DynamoDB_Table with appropriate indexes
4. WHERE media analysis is enabled, THE deployment SHALL create an S3 bucket for media storage
5. THE deployment SHALL use AWS SAM for infrastructure as code

### Requirement 16: Preserve Existing Project Files

**User Story:** As a developer, I want existing project files to remain unchanged, so that I don't lose important documentation or configuration.

#### Acceptance Criteria

1. WHEN the project is initialized, THE system SHALL NOT overwrite existing README.md files
2. WHEN the project is initialized, THE system SHALL NOT overwrite existing LICENSE files
3. WHEN the project is initialized, THE system SHALL NOT overwrite existing .gitignore files
4. WHERE a README.md exists, THE system SHALL append a "Development" section with build instructions

### Requirement 17: Provide Documentation

**User Story:** As a developer, I want comprehensive documentation, so that I can understand and maintain the system.

#### Acceptance Criteria

1. THE system SHALL provide architecture documentation describing component flow
2. THE system SHALL provide API contract specification with request and response JSON schemas
3. THE system SHALL provide prompt templates showing SIFT_Framework integration
4. THE system SHALL provide prompt templates showing FirstDraft 7 Misinformation_Type classification
5. THE system SHALL provide prompt templates enforcing 2 to 3 Credible_Sources requirement
6. THE system SHALL provide a demo script for a 90-second walkthrough
