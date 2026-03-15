/**
 * Manual test script for credibility tier assignment
 * Verifies trusted domains receive correct credibility scores
 */

import { assignCredibilityTier } from './src/services/sourceNormalizer';

console.log('Testing Credibility Tier Assignment\n');
console.log('='.repeat(60));

const testDomains = [
  { domain: 'reuters.com', expected: 1, name: 'Reuters' },
  { domain: 'bbc.com', expected: 1, name: 'BBC' },
  { domain: 'bbc.co.uk', expected: 1, name: 'BBC UK' },
  { domain: 'apnews.com', expected: 1, name: 'AP News' },
  { domain: 'nytimes.com', expected: 1, name: 'New York Times' },
  { domain: 'washingtonpost.com', expected: 1, name: 'Washington Post' },
  { domain: 'cnn.com', expected: 2, name: 'CNN' },
  { domain: 'foxnews.com', expected: 2, name: 'Fox News' },
  { domain: 'example.com', expected: 3, name: 'Unknown Domain' }
];

for (const test of testDomains) {
  const tier = assignCredibilityTier(test.domain);
  const pass = tier === test.expected;
  const status = pass ? '✅ PASS' : '❌ FAIL';
  
  console.log(`${status} ${test.name} (${test.domain}): Tier ${tier} (expected ${test.expected})`);
}

console.log('\n' + '='.repeat(60));
console.log('Test complete\n');
