#!/bin/bash
# Smoke Test Script for Iterative Evidence Orchestration
# Tests all critical paths after feature flag enablement

set -e

echo "=== Orchestration Pipeline Smoke Tests ==="
echo ""

# Configuration
API_URL="https://fnd9pknygc.execute-api.us-east-1.amazonaws.com"
TESTS_PASSED=0
TESTS_FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Helper function to test endpoint
test_endpoint() {
    local test_name="$1"
    local payload="$2"
    local validator="$3"
    
    echo -n "[${test_name}]"
    
    response=$(curl -s -X POST "${API_URL}/analyze" \
        -H "Content-Type: application/json" \
        -d "${payload}" 2>&1)
    
    if [ $? -ne 0 ]; then
        echo -e " ${RED}✗ ERROR${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
    
    if eval "${validator}"; then
        echo -e " ${GREEN}✓ PASS${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e " ${RED}✗ FAIL${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo -e "${GRAY}Testing API: ${API_URL}${NC}"
echo ""

# Test 1: Health Check
echo -n "[Test 1: Health Check]"
health_response=$(curl -s "${API_URL}/health")
if echo "$health_response" | jq -e '.status == "healthy"' > /dev/null 2>&1; then
    echo -e " ${GREEN}✓ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e " ${RED}✗ FAIL${NC}"
    ((TESTS_FAILED++))
fi

# Test 2: Text-Only Claim (Orchestration Active)
test_endpoint "Test 2: Text-Only Claim (Orchestration)" \
    '{"text": "The Eiffel Tower is in Paris"}' \
    'echo "$response" | jq -e ".orchestration.enabled == true and .status_label != null" > /dev/null 2>&1'

# Test 3: Simple Factual Claim
test_endpoint "Test 3: Simple Factual Claim" \
    '{"text": "Water boils at 100 degrees Celsius at sea level"}' \
    'echo "$response" | jq -e ".orchestration.enabled == true and (.text_grounding.sources | length) > 0" > /dev/null 2>&1'

# Test 4: Claim with URL (Legacy Pipeline)
test_endpoint "Test 4: Claim with URL (Legacy)" \
    '{"text": "This is fake", "url": "https://example.com"}' \
    'echo "$response" | jq -e ".orchestration == null and .status_label != null" > /dev/null 2>&1'

# Test 5: Response Schema Validation
test_endpoint "Test 5: Response Schema Validation" \
    '{"text": "The sky is blue"}' \
    'echo "$response" | jq -e ".status_label != null and .confidence_score != null and .rationale != null and .orchestration.enabled == true" > /dev/null 2>&1'

# Test 6: Source Quality Check
test_endpoint "Test 6: Source Quality Check" \
    '{"text": "Climate change is affecting global temperatures"}' \
    'echo "$response" | jq -e "(.text_grounding.sources | length) > 0 and .text_grounding.sources[0].url != null" > /dev/null 2>&1'

# Summary
echo ""
echo -e "${CYAN}=== Test Summary ===${NC}"
echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
