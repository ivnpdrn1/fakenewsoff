/**
 * ClaimEvidenceGraph Component Tests
 *
 * Tests for deterministic SVG layout and positioning
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ClaimEvidenceGraph from './ClaimEvidenceGraph';
import type { NormalizedSourceWithStance } from '../../../shared/schemas/index.js';

describe('ClaimEvidenceGraph', () => {
  describe('Deterministic Layout', () => {
    it('renders empty state with center claim node only', () => {
      render(<ClaimEvidenceGraph sources={[]} />);

      expect(screen.getByText('Claim Evidence Graph')).toBeInTheDocument();
      expect(screen.getByText('No evidence sources found for this analysis.')).toBeInTheDocument();
      expect(screen.getByText('Sources: 0 — Supports: 0 — Contradicts: 0 — Mentions/Unclear: 0')).toBeInTheDocument();
    });

    it('positions claim node at center (400, 250) with radius 50px', () => {
      const { container } = render(<ClaimEvidenceGraph sources={[]} />);

      const claimCircle = container.querySelector('.claim-node circle');
      expect(claimCircle).toHaveAttribute('cx', '400');
      expect(claimCircle).toHaveAttribute('cy', '250');
      expect(claimCircle).toHaveAttribute('r', '50');
    });

    it('positions supporting sources on right side (x=600) with green color', () => {
      const sources: NormalizedSourceWithStance[] = [
        {
          url: 'https://example.com/article1',
          title: 'Supporting Article',
          snippet: 'This supports the claim',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example.com',
          score: 0.9,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
      ];

      const { container } = render(<ClaimEvidenceGraph sources={sources} />);

      const supportsNode = container.querySelector('.supports-node circle');
      expect(supportsNode).toHaveAttribute('cx', '600');
      expect(supportsNode).toHaveAttribute('cy', '100'); // 100 + (0 * 120)
      expect(supportsNode).toHaveAttribute('r', '50');
    });

    it('positions contradicting sources on left side (x=200) with red color', () => {
      const sources: NormalizedSourceWithStance[] = [
        {
          url: 'https://example.com/article1',
          title: 'Contradicting Article',
          snippet: 'This contradicts the claim',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example.com',
          score: 0.9,
          stance: 'contradicts',
          provider: 'bing',
          credibilityTier: 1,
        },
      ];

      const { container } = render(<ClaimEvidenceGraph sources={sources} />);

      const contradictsNode = container.querySelector('.contradicts-node circle');
      expect(contradictsNode).toHaveAttribute('cx', '200');
      expect(contradictsNode).toHaveAttribute('cy', '100'); // 100 + (0 * 120)
      expect(contradictsNode).toHaveAttribute('r', '50');
    });

    it('positions mentions sources on bottom (y=420) with blue color', () => {
      const sources: NormalizedSourceWithStance[] = [
        {
          url: 'https://example.com/article1',
          title: 'Mentioning Article',
          snippet: 'This mentions the claim',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example.com',
          score: 0.7,
          stance: 'mentions',
          provider: 'bing',
          credibilityTier: 2,
        },
      ];

      const { container } = render(<ClaimEvidenceGraph sources={sources} />);

      const mentionsNode = container.querySelector('.mentions-node circle');
      expect(mentionsNode).toHaveAttribute('cx', '300'); // 300 + (0 * 120)
      expect(mentionsNode).toHaveAttribute('cy', '420');
      expect(mentionsNode).toHaveAttribute('r', '45');
    });

    it('positions unclear sources on bottom (y=420) with gray color', () => {
      const sources: NormalizedSourceWithStance[] = [
        {
          url: 'https://example.com/article1',
          title: 'Unclear Article',
          snippet: 'Unclear stance',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example.com',
          score: 0.5,
          stance: 'unclear',
          provider: 'bing',
          credibilityTier: 3,
        },
      ];

      const { container } = render(<ClaimEvidenceGraph sources={sources} />);

      const unclearNode = container.querySelector('.unclear-node circle');
      expect(unclearNode).toHaveAttribute('cx', '300'); // 300 + (0 * 120)
      expect(unclearNode).toHaveAttribute('cy', '420');
      expect(unclearNode).toHaveAttribute('r', '45');
    });

    it('spaces multiple supporting sources vertically with 120px spacing', () => {
      const sources: NormalizedSourceWithStance[] = [
        {
          url: 'https://example.com/article1',
          title: 'Supporting Article 1',
          snippet: 'Supports',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example1.com',
          score: 0.9,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
        {
          url: 'https://example.com/article2',
          title: 'Supporting Article 2',
          snippet: 'Supports',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example2.com',
          score: 0.8,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
      ];

      const { container } = render(<ClaimEvidenceGraph sources={sources} />);

      const supportsNodes = container.querySelectorAll('.supports-node circle');
      expect(supportsNodes[0]).toHaveAttribute('cy', '100'); // 100 + (0 * 120)
      expect(supportsNodes[1]).toHaveAttribute('cy', '220'); // 100 + (1 * 120)
    });

    it('spaces multiple mentions/unclear sources horizontally with 120px spacing', () => {
      const sources: NormalizedSourceWithStance[] = [
        {
          url: 'https://example.com/article1',
          title: 'Mentions Article 1',
          snippet: 'Mentions',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example1.com',
          score: 0.7,
          stance: 'mentions',
          provider: 'bing',
          credibilityTier: 2,
        },
        {
          url: 'https://example.com/article2',
          title: 'Unclear Article 2',
          snippet: 'Unclear',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example2.com',
          score: 0.5,
          stance: 'unclear',
          provider: 'bing',
          credibilityTier: 3,
        },
      ];

      const { container } = render(<ClaimEvidenceGraph sources={sources} />);

      const mentionsNode = container.querySelector('.mentions-node circle');
      const unclearNode = container.querySelector('.unclear-node circle');
      
      expect(mentionsNode).toHaveAttribute('cx', '300'); // 300 + (0 * 120)
      expect(unclearNode).toHaveAttribute('cx', '420'); // 300 + (1 * 120)
    });

    it('renders consistent layout across multiple renders (no jitter)', () => {
      const sources: NormalizedSourceWithStance[] = [
        {
          url: 'https://example.com/article1',
          title: 'Supporting Article',
          snippet: 'Supports',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example.com',
          score: 0.9,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
        {
          url: 'https://example.com/article2',
          title: 'Contradicting Article',
          snippet: 'Contradicts',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example.com',
          score: 0.8,
          stance: 'contradicts',
          provider: 'bing',
          credibilityTier: 1,
        },
      ];

      // Render multiple times
      const { container: container1 } = render(<ClaimEvidenceGraph sources={sources} />);
      const { container: container2 } = render(<ClaimEvidenceGraph sources={sources} />);

      // Get positions from first render
      const supports1 = container1.querySelector('.supports-node circle');
      const contradicts1 = container1.querySelector('.contradicts-node circle');

      // Get positions from second render
      const supports2 = container2.querySelector('.supports-node circle');
      const contradicts2 = container2.querySelector('.contradicts-node circle');

      // Verify positions are identical
      expect(supports1?.getAttribute('cx')).toBe(supports2?.getAttribute('cx'));
      expect(supports1?.getAttribute('cy')).toBe(supports2?.getAttribute('cy'));
      expect(contradicts1?.getAttribute('cx')).toBe(contradicts2?.getAttribute('cx'));
      expect(contradicts1?.getAttribute('cy')).toBe(contradicts2?.getAttribute('cy'));
    });

    it('displays summary counts correctly', () => {
      const sources: NormalizedSourceWithStance[] = [
        {
          url: 'https://example.com/article1',
          title: 'Supporting Article',
          snippet: 'Supports',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example.com',
          score: 0.9,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
        {
          url: 'https://example.com/article2',
          title: 'Contradicting Article',
          snippet: 'Contradicts',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example.com',
          score: 0.8,
          stance: 'contradicts',
          provider: 'bing',
          credibilityTier: 1,
        },
        {
          url: 'https://example.com/article3',
          title: 'Mentions Article',
          snippet: 'Mentions',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example.com',
          score: 0.7,
          stance: 'mentions',
          provider: 'bing',
          credibilityTier: 2,
        },
        {
          url: 'https://example.com/article4',
          title: 'Unclear Article',
          snippet: 'Unclear',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example.com',
          score: 0.5,
          stance: 'unclear',
          provider: 'bing',
          credibilityTier: 3,
        },
      ];

      render(<ClaimEvidenceGraph sources={sources} />);

      expect(screen.getByText('Sources: 4 — Supports: 1 — Contradicts: 1 — Mentions/Unclear: 2')).toBeInTheDocument();
    });
  });

  describe('Interactive Features', () => {
    it('makes source nodes clickable', () => {
      const sources: NormalizedSourceWithStance[] = [
        {
          url: 'https://example.com/article1',
          title: 'Supporting Article',
          snippet: 'Supports',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example.com',
          score: 0.9,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
      ];

      const { container } = render(<ClaimEvidenceGraph sources={sources} />);

      const sourceNode = container.querySelector('.supports-node');
      expect(sourceNode).toHaveStyle({ cursor: 'pointer' });
    });

    it('includes tooltips with source details including credibility tier', () => {
      const sources: NormalizedSourceWithStance[] = [
        {
          url: 'https://example.com/article1',
          title: 'Supporting Article',
          snippet: 'Supports',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example.com',
          score: 0.9,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
      ];

      const { container } = render(<ClaimEvidenceGraph sources={sources} />);

      const tooltip = container.querySelector('.supports-node title');
      expect(tooltip?.textContent).toContain('Supporting Article');
      expect(tooltip?.textContent).toContain('example.com');
      // Date formatting may vary by timezone, just check it contains a date
      expect(tooltip?.textContent).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
      // Check credibility tier is included
      expect(tooltip?.textContent).toContain('Credibility: High');
    });

    it('displays correct credibility tier labels', () => {
      const sources: NormalizedSourceWithStance[] = [
        {
          url: 'https://example.com/article1',
          title: 'High Credibility',
          snippet: 'Supports',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'high.com',
          score: 0.9,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
        {
          url: 'https://example.com/article2',
          title: 'Medium Credibility',
          snippet: 'Mentions',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'medium.com',
          score: 0.7,
          stance: 'mentions',
          provider: 'bing',
          credibilityTier: 2,
        },
        {
          url: 'https://example.com/article3',
          title: 'Low Credibility',
          snippet: 'Unclear',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'low.com',
          score: 0.5,
          stance: 'unclear',
          provider: 'bing',
          credibilityTier: 3,
        },
      ];

      const { container } = render(<ClaimEvidenceGraph sources={sources} />);

      const highTooltip = container.querySelector('.supports-node title');
      const mediumTooltip = container.querySelector('.mentions-node title');
      const lowTooltip = container.querySelector('.unclear-node title');

      expect(highTooltip?.textContent).toContain('Credibility: High');
      expect(mediumTooltip?.textContent).toContain('Credibility: Medium');
      expect(lowTooltip?.textContent).toContain('Credibility: Low');
    });

    it('adds ARIA labels to source nodes', () => {
      const sources: NormalizedSourceWithStance[] = [
        {
          url: 'https://example.com/article1',
          title: 'Supporting Article',
          snippet: 'Supports',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example.com',
          score: 0.9,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
      ];

      const { container } = render(<ClaimEvidenceGraph sources={sources} />);

      const sourceNode = container.querySelector('.supports-node');
      const ariaLabel = sourceNode?.getAttribute('aria-label');
      
      expect(ariaLabel).toContain('Supporting source');
      expect(ariaLabel).toContain('Supporting Article');
      expect(ariaLabel).toContain('example.com');
      expect(ariaLabel).toContain('High credibility');
      expect(ariaLabel).toContain('Click to open in new tab');
    });

    it('makes source nodes keyboard accessible', () => {
      const sources: NormalizedSourceWithStance[] = [
        {
          url: 'https://example.com/article1',
          title: 'Supporting Article',
          snippet: 'Supports',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example.com',
          score: 0.9,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
      ];

      const { container } = render(<ClaimEvidenceGraph sources={sources} />);

      const sourceNode = container.querySelector('.supports-node');
      
      expect(sourceNode).toHaveAttribute('role', 'button');
      expect(sourceNode).toHaveAttribute('tabindex', '0');
    });

    it('adds ARIA label to SVG for screen readers', () => {
      const sources: NormalizedSourceWithStance[] = [
        {
          url: 'https://example.com/article1',
          title: 'Supporting Article',
          snippet: 'Supports',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example.com',
          score: 0.9,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
      ];

      const { container } = render(<ClaimEvidenceGraph sources={sources} />);

      const svg = container.querySelector('svg');
      const ariaLabel = svg?.getAttribute('aria-label');
      
      expect(svg).toHaveAttribute('role', 'img');
      expect(ariaLabel).toContain('1 sources');
      expect(ariaLabel).toContain('1 supporting');
    });

    it('adds ARIA label to empty state SVG', () => {
      const { container } = render(<ClaimEvidenceGraph sources={[]} />);

      const svg = container.querySelector('svg');
      const ariaLabel = svg?.getAttribute('aria-label');
      
      expect(svg).toHaveAttribute('role', 'img');
      expect(ariaLabel).toContain('Empty claim evidence graph');
      expect(ariaLabel).toContain('no sources found');
    });
  });

  describe('Edge Cases', () => {
    it('handles mixed stance sources correctly', () => {
      const sources: NormalizedSourceWithStance[] = [
        {
          url: 'https://example.com/article1',
          title: 'Supporting Article 1',
          snippet: 'Supports',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example1.com',
          score: 0.9,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
        {
          url: 'https://example.com/article2',
          title: 'Supporting Article 2',
          snippet: 'Supports',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example2.com',
          score: 0.85,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
        {
          url: 'https://example.com/article3',
          title: 'Contradicting Article',
          snippet: 'Contradicts',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example3.com',
          score: 0.8,
          stance: 'contradicts',
          provider: 'bing',
          credibilityTier: 1,
        },
        {
          url: 'https://example.com/article4',
          title: 'Mentions Article',
          snippet: 'Mentions',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example4.com',
          score: 0.7,
          stance: 'mentions',
          provider: 'bing',
          credibilityTier: 2,
        },
      ];

      const { container } = render(<ClaimEvidenceGraph sources={sources} />);

      // Verify all stance groups are present
      expect(container.querySelectorAll('.supports-node')).toHaveLength(2);
      expect(container.querySelectorAll('.contradicts-node')).toHaveLength(1);
      expect(container.querySelectorAll('.mentions-node')).toHaveLength(1);
    });

    it('limits display to top 10 sources when >10 sources available', () => {
      // Create 15 sources
      const sources: NormalizedSourceWithStance[] = Array.from({ length: 15 }, (_, i) => ({
        url: `https://example.com/article${i}`,
        title: `Article ${i}`,
        snippet: 'Content',
        publishDate: '2023-12-31T00:00:00Z',
        domain: `example${i}.com`,
        score: 0.8 - i * 0.01,
        stance: 'supports' as const,
        provider: 'bing' as const,
        credibilityTier: 1 as const,
      }));

      const { container } = render(<ClaimEvidenceGraph sources={sources} />);

      // Should only render 10 nodes (excluding claim node)
      const sourceNodes = container.querySelectorAll('.source-node');
      expect(sourceNodes).toHaveLength(10);

      // Should show limit message
      expect(screen.getByText(/Showing top 10 of 15 sources/)).toBeInTheDocument();
    });

    it('prioritizes contradicting sources when limiting to 10', () => {
      // Create 12 sources: 3 contradicts, 9 supports
      const sources: NormalizedSourceWithStance[] = [
        // 3 contradicting sources with lower scores
        {
          url: 'https://example.com/contradict1',
          title: 'Contradicting 1',
          snippet: 'Contradicts',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'contradict1.com',
          score: 0.5,
          stance: 'contradicts',
          provider: 'bing',
          credibilityTier: 1,
        },
        {
          url: 'https://example.com/contradict2',
          title: 'Contradicting 2',
          snippet: 'Contradicts',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'contradict2.com',
          score: 0.4,
          stance: 'contradicts',
          provider: 'bing',
          credibilityTier: 1,
        },
        {
          url: 'https://example.com/contradict3',
          title: 'Contradicting 3',
          snippet: 'Contradicts',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'contradict3.com',
          score: 0.3,
          stance: 'contradicts',
          provider: 'bing',
          credibilityTier: 1,
        },
        // 9 supporting sources with higher scores
        ...Array.from({ length: 9 }, (_, i) => ({
          url: `https://example.com/support${i}`,
          title: `Supporting ${i}`,
          snippet: 'Supports',
          publishDate: '2023-12-31T00:00:00Z',
          domain: `support${i}.com`,
          score: 0.9 - i * 0.01,
          stance: 'supports' as const,
          provider: 'bing' as const,
          credibilityTier: 1 as const,
        })),
      ];

      const { container } = render(<ClaimEvidenceGraph sources={sources} />);

      // Should render all 3 contradicting sources (prioritized)
      const contradictNodes = container.querySelectorAll('.contradicts-node');
      expect(contradictNodes).toHaveLength(3);

      // Should render 7 supporting sources (to make 10 total)
      const supportNodes = container.querySelectorAll('.supports-node');
      expect(supportNodes).toHaveLength(7);

      // Should show limit message
      expect(screen.getByText(/Showing top 10 of 12 sources/)).toBeInTheDocument();
      expect(screen.getByText(/prioritizing contradicting sources/)).toBeInTheDocument();
    });

    it('shows total source count in summary even when limited', () => {
      // Create 15 sources
      const sources: NormalizedSourceWithStance[] = Array.from({ length: 15 }, (_, i) => ({
        url: `https://example.com/article${i}`,
        title: `Article ${i}`,
        snippet: 'Content',
        publishDate: '2023-12-31T00:00:00Z',
        domain: `example${i}.com`,
        score: 0.8 - i * 0.01,
        stance: 'supports' as const,
        provider: 'bing' as const,
        credibilityTier: 1 as const,
      }));

      render(<ClaimEvidenceGraph sources={sources} />);

      // Summary should show total count (15), not limited count (10)
      expect(screen.getByText(/Sources: 15/)).toBeInTheDocument();
    });

    it('does not show limit message when sources <= 10', () => {
      const sources: NormalizedSourceWithStance[] = Array.from({ length: 10 }, (_, i) => ({
        url: `https://example.com/article${i}`,
        title: `Article ${i}`,
        snippet: 'Content',
        publishDate: '2023-12-31T00:00:00Z',
        domain: `example${i}.com`,
        score: 0.8 - i * 0.01,
        stance: 'supports' as const,
        provider: 'bing' as const,
        credibilityTier: 1 as const,
      }));

      render(<ClaimEvidenceGraph sources={sources} />);

      // Should not show limit message
      expect(screen.queryByText(/Showing top 10 of/)).not.toBeInTheDocument();
    });

    it('renders edges with correct markers', () => {
      const sources: NormalizedSourceWithStance[] = [
        {
          url: 'https://example.com/article1',
          title: 'Supporting Article',
          snippet: 'Supports',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example.com',
          score: 0.9,
          stance: 'supports',
          provider: 'bing',
          credibilityTier: 1,
        },
      ];

      const { container } = render(<ClaimEvidenceGraph sources={sources} />);

      const edge = container.querySelector('.edge-supports');
      expect(edge).toHaveAttribute('marker-end', 'url(#arrow-supports)');
    });

    it('uses dashed lines for mentions and dotted for unclear', () => {
      const sources: NormalizedSourceWithStance[] = [
        {
          url: 'https://example.com/article1',
          title: 'Mentions Article',
          snippet: 'Mentions',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example1.com',
          score: 0.7,
          stance: 'mentions',
          provider: 'bing',
          credibilityTier: 2,
        },
        {
          url: 'https://example.com/article2',
          title: 'Unclear Article',
          snippet: 'Unclear',
          publishDate: '2023-12-31T00:00:00Z',
          domain: 'example2.com',
          score: 0.5,
          stance: 'unclear',
          provider: 'bing',
          credibilityTier: 3,
        },
      ];

      const { container } = render(<ClaimEvidenceGraph sources={sources} />);

      const mentionsEdge = container.querySelector('.edge-mentions');
      const unclearEdge = container.querySelector('.edge-unclear');

      expect(mentionsEdge).toHaveAttribute('stroke-dasharray', '5,5');
      expect(unclearEdge).toHaveAttribute('stroke-dasharray', '2,2');
    });
  });
});
