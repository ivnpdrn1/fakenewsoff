/**
 * Load Lite Test
 * 
 * Lightweight load test for demo validation
 * 
 * NOTE: This test requires valid AWS credentials to be configured.
 * In DEMO_MODE, it will still attempt to call AWS services but with mock data.
 * For a true load test, ensure AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY are set.
 */

import { extractClaims } from '../src/services/novaClient';

interface LoadResult {
  totalTime: number;
  operations: number;
  errors: number;
  latencies: number[];
  p95: number;
  p99: number;
}

async function runLoadTest(): Promise<LoadResult> {
  const latencies: number[] = [];
  let errors = 0;
  const startTime = Date.now();
  
  console.log('Starting load test...');
  console.log('DEMO_MODE:', process.env.DEMO_MODE);
  console.log('AWS_REGION:', process.env.AWS_REGION || 'NOT SET');
  console.log('');
  
  // Check if AWS credentials are available
  if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID) {
    console.warn('⚠️  AWS credentials not configured. Load test will fail.');
    console.warn('   Set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY to run this test.');
    console.warn('');
  }
  
  // 20 sequential analyze operations
  for (let i = 0; i < 20; i++) {
    const opStart = Date.now();
    
    try {
      await extractClaims(`Test claim ${i}`, 'Test Title');
      const latency = Date.now() - opStart;
      latencies.push(latency);
      
      if ((i + 1) % 5 === 0) {
        console.log(`Completed ${i + 1}/20 operations`);
      }
    } catch (error) {
      errors++;
      if (errors === 1) {
        // Only log first error in detail
        console.error(`Operation ${i + 1} failed:`, error);
      }
    }
  }
  
  const totalTime = Date.now() - startTime;
  
  // Calculate percentiles
  latencies.sort((a, b) => a - b);
  const p95Index = Math.floor(latencies.length * 0.95);
  const p99Index = Math.floor(latencies.length * 0.99);
  
  return {
    totalTime,
    operations: 20,
    errors,
    latencies,
    p95: latencies[p95Index] || 0,
    p99: latencies[p99Index] || 0
  };
}

async function main() {
  console.log('='.repeat(60));
  console.log('FakeNewsOff Load Lite Test');
  console.log('='.repeat(60));
  console.log('');
  
  const result = await runLoadTest();
  
  console.log('');
  console.log('='.repeat(60));
  console.log('Results:');
  console.log('='.repeat(60));
  console.log(`Total Time: ${result.totalTime}ms`);
  console.log(`Operations: ${result.operations}`);
  console.log(`Errors: ${result.errors}`);
  
  if (result.latencies.length > 0) {
    console.log(`P95 Latency: ${result.p95}ms`);
    console.log(`P99 Latency: ${result.p99}ms`);
    console.log(`Avg Latency: ${Math.round(result.latencies.reduce((a, b) => a + b, 0) / result.latencies.length)}ms`);
  } else {
    console.log('No successful operations to calculate latencies');
  }
  
  // Thresholds
  const p95Target = 800;
  const errorTarget = 0;
  
  console.log('');
  console.log('='.repeat(60));
  console.log('Thresholds:');
  console.log('='.repeat(60));
  
  if (result.latencies.length > 0) {
    console.log(`P95 < ${p95Target}ms: ${result.p95 < p95Target ? '✓ PASS' : '✗ FAIL'}`);
  } else {
    console.log(`P95 < ${p95Target}ms: N/A (no successful operations)`);
  }
  
  console.log(`Errors = ${errorTarget}: ${result.errors === errorTarget ? '✓ PASS' : '✗ FAIL'}`);
  
  // Only fail if AWS credentials are configured but test still failed
  if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID) {
    console.log('');
    console.log('⚠️  Skipping failure due to missing AWS credentials');
    console.log('   This is expected for local development without AWS setup');
    process.exit(0);
  }
  
  if (result.errors > errorTarget || (result.latencies.length > 0 && result.p95 >= p95Target)) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Load test failed:', error);
  process.exit(1);
});
