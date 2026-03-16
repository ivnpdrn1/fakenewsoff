import { classifyStance } from './src/services/stanceClassifier';

const testCases = [
  {
    name: "Reuters",
    title: "Echoes of 2022? Markets look back to Russia play book for Middle East conflict",
    snippet: "World markets, rocked by a Middle East war that could trigger another inflationary shock, are looking back at the play book from Russia's invasion of...",
    domain: "reuters.com"
  },
  {
    name: "Chicago Catholic",
    title: "St Nicholas students lead service for Ukraine",
    snippet: "On the fourth anniversary of Russia's invasion of Ukraine, students at St. Nicholas Cathedral School, 2200 W. Rice St., lead a prayer service on Feb.",
    domain: "chicagocatholic.com"
  },
  {
    name: "BISI",
    title: "Russian Military Performance in the Ukraine War",
    snippet: "Russia's invasion of Ukraine in February 2022 revealed persistent structural weaknesses in logistics, coordination, and command despite reforms implem...",
    domain: "bisi.org.uk"
  }
];

const claim = "Russia invaded Ukraine in February 2022";

console.log(`\nTesting stance classification for claim: "${claim}"\n`);

for (const testCase of testCases) {
  console.log(`\n=== ${testCase.name} ===`);
  console.log(`Domain: ${testCase.domain}`);
  console.log(`Title: ${testCase.title}`);
  console.log(`Snippet: ${testCase.snippet.substring(0, 100)}...`);
  
  const result = classifyStance(claim, testCase.title, testCase.snippet, testCase.domain);
  
  console.log(`\nResult:`);
  console.log(`  Stance: ${result.stance}`);
  console.log(`  Confidence: ${result.confidence.toFixed(2)}`);
  console.log(`  Justification: ${result.justification || 'N/A'}`);
  
  if (result.stance === 'supports') {
    console.log(`  ✓ CORRECT - Classified as SUPPORTS`);
  } else {
    console.log(`  ✗ INCORRECT - Should be SUPPORTS, got ${result.stance.toUpperCase()}`);
  }
}
