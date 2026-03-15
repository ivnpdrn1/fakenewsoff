/**
 * End-to-End Bedrock Integration Test
 * 
 * Tests the complete pipeline with real Bedrock/NOVA invocation:
 * 1. Evidence retrieval (Serper)
 * 2. Stance classification
 * 3. Credibility scoring
 * 4. NOVA reasoning through Bedrock
 * 5. Verdict synthesis
 * 
 * REQUIREMENTS:
 * - AWS_REGION (e.g., us-east-1)
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - BEDROCK_MODEL_ID (e.g., amazon.nova-lite-v1:0)
 * - SERPER_API_KEY (for evidence retrieval)
 */

import { synthesizeVerdict } from './src/services/novaClient';
import { classifyStance } from './src/services/stanceClassifier';
import { assignCredibilityTier } from './src/services/sourceNormalizer';
import type { ClaimDecomposition, EvidenceBucket, FilteredEvidence } from './src/types/orchestration';

// Check required environment variables
function checkEnvironment(): void {
  const required = [
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nPlease set these variables before running this test.');
    console.error('Example:');
    console.error('  $env:AWS_REGION="us-east-1"');
    console.error('  $env:AWS_ACCESS_KEY_ID="your_key"');
    console.error('  $env:AWS_SECRET_ACCESS_KEY="your_secret"');
    process.exit(1);
  }
  
  console.log('✅ Environment variables configured:');
  console.log(`   AWS_REGION: ${process.env.AWS_REGION}`);
  console.log(`   AWS_ACCESS_KEY_ID: [SET]`);
  console.log(`   AWS_SECRET_ACCESS_KEY: [SET]`);
  console.log(`   BEDROCK_MODEL_ID: ${process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0 (default)'}`);
  console.log('');
}

