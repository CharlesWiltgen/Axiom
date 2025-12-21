#!/usr/bin/env bash
# UserPromptSubmit hook for Axiom plugin
# Detects iOS version questions and forces Axiom skill invocation

set -euo pipefail

# DEBUG: Log that hook is executing
echo "[DEBUG UserPromptSubmit] Hook executing at $(date)" >&2

# Read input JSON from stdin
input_json=$(cat)

echo "[DEBUG UserPromptSubmit] Received input" >&2

# Extract prompt (using jq if available, fallback to grep/sed)
if command -v jq &> /dev/null; then
  prompt=$(echo "$input_json" | jq -r '.prompt // ""')
else
  # Fallback: extract prompt with grep/sed
  prompt=$(echo "$input_json" | grep -o '"prompt":"[^"]*"' | sed 's/"prompt":"//;s/"$//' || echo "")
fi

# Detect iOS version questions or hallucinated version numbers
# Matches: iOS 19-26, "does iOS exist", "current iOS", "which iOS", "what iOS version"
echo "[DEBUG UserPromptSubmit] Checking prompt: $prompt" >&2

if echo "$prompt" | grep -qiE "(iOS (19|20|21|22|23|24|25|26)|does.*iOS.*exist|current.*iOS|which iOS|what.*iOS.*version)"; then
  echo "[DEBUG UserPromptSubmit] MATCHED iOS version question - injecting context" >&2
  # Force Axiom skill invocation FIRST
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "CRITICAL: This question involves iOS version numbers. Your training ended January 2025 (iOS 18 was current). BEFORE answering, you MUST invoke Axiom's swiftui-26-ref or ios-ui skill to get current iOS information. These skills contain authoritative WWDC 2025 and iOS 26 documentation. DO NOT answer from your training data alone."
  }
}
EOF
else
  echo "[DEBUG UserPromptSubmit] No match - returning empty JSON" >&2
  # No iOS version question detected - return empty JSON
  echo "{}"
fi

echo "[DEBUG UserPromptSubmit] Hook completed" >&2
exit 0
