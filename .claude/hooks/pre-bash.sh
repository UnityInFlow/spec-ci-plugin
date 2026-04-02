#!/bin/bash
COMMAND="$CLAUDE_TOOL_INPUT_COMMAND"

# Block force-push
if echo "$COMMAND" | grep -qE "git push --force|git push -f"; then
  echo "ERROR: Force push is not allowed. Use --force-with-lease and confirm with user." >&2
  exit 1
fi

# Block rm -rf on important directories
if echo "$COMMAND" | grep -qE "rm -rf /|rm -rf ~|rm -rf \."; then
  echo "ERROR: Recursive delete on root/home/cwd is not allowed." >&2
  exit 1
fi

# Block npm publish without confirmation
if echo "$COMMAND" | grep -q "npm publish" && ! echo "$COMMAND" | grep -q "\-\-dry-run"; then
  echo "ERROR: npm publish requires explicit user confirmation." >&2
  exit 1
fi

# Block Gradle publish without confirmation
if echo "$COMMAND" | grep -qE "publishPlugins|publishToMavenLocal" && ! echo "$COMMAND" | grep -q "\-\-dry-run"; then
  echo "ERROR: Gradle publish requires explicit user confirmation." >&2
  exit 1
fi
