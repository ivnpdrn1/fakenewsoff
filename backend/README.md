# FakeNews-Off Backend

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
