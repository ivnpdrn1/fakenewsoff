// Quick test to verify pattern matching with different apostrophe types

const testCases = [
  {
    name: "Reuters snippet",
    text: "World markets, rocked by a Middle East war that could trigger another inflationary shock, are looking back at the play book from Russia's invasion of...",
    claim: "Russia invaded Ukraine in February 2022"
  },
  {
    name: "Chicago Catholic snippet",
    text: "On the fourth anniversary of Russia's invasion of Ukraine, students at St. Nicholas Cathedral School, 2200 W. Rice St., lead a prayer service on Feb.",
    claim: "Russia invaded Ukraine in February 2022"
  },
  {
    name: "BISI snippet",
    text: "Russia's invasion of Ukraine in February 2022 revealed persistent structural weaknesses in logistics, coordination, and command despite reforms implem...",
    claim: "Russia invaded Ukraine in February 2022"
  }
];

const patterns = [
  "russia's invasion",  // straight apostrophe
  "russia's invasion",  // curly apostrophe
  "russian invasion"
];

for (const testCase of testCases) {
  const textLower = testCase.text.toLowerCase();
  console.log(`\n${testCase.name}:`);
  console.log(`Text: ${textLower.substring(0, 100)}...`);
  
  // Check apostrophe character
  const apostropheMatch = textLower.match(/russia.s invasion/);
  if (apostropheMatch) {
    const apostropheChar = apostropheMatch[0].charAt(6);
    console.log(`Apostrophe character code: ${apostropheChar.charCodeAt(0)} (${apostropheChar})`);
  }
  
  for (const pattern of patterns) {
    const matches = textLower.includes(pattern);
    console.log(`  Pattern "${pattern}" (char code ${pattern.charCodeAt(6)}): ${matches ? 'MATCH' : 'NO MATCH'}`);
  }
  
  // Check for ukraine
  console.log(`  Contains "ukraine": ${textLower.includes('ukraine')}`);
}
