# FakeNewsOff Web UI

React + Vite single-page application for analyzing text and URLs for misinformation.

## Features

- Text and URL analysis
- Demo mode support (no AWS credentials required)
- Real-time analysis results with confidence scores
- SIFT framework guidance
- Credible source citations
- Responsive design

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
npm install
```

### Development Server

```bash
npm run dev
```

The app will be available at http://localhost:5173

### Build

```bash
npm run build
```

Production build will be in `dist/` directory.

### Testing

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch
```

### Code Quality

```bash
# TypeScript type checking
npm run typecheck

# ESLint
npm run lint

# Prettier format check
npm run formatcheck
```

## Project Structure

```
src/
├── components/       # React components
│   └── ErrorBoundary.tsx
├── context/          # React contexts
│   └── DemoModeContext.tsx
├── pages/            # Page components
│   ├── Home.tsx
│   └── Results.tsx
├── test/             # Test setup
│   └── setup.ts
├── App.tsx           # Root component with routing
├── main.tsx          # Entry point
└── index.css         # Global styles with CSS variables
```

## Configuration

### Vite Configuration

- Port: 5173
- Proxy: `/analyze` → `http://localhost:3000`
- Test environment: jsdom

### Color Scheme

CSS variables defined in `index.css`:

- `--color-supported`: Green (#22c55e)
- `--color-disputed`: Red (#ef4444)
- `--color-unverified`: Yellow (#eab308)
- `--color-manipulated`: Dark red (#7f1d1d)
- `--color-biased`: Orange (#f97316)

## Demo Mode

Toggle demo mode on the home page to use keyword-based responses without AWS credentials.

Demo mode preference is persisted in localStorage.

## Backend Integration

The web UI communicates with the backend API at `http://localhost:3000/analyze`.

Ensure the backend is running before starting the web UI.

## License

MIT
