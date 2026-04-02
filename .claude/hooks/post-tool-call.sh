#!/bin/bash
cd "$CLAUDE_PROJECT_DIR" || exit 0

# Hybrid project: TypeScript (GitHub Action) + Kotlin (Gradle plugin)
# Check which part changed and lint accordingly

if [ -f "package.json" ]; then
  OUTPUT=$(npm run lint 2>&1)
  if [ $? -ne 0 ]; then
    echo "TypeScript errors:" >&2
    echo "$OUTPUT" >&2
    exit 2
  fi
fi

if [ -f "build.gradle.kts" ]; then
  OUTPUT=$(./gradlew ktlintCheck 2>&1)
  if [ $? -ne 0 ]; then
    echo "Kotlin lint errors:" >&2
    echo "$OUTPUT" >&2
    exit 2
  fi
fi

# SUCCESS: completely silent