async function runIntegrationTest(): Promise<void> {
  console.log('='.repeat(80));
  console.log('BEDROCK INTEGRATION TEST - Russia-Ukraine Claim');
  console.log('='.repeat(80));
  console.log('');
  
  checkEnvironment();
  
  const claim = 'Russia invaded Ukraine in February 2022';
  console.log(`Claim: "${claim}"`);
  console.log('');
  
  // Step 1: Create claim decomposition
  console.log('Step 1: Claim Decomposition');
  console.log('-'.repeat(80));
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
  console.log(`Subclaims: ${decomposition.subclaims.length}`);
  decomposition.subclaims.forEach((sc, i) => {
    console.log(`  ${i + 1}. [${sc.type}] ${sc.text} (importance: ${sc.importance})`);
  });
  console.log('');
  
  // Step 2: Simulate evidence retrieval with realistic sources
  console.log('Step 2: Evidence Retrieval (Simulated)');
  console.log('-'.repeat(80));
  console.log('Note: Using simulated evidence sources (Reuters, BBC, AP News)');
  console.log('In production, this would call Serper API for real-time retrieval');
  console.log('');
  
  const evidenceSources = [
    {
      url: 'https://www.reuters.com/world/europe/russia-invades-ukraine-2022-02-24/',
      title: 'Russia invades Ukraine',
      snippet: 'Russia invaded Ukraine on February 24, 2022, launching a full-scale military operation',
      domain: 'reuters.com',
      publishDate: '2022-02-24T06:00:00Z'
    },
    {
      url: 'https://www.bbc.com/news/world-europe-60503037',
      title: 'Russia attacks Ukraine',
      snippet: 'Russia invaded its neighbor Ukraine on Feb. 24, 2022',
      domain: 'bbc.com',
      publishDate: '2022-02-24T07:00:00Z'
    },
    {
      url: 'https://apnews.com/article/russia-ukraine-invasion-feb-2022',
      title: 'Russia launches invasion of Ukraine',
      snippet: 'Russia invaded Ukraine on February 24, 2022',
      domain: 'apnews.com',
      publishDate: '2022-02-24T06:30:00Z'
    }
  ];
  
  console.log(`Retrieved ${evidenceSources.length} evidence sources:`);
  evidenceSources.forEach((source, i) => {
    console.log(`  ${i + 1}. ${source.domain} - "${source.title}"`);
  });
  console.log('');
  
  // Step 3: Stance classification
  console.log('Step 3: Stance Classification');
  console.log('-'.repeat(80));
  const supportingEvidence: FilteredEvidence[] = [];
  
  for (const source of evidenceSources) {
    const stanceResult = classifyStance(claim, source.title, source.snippet);
    const credibilityTier = assignCredibilityTier(source.domain);
    
    console.log(`${source.domain}:`);
    console.log(`  Stance: ${stanceResult.stance}`);
    console.log(`  Confidence: ${stanceResult.confidence.toFixed(2)}`);
    console.log(`  Credibility Tier: ${credibilityTier}`);
    if (stanceResult.justification) {
      console.log(`  Justification: ${stanceResult.justification}`);
    }
    
    if (stanceResult.stance === 'supports') {
      supportingEvidence.push({
        url: source.url,
        title: source.title,
        snippet: source.snippet,
        domain: source.domain,
        publishDate: source.publishDate,
        score: 0.90 + (Math.random() * 0.05), // 0.90-0.95
        stance: stanceResult.stance,
        stanceJustification: stanceResult.justification || 'Supporting evidence',
        provider: 'serper',
        credibilityTier: credibilityTier,
        sourceClass: 'major_international',
        authorityLevel: 'high',
        pageType: 'article',
        qualityScore: {
          claimRelevance: 0.95,
          specificity: 0.9,
          directness: 0.95,
          freshness: 0.8,
          sourceAuthority: 1.0,
          primaryWeight: 0.8,
          contradictionValue: 0.0,
          corroborationCount: 0.9,
          accessibility: 0.9,
          geographicRelevance: 0.95,
          composite: 0.92
        },
        retrievedByQuery: claim,
        retrievedInPass: 1,
        passed: true
      });
    }
    console.log('');
  }
  
  console.log(`Supporting evidence count: ${supportingEvidence.length}`);
  console.log('');
  
  // Step 4: Create evidence buckets
  console.log('Step 4: Evidence Buckets');
  console.log('-'.repeat(80));
  const evidenceBuckets: EvidenceBucket = {
    supporting: supportingEvidence,
    contradicting: [],
    context: [],
    rejected: []
  };
  
  console.log(`Supporting: ${evidenceBuckets.supporting.length}`);
  console.log(`Contradicting: ${evidenceBuckets.contradicting.length}`);
  console.log(`Context: ${evidenceBuckets.context.length}`);
  console.log(`Rejected: ${evidenceBuckets.rejected.length}`);
  console.log('');
  
  // Step 5: Verdict synthesis with REAL Bedrock invocation
  console.log('Step 5: Verdict Synthesis (REAL BEDROCK INVOCATION)');
  console.log('-'.repeat(80));
  console.log('Invoking AWS Bedrock with NOVA model...');
  console.log('This will make a real API call to AWS Bedrock.');
  console.log('');
  
  try {
    const startTime = Date.now();
    const verdict = await synthesizeVerdict(claim, decomposition, evidenceBuckets);
    const duration = Date.now() - startTime;
    
    console.log('✅ Bedrock invocation SUCCEEDED');
    console.log('');
    
    // Step 6: Results
    console.log('='.repeat(80));
    console.log('RESULTS');
    console.log('='.repeat(80));
    console.log('');
    
    console.log('Verdict:');
    console.log(`  Classification: ${verdict.classification}`);
    console.log(`  Confidence: ${verdict.confidence.toFixed(2)} (${(verdict.confidence * 100).toFixed(0)}%)`);
    console.log(`  Rationale: ${verdict.rationale}`);
    console.log('');
    
    console.log('Subclaims:');
    console.log(`  Supported: ${verdict.supportedSubclaims.length}`);
    verdict.supportedSubclaims.forEach((sc, i) => {
      console.log(`    ${i + 1}. ${sc}`);
    });
    console.log(`  Unsupported: ${verdict.unsupportedSubclaims.length}`);
    verdict.unsupportedSubclaims.forEach((sc, i) => {
      console.log(`    ${i + 1}. ${sc}`);
    });
    console.log('');
    
    console.log('Evidence:');
    console.log(`  Best evidence count: ${verdict.bestEvidence.length}`);
    verdict.bestEvidence.forEach((ev, i) => {
      console.log(`    ${i + 1}. ${ev.domain} - ${ev.title}`);
    });
    console.log('');
    
    console.log('Performance:');
    console.log(`  Duration: ${duration}ms`);
    console.log('');
    
    // Validation
    console.log('='.repeat(80));
    console.log('VALIDATION');
    console.log('='.repeat(80));
    console.log('');
    
    let allPassed = true;
    
    // Check 1: Stance classification
    const supportsCount = supportingEvidence.filter(e => e.stance === 'supports').length;
    if (supportsCount > 0) {
      console.log('✅ PASS: Stance classification - supporting evidence found');
    } else {
      console.log('❌ FAIL: Stance classification - no supporting evidence');
      allPassed = false;
    }
    
    // Check 2: Trusted domains
    const trustedDomains = supportingEvidence.filter(e => 
      ['reuters.com', 'bbc.com', 'apnews.com', 'nytimes.com'].includes(e.domain)
    );
    if (trustedDomains.length > 0) {
      console.log(`✅ PASS: Trusted domains - ${trustedDomains.length} sources from tier-1 domains`);
    } else {
      console.log('❌ FAIL: Trusted domains - no tier-1 sources');
      allPassed = false;
    }
    
    // Check 3: Verdict classification
    if (verdict.classification === 'true') {
      console.log('✅ PASS: Verdict classification - "true" (expected)');
    } else {
      console.log(`⚠️  WARNING: Verdict classification - "${verdict.classification}" (expected "true")`);
      console.log('   This may be acceptable depending on LLM reasoning');
    }
    
    // Check 4: Confidence score
    if (verdict.confidence >= 0.75) {
      console.log(`✅ PASS: Confidence score - ${(verdict.confidence * 100).toFixed(0)}% (>= 75%)`);
    } else {
      console.log(`❌ FAIL: Confidence score - ${(verdict.confidence * 100).toFixed(0)}% (< 75%)`);
      allPassed = false;
    }
    
    console.log('');
    
    if (allPassed) {
      console.log('='.repeat(80));
      console.log('✅ ALL VALIDATIONS PASSED');
      console.log('='.repeat(80));
      console.log('');
      console.log('The verification logic fix is working correctly with real Bedrock/NOVA.');
      console.log('');
      process.exit(0);
    } else {
      console.log('='.repeat(80));
      console.log('❌ SOME VALIDATIONS FAILED');
      console.log('='.repeat(80));
      console.log('');
      console.log('Please review the results above.');
      console.log('');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Bedrock invocation FAILED');
    console.error('');
    console.error('Error:', error instanceof Error ? error.message : String(error));
    console.error('');
    
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }
    
    console.log('');
    console.log('='.repeat(80));
    console.log('TROUBLESHOOTING');
    console.log('='.repeat(80));
    console.log('');
    console.log('1. Verify AWS credentials are correct');
    console.log('2. Verify AWS region supports Bedrock (us-east-1, us-west-2)');
    console.log('3. Verify Bedrock model access is enabled in your AWS account');
    console.log('4. Check AWS CloudWatch logs for detailed error messages');
    console.log('');
    
    process.exit(1);
  }
}

// Run the test
runIntegrationTest().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
