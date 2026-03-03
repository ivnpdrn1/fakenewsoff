/**
 * Demo Mode Utilities
 * 
 * Provides deterministic responses for hackathon demos.
 * Enable with: DEMO_MODE=true environment variable
 * 
 * Use cases:
 * - Jury presentations with predictable output
 * - Testing without AWS credentials
 * - Offline development
 */

import type { AnalysisResponse, StatusLabel, MisinformationType } from './schemaValidators';

/**
 * Check if demo mode is enabled
 */
export const isDemoMode = (): boolean => {
  return process.env.DEMO_MODE === 'true';
};

/**
 * Demo response templates for different claim types
 */
export type DemoClaimType = 'supported' | 'disputed' | 'unverified' | 'manipulated' | 'biased';

/**
 * Get deterministic demo response for a claim type
 * 
 * @param claimType - Type of claim to generate response for
 * @param requestId - Optional request ID (defaults to generated UUID)
 * @returns Complete AnalysisResponse object
 */
export const getDemoResponse = (
  claimType: DemoClaimType,
  requestId?: string
): AnalysisResponse => {
  const timestamp = new Date().toISOString();
  const baseRequestId = requestId || crypto.randomUUID();

  const responses: Record<DemoClaimType, AnalysisResponse> = {
    supported: {
      request_id: baseRequestId,
      status_label: 'Supported' as StatusLabel,
      confidence_score: 85,
      recommendation: 'This claim is well-supported by credible sources. Multiple peer-reviewed studies and authoritative sources confirm the information.',
      progress_stages: [
        { stage: 'Claim Extraction', status: 'completed', timestamp },
        { stage: 'Source Retrieval', status: 'completed', timestamp },
        { stage: 'Evidence Synthesis', status: 'completed', timestamp },
        { stage: 'Label Determination', status: 'completed', timestamp }
      ],
      sources: [
        {
          url: 'https://example.com/credible-source-1',
          title: 'Peer-Reviewed Research Study',
          snippet: 'Multiple studies confirm this finding with high confidence...',
          why: 'Peer-reviewed research from reputable institution',
          domain: 'example.com'
        },
        {
          url: 'https://example.org/authoritative-source',
          title: 'Expert Analysis',
          snippet: 'Leading experts in the field agree on this conclusion...',
          why: 'Expert consensus from authoritative source',
          domain: 'example.org'
        }
      ],
      media_risk: null,
      misinformation_type: null,
      sift_guidance: 'Stop: Verified by credible sources. Investigate: Multiple peer-reviewed sources confirm. Find: Consensus among experts. Trace: Original research is well-documented.',
      timestamp
    },

    disputed: {
      request_id: baseRequestId,
      status_label: 'Disputed' as StatusLabel,
      confidence_score: 75,
      recommendation: 'This claim is disputed by credible sources and fact-checkers. Multiple authoritative sources contradict the information presented.',
      progress_stages: [
        { stage: 'Claim Extraction', status: 'completed', timestamp },
        { stage: 'Source Retrieval', status: 'completed', timestamp },
        { stage: 'Evidence Synthesis', status: 'completed', timestamp },
        { stage: 'Label Determination', status: 'completed', timestamp }
      ],
      sources: [
        {
          url: 'https://factcheck.example.com/debunk',
          title: 'Fact Check: Claim Debunked',
          snippet: 'This claim has been thoroughly debunked by multiple fact-checkers...',
          why: 'Professional fact-checking organization',
          domain: 'factcheck.example.com'
        },
        {
          url: 'https://science.example.org/correction',
          title: 'Scientific Correction',
          snippet: 'Current scientific evidence contradicts this claim...',
          why: 'Scientific consensus contradicts claim',
          domain: 'science.example.org'
        }
      ],
      media_risk: 'medium' as const,
      misinformation_type: 'Misleading Content' as MisinformationType,
      sift_guidance: 'Stop: Do not share. Investigate: Multiple fact-checkers dispute this. Find: Seek authoritative sources. Trace: Original claim lacks credible sourcing.',
      timestamp
    },

    unverified: {
      request_id: baseRequestId,
      status_label: 'Unverified' as StatusLabel,
      confidence_score: 30,
      recommendation: 'Unable to verify this claim with credible sources. Apply the SIFT framework before sharing.',
      progress_stages: [
        { stage: 'Claim Extraction', status: 'completed', timestamp },
        { stage: 'Source Retrieval', status: 'completed', timestamp },
        { stage: 'Evidence Synthesis', status: 'completed', timestamp },
        { stage: 'Label Determination', status: 'completed', timestamp }
      ],
      sources: [],
      media_risk: null,
      misinformation_type: null,
      sift_guidance: 'Stop: Unverified claim. Investigate: Source credibility unknown. Find: Seek better coverage from credible sources. Trace: Cannot locate original authoritative source.',
      timestamp
    },

    manipulated: {
      request_id: baseRequestId,
      status_label: 'Manipulated' as StatusLabel,
      confidence_score: 90,
      recommendation: 'Evidence suggests this content has been manipulated or fabricated. Do not share.',
      progress_stages: [
        { stage: 'Claim Extraction', status: 'completed', timestamp },
        { stage: 'Source Retrieval', status: 'completed', timestamp },
        { stage: 'Evidence Synthesis', status: 'completed', timestamp },
        { stage: 'Label Determination', status: 'completed', timestamp }
      ],
      sources: [
        {
          url: 'https://verification.example.com/analysis',
          title: 'Media Forensics Analysis',
          snippet: 'Forensic analysis reveals signs of digital manipulation...',
          why: 'Professional media verification service',
          domain: 'verification.example.com'
        }
      ],
      media_risk: 'high' as const,
      misinformation_type: 'Manipulated Content' as MisinformationType,
      sift_guidance: 'Stop: Do not share manipulated content. Investigate: Forensic analysis confirms manipulation. Find: Seek original unaltered source. Trace: Content has been digitally altered.',
      timestamp
    },

    biased: {
      request_id: baseRequestId,
      status_label: 'Biased framing' as StatusLabel,
      confidence_score: 70,
      recommendation: 'Content is factually accurate but uses selective framing or bias. Read better coverage for balanced perspective.',
      progress_stages: [
        { stage: 'Claim Extraction', status: 'completed', timestamp },
        { stage: 'Source Retrieval', status: 'completed', timestamp },
        { stage: 'Evidence Synthesis', status: 'completed', timestamp },
        { stage: 'Label Determination', status: 'completed', timestamp }
      ],
      sources: [
        {
          url: 'https://balanced.example.com/analysis',
          title: 'Balanced Coverage',
          snippet: 'While the facts are accurate, the framing is selective...',
          why: 'Provides balanced perspective',
          domain: 'balanced.example.com'
        }
      ],
      media_risk: 'low' as const,
      misinformation_type: 'Misleading Content' as MisinformationType,
      sift_guidance: 'Stop: Consider the framing. Investigate: Facts are accurate but presentation is biased. Find: Read multiple perspectives. Trace: Seek more balanced coverage.',
      timestamp
    }
  };

  return responses[claimType];
};

