import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    // Check that at least one element with "FakeNewsOff" exists
    const elements = screen.getAllByText(/FakeNewsOff/i);
    expect(elements.length).toBeGreaterThan(0);
  });
});
