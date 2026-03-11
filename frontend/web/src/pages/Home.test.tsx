/**
 * Home Page Tests
 *
 * Tests for the Home page including ExampleClaims integration
 *
 * Validates: Requirements 6.3, 11.3
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Home from './Home.js';
import { DemoModeProvider } from '../context/DemoModeContext.js';

// Mock the API client
vi.mock('../../../shared/api/client.js', () => ({
  analyzeContent: vi.fn(),
  getApiConfig: vi.fn(() => ({
    baseUrl: 'http://localhost:3000',
  })),
  checkHealth: vi.fn(() => Promise.resolve({ success: true, data: { status: 'ok' } })),
  checkGroundingHealth: vi.fn(() => Promise.resolve({ success: true, data: { ok: true, provider_enabled: true, bing_configured: true, gdelt_configured: true, provider_order: ['bing', 'gdelt'], timeout_ms: 5000, cache_ttl_seconds: 3600 } })),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Home', () => {
  const renderHome = () => {
    return render(
      <BrowserRouter>
        <DemoModeProvider>
          <Home />
        </DemoModeProvider>
      </BrowserRouter>
    );
  };

  it('renders the Home page with all components', () => {
    renderHome();

    expect(screen.getByText('FakeNewsOff')).toBeInTheDocument();
    expect(screen.getByText('Real-time misinformation detection powered by evidence')).toBeInTheDocument();
    expect(screen.getByText('Try an Example')).toBeInTheDocument();
    expect(screen.getByLabelText('Text to analyze')).toBeInTheDocument();
  });

  it('renders ExampleClaims component', () => {
    renderHome();

    // Check for all three example claims
    expect(
      screen.getByText('The Eiffel Tower is located in Paris, France')
    ).toBeInTheDocument();
    expect(
      screen.getByText('The moon landing was faked in 1969')
    ).toBeInTheDocument();
    expect(
      screen.getByText('A new species was discovered yesterday')
    ).toBeInTheDocument();
  });

  it('auto-fills input when example claim is clicked', async () => {
    renderHome();

    const exampleClaim = screen.getByText(
      'The Eiffel Tower is located in Paris, France'
    );
    const card = exampleClaim.closest('.example-claim-card')!;

    fireEvent.click(card);

    // Wait for the input to be filled
    await waitFor(() => {
      const textarea = screen.getByLabelText('Text to analyze') as HTMLTextAreaElement;
      expect(textarea.value).toBe('The Eiffel Tower is located in Paris, France');
    });
  });

  it('auto-fills input for different example claims', async () => {
    renderHome();

    // Click disputed claim
    const disputedClaim = screen.getByText(
      'The moon landing was faked in 1969'
    );
    fireEvent.click(disputedClaim.closest('.example-claim-card')!);

    await waitFor(() => {
      const textarea = screen.getByLabelText('Text to analyze') as HTMLTextAreaElement;
      expect(textarea.value).toBe('The moon landing was faked in 1969');
    });

    // Click unverified claim
    const unverifiedClaim = screen.getByText(
      'A new species was discovered yesterday'
    );
    fireEvent.click(unverifiedClaim.closest('.example-claim-card')!);

    await waitFor(() => {
      const textarea = screen.getByLabelText('Text to analyze') as HTMLTextAreaElement;
      expect(textarea.value).toBe('A new species was discovered yesterday');
    });
  });

  it('enables submit button when example claim is clicked', async () => {
    renderHome();

    const submitButton = screen.getByRole('button', { name: /Analyze content/i });
    
    // Initially disabled (no input)
    expect(submitButton).toBeDisabled();

    // Click example claim
    const exampleClaim = screen.getByText(
      'The Eiffel Tower is located in Paris, France'
    );
    fireEvent.click(exampleClaim.closest('.example-claim-card')!);

    // Wait for button to be enabled
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });
});
