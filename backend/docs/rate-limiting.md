# Rate Limiting Configuration

When deployed as an API, use these recommended limits:

## Default Limits
- Global: 60 req/min per IP
- /analyze endpoint: 20 req/min per IP

## Environment Variables
```bash
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
RATE_LIMIT_ANALYZE_MAX=20
```

## Response Headers
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Time when limit resets
- `Retry-After`: Seconds to wait (on 429)

## Implementation
Use express-rate-limit or similar middleware.
