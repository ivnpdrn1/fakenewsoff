#!/bin/bash

# Full Production Path Test - Cloud Runner
# Run this script in a cloud environment with working Serper connectivity

set -e

echo "================================================================================"
echo "FULL PRODUCTION PATH TEST - CLOUD RUNNER"
echo "================================================================================"
echo ""

# Check environment variables
echo "Checking environment variables..."
MISSING_VARS=()

if [ -z "$AWS_REGION" ]; then
    MISSING_VARS+=("AWS_REGION")
fi

if [ -z "$AWS_ACCESS_KEY_ID" ]; then
    MISSING_VARS+=("AWS_ACCESS_KEY_ID")
fi

if [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    MISSING_VARS+=("AWS_SECRET_ACCESS_KEY")
fi

if [ -z "$SERPER_API_KEY" ]; then
    MISSING_VARS+=("SERPER_API_KEY")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "ERROR: Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Please set these variables before running this script."
    exit 1
fi

echo "✓ All required environment variables are set"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

# Run the test
echo "Running full production path test..."
echo ""
npx tsx test-full-production-path.ts

echo ""
echo "================================================================================"
echo "TEST COMPLETE"
echo "================================================================================"
