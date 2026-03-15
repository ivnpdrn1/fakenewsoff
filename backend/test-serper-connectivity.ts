/**
 * Minimal Serper Connectivity Test
 * 
 * Tests basic connectivity to Serper API to diagnose network issues.
 * Uses the same request method as production code.
 */

console.log('='.repeat(80));
console.log('SERPER CONNECTIVITY TEST');
console.log('='.repeat(80));
console.log();

// Check environment
const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SERPER_TIMEOUT_MS = parseInt(process.env.SERPER_TIMEOUT_MS || '10000', 10);

console.log('Environment Check:');
console.log(`  SERPER_API_KEY: ${SERPER_API_KEY ? '✓ Present (' + SERPER_API_KEY.length + ' chars)' : '✗ Missing'}`);
console.log(`  SERPER_TIMEOUT_MS: ${SERPER_TIMEOUT_MS}ms`);
console.log();

if (!SERPER_API_KEY) {
  console.log('ERROR: SERPER_API_KEY environment variable is required');
  process.exit(1);
}

// Test configuration
const TEST_URL = 'https://google.serper.dev/news';
const TEST_QUERY = 'test';

console.log('Test Configuration:');
console.log(`  URL: ${TEST_URL}`);
console.log(`  Method: POST`);
console.log(`  Query: "${TEST_QUERY}"`);
console.log(`  Timeout: ${SERPER_TIMEOUT_MS}ms`);
console.log();

async function testSerperConnectivity() {
  console.log('='.repeat(80));
  console.log('TEST 1: Basic Fetch Connectivity');
  console.log('='.repeat(80));
  console.log();

  try {
    console.log('Attempting fetch request...');
    const startTime = Date.now();

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`  ⚠ Timeout triggered after ${SERPER_TIMEOUT_MS}ms`);
      controller.abort();
    }, SERPER_TIMEOUT_MS);

    const requestBody = {
      q: TEST_QUERY,
      num: 1,
    };

    console.log(`  Request body: ${JSON.stringify(requestBody)}`);
    console.log(`  Headers: X-API-KEY (${SERPER_API_KEY!.length} chars), Content-Type: application/json`);
    console.log();

    const response = await fetch(TEST_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'X-API-KEY': SERPER_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    clearTimeout(timeoutId);

    const latency = Date.now() - startTime;

    console.log('✓ Fetch succeeded');
    console.log(`  Latency: ${latency}ms`);
    console.log(`  Status: ${response.status} ${response.statusText}`);
    console.log(`  OK: ${response.ok}`);
    console.log(`  Headers:`);
    response.headers.forEach((value, key) => {
      console.log(`    ${key}: ${value}`);
    });
    console.log();

    if (response.ok) {
      const data = await response.json();
      console.log('✓ Response parsed successfully');
      console.log(`  News count: ${data.news?.length || 0}`);
      if (data.news && data.news.length > 0) {
        console.log(`  Sample article: ${data.news[0].title}`);
      }
      console.log();
      console.log('='.repeat(80));
      console.log('✓ ALL TESTS PASSED');
      console.log('='.repeat(80));
      console.log();
      console.log('Serper connectivity is working correctly.');
      process.exit(0);
    } else {
      const errorText = await response.text();
      console.log('✗ Response not OK');
      console.log(`  Error body: ${errorText}`);
      console.log();
      console.log('='.repeat(80));
      console.log('✗ TEST FAILED');
      console.log('='.repeat(80));
      console.log();
      console.log('Serper API returned an error response.');
      console.log('Possible causes:');
      console.log('  - Invalid API key');
      console.log('  - Rate limit exceeded');
      console.log('  - API service issue');
      process.exit(1);
    }
  } catch (error) {
    console.log();
    console.log('✗ Fetch failed');
    console.log();

    if (error instanceof Error) {
      console.log(`  Error name: ${error.name}`);
      console.log(`  Error message: ${error.message}`);
      
      if (error.name === 'AbortError') {
        console.log();
        console.log('='.repeat(80));
        console.log('✗ TEST FAILED: TIMEOUT');
        console.log('='.repeat(80));
        console.log();
        console.log('The request timed out.');
        console.log('Possible causes:');
        console.log('  - Slow network connection');
        console.log('  - Firewall blocking outbound HTTPS');
        console.log('  - DNS resolution failure');
        console.log('  - Serper API is down');
        process.exit(1);
      }

      // Check for specific error types
      const errorDetails = error as any;
      console.log(`  Error cause: ${errorDetails.cause || 'N/A'}`);
      console.log(`  Error code: ${errorDetails.code || 'N/A'}`);
      console.log(`  Error errno: ${errorDetails.errno || 'N/A'}`);
      console.log(`  Error syscall: ${errorDetails.syscall || 'N/A'}`);
      
      if (error.stack) {
        console.log();
        console.log('  Stack trace:');
        console.log(error.stack.split('\n').map(line => `    ${line}`).join('\n'));
      }
    } else {
      console.log(`  Unknown error: ${error}`);
    }

    console.log();
    console.log('='.repeat(80));
    console.log('✗ TEST FAILED: NETWORK ERROR');
    console.log('='.repeat(80));
    console.log();
    console.log('Failed to connect to Serper API.');
    console.log();
    console.log('Possible causes:');
    console.log('  1. DNS Resolution Failure');
    console.log('     - Cannot resolve google.serper.dev');
    console.log('     - Check DNS settings');
    console.log();
    console.log('  2. TLS/Certificate Issue');
    console.log('     - Certificate validation failed');
    console.log('     - Check system certificates');
    console.log();
    console.log('  3. Proxy/Firewall Issue');
    console.log('     - Corporate proxy blocking HTTPS');
    console.log('     - Firewall blocking port 443');
    console.log('     - Check proxy settings');
    console.log();
    console.log('  4. Network Connectivity Issue');
    console.log('     - No internet connection');
    console.log('     - Network adapter issue');
    console.log();
    console.log('Debugging steps:');
    console.log('  1. Test DNS: nslookup google.serper.dev');
    console.log('  2. Test HTTPS: curl -v https://google.serper.dev');
    console.log('  3. Check proxy: echo $HTTP_PROXY $HTTPS_PROXY');
    console.log('  4. Test with different network (e.g., mobile hotspot)');
    console.log();

    process.exit(1);
  }
}

// Run the test
testSerperConnectivity();