/**
 * Get demo response based on content keywords
 * 
 * Analyzes content text to determine appropriate demo response type.
 * Useful for automated demos that respond to different inputs.
 * 
 * @param content - Content text to analyze
 * @returns Appropriate demo response
 */
export const getDemoResponseForContent = (content: string): AnalysisResponse => {
  const lowerContent = content.toLowerCase();

  // Check for keywords to determine response type
  if (lowerContent.includes('fake') || lowerContent.includes('manipulated') || lowerContent.includes('photoshop')) {
    return getDemoResponse('manipulated');
  }
  
  if (lowerContent.includes('disputed') || lowerContent.includes('false') || lowerContent.includes('debunk')) {
    return getDemoResponse('disputed');
  }
  
  if (lowerContent.includes('bias') || lowerContent.includes('framing') || lowerContent.includes('selective')) {
    return getDemoResponse('biased');
  }
  
  if (lowerContent.includes('verified') || lowerContent.includes('confirmed') || lowerContent.includes('proven')) {
    return getDemoResponse('supported');
  }

  // Default to unverified
  return getDemoResponse('unverified');
};

/**
 * Demo mode configuration
 */
export interface DemoConfig {
  enabled: boolean;
  responseDelay?: number; // Simulate API delay in ms
  logRequests?: boolean; // Log demo requests to console
}

/**
 * Get demo mode configuration
 */
export const getDemoConfig = (): DemoConfig => {
  return {
    enabled: isDemoMode(),
    responseDelay: parseInt(process.env.DEMO_DELAY || '500', 10),
    logRequests: process.env.DEMO_LOG === 'true'
  };
};

/**
 * Simulate API delay for demo mode
 * 
 * @param ms - Milliseconds to delay (defaults to config value)
 */
export const demoDelay = async (ms?: number): Promise<void> => {
  const config = getDemoConfig();
  const delayMs = ms ?? config.responseDelay ?? 500;
  
  if (config.enabled && delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
};
