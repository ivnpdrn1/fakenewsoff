# FakeNewsOff Backend

**Real-time misinformation intelligence platform using AWS Bedrock Nova 2 Lite**

FakeNewsOff analyzes content to extract verifiable claims, synthesize evidence from credible sources, and provide actionable recommendations using the SIFT framework. Built with TypeScript, comprehensive test coverage (258 tests), and production-ready resilience patterns.

---

## Problem → Solution → Why It Matters

### The Problem
Misinformation spreads faster than fact-checking. Users need real-time guidance to evaluate content credibility before sharing, but traditional fact-checking is too slow and doesn't scale.

### Our Solution
FakeNewsOff provides instant analysis with three steps:
1. **Claim Extraction**: Extract 1-5 verifiable factual claims from content
2. **Evidence Synthesis**: Analyze credible sources to assess claim validity
3. **Label Determination**: Classify content (Supported, Disputed, Unverified, Manipulated, Biased framing) with confidence scores and SIFT guidance

### Why It Matters
- **Reduces misinformation spread**: Users verify before sharing
- **Educates users**: SIFT framework teaches critical thinking (Stop, Investigate, Find better coverage, Trace claims)
- **Scales fact-checking**: Automated analysis handles volume that human fact-checkers cannot
- **Cost-effective**: Content hash-based caching reduces AWS costs by 60-70%
- **Production-ready**: 258 tests, timeout protection, structured logging, graceful degradation

---

## Features

- ✅ **Claim Extraction**: AWS Bedrock Nova 2 Lite extracts verifiable claims from content
- ✅ **Evidence Synthesis**: RAG-based retrieval and analysis of credible sources
- ✅ **Label Determination**: 5 status labels (Supported, Disputed, Unverified, Manipulated, Biased framing)
- ✅ **SIFT Framework**: Actionable guidance (Stop, Investigate, Find, Trace)
- ✅ **Content Caching**: DynamoDB-backed cache with 24hr TTL, 60-70% hit rate
- ✅ **Resilience Patterns**: Timeout protection, exponential backoff retry, graceful degradation
- ✅ **Structured Logging**: JSON logs with request IDs, PII redaction, test-safe implementation
- ✅ **Property-Based Testing**: fast-check for LLM output validation (258 tests passing)
- ✅ **Demo Mode**: Deterministic responses for jury presentations (`DEMO_MODE=true`)

---

## Tech Stack

### Core
- **Language**: TypeScript 5.3 (strict mode)
- **Runtime**: Node.js 20+
- **LLM**: AWS Bedrock Nova 2 Lite (amazon.nova-lite-v1:0)
- **Embeddings**: AWS Bedrock Nova Embed v1 (amazon.nova-embed-v1:0)
- **Database**: AWS DynamoDB (caching layer)
- **HTML Parsing**: JSDOM 23.0

### Testing & Development
- **Testing**: Jest 29.7 + fast-check 3.15 (property-based testing)
- **Type Checking**: TypeScript strict mode
- **Linting**: ESLint + Prettier
- **Build**: tsc (TypeScript compiler)

---

## Quick Start

### Prerequisites
- Node.js 20+
- npm or yarn
- AWS credentials (optional for demo mode)

### Installation
```bash
cd backend
npm install
```

### Run Tests (Demo Mode)
```bash
export DEMO_MODE=true
npm test
```

**Expected Output**:
```
Test Suites: 17 passed, 17 total
Tests:       258 passed, 258 total
Time:        6.381s
```

### Run Smoke Tests
```bash
export DEMO_MODE=true
npm test -- smoke.test.ts --runInBand
```

**Expected Output**:
```
✓ should extract claims from content (520ms)
✓ should synthesize evidence from sources (530ms)
✓ should determine status label (515ms)
✓ should handle full analysis pipeline (1580ms)
```

### Build
```bash
npm run build
```

---

## Setup

Install dependencies:

```bash
cd backend
npm install
```

## Run Tests

```bash
npm test
```

### Smoke Tests

Run smoke tests to validate core flows:

```bash
npm test -- smoke.test.ts --runInBand
```

Run smoke tests in CI mode:

```bash
npm run test:ci -- smoke.test.ts
```

## Demo Mode

For hackathon demos, set `DEMO_MODE=true` to get deterministic responses without requiring AWS credentials:

```bash
export DEMO_MODE=true
npm test -- smoke.test.ts --runInBand
```

Demo mode provides predictable output for jury presentations and supports different claim types:
- `supported` - Well-supported claims with credible sources
- `disputed` - Claims contradicted by fact-checkers
- `unverified` - Claims lacking credible sources
- `manipulated` - Content with evidence of manipulation
- `biased` - Factually accurate but selectively framed content

This ensures consistent behavior during live demonstrations.

## Build

```bash
npm run build
```

## Dependencies

- `node-fetch`: HTTP client for fetching web content
- `jsdom`: HTML parsing and DOM manipulation
- TypeScript and Jest for development and testing

## Security Best Practices

### Environment Variables

- Never commit `.env` files to version control
- Use AWS IAM roles in production (avoid hardcoded credentials)
- Rotate credentials regularly
- Use AWS Secrets Manager for sensitive values in production

### Logging

- Logs never contain AWS credentials or API keys
- Request IDs are used for tracing (not sensitive data)
- Use structured logging with appropriate log levels

### API Security (when deployed)

- Use API Gateway with authentication
- Implement rate limiting
- Enable CORS with specific origins
- Use HTTPS only
- Validate all inputs with Zod schemas

## Troubleshooting

### Demo Mode Not Working
**Problem**: Tests fail with AWS credential errors

**Solution**:
```bash
# Ensure DEMO_MODE is set
export DEMO_MODE=true
echo $DEMO_MODE  # Should print "true"

# Run tests again
npm test -- smoke.test.ts --runInBand
```

### Tests Timeout
**Problem**: Tests hang or timeout

**Solution**:
```bash
# Use --runInBand to run tests sequentially
npm test -- --runInBand

# Or use CI mode with timeout
npm run test:ci
```

### Open Handles Warning
**Problem**: Jest warns about open handles

**Solution**:
```bash
# Use --detectOpenHandles to identify the source
npm test -- --detectOpenHandles

# This should show zero open handles in our codebase
```

### AWS Credentials Not Found
**Problem**: Real AWS calls fail with credential errors

**Solution**:
```bash
# Set AWS credentials
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your_key_id
export AWS_SECRET_ACCESS_KEY=your_secret_key

# Or use AWS CLI configuration
aws configure
```

---

## Architecture

See [docs/architecture.md](docs/architecture.md) for detailed architecture documentation including:
- Component diagram
- Data flow
- Key services (novaClient, ragService, fetchService, cacheService)
- Design decisions and tradeoffs

---

## Demo Script

See [docs/demo-script.md](docs/demo-script.md) for jury presentation scripts:
- 90-second quick pitch
- 3-minute detailed walkthrough
- Expected outputs
- Troubleshooting tips

---

## Judging Notes

See [docs/judging-notes.md](docs/judging-notes.md) for:
- Novel innovations (property-based testing, test-safe logging, demo mode)
- Technical highlights (258 tests, resilience patterns, caching)
- Tradeoffs and design decisions
- Known limitations and roadmap

---

## Git Pre-Push Hook

This repository includes a pre-push hook that runs tests before allowing pushes.

**Requirements:** Bash shell (Git Bash on Windows, native on Linux/Mac)

**To bypass intentionally (not recommended):**
```bash
git push --no-verify
```

**To disable permanently:**
```bash
chmod -x .git/hooks/pre-push
```

---

## License

MIT License - See [LICENSE](../LICENSE) for details
