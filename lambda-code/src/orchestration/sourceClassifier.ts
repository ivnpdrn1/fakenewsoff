/**
 * Source Classifier
 *
 * Classifies evidence sources by source class and authority level.
 * Uses domain-based classification for known sources and content-based
 * classification for unknown sources.
 */

import type { NormalizedSourceWithStance } from '../types/grounding';
import type {
  ClassifiedSource,
  SourceClass,
  AuthorityLevel,
  PageType,
} from '../types/orchestration';

/**
 * Known domain classifications
 */
const DOMAIN_CLASSIFICATIONS: Record<string, { sourceClass: SourceClass; authorityLevel: AuthorityLevel }> = {
  // Major international news
  'reuters.com': { sourceClass: 'major_international', authorityLevel: 'high' },
  'apnews.com': { sourceClass: 'major_international', authorityLevel: 'high' },
  'bbc.com': { sourceClass: 'major_international', authorityLevel: 'high' },
  'bbc.co.uk': { sourceClass: 'major_international', authorityLevel: 'high' },
  'cnn.com': { sourceClass: 'major_international', authorityLevel: 'high' },
  'nytimes.com': { sourceClass: 'major_international', authorityLevel: 'high' },
  'washingtonpost.com': { sourceClass: 'major_international', authorityLevel: 'high' },
  'theguardian.com': { sourceClass: 'major_international', authorityLevel: 'high' },
  'aljazeera.com': { sourceClass: 'major_international', authorityLevel: 'high' },
  'france24.com': { sourceClass: 'major_international', authorityLevel: 'high' },
  
  // Official government
  'gov': { sourceClass: 'official_government', authorityLevel: 'high' },
  'mil': { sourceClass: 'official_government', authorityLevel: 'high' },
  'state.gov': { sourceClass: 'official_government', authorityLevel: 'high' },
  'whitehouse.gov': { sourceClass: 'official_government', authorityLevel: 'high' },
  'defense.gov': { sourceClass: 'official_government', authorityLevel: 'high' },
  
  // International organizations
  'un.org': { sourceClass: 'international_org', authorityLevel: 'high' },
  'who.int': { sourceClass: 'international_org', authorityLevel: 'high' },
  'nato.int': { sourceClass: 'international_org', authorityLevel: 'high' },
  'worldbank.org': { sourceClass: 'international_org', authorityLevel: 'high' },
  'imf.org': { sourceClass: 'international_org', authorityLevel: 'high' },
  
  // Fact checkers
  'snopes.com': { sourceClass: 'fact_checker', authorityLevel: 'high' },
  'factcheck.org': { sourceClass: 'fact_checker', authorityLevel: 'high' },
  'politifact.com': { sourceClass: 'fact_checker', authorityLevel: 'high' },
  'fullfact.org': { sourceClass: 'fact_checker', authorityLevel: 'high' },
  'afp.com': { sourceClass: 'fact_checker', authorityLevel: 'high' },
};

/**
 * Source classifier service
 */
export class SourceClassifier {
  /**
   * Classify evidence source
   *
   * @param source - Source to classify
   * @param pageType - Page type from evidence filter
   * @returns Classified source with source class and authority level
   */
  classify(source: NormalizedSourceWithStance, pageType: PageType): ClassifiedSource {
    // Try domain-based classification first
    const domainClassification = this.classifyByDomain(source.domain);
    
    if (domainClassification) {
      return {
        ...source,
        sourceClass: domainClassification.sourceClass,
        authorityLevel: domainClassification.authorityLevel,
        pageType,
      };
    }
    
    // Fall back to content-based classification
    return this.classifyByContent(source, pageType);
  }

  /**
   * Classify by domain (known sources)
   */
  private classifyByDomain(domain: string): { sourceClass: SourceClass; authorityLevel: AuthorityLevel } | null {
    // Check exact match
    if (DOMAIN_CLASSIFICATIONS[domain]) {
      return DOMAIN_CLASSIFICATIONS[domain];
    }
    
    // Check TLD patterns (.gov, .mil)
    if (domain.endsWith('.gov') || domain.endsWith('.gov.uk') || domain.endsWith('.gov.au')) {
      return { sourceClass: 'official_government', authorityLevel: 'high' };
    }
    
    if (domain.endsWith('.mil')) {
      return { sourceClass: 'official_government', authorityLevel: 'high' };
    }
    
    // Check subdomain patterns
    for (const [knownDomain, classification] of Object.entries(DOMAIN_CLASSIFICATIONS)) {
      if (domain.endsWith(`.${knownDomain}`) || domain === knownDomain) {
        return classification;
      }
    }
    
    return null;
  }

  /**
   * Classify by content (unknown sources)
   */
  private classifyByContent(source: NormalizedSourceWithStance, pageType: PageType): ClassifiedSource {
    // Use page type to infer source class
    let sourceClass: SourceClass;
    let authorityLevel: AuthorityLevel;
    
    switch (pageType) {
      case 'official_statement':
        sourceClass = 'official_government';
        authorityLevel = 'high';
        break;
        
      case 'press_release':
        sourceClass = 'primary_source';
        authorityLevel = 'high';
        break;
        
      case 'transcript':
        sourceClass = 'primary_source';
        authorityLevel = 'high';
        break;
        
      case 'fact_check':
        sourceClass = 'fact_checker';
        authorityLevel = 'high';
        break;
        
      case 'article':
      default:
        // Default to regional media with medium authority
        sourceClass = 'regional_media';
        authorityLevel = this.inferAuthorityFromCredibilityTier(source.credibilityTier);
        break;
    }
    
    return {
      ...source,
      sourceClass,
      authorityLevel,
      pageType,
    };
  }

  /**
   * Infer authority level from credibility tier
   */
  private inferAuthorityFromCredibilityTier(tier: 1 | 2 | 3): AuthorityLevel {
    switch (tier) {
      case 1:
        return 'high';
      case 2:
        return 'medium';
      case 3:
        return 'low';
    }
  }
}
