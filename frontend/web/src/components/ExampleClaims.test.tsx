/**
 * ExampleClaims Component Tests
 *
 * Tests for the ExampleClaims component including rendering, click handling,
 * and keyboard navigation.
 *
 * Validates: Requirements 6.3, 11.3
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExampleClaims from './ExampleClaims.js';

describe('ExampleClaims', () => {
  it('renders the component with heading and description', () => {
    const mockOnClaimClick = vi.fn();
    render(<ExampleClaims onClaimClick={mockOnClaimClick} />);

    expect(screen.getByText('Try an Example')).toBeInTheDocument();
    expect(
      screen.getByText(/Click an example below to see how FakeNewsOff analyzes/)
    ).toBeInTheDocument();
  });

  it('renders all three example claims', () => {
    const mockOnClaimClick = vi.fn();
    render(<ExampleClaims onClaimClick={mockOnClaimClick} />);

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

  it('renders category labels for each claim', () => {
    const mockOnClaimClick = vi.fn();
    render(<ExampleClaims onClaimClick={mockOnClaimClick} />);

    expect(screen.getByText('Supported')).toBeInTheDocument();
    expect(screen.getByText('Disputed')).toBeInTheDocument();
    expect(screen.getByText('Unverified')).toBeInTheDocument();
  });

  it('renders descriptions for each claim', () => {
    const mockOnClaimClick = vi.fn();
    render(<ExampleClaims onClaimClick={mockOnClaimClick} />);

    expect(
      screen.getByText('Shows orchestration success with supporting evidence')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Demonstrates contradiction detection')
    ).toBeInTheDocument();
    expect(screen.getByText('Shows empty state handling')).toBeInTheDocument();
  });

  it('calls onClaimClick with correct text when a claim is clicked', () => {
    const mockOnClaimClick = vi.fn();
    render(<ExampleClaims onClaimClick={mockOnClaimClick} />);

    const supportedClaim = screen.getByText(
      'The Eiffel Tower is located in Paris, France'
    );
    fireEvent.click(supportedClaim.closest('.example-claim-card')!);

    expect(mockOnClaimClick).toHaveBeenCalledWith(
      'The Eiffel Tower is located in Paris, France'
    );
  });

  it('calls onClaimClick for each different claim', () => {
    const mockOnClaimClick = vi.fn();
    render(<ExampleClaims onClaimClick={mockOnClaimClick} />);

    // Click supported claim
    const supportedClaim = screen.getByText(
      'The Eiffel Tower is located in Paris, France'
    );
    fireEvent.click(supportedClaim.closest('.example-claim-card')!);
    expect(mockOnClaimClick).toHaveBeenCalledWith(
      'The Eiffel Tower is located in Paris, France'
    );

    // Click disputed claim
    const disputedClaim = screen.getByText(
      'The moon landing was faked in 1969'
    );
    fireEvent.click(disputedClaim.closest('.example-claim-card')!);
    expect(mockOnClaimClick).toHaveBeenCalledWith(
      'The moon landing was faked in 1969'
    );

    // Click unverified claim
    const unverifiedClaim = screen.getByText(
      'A new species was discovered yesterday'
    );
    fireEvent.click(unverifiedClaim.closest('.example-claim-card')!);
    expect(mockOnClaimClick).toHaveBeenCalledWith(
      'A new species was discovered yesterday'
    );

    expect(mockOnClaimClick).toHaveBeenCalledTimes(3);
  });

  it('supports keyboard navigation with Enter key', () => {
    const mockOnClaimClick = vi.fn();
    render(<ExampleClaims onClaimClick={mockOnClaimClick} />);

    const supportedCard = screen
      .getByText('The Eiffel Tower is located in Paris, France')
      .closest('.example-claim-card')!;

    fireEvent.keyDown(supportedCard, { key: 'Enter' });

    expect(mockOnClaimClick).toHaveBeenCalledWith(
      'The Eiffel Tower is located in Paris, France'
    );
  });

  it('supports keyboard navigation with Space key', () => {
    const mockOnClaimClick = vi.fn();
    render(<ExampleClaims onClaimClick={mockOnClaimClick} />);

    const disputedCard = screen
      .getByText('The moon landing was faked in 1969')
      .closest('.example-claim-card')!;

    fireEvent.keyDown(disputedCard, { key: ' ' });

    expect(mockOnClaimClick).toHaveBeenCalledWith(
      'The moon landing was faked in 1969'
    );
  });

  it('does not trigger onClaimClick for other keys', () => {
    const mockOnClaimClick = vi.fn();
    render(<ExampleClaims onClaimClick={mockOnClaimClick} />);

    const supportedCard = screen
      .getByText('The Eiffel Tower is located in Paris, France')
      .closest('.example-claim-card')!;

    fireEvent.keyDown(supportedCard, { key: 'Tab' });
    fireEvent.keyDown(supportedCard, { key: 'Escape' });

    expect(mockOnClaimClick).not.toHaveBeenCalled();
  });

  it('has proper ARIA attributes for accessibility', () => {
    const mockOnClaimClick = vi.fn();
    render(<ExampleClaims onClaimClick={mockOnClaimClick} />);

    const cards = screen.getAllByRole('button');
    expect(cards).toHaveLength(3);

    // Check that each card has proper ARIA label
    cards.forEach((card) => {
      expect(card).toHaveAttribute('aria-label');
      expect(card).toHaveAttribute('tabIndex', '0');
    });
  });

  it('has proper section heading with id for aria-labelledby', () => {
    const mockOnClaimClick = vi.fn();
    render(<ExampleClaims onClaimClick={mockOnClaimClick} />);

    const heading = screen.getByText('Try an Example');
    expect(heading).toHaveAttribute('id', 'example-claims-heading');

    const section = heading.closest('section');
    expect(section).toHaveAttribute(
      'aria-labelledby',
      'example-claims-heading'
    );
  });

  it('applies correct CSS classes for each category', () => {
    const mockOnClaimClick = vi.fn();
    render(<ExampleClaims onClaimClick={mockOnClaimClick} />);

    const supportedCard = screen
      .getByText('The Eiffel Tower is located in Paris, France')
      .closest('.example-claim-card')!;
    expect(supportedCard).toHaveClass('example-claim-supported');

    const disputedCard = screen
      .getByText('The moon landing was faked in 1969')
      .closest('.example-claim-card')!;
    expect(disputedCard).toHaveClass('example-claim-disputed');

    const unverifiedCard = screen
      .getByText('A new species was discovered yesterday')
      .closest('.example-claim-card')!;
    expect(unverifiedCard).toHaveClass('example-claim-unverified');
  });

  it('displays correct icons for each category', () => {
    const mockOnClaimClick = vi.fn();
    const { container } = render(
      <ExampleClaims onClaimClick={mockOnClaimClick} />
    );

    const icons = container.querySelectorAll('.example-claim-icon');
    expect(icons).toHaveLength(3);

    // Check icon content (✓, ✗, ?)
    expect(icons[0].textContent).toBe('✓');
    expect(icons[1].textContent).toBe('✗');
    expect(icons[2].textContent).toBe('?');
  });
});
