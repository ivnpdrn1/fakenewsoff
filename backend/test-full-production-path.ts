/**
 * Full Production Path Integration Test
 * 
 * Tests the COMPLETE production pipeline with:
 * - LIVE Serper API retrieval (real-time news)
 * - REAL Bedrock/NOVA reasoning (actual LLM invocation)
 * - Real stance classification
 * - Real credibility scoring
 * 
 * This is the final validation that the verification logic fix works end-to-end.
 * 
 * REQUIREMENTS:
 * - AWS_REGION
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - BEDROCK_MODEL_ID (optional, defaults to amazon.nova-lite-v1:0)
 * - SERPER_API_KEY
 */

import { SerperClient } from './src/clients/serperClient';
import { generateQueries } from './src/utils/queryBuilder';
import { classifyStance } from './src/services/stanceClassifier';
import { assignCredibilityTier } from './src/services/sourceNormalizer';
import { synthesizeVerdict } from './src/services/novaClient';
import type { ClaimDecomposition, EvidenceBucket, FilteredEvidence } from './src/types/orchestration';

// ============================================================================
// Environment Verification
// ============================================================================

function checkEnvironment(): void {
  console.log('='.repeat(80));
  console.log('STEP 1: Environment Verification');
  console.log('='.repeat(80));
  console.log('');
  
  const required = [
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'SERPER_API_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  console.log('Checking required environment variables:');
  for (const key of required) {
    const isSet = !!process.env[key];
    console.log(`  ${key}: ${isSet ? '✅ SET' : '❌ NOT SET'}`);
  }
  
  console.log('');
  console.log('Optional environment variables:');
  console.log(`  BEDROCK_MODEL_ID: ${process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0 (default)'}`);
  console.log('');
  
  if (missing.length > 0) {
    console.error('❌ ERROR: Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('');
    console.error('Please set these variables before running this test.');
    console.error('Example:');
    console.error('  $env:AWS_REGION="us-east-1"');
    console.error('  $env:AWS_ACCESS_KEY_ID="your_key"');
    console.error('  $env:AWS_SECRET_ACCESS_KEY="your_secret"');
    console.error('  $env:SERPER_API_KEY="your_serper_key"');
    console.error('');
    process.exit(1);
  }
  
  console.log('✅ All required environment variables are set');
  console.log('');
}

// ============================================================================
// Main Test Function
// ============================================================================

async function runFullProductionPathTest(): Promise<void> {
  const startTime = Date.now();
  
  console.log('='.repeat(80));
  console.log('FULL PRODUCTION PATH INTEGRATION TEST');
  console.log('='.repeat(80));
  console.log('');
  console.log('This test validates the complete production pipeline:');
  console.log('  1. Query generation');
  console.log('  2. LIVE Serper retrieval');
  console.log('  3. Evidence normalization');
  console.log('  4. Stance classification');
  console.log('  5. Credibility scoring');
  console.log('  6. REAL Bedrock/NOVA reasoning');
  console.log('  7. Verdict synthesis');
  console.log('');
  
  // Step 1: Environment verification
  checkEnvironment();
  
  // Step 2: Claim input
  console.log('='.repeat(80));
  console.log('STEP 2: Claim Input');
  console.log('='.repeat(80));
  console.log('');
  
  const claim = 'Russia invaded Ukraine in February 2022';
  console.log(`Claim: "${claim}"`);
  console.log('');
  
  // Step 3: Query generation
  console.log('='.repeat(80));
  console.log('STEP 3: Query Generation');
  console.log('='.repeat(80));
  console.log('');
  
  const queryResult = generateQueries(claim);
  console.log(`Generated ${queryResult.queries.length} search queries:`);
  queryResult.queries.forEach((query, i) => {
    console.log(`  ${i + 1}. "${query}"`);
  });
  console.log('');
  console.log('Metadata:');
  console.log(`  Entities extracted: ${queryResult.metadata.entitiesExtracted.join(', ') || 'none'}`);
  console.log(`  Key phrases: ${queryResult.metadata.keyPhrasesExtracted.join(', ') || 'none'}`);
  console.log(`  Temporal keywords: ${queryResult.metadata.temporalKeywordsDetected.join(', ') || 'none'}`);
  console.log('');
  
  // Step 4: Live Serper retrieval
  console.log('='.repeat(80));
  console.log('STEP 4: Live Serper Retrieval');
  console.log('='.repeat(80));
  console.log('');
  console.log('⚠️  LIVE API CALL - This will use real Serper API credits');
  console.log('');
  
  const serperClient = new SerperClient();
  const allResults: Array<{
    query: string;
    results: any[];
  }> = [];
  
  // Retrieve for each query (limit to first 3 to save API calls)
  const queriesToRun = queryResult.queries.slice(0, 3);
  console.log(`Running ${queriesToRun.length} queries (limited to save API credits):`);
  console.log('');
  
  for (const query of queriesToRun) {
    console.log(`Query: "${query}"`);
    try {
      const response = await serperClient.searchNews({
        q: query,
        num: 10
      });
      
      console.log(`  ✅ Retrieved ${response.news.length} results`);
      console.log(`  Top domains: ${response.news.slice(0, 5).map(n => {
        try {
          const url = new URL(n.link);
          return url.hostname.replace(/^www\./, '');
        } catch {
          return 'unknown';
        }
      }).join(', ')}`);
      
      allResults.push({
        query,
        results: response.news
      });
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    console.log('');
  }
  
  // Aggregate and deduplicate results
  const seenUrls = new Set<string>();
  const aggregatedResults: any[] = [];
  
  for (const { results } of allResults) {
    for (const result of results) {
      if (!seenUrls.has(result.link)) {
        seenUrls.add(result.link);
        aggregatedResults.push(result);
      }
    }
  }
  
  console.log(`Total unique results: ${aggregatedResults.length}`);
  console.log('');
  
  // Step 5: Evidence normalization
  console.log('='.repeat(80));
  console.log('STEP 5: Evidence Normalization');
  console.log('='.repeat(80));
  console.log('');
  
  console.log(`Normalizing ${aggregatedResults.length} evidence sources:`);
  console.log('');
  
  const normalizedEvidence = aggregatedResults.slice(0, 10).map(result => {
    const url = result.link;
    let domain = 'unknown';
    try {
      const urlObj = new URL(url);
      domain = urlObj.hostname.replace(/^www\./, '');
    } catch {
      // ignore
    }
    
    return {
      url,
      domain,
      title: result.title,
      snippet: result.snippet,
      publishDate: result.date || new Date().toISOString()
    };
  });
  
  normalizedEvidence.forEach((ev, i) => {
    console.log(`${i + 1}. ${ev.domain}`);
    console.log(`   Title: ${ev.title.substring(0, 80)}${ev.title.length > 80 ? '...' : ''}`);
    console.log(`   Snippet: ${ev.snippet.substring(0, 100)}${ev.snippet.length > 100 ? '...' : ''}`);
    console.log(`   Date: ${ev.publishDate}`);
    console.log('');
  });
  
  // Step 6: Stance classification
  console.log('='.repeat(80));
  console.log('STEP 6: Stance Classification');
  console.log('='.repeat(80));
  console.log('');
  
  const stanceResults = normalizedEvidence.map(ev => {
    const stanceResult = classifyStance(claim, ev.title, ev.snippet);
    return {
      ...ev,
      stance: stanceResult.stance,
      stanceConfidence: stanceResult.confidence,
      stanceJustification: stanceResult.justification || ''
    };
  });
  
  console.log('Stance classification results:');
  console.log('');
  
  stanceResults.forEach((result, i) => {
    console.log(`${i + 1}. ${result.domain}`);
    console.log(`   Stance: ${result.stance}`);
    console.log(`   Confidence: ${result.stanceConfidence.toFixed(2)}`);
    if (result.stanceJustification) {
      console.log(`   Justification: ${result.stanceJustification}`);
    }
    console.log('');
  });
  
  const supportingCount = stanceResults.filter(r => r.stance === 'supports').length;
  const contradictingCount = stanceResults.filter(r => r.stance === 'contradicts').length;
  const mentionsCount = stanceResults.filter(r => r.stance === 'mentions').length;
  const unclearCount = stanceResults.filter(r => r.stance === 'unclear').length;
  
  console.log('Stance distribution:');
  console.log(`  Supporting: ${supportingCount}`);
  console.log(`  Contradicting: ${contradictingCount}`);
  console.log(`  Mentions: ${mentionsCount}`);
  console.log(`  Unclear: ${unclearCount}`);
  console.log('');
  
  // Step 7: Credibility scoring
  console.log('='.repeat(80));
  console.log('STEP 7: Credibility Scoring');
  console.log('='.repeat(80));
  console.log('');
  
  const credibilityResults = stanceResults.map(result => {
    const tier = assignCredibilityTier(result.domain);
    const isTrusted = tier === 1;
    return {
      ...result,
      credibilityTier: tier,
      isTrusted
    };
  });
  
  console.log('Credibility scoring results:');
  console.log('');
  
  credibilityResults.forEach((result, i) => {
    console.log(`${i + 1}. ${result.domain}`);
    console.log(`   Credibility Tier: ${result.credibilityTier}`);
    console.log(`   Trusted: ${result.isTrusted ? 'Yes' : 'No'}`);
    console.log('');
  });
  
  const trustedCount = credibilityResults.filter(r => r.isTrusted).length;
  console.log(`Trusted domains found: ${trustedCount}`);
  console.log('');
  
  // Prepare evidence buckets
  const supportingEvidence: FilteredEvidence[] = credibilityResults
    .filter(r => r.stance === 'supports')
    .map((r, i) => ({
      url: r.url,
      title: r.title,
      snippet: r.snippet,
      domain: r.domain,
      publishDate: r.publishDate,
      score: 0.90 - (i * 0.05),
      stance: r.stance,
      stanceJustification: r.stanceJustification,
      provider: 'serper',
      credibilityTier: r.credibilityTier,
      sourceClass: r.isTrusted ? 'major_international' : 'regional_media',
      authorityLevel: r.isTrusted ? 'high' : 'medium',
      pageType: 'article',
      qualityScore: {
        claimRelevance: 0.9,
        specificity: 0.85,
        directness: 0.9,
        freshness: 0.8,
        sourceAuthority: r.isTrusted ? 1.0 : 0.6,
        primaryWeight: 0.7,
        contradictionValue: 0.0,
        corroborationCount: 0.8,
        accessibility: 0.85,
        geographicRelevance: 0.9,
        composite: 0.85
      },
      retrievedByQuery: claim,
      retrievedInPass: 1,
      passed: true
    }));
  
  const contradictingEvidence: FilteredEvidence[] = credibilityResults
    .filter(r => r.stance === 'contradicts')
    .map((r, i) => ({
      url: r.url,
      title: r.title,
      snippet: r.snippet,
      domain: r.domain,
      publishDate: r.publishDate,
      score: 0.85 - (i * 0.05),
      stance: r.stance,
      stanceJustification: r.stanceJustification,
      provider: 'serper',
      credibilityTier: r.credibilityTier,
      sourceClass: r.isTrusted ? 'major_international' : 'regional_media',
      authorityLevel: r.isTrusted ? 'high' : 'medium',
      pageType: 'article',
      qualityScore: {
        claimRelevance: 0.9,
        specificity: 0.85,
        directness: 0.9,
        freshness: 0.8,
        sourceAuthority: r.isTrusted ? 1.0 : 0.6,
        primaryWeight: 0.7,
        contradictionValue: 0.9,
        corroborationCount: 0.0,
        accessibility: 0.85,
        geographicRelevance: 0.9,
        composite: 0.85
      },
      retrievedByQuery: claim,
      retrievedInPass: 1,
      passed: true
    }));
  
  const contextEvidence: FilteredEvidence[] = credibilityResults
    .filter(r => r.stance === 'mentions')
    .map((r, i) => ({
      url: r.url,
      title: r.title,
      snippet: r.snippet,
      domain: r.domain,
      publishDate: r.publishDate,
      score: 0.60 - (i * 0.05),
      stance: r.stance,
      stanceJustification: r.stanceJustification,
      provider: 'serper',
      credibilityTier: r.credibilityTier,
      sourceClass: 'regional_media',
      authorityLevel: 'medium',
      pageType: 'article',
      qualityScore: {
        claimRelevance: 0.6,
        specificity: 0.5,
        directness: 0.4,
        freshness: 0.7,
        sourceAuthority: 0.5,
        primaryWeight: 0.0,
        contradictionValue: 0.0,
        corroborationCount: 0.0,
        accessibility: 0.7,
        geographicRelevance: 0.6,
        composite: 0.55
      },
      retrievedByQuery: claim,
      retrievedInPass: 1,
      passed: true
    }));
  
  // Step 8: Real Bedrock/NOVA reasoning
  console.log('='.repeat(80));
  console.log('STEP 8: Real Bedrock/NOVA Reasoning');
  console.log('='.repeat(80));
  console.log('');
  console.log('⚠️  LIVE API CALL - This will invoke real AWS Bedrock/NOVA');
  console.log('');
  
  const decomposition: ClaimDecomposition = {
    originalClaim: claim,
    subclaims: [
      { type: 'actor', text: 'Russia', importance: 1.0 },
      { type: 'action', text: 'invaded', importance: 1.0 },
      { type: 'object', text: 'Ukraine', importance: 1.0 },
      { type: 'time', text: 'in February 2022', importance: 0.9 }
    ],
    timestamp: new Date().toISOString()
  };
  
  const evidenceBuckets: EvidenceBucket = {
    supporting: supportingEvidence,
    contradicting: contradictingEvidence,
    context: contextEvidence,
    rejected: []
  };
  
  console.log(`Model: ${process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0'}`);
  console.log(`Supporting evidence: ${supportingEvidence.length}`);
  console.log(`Contradicting evidence: ${contradictingEvidence.length}`);
  console.log(`Context evidence: ${contextEvidence.length}`);
  console.log('');
  console.log('Invoking Bedrock...');
  console.log('');
  
  let verdict;
  let bedrockSuccess = false;
  
  try {
    verdict = await synthesizeVerdict(claim, decomposition, evidenceBuckets);
    bedrockSuccess = true;
    console.log('✅ Bedrock invocation SUCCEEDED');
  } catch (error) {
    console.log('❌ Bedrock invocation FAILED');
    console.log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    verdict = null;
  }
  
  console.log('');
  
  // Step 9: Validation checks
  console.log('='.repeat(80));
  console.log('STEP 9: Validation Checks');
  console.log('='.repeat(80));
  console.log('');
  
  const validations: Array<{ check: string; passed: boolean; details: string }> = [];
  
  // A. Live retrieval returned at least 2 usable sources
  const usableSourcesCheck = aggregatedResults.length >= 2;
  validations.push({
    check: 'A. Live retrieval returned at least 2 usable sources',
    passed: usableSourcesCheck,
    details: `Retrieved ${aggregatedResults.length} sources`
  });
  
  // B. Supporting evidence count > 0
  const supportingCheck = supportingEvidence.length > 0;
  validations.push({
    check: 'B. Supporting evidence count > 0',
    passed: supportingCheck,
    details: `Found ${supportingEvidence.length} supporting sources`
  });
  
  // C. At least one trusted domain present
  const trustedCheck = trustedCount > 0;
  validations.push({
    check: 'C. At least one trusted domain present',
    passed: trustedCheck,
    details: `Found ${trustedCount} trusted domains`
  });
  
  // D. Bedrock invocation succeeded
  validations.push({
    check: 'D. Bedrock invocation succeeded',
    passed: bedrockSuccess,
    details: bedrockSuccess ? 'Bedrock call completed' : 'Bedrock call failed'
  });
  
  // E. Final verdict is not low-confidence unverified
  let verdictCheck = false;
  let verdictDetails = 'No verdict (Bedrock failed)';
  if (verdict) {
    const isLowConfidenceUnverified = verdict.classification === 'unverified' && verdict.confidence < 0.5;
    verdictCheck = !isLowConfidenceUnverified;
    verdictDetails = `Classification: ${verdict.classification}, Confidence: ${(verdict.confidence * 100).toFixed(0)}%`;
  }
  validations.push({
    check: 'E. Final verdict is not low-confidence unverified',
    passed: verdictCheck,
    details: verdictDetails
  });
  
  // F. Target expected behavior
  // Print validation results
  validations.forEach(v => {
    const status = v.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${v.check}`);
    console.log(`         ${v.details}`);
    console.log('');
  });
  
  const allPassed = validations.every(v => v.passed);
  
  // Step 10: Final summary
  console.log('='.repeat(80));
  console.log('STEP 10: Final Summary');
  console.log('='.repeat(80));
  console.log('');
  
  const duration = Date.now() - startTime;
  
  console.log('Test Results:');
  console.log(`  Total sources retrieved: ${aggregatedResults.length}`);
  console.log(`  Supporting: ${supportingEvidence.length}`);
  console.log(`  Contradicting: ${contradictingEvidence.length}`);
  console.log(`  Context: ${contextEvidence.length}`);
  console.log(`  Trusted domains found: ${trustedCount}`);
  console.log('');
  
  if (verdict) {
    console.log('Final Bedrock Verdict:');
    console.log(`  Classification: ${verdict.classification}`);
    console.log(`  Confidence: ${(verdict.confidence * 100).toFixed(0)}%`);
    console.log(`  Rationale: ${verdict.rationale}`);
    console.log('');
  }
  
  console.log(`Total test duration: ${duration}ms`);
  console.log('');
  
  console.log('='.repeat(80));
  if (allPassed) {
    console.log('✅ ALL VALIDATIONS PASSED');
    console.log('='.repeat(80));
    console.log('');
    console.log('The verification logic fix is working correctly in the full production path.');
    console.log('');
    process.exit(0);
  } else {
    console.log('❌ SOME VALIDATIONS FAILED');
    console.log('='.repeat(80));
    console.log('');
    console.log('Please review the validation results above.');
    console.log('');
    process.exit(1);
  }
}

// Run the test
runFullProductionPathTest().catch(error => {
  console.error('');
  console.error('='.repeat(80));
  console.error('UNEXPECTED ERROR');
  console.error('='.repeat(80));
  console.error('');
  console.error(error);
  console.error('');
  process.exit(1);
});
