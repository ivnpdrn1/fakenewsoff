/**
 * ResultsCard Component Tests
 *
 * Tests for orchestration metadata display and other ResultsCard features
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResultsCard from './ResultsCard';
import type { AnalysisResponse } from '../../../shared/schemas/index.js';

// Declare global for test mocking
declare const global: typeof globalThis;

describe('ResultsCard', () => {
  const baseResponse: AnalysisResponse = {
    request_id: '123e4567-e89b-12d3-a456-426614174000',
    status_label: 'Supported',
    confidence_score: 85,
    recommendation: 'This claim is supported by evidence.',
    progress_stages: [],
    sources: [],
    media_risk: null,
    misinformation_type: null,
    sift_guidance: 'Follow SIFT framework',
    timestamp: '2024-01-01T00:00:00Z',
  };

  it('renders without crashing', () => {
    render(<ResultsCard response={baseResponse} />);
    expect(screen.getByText('Recommendation')).toBeInTheDocument();
  });

  it('displays orchestration metadata when enabled', () => {
    const responseWithOrchestration: AnalysisResponse = {
      ...baseResponse,
      orchestration: {
        enabled: true,
        passes_executed: 2,
        source_classes: 2,
        average_quality: 0.75,
        contradictions_found: false,
      },
    };

    render(<ResultsCard response={responseWithOrchestration} />);

    // Check for orchestration section
    expect(
      screen.getByText('Analysis Details (Orchestration Used)')
    ).toBeInTheDocument();
  });

  it('does not display orchestration metadata when disabled', () => {
    const responseWithoutOrchestration: AnalysisResponse = {
      ...baseResponse,
      orchestration: {
        enabled: false,
        passes_executed: 1,
        source_classes: 0,
        average_quality: 0,
        contradictions_found: false,
      },
    };

    render(<ResultsCard response={responseWithoutOrchestration} />);

    // Orchestration section should not be present
    expect(
      screen.queryByText('Analysis Details (Orchestration Used)')
    ).not.toBeInTheDocument();
  });

  it('does not display orchestration metadata when not present', () => {
    render(<ResultsCard response={baseResponse} />);

    // Orchestration section should not be present
    expect(
      screen.queryByText('Analysis Details (Orchestration Used)')
    ).not.toBeInTheDocument();
  });

  it('displays correct pass explanation for 1 pass', () => {
    const response: AnalysisResponse = {
      ...baseResponse,
      orchestration: {
        enabled: true,
        passes_executed: 1,
        source_classes: 1,
        average_quality: 0.6,
        contradictions_found: false,
      },
    };

    render(<ResultsCard response={response} />);
    expect(screen.getByText('Single pass: Initial retrieval')).toBeInTheDocument();
  });

  it('displays correct pass explanation for 2 passes', () => {
    const response: AnalysisResponse = {
      ...baseResponse,
      orchestration: {
        enabled: true,
        passes_executed: 2,
        source_classes: 2,
        average_quality: 0.75,
        contradictions_found: false,
      },
    };

    render(<ResultsCard response={response} />);
    expect(
      screen.getByText('2 passes: Initial retrieval + targeted refinement')
    ).toBeInTheDocument();
  });

  it('displays correct pass explanation for 3 passes', () => {
    const response: AnalysisResponse = {
      ...baseResponse,
      orchestration: {
        enabled: true,
        passes_executed: 3,
        source_classes: 3,
        average_quality: 0.8,
        contradictions_found: true,
      },
    };

    render(<ResultsCard response={response} />);
    expect(
      screen.getByText(
        '3 passes: Initial retrieval + targeted refinement + contradiction search'
      )
    ).toBeInTheDocument();
  });

  it('displays source diversity correctly', () => {
    const response: AnalysisResponse = {
      ...baseResponse,
      orchestration: {
        enabled: true,
        passes_executed: 2,
        source_classes: 2,
        average_quality: 0.75,
        contradictions_found: false,
      },
    };

    render(<ResultsCard response={response} />);
    expect(screen.getByText(/Source Diversity: 2 classes/)).toBeInTheDocument();
  });

  it('displays average quality score correctly', () => {
    const response: AnalysisResponse = {
      ...baseResponse,
      orchestration: {
        enabled: true,
        passes_executed: 2,
        source_classes: 2,
        average_quality: 0.75,
        contradictions_found: false,
      },
    };

    render(<ResultsCard response={response} />);
    expect(screen.getByText(/Average Quality: 0\.75/)).toBeInTheDocument();
    expect(screen.getByText('High quality evidence')).toBeInTheDocument();
  });

  it('displays contradiction warning when contradictions found', () => {
    const response: AnalysisResponse = {
      ...baseResponse,
      orchestration: {
        enabled: true,
        passes_executed: 2,
        source_classes: 2,
        average_quality: 0.75,
        contradictions_found: true,
      },
    };

    render(<ResultsCard response={response} />);
    expect(screen.getByText(/⚠️ Contradictions: Found/)).toBeInTheDocument();
    expect(
      screen.getByText(/Safety-first contradiction check performed/)
    ).toBeInTheDocument();
  });

  it('does not display contradiction warning when no contradictions', () => {
    const response: AnalysisResponse = {
      ...baseResponse,
      orchestration: {
        enabled: true,
        passes_executed: 2,
        source_classes: 2,
        average_quality: 0.75,
        contradictions_found: false,
      },
    };

    render(<ResultsCard response={response} />);
    expect(
      screen.queryByText(/⚠️ Contradictions: Found/)
    ).not.toBeInTheDocument();
  });

  it('displays quality explanation for high quality', () => {
    const response: AnalysisResponse = {
      ...baseResponse,
      orchestration: {
        enabled: true,
        passes_executed: 2,
        source_classes: 2,
        average_quality: 0.85,
        contradictions_found: false,
      },
    };

    render(<ResultsCard response={response} />);
    expect(screen.getByText('High quality evidence')).toBeInTheDocument();
  });

  it('displays quality explanation for medium quality', () => {
    const response: AnalysisResponse = {
      ...baseResponse,
      orchestration: {
        enabled: true,
        passes_executed: 2,
        source_classes: 2,
        average_quality: 0.6,
        contradictions_found: false,
      },
    };

    render(<ResultsCard response={response} />);
    expect(screen.getByText('Medium quality evidence')).toBeInTheDocument();
  });

  it('displays quality explanation for low quality', () => {
    const response: AnalysisResponse = {
      ...baseResponse,
      orchestration: {
        enabled: true,
        passes_executed: 1,
        source_classes: 1,
        average_quality: 0.4,
        contradictions_found: false,
      },
    };

    render(<ResultsCard response={response} />);
    expect(screen.getByText('Lower quality evidence')).toBeInTheDocument();
  });

  // Confidence context messaging tests
  it('displays low confidence warning with suggestions', () => {
    const response: AnalysisResponse = {
      ...baseResponse,
      confidence_score: 35,
    };

    render(<ResultsCard response={response} />);
    expect(screen.getByText(/Low Confidence - Insufficient Evidence/)).toBeInTheDocument();
    expect(screen.getByText(/We found limited evidence for this claim/)).toBeInTheDocument();
    expect(screen.getByText(/Try providing a URL to the original source/)).toBeInTheDocument();
  });

  it('displays medium confidence message', () => {
    const response: AnalysisResponse = {
      ...baseResponse,
      confidence_score: 65,
    };

    render(<ResultsCard response={response} />);
    expect(screen.getByText(/Moderate Confidence - Some Uncertainty/)).toBeInTheDocument();
    expect(screen.getByText(/We found some evidence for this claim/)).toBeInTheDocument();
  });

  it('displays high confidence message', () => {
    const response: AnalysisResponse = {
      ...baseResponse,
      confidence_score: 85,
    };

    render(<ResultsCard response={response} />);
    expect(screen.getByText(/High Confidence - Strong Evidence/)).toBeInTheDocument();
    expect(screen.getByText(/We found strong evidence for this analysis/)).toBeInTheDocument();
  });

  it('displays confidence factors from orchestration metadata', () => {
    const response: AnalysisResponse = {
      ...baseResponse,
      confidence_score: 85,
      orchestration: {
        enabled: true,
        passes_executed: 2,
        source_classes: 2,
        average_quality: 0.8,
        contradictions_found: false,
      },
    };

    render(<ResultsCard response={response} />);
    expect(screen.getByText(/Factors:/)).toBeInTheDocument();
    expect(screen.getByText(/high-quality evidence/)).toBeInTheDocument();
    expect(screen.getByText(/diverse sources/)).toBeInTheDocument();
  });

  it('displays contradictions in confidence factors', () => {
    const response: AnalysisResponse = {
      ...baseResponse,
      confidence_score: 60,
      orchestration: {
        enabled: true,
        passes_executed: 2,
        source_classes: 2,
        average_quality: 0.7,
        contradictions_found: true,
      },
    };

    render(<ResultsCard response={response} />);
    expect(screen.getByText(/contradicting evidence found/)).toBeInTheDocument();
  });

  // Stance-based grouping tests
  describe('Stance-based source grouping', () => {
    it('displays supporting sources with green indicators', () => {
      const response: AnalysisResponse = {
        ...baseResponse,
        text_grounding: {
          sources: [
            {
              url: 'https://example.com/supports',
              title: 'Supporting Article',
              snippet: 'This supports the claim',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.9,
              stance: 'supports',
              stanceJustification: 'Evidence supports the claim',
              provider: 'bing',
              credibilityTier: 1,
            },
          ],
          queries: ['test query'],
          providerUsed: ['bing'],
          sourcesCount: 1,
          cacheHit: false,
          latencyMs: 100,
        },
      };

      render(<ResultsCard response={response} />);
      expect(screen.getByText('Supporting Evidence')).toBeInTheDocument();
      expect(screen.getByText('Supporting Article')).toBeInTheDocument();
      expect(screen.getByText(/Evidence supports the claim/)).toBeInTheDocument();
    });

    it('displays contradicting sources with red indicators', () => {
      const response: AnalysisResponse = {
        ...baseResponse,
        text_grounding: {
          sources: [
            {
              url: 'https://example.com/contradicts',
              title: 'Contradicting Article',
              snippet: 'This contradicts the claim',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.8,
              stance: 'contradicts',
              stanceJustification: 'Evidence contradicts the claim',
              provider: 'bing',
              credibilityTier: 1,
            },
          ],
          queries: ['test query'],
          providerUsed: ['bing'],
          sourcesCount: 1,
          cacheHit: false,
          latencyMs: 100,
        },
      };

      render(<ResultsCard response={response} />);
      expect(screen.getByText('Contradicting Evidence')).toBeInTheDocument();
      expect(screen.getByText('Contradicting Article')).toBeInTheDocument();
      expect(screen.getByText(/Evidence contradicts the claim/)).toBeInTheDocument();
    });

    it('displays contextual sources with blue/gray indicators', () => {
      const response: AnalysisResponse = {
        ...baseResponse,
        text_grounding: {
          sources: [
            {
              url: 'https://example.com/mentions',
              title: 'Contextual Article',
              snippet: 'This mentions the claim',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.7,
              stance: 'mentions',
              stanceJustification: 'Provides context',
              provider: 'bing',
              credibilityTier: 2,
            },
          ],
          queries: ['test query'],
          providerUsed: ['bing'],
          sourcesCount: 1,
          cacheHit: false,
          latencyMs: 100,
        },
      };

      render(<ResultsCard response={response} />);
      expect(screen.getByText('Contextual Information')).toBeInTheDocument();
      expect(screen.getByText('Contextual Article')).toBeInTheDocument();
      expect(screen.getByText(/Provides context/)).toBeInTheDocument();
    });

    it('groups sources by stance correctly', () => {
      const response: AnalysisResponse = {
        ...baseResponse,
        text_grounding: {
          sources: [
            {
              url: 'https://example.com/supports',
              title: 'Supporting Article',
              snippet: 'Supports',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.9,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 1,
            },
            {
              url: 'https://example.com/contradicts',
              title: 'Contradicting Article',
              snippet: 'Contradicts',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.8,
              stance: 'contradicts',
              provider: 'bing',
              credibilityTier: 1,
            },
            {
              url: 'https://example.com/mentions',
              title: 'Contextual Article',
              snippet: 'Mentions',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.7,
              stance: 'mentions',
              provider: 'bing',
              credibilityTier: 2,
            },
          ],
          queries: ['test query'],
          providerUsed: ['bing'],
          sourcesCount: 3,
          cacheHit: false,
          latencyMs: 100,
        },
      };

      render(<ResultsCard response={response} />);
      
      // All three groups should be present
      expect(screen.getByText('Supporting Evidence')).toBeInTheDocument();
      expect(screen.getByText('Contradicting Evidence')).toBeInTheDocument();
      expect(screen.getByText('Contextual Information')).toBeInTheDocument();
      
      // All three articles should be present
      expect(screen.getByText('Supporting Article')).toBeInTheDocument();
      expect(screen.getByText('Contradicting Article')).toBeInTheDocument();
      expect(screen.getByText('Contextual Article')).toBeInTheDocument();
    });

    it('displays credibility tiers correctly', () => {
      const response: AnalysisResponse = {
        ...baseResponse,
        text_grounding: {
          sources: [
            {
              url: 'https://example.com/high',
              title: 'High Credibility',
              snippet: 'High tier',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.9,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 1,
            },
            {
              url: 'https://example.com/medium',
              title: 'Medium Credibility',
              snippet: 'Medium tier',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.7,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 2,
            },
            {
              url: 'https://example.com/low',
              title: 'Low Credibility',
              snippet: 'Low tier',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.5,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 3,
            },
          ],
          queries: ['test query'],
          providerUsed: ['bing'],
          sourcesCount: 3,
          cacheHit: false,
          latencyMs: 100,
        },
      };

      render(<ResultsCard response={response} />);
      
      expect(screen.getByText('Credibility: High')).toBeInTheDocument();
      expect(screen.getByText('Credibility: Medium')).toBeInTheDocument();
      expect(screen.getByText('Credibility: Low')).toBeInTheDocument();
    });

    it('displays credibility tier badges with correct colors and tooltips', () => {
      const response: AnalysisResponse = {
        ...baseResponse,
        text_grounding: {
          sources: [
            {
              url: 'https://example.com/high',
              title: 'High Credibility Source',
              snippet: 'High tier',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.9,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 1,
            },
            {
              url: 'https://example.com/medium',
              title: 'Medium Credibility Source',
              snippet: 'Medium tier',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.7,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 2,
            },
            {
              url: 'https://example.com/low',
              title: 'Low Credibility Source',
              snippet: 'Low tier',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.5,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 3,
            },
          ],
          queries: ['test query'],
          providerUsed: ['bing'],
          sourcesCount: 3,
          cacheHit: false,
          latencyMs: 100,
        },
      };

      const { container } = render(<ResultsCard response={response} />);
      
      // Check for credibility tier badges with correct CSS classes
      const tier1Badge = container.querySelector('.credibility-tier-1');
      const tier2Badge = container.querySelector('.credibility-tier-2');
      const tier3Badge = container.querySelector('.credibility-tier-3');
      
      expect(tier1Badge).toBeInTheDocument();
      expect(tier2Badge).toBeInTheDocument();
      expect(tier3Badge).toBeInTheDocument();
      
      // Check tooltips
      expect(tier1Badge).toHaveAttribute('title', 'High credibility: Established, authoritative sources with strong editorial standards');
      expect(tier2Badge).toHaveAttribute('title', 'Medium credibility: Generally reliable sources, verify with additional sources');
      expect(tier3Badge).toHaveAttribute('title', 'Low credibility: Less established sources, verify carefully with authoritative sources');
    });

    it('sorts sources by credibility tier within stance groups', () => {
      const response: AnalysisResponse = {
        ...baseResponse,
        text_grounding: {
          sources: [
            {
              url: 'https://example.com/low',
              title: 'Low Credibility',
              snippet: 'Low tier',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.5,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 3,
            },
            {
              url: 'https://example.com/high',
              title: 'High Credibility',
              snippet: 'High tier',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.9,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 1,
            },
            {
              url: 'https://example.com/medium',
              title: 'Medium Credibility',
              snippet: 'Medium tier',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.7,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 2,
            },
          ],
          queries: ['test query'],
          providerUsed: ['bing'],
          sourcesCount: 3,
          cacheHit: false,
          latencyMs: 100,
        },
      };

      const { container } = render(<ResultsCard response={response} />);
      
      // Get all source items in the supporting evidence section
      const sourceItems = container.querySelectorAll('.stance-supports .stance-source-item');
      
      // Check that sources are sorted by credibility tier (1, 2, 3)
      expect(sourceItems[0].querySelector('.source-title')?.textContent).toContain('High Credibility');
      expect(sourceItems[1].querySelector('.source-title')?.textContent).toContain('Medium Credibility');
      expect(sourceItems[2].querySelector('.source-title')?.textContent).toContain('Low Credibility');
    });

    it('falls back to credible_sources when text_grounding is not available', () => {
      const response: AnalysisResponse = {
        ...baseResponse,
        credible_sources: [
          {
            url: 'https://example.com/legacy',
            title: 'Legacy Source',
            snippet: 'Legacy snippet',
            domain: 'example.com',
            why: 'Credible source',
          },
        ],
      };

      render(<ResultsCard response={response} />);
      
      // Should not show stance groups
      expect(screen.queryByText('Supporting Evidence')).not.toBeInTheDocument();
      expect(screen.queryByText('Contradicting Evidence')).not.toBeInTheDocument();
      
      // Should show legacy source
      expect(screen.getByText('Legacy Source')).toBeInTheDocument();
      expect(screen.getByText(/Why credible:/)).toBeInTheDocument();
    });

    it('displays empty state when no sources available', () => {
      const response: AnalysisResponse = {
        ...baseResponse,
        text_grounding: {
          sources: [],
          queries: ['test query'],
          providerUsed: ['bing'],
          sourcesCount: 0,
          cacheHit: false,
          latencyMs: 100,
        },
      };

      render(<ResultsCard response={response} />);
      
      expect(screen.getByText(/No Evidence Sources Found/i)).toBeInTheDocument();
      expect(screen.getByText(/Providing a URL/i)).toBeInTheDocument();
    });
  });

  // Export functionality tests
  describe('Export functionality', () => {
    it('renders copy to clipboard button', () => {
      render(<ResultsCard response={baseResponse} />);
      expect(screen.getByLabelText('Copy analysis summary to clipboard')).toBeInTheDocument();
    });

    it('renders export JSON button', () => {
      render(<ResultsCard response={baseResponse} />);
      expect(screen.getByLabelText('Export analysis as JSON file')).toBeInTheDocument();
    });

    it('copy button shows feedback after clicking', async () => {
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn(() => Promise.resolve()),
        },
      });

      render(<ResultsCard response={baseResponse} />);
      const copyButton = screen.getByLabelText('Copy analysis summary to clipboard');
      
      expect(copyButton).toHaveTextContent('📋 Copy to Clipboard');
      
      await userEvent.click(copyButton);
      
      expect(copyButton).toHaveTextContent('✓ Copied!');
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    it('copied summary includes verdict, confidence, recommendation, and sources', async () => {
      const responseWithSources: AnalysisResponse = {
        ...baseResponse,
        sources: [
          {
            url: 'https://example.com/article',
            title: 'Example Article',
            snippet: 'This is an example',
            domain: 'example.com',
            why: 'Credible source',
          },
        ],
      };

      // Mock clipboard API
      let copiedText = '';
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn((text: string) => {
            copiedText = text;
            return Promise.resolve();
          }),
        },
      });

      render(<ResultsCard response={responseWithSources} />);
      const copyButton = screen.getByLabelText('Copy analysis summary to clipboard');
      
      await userEvent.click(copyButton);
      
      // Verify copied text includes required fields
      expect(copiedText).toContain('Status: Supported');
      expect(copiedText).toContain('Confidence: 85%');
      expect(copiedText).toContain('Recommendation:');
      expect(copiedText).toContain('This claim is supported by evidence.');
      expect(copiedText).toContain('Sources:');
      expect(copiedText).toContain('Example Article');
      expect(copiedText).toContain('example.com');
      expect(copiedText).toContain('https://example.com/article');
    });

    it('exported JSON is valid and properly formatted', async () => {
      let capturedBlob: Blob | undefined;
      const createObjectURL = vi.fn((blob: Blob) => {
        capturedBlob = blob;
        return 'blob:mock-url';
      });
      const revokeObjectURL = vi.fn();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).URL = {
        createObjectURL,
        revokeObjectURL,
      };

      render(<ResultsCard response={baseResponse} />);
      const exportButton = screen.getByLabelText('Export analysis as JSON file');
      
      await userEvent.click(exportButton);
      
      // Verify Blob was created with JSON content
      expect(createObjectURL).toHaveBeenCalled();
      expect(capturedBlob).toBeDefined();
      expect(capturedBlob!.type).toBe('application/json');
      
      // Verify cleanup
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('export JSON creates download with correct filename', async () => {
      // Mock URL methods
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).URL = {
        createObjectURL: vi.fn(() => 'blob:mock-url'),
        revokeObjectURL: vi.fn(),
      };

      // Track created link elements
      const createdLinks: HTMLAnchorElement[] = [];
      const originalAppendChild = document.body.appendChild.bind(document.body);
      const originalRemoveChild = document.body.removeChild.bind(document.body);
      
      vi.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => {
        if (node instanceof HTMLAnchorElement) {
          createdLinks.push(node);
          // Don't actually append to prevent navigation
          return node;
        }
        return originalAppendChild(node);
      });
      
      vi.spyOn(document.body, 'removeChild').mockImplementation((node: Node) => {
        if (node instanceof HTMLAnchorElement) {
          return node;
        }
        return originalRemoveChild(node);
      });

      render(<ResultsCard response={baseResponse} />);
      const exportButton = screen.getByLabelText('Export analysis as JSON file');
      
      await userEvent.click(exportButton);
      
      // Verify link was created with correct properties
      expect(createdLinks.length).toBe(1);
      const linkElement = createdLinks[0];
      expect(linkElement.download).toBe('analysis-123e4567-e89b-12d3-a456-426614174000.json');
      expect(linkElement.href).toContain('blob:mock-url');
    });
  });

  // Evidence quality filtering tests
  describe('Evidence quality filtering', () => {
    it('filters out homepage URLs', () => {
      const response: AnalysisResponse = {
        ...baseResponse,
        text_grounding: {
          sources: [
            {
              url: 'https://example.com/',
              title: 'Example Homepage',
              snippet: 'Homepage content',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.5,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 2,
            },
            {
              url: 'https://example.com/article',
              title: 'Specific Article',
              snippet: 'Article content',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.9,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 1,
            },
          ],
          queries: ['test query'],
          providerUsed: ['bing'],
          sourcesCount: 2,
          cacheHit: false,
          latencyMs: 100,
        },
      };

      render(<ResultsCard response={response} />);
      
      // Homepage should be filtered out
      expect(screen.queryByText('Example Homepage')).not.toBeInTheDocument();
      
      // Specific article should be shown
      expect(screen.getByText('Specific Article')).toBeInTheDocument();
    });

    it('filters out category page URLs', () => {
      const response: AnalysisResponse = {
        ...baseResponse,
        text_grounding: {
          sources: [
            {
              url: 'https://example.com/category/news',
              title: 'News Category',
              snippet: 'Category content',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.5,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 2,
            },
            {
              url: 'https://example.com/article',
              title: 'Specific Article',
              snippet: 'Article content',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.9,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 1,
            },
          ],
          queries: ['test query'],
          providerUsed: ['bing'],
          sourcesCount: 2,
          cacheHit: false,
          latencyMs: 100,
        },
      };

      render(<ResultsCard response={response} />);
      
      // Category page should be filtered out
      expect(screen.queryByText('News Category')).not.toBeInTheDocument();
      
      // Specific article should be shown
      expect(screen.getByText('Specific Article')).toBeInTheDocument();
    });

    it('filters out tag page URLs', () => {
      const response: AnalysisResponse = {
        ...baseResponse,
        text_grounding: {
          sources: [
            {
              url: 'https://example.com/tag/politics',
              title: 'Politics Tag',
              snippet: 'Tag content',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.5,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 2,
            },
            {
              url: 'https://example.com/article',
              title: 'Specific Article',
              snippet: 'Article content',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.9,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 1,
            },
          ],
          queries: ['test query'],
          providerUsed: ['bing'],
          sourcesCount: 2,
          cacheHit: false,
          latencyMs: 100,
        },
      };

      render(<ResultsCard response={response} />);
      
      // Tag page should be filtered out
      expect(screen.queryByText('Politics Tag')).not.toBeInTheDocument();
      
      // Specific article should be shown
      expect(screen.getByText('Specific Article')).toBeInTheDocument();
    });

    it('filters out search page URLs', () => {
      const response: AnalysisResponse = {
        ...baseResponse,
        text_grounding: {
          sources: [
            {
              url: 'https://example.com/search?q=test',
              title: 'Search Results',
              snippet: 'Search content',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.5,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 2,
            },
            {
              url: 'https://example.com/article',
              title: 'Specific Article',
              snippet: 'Article content',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.9,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 1,
            },
          ],
          queries: ['test query'],
          providerUsed: ['bing'],
          sourcesCount: 2,
          cacheHit: false,
          latencyMs: 100,
        },
      };

      render(<ResultsCard response={response} />);
      
      // Search page should be filtered out
      expect(screen.queryByText('Search Results')).not.toBeInTheDocument();
      
      // Specific article should be shown
      expect(screen.getByText('Specific Article')).toBeInTheDocument();
    });

    it('shows enhanced empty state when all sources are filtered out', () => {
      const response: AnalysisResponse = {
        ...baseResponse,
        text_grounding: {
          sources: [
            {
              url: 'https://example.com/',
              title: 'Homepage',
              snippet: 'Homepage content',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.5,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 2,
            },
            {
              url: 'https://example.com/category/news',
              title: 'Category Page',
              snippet: 'Category content',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.5,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 2,
            },
          ],
          queries: ['test query'],
          providerUsed: ['bing'],
          sourcesCount: 2,
          cacheHit: false,
          latencyMs: 100,
        },
      };

      render(<ResultsCard response={response} />);
      
      // Enhanced empty state should be shown
      expect(screen.getByText('No Usable Sources Found')).toBeInTheDocument();
      expect(screen.getByText(/generic pages \(homepages, category pages, or search results\)/)).toBeInTheDocument();
      expect(screen.getByText(/Provide a URL/)).toBeInTheDocument();
      expect(screen.getByText(/Rephrase your claim/)).toBeInTheDocument();
      expect(screen.getByText(/Check if the claim is too recent/)).toBeInTheDocument();
    });

    it('shows enhanced empty state with suggestions when no sources at all', () => {
      const response: AnalysisResponse = {
        ...baseResponse,
        text_grounding: {
          sources: [],
          queries: ['test query'],
          providerUsed: ['bing'],
          sourcesCount: 0,
          cacheHit: false,
          latencyMs: 100,
        },
      };

      render(<ResultsCard response={response} />);
      
      // Enhanced empty state should be shown
      expect(screen.getByText('No Evidence Sources Found')).toBeInTheDocument();
      expect(screen.getByText(/We couldn't find credible sources for this claim/)).toBeInTheDocument();
      expect(screen.getByText(/This could mean:/)).toBeInTheDocument();
      expect(screen.getByText(/The claim is too vague or general/)).toBeInTheDocument();
      expect(screen.getByText(/Providing a URL/)).toBeInTheDocument();
    });

    it('filters generic pages from legacy credible_sources', () => {
      const response: AnalysisResponse = {
        ...baseResponse,
        credible_sources: [
          {
            url: 'https://example.com/',
            title: 'Homepage',
            snippet: 'Homepage content',
            domain: 'example.com',
            why: 'Credible source',
          },
          {
            url: 'https://example.com/article',
            title: 'Specific Article',
            snippet: 'Article content',
            domain: 'example.com',
            why: 'Credible source',
          },
        ],
      };

      render(<ResultsCard response={response} />);
      
      // Homepage should be filtered out
      expect(screen.queryByText('Homepage')).not.toBeInTheDocument();
      
      // Specific article should be shown
      expect(screen.getByText('Specific Article')).toBeInTheDocument();
    });

    it('shows empty state when all legacy sources are filtered out', () => {
      const response: AnalysisResponse = {
        ...baseResponse,
        credible_sources: [
          {
            url: 'https://example.com/',
            title: 'Homepage',
            snippet: 'Homepage content',
            domain: 'example.com',
            why: 'Credible source',
          },
          {
            url: 'https://example.com/search?q=test',
            title: 'Search Results',
            snippet: 'Search content',
            domain: 'example.com',
            why: 'Credible source',
          },
        ],
      };

      render(<ResultsCard response={response} />);
      
      // Enhanced empty state should be shown
      expect(screen.getByText('No Usable Sources Found')).toBeInTheDocument();
      expect(screen.getByText(/generic pages/)).toBeInTheDocument();
    });

    it('does not filter out specific article URLs', () => {
      const response: AnalysisResponse = {
        ...baseResponse,
        text_grounding: {
          sources: [
            {
              url: 'https://example.com/2024/01/specific-article-title',
              title: 'Specific Article',
              snippet: 'Article content',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.9,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 1,
            },
            {
              url: 'https://example.com/news/breaking-story',
              title: 'Breaking Story',
              snippet: 'Story content',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.85,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 1,
            },
          ],
          queries: ['test query'],
          providerUsed: ['bing'],
          sourcesCount: 2,
          cacheHit: false,
          latencyMs: 100,
        },
      };

      render(<ResultsCard response={response} />);
      
      // Both specific articles should be shown
      expect(screen.getByText('Specific Article')).toBeInTheDocument();
      expect(screen.getByText('Breaking Story')).toBeInTheDocument();
    });

    it('filters based on title patterns for generic pages', () => {
      const response: AnalysisResponse = {
        ...baseResponse,
        text_grounding: {
          sources: [
            {
              url: 'https://example.com/some-path',
              title: 'Home Page',
              snippet: 'Homepage content',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.5,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 2,
            },
            {
              url: 'https://example.com/another-path',
              title: 'Latest News',
              snippet: 'Latest news content',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.5,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 2,
            },
            {
              url: 'https://example.com/article',
              title: 'Specific Article Title',
              snippet: 'Article content',
              publishDate: '2024-01-01T00:00:00Z',
              domain: 'example.com',
              score: 0.9,
              stance: 'supports',
              provider: 'bing',
              credibilityTier: 1,
            },
          ],
          queries: ['test query'],
          providerUsed: ['bing'],
          sourcesCount: 3,
          cacheHit: false,
          latencyMs: 100,
        },
      };

      render(<ResultsCard response={response} />);
      
      // Generic title pages should be filtered out
      expect(screen.queryByText('Home Page')).not.toBeInTheDocument();
      expect(screen.queryByText('Latest News')).not.toBeInTheDocument();
      
      // Specific article should be shown
      expect(screen.getByText('Specific Article Title')).toBeInTheDocument();
    });
  });
});
