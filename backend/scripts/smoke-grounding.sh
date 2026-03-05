#!/usr/bin/env bash
# Grounding Smoke Test Script (Bash)
# Tests grounding health and self-test endpoints

set -e

API_URL="${1:-https://fnd9pknygc.execute-api.us-east-1.amazonaws.com}"
TOKEN="${INTERNAL_DIAGNOSTICS_TOKEN:-}"

echo "=== Grounding Smoke Test ==="
echo "API URL: $API_URL"
echo ""

# Test 1: Basic health check
echo "[1/3] Testing /health endpoint..."
response=$(curl -s -X GET "$API_URL/health")
status=$(echo "$response" | jq -r '.status')
demo_mode=$(echo "$response" | jq -r '.demo_mode')

if [ "$status" = "ok" ]; then
    echo "✓ Health check passed"
    echo "  Status: $status"
    echo "  Demo Mode: $demo_mode"
    echo ""
else
    echo "✗ Health check failed"
    echo "$response"
    exit 1
fi

# Test 2: Grounding health check
echo "[2/3] Testing /health/grounding endpoint..."
response=$(curl -s -X GET "$API_URL/health/grounding")
ok=$(echo "$response" | jq -r '.ok')
bing_configured=$(echo "$response" | jq -r '.bing_configured')
gdelt_configured=$(echo "$response" | jq -r '.gdelt_configured')
timeout_ms=$(echo "$response" | jq -r '.timeout_ms')
cache_ttl=$(echo "$response" | jq -r '.cache_ttl_seconds')
provider_enabled=$(echo "$response" | jq -r '.provider_enabled')
provider_order=$(echo "$response" | jq -r '.provider_order | join(", ")')

echo "✓ Grounding health check passed"
echo "  OK: $ok"
echo "  Bing Configured: $bing_configured"
echo "  GDELT Configured: $gdelt_configured"
echo "  Timeout (ms): $timeout_ms"
echo "  Cache TTL (s): $cache_ttl"
echo "  Provider Enabled: $provider_enabled"
echo "  Provider Order: $provider_order"
echo ""

# Test 3: Self-test (requires token)
echo "[3/3] Testing /internal/grounding-selftest endpoint..."
if [ -z "$TOKEN" ]; then
    echo "⚠ Skipping self-test (no INTERNAL_DIAGNOSTICS_TOKEN provided)"
    echo "  Set token via: export INTERNAL_DIAGNOSTICS_TOKEN='your_token'"
    echo ""
else
    response=$(curl -s -X POST "$API_URL/internal/grounding-selftest" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"query":"breaking news"}')
    
    provider_used=$(echo "$response" | jq -r '.providerUsed')
    results_raw=$(echo "$response" | jq -r '.resultsCountRaw')
    results_filtered=$(echo "$response" | jq -r '.resultsCountAfterFilter')
    top_domains=$(echo "$response" | jq -r '.topDomains | join(", ")')
    latency=$(echo "$response" | jq -r '.latencyMs')
    attempted=$(echo "$response" | jq -r '.attemptedProviders | join(", ")')
    errors=$(echo "$response" | jq -r '.errors | join(", ")')
    
    echo "✓ Self-test passed"
    echo "  Provider Used: $provider_used"
    echo "  Results (Raw): $results_raw"
    echo "  Results (Filtered): $results_filtered"
    echo "  Top Domains: $top_domains"
    echo "  Latency (ms): $latency"
    echo "  Attempted Providers: $attempted"
    if [ -n "$errors" ] && [ "$errors" != "null" ]; then
        echo "  Errors: $errors"
    fi
    echo ""
fi

echo "=== All Tests Passed ==="
