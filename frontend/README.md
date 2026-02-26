# FakeNewsOff Frontend

User-facing frontend experience for FakeNewsOff, including a React web application and Chrome browser extension.

## Project Structure

```
frontend/
├── web/          # React + Vite web application
├── extension/    # Chrome Manifest V3 browser extension
├── shared/       # Shared code (API client, schemas, utilities)
└── tests/        # Integration tests
```

## Components

### Web Application (`web/`)
React single-page application for analyzing text and URLs through a web interface.

**Features:**
- Text and URL input for content analysis
- Demo mode toggle for presentations
- Comprehensive results display with status labels, confidence scores, and sources
- SIFT framework guidance
- Export and sharing capabilities

### Browser Extension (`extension/`)
Chrome extension for analyzing selected text or page content.

**Features:**
- Popup interface for quick analysis
- Context menu integration ("Analyze with FakeNewsOff")
- Selected text capture
- Seamless handoff to web UI for detailed results

### Shared Module (`shared/`)
Common code used by both web and extension.

**Includes:**
- API client for backend communication
- Zod schemas for response validation
- Error types and utilities

## Getting Started

### Prerequisites
- Node.js 20+
- npm 10+

### Development

**Web Application:**
```bash
cd web
npm install
npm run dev          # Start dev server on http://localhost:5173
```

**Browser Extension:**
```bash
cd extension
npm install
npm run dev          # Build extension in watch mode
```

**Shared Module:**
```bash
cd shared
npm install
npm run test         # Run tests
```

### Demo Mode

Start the full demo environment (backend + frontend):

```bash
# From repository root
npm run demo
```

This will:
1. Start backend in demo mode on http://localhost:3000
2. Start web UI on http://localhost:5173
3. Display instructions for loading the extension

## Validation Commands

All components must pass validation before committing:

```bash
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
npm run formatcheck  # Prettier format check
npm run test         # Run all tests
npm run build        # Production build
```

## Architecture

The frontend follows a clean separation of concerns:

- **Web UI**: Standalone React application with routing and state management
- **Extension**: Chrome Manifest V3 with popup, content script, and background worker
- **Shared**: Centralized API client and validation logic

All components communicate with the backend via the shared API client, ensuring consistent error handling and response validation.

## Documentation

- [Web UI Documentation](./web/README.md)
- [Extension Installation Guide](./extension/README.md)
- [Shared Module Documentation](./shared/README.md)
- [User Demo Script](../docs/USER_DEMO.md) *(to be created)*

## Technology Stack

- **React 18+**: Component architecture
- **Vite 5+**: Build tooling and dev server
- **TypeScript 5+**: Type safety
- **Zod**: Runtime validation
- **Vitest**: Testing framework
- **fast-check**: Property-based testing

## Design Principles

1. **Reliability First**: Simple architecture, clear error boundaries
2. **Demo Optimized**: Support both demo and production modes
3. **CI Validation**: All code passes typecheck, lint, formatcheck, test, build
4. **Minimal Risk**: Graceful degradation, comprehensive error handling
5. **Jury Impact**: Polished UI, smooth interactions
