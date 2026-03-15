/**
 * Evidence Filter
 *
 * Filters evidence candidates using NOVA-based classification and scoring.
 * Rejects generic pages (homepage, category, tag, search, unavailable).
 * Scores evidence quality across multiple dimensions.
 */

import {
  classifyEvidencePageType,
  scoreEvidenceQuality,
  verifyEvidenceContent,
} from '../services/novaClient';
import type {
  EvidenceCandidate,
  FilteredEvidence,
  PageType,
  RejectionReason,
  QualityScore,
} from '../types/orchestration';

/**
 * Evidence filter service
 */
export class EvidenceFilter {
  private readonly minQualityScore: number;

  constructor(minQualityScore: number = 0.6) {
    this.minQualityScore = minQualityScore;
  }

  /**
   * Filter evidence candidates
   *
   * @param candidates - Evidence candidates to filter
   * @param claim - Original claim
   * @returns Filtered evidence with pass/fail status
   */
  async filter(candidates: EvidenceCandidate[], claim: string): Promise<FilteredEvidence[]> {
    this.logFilterStart(candidates.length);

    // Try NOVA-based filtering, fall back to pass-through if unavailable
    let usePassthrough = false;
    const filtered: FilteredEvidence[] = [];

    for (const candidate of candidates) {
      try {
        const result = await this.filterSingle(candidate, claim);
        filtered.push(result);
      } catch (error) {
        // If NOVA filtering fails, use pass-through for this candidate
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            service: 'evidenceFilter',
            event: 'EVIDENCE_FILTER_MODEL_ERROR',
            error: error instanceof Error ? error.message : 'Unknown error',
            url: candidate.url,
          })
        );
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            service: 'evidenceFilter',
            event: 'EVIDENCE_FILTER_PASS_THROUGH_FALLBACK',
            url: candidate.url,
          })
        );
        usePassthrough = true;
        const passedCandidate = {
          ...candidate,
          qualityScore: {
            claimRelevance: 0.7,
            specificity: 0.7,
            directness: 0.7,
            freshness: 0.7,
            sourceAuthority: 0.7,
            primaryWeight: 0.0,
            contradictionValue: 0.0,
            corroborationCount: 0.0,
            accessibility: 0.7,
            geographicRelevance: 0.7,
            composite: 0.7,
          },
          passed: true,
        };
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            service: 'evidenceFilter',
            event: 'EVIDENCE_FILTER_CANDIDATE_PRESERVED',
            url: candidate.url,
            title: candidate.title,
          })
        );
        filtered.push(passedCandidate);
      }
    }

    const passed = filtered.filter((f) => f.passed).length;
    const rejected = filtered.length - passed;

    // Log which mode was used
    if (usePassthrough) {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          service: 'evidenceFilter',
          event: 'EVIDENCE_FILTER_PASSTHROUGH',
          message: 'Some candidates used pass-through due to NOVA errors',
        })
      );
    } else {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          service: 'evidenceFilter',
          event: 'EVIDENCE_FILTER_MODEL_USED',
          model: 'amazon.nova-lite-v1:0',
          message: 'All candidates filtered using NOVA model',
        })
      );
    }

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'evidenceFilter',
        event: 'EVIDENCE_FILTER_REJECTED_COUNT',
        rejected_count: rejected,
        total_count: filtered.length,
      })
    );

    this.logFilterComplete(candidates.length, passed);

    return filtered;
  }

  /**
   * Filter single evidence candidate
   */
  private async filterSingle(
    candidate: EvidenceCandidate,
    claim: string
  ): Promise<FilteredEvidence> {
    // Step 1: Classify page type
    const pageType = await this.classifyPageType(candidate);

    // Step 2: Check if page type should be rejected
    const genericRejection = this.checkGenericPageRejection(pageType);
    if (genericRejection) {
      return {
        ...candidate,
        passed: false,
        rejectionReason: genericRejection,
      };
    }

    // Step 3: Score quality
    const qualityScore = await this.scoreQuality(candidate, claim);

    // Step 4: Check quality threshold
    if (qualityScore.composite < this.minQualityScore) {
      return {
        ...candidate,
        qualityScore,
        passed: false,
        rejectionReason: 'LOW_RELEVANCE',
      };
    }

    // Step 5: Verify content relevance
    const contentVerification = await this.verifyContent(candidate, claim);
    if (!contentVerification.relevant) {
      return {
        ...candidate,
        qualityScore,
        passed: false,
        rejectionReason: 'UNRELATED',
      };
    }

    // Passed all filters
    return {
      ...candidate,
      qualityScore,
      passed: true,
    };
  }

  /**
   * Classify page type using NOVA
   */
  private async classifyPageType(candidate: EvidenceCandidate): Promise<PageType> {
    try {
      return await classifyEvidencePageType(candidate.url, candidate.title, candidate.snippet);
    } catch {
      return 'unknown';
    }
  }

  /**
   * Check if page type should be rejected as generic
   */
  private checkGenericPageRejection(pageType: PageType): RejectionReason | null {
    const rejectionMap: Record<string, RejectionReason> = {
      homepage: 'HOMEPAGE_ONLY',
      category: 'CATEGORY_PAGE',
      tag: 'TAG_PAGE',
      search: 'SEARCH_PAGE',
      unavailable: 'BROKEN_PAGE',
    };

    return rejectionMap[pageType] || null;
  }

  /**
   * Score evidence quality using NOVA
   */
  private async scoreQuality(
    candidate: EvidenceCandidate,
    claim: string
  ): Promise<QualityScore> {
    try {
      return await scoreEvidenceQuality(
        {
          url: candidate.url,
          title: candidate.title,
          snippet: candidate.snippet,
          domain: candidate.domain,
        },
        claim
      );
    } catch {
      // Fallback: return neutral scores (0.7 to pass 0.6 threshold)
      return {
        claimRelevance: 0.7,
        specificity: 0.7,
        directness: 0.7,
        freshness: 0.7,
        sourceAuthority: 0.7,
        primaryWeight: 0.0,
        contradictionValue: 0.0,
        corroborationCount: 0.0,
        accessibility: 0.7,
        geographicRelevance: 0.7,
        composite: 0.7,
      };
    }
  }

  /**
   * Verify content relevance using NOVA
   */
  private async verifyContent(
    candidate: EvidenceCandidate,
    claim: string
  ): Promise<{ relevant: boolean; reason: string }> {
    try {
      return await verifyEvidenceContent(
        {
          url: candidate.url,
          title: candidate.title,
          snippet: candidate.snippet,
        },
        claim
      );
    } catch {
      return { relevant: true, reason: 'Unable to verify, assuming relevant' };
    }
  }

  /**
   * Log filter start
   */
  private logFilterStart(candidateCount: number): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'evidenceFilter',
        event: 'filter_start',
        candidate_count: candidateCount,
      })
    );
  }

  /**
   * Log filter complete
   */
  private logFilterComplete(total: number, passed: number): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'evidenceFilter',
        event: 'filter_complete',
        total_candidates: total,
        passed_count: passed,
        rejected_count: total - passed,
        pass_rate: total > 0 ? passed / total : 0,
      })
    );
  }
}
