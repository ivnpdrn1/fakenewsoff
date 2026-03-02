# Pre-Push Hook Documentation

## Current Hook

The repository has a pre-push hook at `.git/hooks/pre-push` that runs the backend test suite before allowing pushes.

## Requirements

- **Bash shell**: Git Bash on Windows, bash on Linux/macOS
- **Node.js and npm**: Must be installed and accessible

## Bypass Instructions

If you need to push without running tests (e.g., CI will handle it):

```bash
git push --no-verify
```

## Troubleshooting

- **On Windows**: Ensure you're using Git Bash (not CMD or PowerShell)
- **Hook doesn't run**: Check file has execute permissions:
  ```bash
  chmod +x .git/hooks/pre-push
  ```

## What the Hook Does

1. Runs `npm test -- --runInBand` in the backend directory
2. Runs `npm test -- --runInBand --detectOpenHandles` to check for resource leaks
3. Blocks push if either command fails
4. Provides bypass instructions on failure

## Correct Hook Implementation

**IMPORTANT:** Use `--` to properly forward arguments from npm to Jest.

Replace `.git/hooks/pre-push` with:

```bash
#!/bin/bash

# Git pre-push hook for FakeNewsOff backend
# Runs test suite and checks for open handles before allowing push
#
# REQUIREMENTS:
#   - Bash shell (Git Bash on Windows, bash on Linux/macOS)
#   - Node.js and npm installed
#
# BYPASS THIS HOOK:
#   If you need to push without running tests (e.g., CI will handle it):
#   git push --no-verify
#
# TROUBLESHOOTING:
#   - On Windows: Ensure you're using Git Bash (not CMD or PowerShell)
#   - If hook doesn't run: Check file has execute permissions (chmod +x .git/hooks/pre-push)

echo "Running backend test suite before push..."
cd backend || exit 1

# Run full test suite
# NOTE: Use -- to forward arguments from npm to Jest
echo "→ Running: npm test -- --runInBand"
npm test -- --runInBand
TEST_EXIT=$?

if [ $TEST_EXIT -ne 0 ]; then
  echo "❌ Tests failed. Push blocked."
  echo "💡 To bypass this hook: git push --no-verify"
  exit 1
fi

# Check for open handles
echo "→ Running: npm test -- --runInBand --detectOpenHandles"
npm test -- --runInBand --detectOpenHandles
HANDLES_EXIT=$?

if [ $HANDLES_EXIT -ne 0 ]; then
  echo "❌ Open handles detected or tests failed. Push blocked."
  echo "💡 To bypass this hook: git push --no-verify"
  exit 1
fi

echo "✅ All tests passed and no open handles. Push allowed."
exit 0
```
