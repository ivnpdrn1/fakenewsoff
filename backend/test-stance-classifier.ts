/**
 * Manual test script for stance classifier
 * Tests the Russia-Ukraine claim with various evidence formats
 */

import { classifyStance } from './src/services/stanceClassifier';

console.log('Testing Stance Classifier with Russia-Ukraine Claim\n');
console.log('='.repeat(60));

const claim = 'Russia invaded Ukraine in February 2022';

const testCases = [
  {
    name: 'Reuters - Exact date',
    title: 'Russia invades Ukraine',
    snippet: 'Russia invaded Ukraine on February 24, 2022, launching a full-scale military operation'
  },
  {
    name: 'BBC - Abbreviated month with period',
    title: 'Russia attacks Ukraine',
    snippet: 'Russia invaded its neighbor Ukraine on Feb. 24, 2022'
  },
  {
    name: 'AP News - Exact date',
    title: 'Russia launches invasion of Ukraine',
    snippet: 'Russia invaded Ukraine on February 24, 2022'
  },
  {
    name: 'Contextual only (should NOT support)',
    title: 'Ukraine Conflict Background',
    snippet: 'The Ukraine conflict has historical roots in regional tensions'
  },
  {
    name: 'Different year (should NOT support)',
    title: 'Historical Conflict',
    snippet: 'Russia invaded Ukraine in February 2014'
  }
];

for (const testCase of testCases) {
  console.log(`\n${testCase.name}:`);
  console.log(`  Title: ${testCase.title}`);
  console.log(`  Snippet: ${testCase.snippet}`);
  
  const result = classifyStance(claim, testCase.title, testCase.snippet);
  
  console.log(`  Result:`);
  console.log(`    Stance: ${result.stance}`);
  console.log(`    Confidence: ${result.confidence.toFixed(2)}`);
  if (result.justification) {
    console.log(`    Justification: ${result.justification}`);
  }
  
  // Validation
  if (testCase.name.includes('should NOT support')) {
    if (result.stance === 'supports') {
      console.log(`    ❌ FAIL: Should NOT be classified as supports`);
    } else {
      console.log(`    ✅ PASS: Correctly NOT classified as supports`);
    }
  } else if (testCase.name.includes('Contextual')) {
    if (result.stance === 'supports') {
      console.log(`    ❌ FAIL: Contextual evidence should NOT be classified as supports`);
    } else {
      console.log(`    ✅ PASS: Correctly NOT classified as supports`);
    }
  } else {
    if (result.stance === 'supports' && result.confidence >= 0.7) {
      console.log(`    ✅ PASS: Correctly classified as supports with high confidence`);
    } else {
      console.log(`    ❌ FAIL: Should be classified as supports with confidence >= 0.7`);
    }
  }
}

console.log('\n' + '='.repeat(60));
console.log('Test complete\n');
