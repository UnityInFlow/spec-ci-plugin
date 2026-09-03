#!/bin/bash
# PreToolUse hook for the Bash tool.
#
# Claude Code sends the pending tool call as JSON on stdin; there is no
# CLAUDE_TOOL_INPUT_COMMAND variable. Exit 2 blocks the call and shows stderr
# to Claude. Exit 1 is a non-blocking error: the command runs anyway, which is
# what every check below used to return.
COMMAND=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input", {}).get("command", ""))' 2>/dev/null)
[ -n "$COMMAND" ] || exit 0

# Block force-push
if echo "$COMMAND" | grep -qE "git push --force|git push -f"; then
  echo "ERROR: Force push is not allowed. Use --force-with-lease and confirm with user." >&2
  exit 2
fi

# Block rm -rf on important directories
if echo "$COMMAND" | grep -qE "rm -rf /|rm -rf ~|rm -rf \."; then
  echo "ERROR: Recursive delete on root/home/cwd is not allowed." >&2
  exit 2
fi

# Block npm publish without confirmation
if echo "$COMMAND" | grep -q "npm publish" && ! echo "$COMMAND" | grep -q "\-\-dry-run"; then
  echo "ERROR: npm publish requires explicit user confirmation." >&2
  exit 2
fi

# Block Gradle publish without confirmation
if echo "$COMMAND" | grep -qE "publishPlugins|publishToMavenLocal" && ! echo "$COMMAND" | grep -q "\-\-dry-run"; then
  echo "ERROR: Gradle publish requires explicit user confirmation." >&2
  exit 2
fi

exit 0
