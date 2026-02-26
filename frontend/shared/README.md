# FakeNewsOff Shared Module

This module contains code shared between the web application and browser extension.

## Structure

```
shared/
├── api/          # API client for communicating with backend
├── schemas/      # Zod schemas re-exported from backend
└── utils/        # Shared utilities (errors, validation)
```

## Purpose

The shared module provides:

1. **API Client**: Typed `analyzeContent()` function for backend communication
2. **Schemas**: Runtime validation using Zod schemas from the backend
3. **Utilities**: Error types, validation helpers, and common functions

## Usage

Both the web application and browser extension import from this module to ensure consistent API communication and validation logic.

## Development

```bash
# Install dependencies
npm install

# Run type checking
npm run typecheck

# Run tests
npm test

# Watch mode for tests
npm run test:watch
```

## Design Principles

- **Type Safety**: All API responses validated with Zod at runtime
- **Error Handling**: Discriminated union error types for type-safe error handling
- **Minimal Dependencies**: Only essential dependencies (Zod)
- **Browser Compatible**: Works in both browser and extension contexts
