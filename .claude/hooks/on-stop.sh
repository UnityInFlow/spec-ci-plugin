#!/bin/bash
cd "$CLAUDE_PROJECT_DIR" || exit 0

# TypeScript checks
if [ -f "package.json" ]; then
  TEST_OUTPUT=$(npm test 2>&1)
  if [ $? -ne 0 ]; then
    echo "TypeScript tests failed:" >&2
    echo "$TEST_OUTPUT" >&2
    exit 2
  fi

  LINT_OUTPUT=$(npm run lint 2>&1)
  if [ $? -ne 0 ]; then
    echo "TypeScript errors:" >&2
    echo "$LINT_OUTPUT" >&2
    exit 2
  fi

  FORMAT_OUTPUT=$(npm run format 2>&1)
  if [ $? -ne 0 ]; then
    echo "Prettier formatting issues:" >&2
    echo "$FORMAT_OUTPUT" >&2
    exit 2
  fi
fi

# Kotlin checks
if [ -f "build.gradle.kts" ]; then
  GRADLE_OUTPUT=$(./gradlew test 2>&1)
  if [ $? -ne 0 ]; then
    echo "Kotlin tests failed:" >&2
    echo "$GRADLE_OUTPUT" >&2
    exit 2
  fi
fi

# PR artifact check
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [[ "$BRANCH" == feat/* ]] || [[ "$BRANCH" == fix/* ]]; then
  ISSUE_LINKED=$(git log origin/main..HEAD --format="%s %b" 2>/dev/null | grep -cE "#[0-9]+")
  if [ "$ISSUE_LINKED" -eq 0 ]; then
    echo "No GitHub issue linked in commit history. Add before finishing." >&2
    exit 2
  fi
fi

# SUCCESS: completely silent
